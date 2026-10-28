-- Estensioni e tipi enumerati del dominio
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('PARTECIPANTE', 'ORGANIZZATORE');
CREATE TYPE event_type AS ENUM ('CONCERTO', 'WORKSHOP', 'DJ_SET');
CREATE TYPE event_status AS ENUM ('PUBBLICATO', 'ANNULLATO');
CREATE TYPE booking_status AS ENUM ('CONFERMATA', 'ANNULLATA');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'PARTECIPANTE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description TEXT NOT NULL DEFAULT '',
  type event_type NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  location TEXT NOT NULL CHECK (char_length(location) BETWEEN 2 AND 160),
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 10000),
  status event_status NOT NULL DEFAULT 'PUBBLICATO',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX events_starts_at_idx ON events (starts_at);
CREATE INDEX events_type_idx ON events (type);
CREATE INDEX events_created_by_idx ON events (created_by);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status booking_status NOT NULL DEFAULT 'CONFERMATA',
  seat_number INTEGER CHECK (seat_number IS NULL OR seat_number > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX bookings_event_idx ON bookings (event_id, status);
CREATE INDEX bookings_user_idx ON bookings (user_id, status);

-- Un partecipante può avere una sola prenotazione attiva per evento.
CREATE UNIQUE INDEX bookings_one_active_per_user
  ON bookings (event_id, user_id)
  WHERE status = 'CONFERMATA';

-- Un posto numerato può essere assegnato a una sola prenotazione attiva.
CREATE UNIQUE INDEX bookings_unique_seat
  ON bookings (event_id, seat_number)
  WHERE status = 'CONFERMATA' AND seat_number IS NOT NULL;
