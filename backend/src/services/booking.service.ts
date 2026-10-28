import { pool } from '../db/pool.js';
import type {
  AuthUser,
  BookingDto,
  BookingStatus,
  EventStatus,
  EventType,
} from '../types/domain.js';
import { HttpError, notFound } from '../utils/http-error.js';

interface EventLockRow {
  id: string;
  type: EventType;
  capacity: number;
  status: EventStatus;
  starts_at: Date;
}

interface BookingRow {
  id: string;
  event_id: string;
  user_id: string;
  status: BookingStatus;
  seat_number: number | null;
  created_at: Date;
  cancelled_at: Date | null;
}

interface MyBookingRow extends BookingRow {
  event_title: string;
  event_type: EventType;
  event_starts_at: Date;
  event_location: string;
  event_status: EventStatus;
}

function mapBooking(row: BookingRow): BookingDto {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    status: row.status,
    seatNumber: row.seat_number,
    createdAt: row.created_at.toISOString(),
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
  };
}

export async function createBooking(
  userId: string,
  eventId: string,
): Promise<BookingDto> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventResult = await client.query<EventLockRow>(
      `SELECT id, type::text AS type, capacity, status::text AS status, starts_at
       FROM events WHERE id = $1 FOR UPDATE`,
      [eventId],
    );
    const event = eventResult.rows[0];
    if (!event) throw notFound('Evento non trovato.');
    if (event.status === 'ANNULLATO') {
      throw new HttpError(
        409,
        'EVENT_CANCELLED',
        'Questo evento è stato annullato.',
      );
    }
    if (event.starts_at.getTime() <= Date.now()) {
      throw new HttpError(
        409,
        'EVENT_STARTED',
        'Le prenotazioni per questo evento sono chiuse.',
      );
    }

    const existing = await client.query(
      `SELECT 1 FROM bookings
       WHERE event_id = $1 AND user_id = $2 AND status = 'CONFERMATA'`,
      [eventId, userId],
    );
    if (existing.rowCount) {
      throw new HttpError(
        409,
        'ALREADY_BOOKED',
        'Hai già una prenotazione attiva per questo evento.',
      );
    }

    const bookedResult = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM bookings
       WHERE event_id = $1 AND status = 'CONFERMATA'`,
      [eventId],
    );
    const booked = bookedResult.rows[0]?.count ?? 0;
    if (booked >= event.capacity) {
      throw new HttpError(409, 'SOLD_OUT', 'Evento esaurito.');
    }

    let seatNumber: number | null = null;
    if (event.type === 'CONCERTO') {
      const seat = await client.query<{ seat: number }>(
        `SELECT s AS seat
         FROM generate_series(1, $2) AS s
         WHERE NOT EXISTS (
           SELECT 1 FROM bookings b
           WHERE b.event_id = $1 AND b.seat_number = s AND b.status = 'CONFERMATA'
         )
         ORDER BY s
         LIMIT 1`,
        [eventId, event.capacity],
      );
      seatNumber = seat.rows[0]?.seat ?? null;
      if (seatNumber === null) {
        throw new HttpError(409, 'SOLD_OUT', 'Evento esaurito.');
      }
    }

    const inserted = await client.query<BookingRow>(
      `INSERT INTO bookings (event_id, user_id, seat_number)
       VALUES ($1, $2, $3)
       RETURNING id, event_id, user_id, status::text AS status, seat_number,
                 created_at, cancelled_at`,
      [eventId, userId, seatNumber],
    );

    const booking = inserted.rows[0];
    if (!booking) throw new Error('Creazione prenotazione fallita');

    await client.query('COMMIT');
    return mapBooking(booking);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelBooking(
  user: AuthUser,
  bookingId: string,
): Promise<BookingDto> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<
      BookingRow & { event_starts_at: Date; event_created_by: string }
    >(
      `SELECT b.id, b.event_id, b.user_id, b.status::text AS status,
              b.seat_number, b.created_at, b.cancelled_at,
              e.starts_at AS event_starts_at, e.created_by AS event_created_by
       FROM bookings b
       JOIN events e ON e.id = b.event_id
       WHERE b.id = $1
       FOR UPDATE OF b`,
      [bookingId],
    );

    const booking = rows[0];
    if (!booking) throw notFound('Prenotazione non trovata.');

    const isOwner = booking.user_id === user.id;
    const isEventOrganizer =
      user.role === 'ORGANIZZATORE' && booking.event_created_by === user.id;
    if (!isOwner && !isEventOrganizer) {
      throw new HttpError(
        403,
        'FORBIDDEN',
        'Non puoi annullare questa prenotazione.',
      );
    }
    if (booking.status === 'ANNULLATA') {
      throw new HttpError(
        409,
        'ALREADY_CANCELLED',
        'Questa prenotazione è già stata annullata.',
      );
    }
    if (booking.event_starts_at.getTime() <= Date.now()) {
      throw new HttpError(
        409,
        'EVENT_STARTED',
        'Non è più possibile annullare la prenotazione.',
      );
    }

    const updated = await client.query<BookingRow>(
      `UPDATE bookings
       SET status = 'ANNULLATA', cancelled_at = now()
       WHERE id = $1
       RETURNING id, event_id, user_id, status::text AS status, seat_number,
                 created_at, cancelled_at`,
      [bookingId],
    );
    const cancelled = updated.rows[0];
    if (!cancelled) throw new Error('Annullamento prenotazione fallito');

    await client.query('COMMIT');
    return mapBooking(cancelled);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listMyBookings(userId: string): Promise<BookingDto[]> {
  const { rows } = await pool.query<MyBookingRow>(
    `SELECT b.id, b.event_id, b.user_id, b.status::text AS status,
            b.seat_number, b.created_at, b.cancelled_at,
            e.title AS event_title, e.type::text AS event_type,
            e.starts_at AS event_starts_at, e.location AS event_location,
            e.status::text AS event_status
     FROM bookings b
     JOIN events e ON e.id = b.event_id
     WHERE b.user_id = $1
     ORDER BY (e.starts_at >= now()) DESC, e.starts_at ASC`,
    [userId],
  );

  return rows.map((row) => ({
    ...mapBooking(row),
    event: {
      id: row.event_id,
      title: row.event_title,
      type: row.event_type,
      startsAt: row.event_starts_at.toISOString(),
      location: row.event_location,
      status: row.event_status,
    },
  }));
}
