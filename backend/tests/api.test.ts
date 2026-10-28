import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { migrate } from '../src/db/migrate.js';
import { pool } from '../src/db/pool.js';

const app = createApp();

interface Account {
  token: string;
  userId: string;
}

async function register(
  email: string,
  password = 'Password123!',
  role: 'PARTECIPANTE' | 'ORGANIZZATORE' = 'PARTECIPANTE',
): Promise<Account> {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      name: role === 'ORGANIZZATORE' ? 'Marco Test' : 'Giulia Test',
      email,
      password,
      ...(role === 'ORGANIZZATORE' ? { organizerCode: 'TESTCODE' } : {}),
    })
    .expect(201);

  return {
    token: response.body.token as string,
    userId: response.body.user.id as string,
  };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function futureIso(days = 15): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(21, 0, 0, 0);
  return date.toISOString();
}

async function createEvent(
  organizerToken: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await request(app)
    .post('/api/events')
    .set(auth(organizerToken))
    .send({
      title: 'Notturno Elettrico',
      description: 'Live set di synth e percussioni.',
      type: 'CONCERTO',
      startsAt: futureIso(),
      location: 'Ex Macello, Bologna',
      capacity: 3,
      ...overrides,
    })
    .expect(201);
  return response.body.event as Record<string, unknown>;
}

beforeAll(async () => {
  await migrate();
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE bookings, events, users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe('health', () => {
  it('risponde con lo stato del database', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
  });
});

describe('autenticazione', () => {
  it('registra un partecipante e restituisce un JWT', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Giulia Rossi',
        email: 'GIULIA@example.com',
        password: 'Password123!',
      })
      .expect(201);

    expect(response.body.user).toMatchObject({
      name: 'Giulia Rossi',
      email: 'giulia@example.com',
      role: 'PARTECIPANTE',
    });
    expect(response.body.token).toEqual(expect.any(String));

    const me = await request(app)
      .get('/api/auth/me')
      .set(auth(response.body.token))
      .expect(200);
    expect(me.body.user.email).toBe('giulia@example.com');
  });

  it('rifiuta email duplicate e dati non validi', async () => {
    await register('doppia@example.com');

    const duplicate = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Altro Nome',
        email: 'doppia@example.com',
        password: 'Password123!',
      })
      .expect(409);
    expect(duplicate.body.error.code).toBe('EMAIL_IN_USE');

    const invalid = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'non-una-email', password: 'corta' })
      .expect(422);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalid.body.error.details.length).toBeGreaterThan(0);
  });

  it('crea un organizzatore solo con il codice corretto', async () => {
    const wrong = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Fake Org',
        email: 'fake@example.com',
        password: 'Password123!',
        organizerCode: 'SBAGLIATO',
      })
      .expect(403);
    expect(wrong.body.error.code).toBe('INVALID_INVITE_CODE');

    const organizer = await register('org@example.com', 'Password123!', 'ORGANIZZATORE');
    const me = await request(app)
      .get('/api/auth/me')
      .set(auth(organizer.token))
      .expect(200);
    expect(me.body.user.role).toBe('ORGANIZZATORE');
  });

  it('nega il login con password errata e le rotte protette senza token', async () => {
    await register('giulia@example.com');

    const badLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'giulia@example.com', password: 'Sbagliata123!' })
      .expect(401);
    expect(badLogin.body.error.code).toBe('INVALID_CREDENTIALS');

    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/bookings/me').expect(401);
  });
});

describe('eventi', () => {
  it('impedisce ai partecipanti di creare eventi', async () => {
    const participant = await register('p@example.com');
    const response = await request(app)
      .post('/api/events')
      .set(auth(participant.token))
      .send({
        title: 'Evento non autorizzato',
        type: 'DJ_SET',
        startsAt: futureIso(),
        location: 'Bologna',
        capacity: 10,
      })
      .expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('crea, elenca e filtra gli eventi pubblicati', async () => {
    const organizer = await register('org@example.com', 'Password123!', 'ORGANIZZATORE');
    const concert = await createEvent(organizer.token);
    await createEvent(organizer.token, {
      title: 'Workshop di arrangiamento',
      type: 'WORKSHOP',
      capacity: 10,
    });

    const all = await request(app).get('/api/events').expect(200);
    expect(all.body.events).toHaveLength(2);
    expect(all.body.meta.total).toBe(2);
    expect(all.body.events[0]).toMatchObject({
      title: 'Notturno Elettrico',
      availableSeats: 3,
      bookedCount: 0,
    });

    const filtered = await request(app).get('/api/events?type=WORKSHOP').expect(200);
    expect(filtered.body.events).toHaveLength(1);
    expect(filtered.body.events[0].title).toBe('Workshop di arrangiamento');

    const search = await request(app).get('/api/events?q=macello').expect(200);
    expect(search.body.events).toHaveLength(2);

    const detail = await request(app).get(`/api/events/${concert.id}`).expect(200);
    expect(detail.body.event.title).toBe('Notturno Elettrico');
  });

  it('valida i campi e impedisce di ridurre la capienza sotto le prenotazioni', async () => {
    const organizer = await register('org@example.com', 'Password123!', 'ORGANIZZATORE');
    const event = await createEvent(organizer.token, { capacity: 3 });
    const giulia = await register('giulia@example.com');
    const luca = await register('luca@example.com');

    await request(app)
      .post(`/api/events/${event.id}/bookings`)
      .set(auth(giulia.token))
      .expect(201);
    await request(app)
      .post(`/api/events/${event.id}/bookings`)
      .set(auth(luca.token))
      .expect(201);

    const invalid = await request(app)
      .post('/api/events')
      .set(auth(organizer.token))
      .send({
        title: 'X',
        type: 'ALTRO',
        startsAt: 'non-una-data',
        location: '',
        capacity: 0,
      })
      .expect(422);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const tooSmall = await request(app)
      .put(`/api/events/${event.id}`)
      .set(auth(organizer.token))
      .send({ capacity: 1 })
      .expect(409);
    expect(tooSmall.body.error.code).toBe('CAPACITY_TOO_LOW');

    const lower = await request(app)
      .put(`/api/events/${event.id}`)
      .set(auth(organizer.token))
      .send({ capacity: 2, title: 'Titolo aggiornato' })
      .expect(200);
    expect(lower.body.event.capacity).toBe(2);
    expect(lower.body.event.title).toBe('Titolo aggiornato');
  });

  it('protegge modifica e annullamento da organizzatori non proprietari', async () => {
    const owner = await register('owner@example.com', 'Password123!', 'ORGANIZZATORE');
    const other = await register('other@example.com', 'Password123!', 'ORGANIZZATORE');
    const event = await createEvent(owner.token);

    await request(app)
      .put(`/api/events/${event.id}`)
      .set(auth(other.token))
      .send({ title: 'Tentativo di modifica' })
      .expect(403);
    await request(app)
      .post(`/api/events/${event.id}/cancel`)
      .set(auth(other.token))
      .expect(403);
  });
});

describe('prenotazioni', () => {
  it('assegna posti numerati, rifiuta duplicati e gestisce il sold out', async () => {
    const organizer = await register('org@example.com', 'Password123!', 'ORGANIZZATORE');
    const giulia = await register('giulia@example.com');
    const luca = await register('luca@example.com');
    const event = await createEvent(organizer.token, { capacity: 2 });

    const first = await request(app)
      .post(`/api/events/${event.id}/bookings`)
      .set(auth(giulia.token))
      .expect(201);
    expect(first.body.booking).toMatchObject({
      status: 'CONFERMATA',
      seatNumber: 1,
    });

    const duplicate = await request(app)
      .post(`/api/events/${event.id}/bookings`)
      .set(auth(giulia.token))
      .expect(409);
    expect(duplicate.body.error.code).toBe('ALREADY_BOOKED');

    const second = await request(app)
      .post(`/api/events/${event.id}/bookings`)
      .set(auth(luca.token))
      .expect(201);
    expect(second.body.booking.seatNumber).toBe(2);

    const soldOut = await request(app)
      .post(`/api/events/${event.id}/bookings`)
      .set(auth((await register('sara@example.com')).token))
      .expect(409);
    expect(soldOut.body.error.code).toBe('SOLD_OUT');

    const detail = await request(app).get(`/api/events/${event.id}`).expect(200);
    expect(detail.body.event.availableSeats).toBe(0);
  });

  it('non assegna posti numerati a workshop e DJ set', async () => {
    const organizer = await register('org@example.com', 'Password123!', 'ORGANIZZATORE');
    const user = await register('u@example.com');
    const workshop = await createEvent(organizer.token, {
      title: 'Workshop Test',
      type: 'WORKSHOP',
    });
    const djSet = await createEvent(organizer.token, {
      title: 'DJ Set Test',
      type: 'DJ_SET',
    });

    const workshopBooking = await request(app)
      .post(`/api/events/${workshop.id}/bookings`)
      .set(auth(user.token))
      .expect(201);
    expect(workshopBooking.body.booking.seatNumber).toBeNull();

    const djBooking = await request(app)
      .post(`/api/events/${djSet.id}/bookings`)
      .set(auth(user.token))
      .expect(201);
    expect(djBooking.body.booking.seatNumber).toBeNull();
  });

  it('previene l’overbooking con richieste concorrenti', async () => {
    const organizer = await register('org@example.com', 'Password123!', 'ORGANIZZATORE');
    const event = await createEvent(organizer.token, { capacity: 1 });
    const users = await Promise.all([
      register('a@example.com'),
      register('b@example.com'),
      register('c@example.com'),
    ]);

    const responses = await Promise.all(
      users.map((user) =>
        request(app)
          .post(`/api/events/${event.id}/bookings`)
          .set(auth(user.token)),
      ),
    );

    const created = responses.filter((response) => response.status === 201);
    const conflicts = responses.filter((response) => response.status === 409);
    expect(created).toHaveLength(1);
    expect(conflicts).toHaveLength(2);

    const detail = await request(app).get(`/api/events/${event.id}`).expect(200);
    expect(detail.body.event.bookedCount).toBe(1);
  });

  it('annulla una prenotazione e libera il posto numerato', async () => {
    const organizer = await register('org@example.com', 'Password123!', 'ORGANIZZATORE');
    const giulia = await register('giulia@example.com');
    const luca = await register('luca@example.com');
    const event = await createEvent(organizer.token, { capacity: 1 });

    const booking = await request(app)
      .post(`/api/events/${event.id}/bookings`)
      .set(auth(giulia.token))
      .expect(201);

    const mine = await request(app)
      .get('/api/bookings/me')
      .set(auth(giulia.token))
      .expect(200);
    expect(mine.body.bookings).toHaveLength(1);
    expect(mine.body.bookings[0].event.title).toBe('Notturno Elettrico');

    const cancelled = await request(app)
      .delete(`/api/bookings/${booking.body.booking.id}`)
      .set(auth(giulia.token))
      .expect(200);
    expect(cancelled.body.booking.status).toBe('ANNULLATA');

    const second = await request(app)
      .post(`/api/events/${event.id}/bookings`)
      .set(auth(luca.token))
      .expect(201);
    expect(second.body.booking.seatNumber).toBe(1);
  });

  it('impedisce di annullare la prenotazione di un altro utente', async () => {
    const organizer = await register('org@example.com', 'Password123!', 'ORGANIZZATORE');
    const giulia = await register('giulia@example.com');
    const luca = await register('luca@example.com');
    const event = await createEvent(organizer.token);

    const booking = await request(app)
      .post(`/api/events/${event.id}/bookings`)
      .set(auth(giulia.token))
      .expect(201);

    await request(app)
      .delete(`/api/bookings/${booking.body.booking.id}`)
      .set(auth(luca.token))
      .expect(403);
  });
});

describe('annullamento evento', () => {
  it('chiude le prenotazioni attive e nasconde l’evento dalla lista pubblica', async () => {
    const organizer = await register('org@example.com', 'Password123!', 'ORGANIZZATORE');
    const giulia = await register('giulia@example.com');
    const event = await createEvent(organizer.token);

    await request(app)
      .post(`/api/events/${event.id}/bookings`)
      .set(auth(giulia.token))
      .expect(201);

    const cancelled = await request(app)
      .post(`/api/events/${event.id}/cancel`)
      .set(auth(organizer.token))
      .expect(200);
    expect(cancelled.body.cancelledBookings).toBe(1);
    expect(cancelled.body.event.status).toBe('ANNULLATO');

    const list = await request(app).get('/api/events').expect(200);
    expect(list.body.events).toHaveLength(0);

    const mine = await request(app)
      .get('/api/bookings/me')
      .set(auth(giulia.token))
      .expect(200);
    expect(mine.body.bookings[0].status).toBe('ANNULLATA');
    expect(mine.body.bookings[0].event.status).toBe('ANNULLATO');

    const attempt = await request(app)
      .post(`/api/events/${event.id}/bookings`)
      .set(auth((await register('sara@example.com')).token))
      .expect(409);
    expect(attempt.body.error.code).toBe('EVENT_CANCELLED');
  });

  it('elenca le prenotazioni di un evento solo al proprietario', async () => {
    const organizer = await register('org@example.com', 'Password123!', 'ORGANIZZATORE');
    const other = await register('other@example.com', 'Password123!', 'ORGANIZZATORE');
    const giulia = await register('giulia@example.com');
    const event = await createEvent(organizer.token);

    await request(app)
      .post(`/api/events/${event.id}/bookings`)
      .set(auth(giulia.token))
      .expect(201);

    const list = await request(app)
      .get(`/api/events/${event.id}/bookings`)
      .set(auth(organizer.token))
      .expect(200);
    expect(list.body.bookings).toHaveLength(1);
    expect(list.body.bookings[0].participant.name).toBe('Giulia Test');

    await request(app)
      .get(`/api/events/${event.id}/bookings`)
      .set(auth(other.token))
      .expect(403);
  });
});
