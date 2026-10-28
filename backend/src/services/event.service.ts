import { pool } from '../db/pool.js';
import type {
  CreateEventInput,
  ListEventsQuery,
  UpdateEventInput,
} from '../schemas/event.schema.js';
import type {
  AuthUser,
  EventDto,
  EventStatus,
  EventType,
} from '../types/domain.js';
import { HttpError, notFound } from '../utils/http-error.js';

interface EventRow {
  id: string;
  title: string;
  description: string;
  type: EventType;
  starts_at: Date;
  location: string;
  capacity: number;
  status: EventStatus;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  organizer_name: string;
  booked_count: number;
  available_seats: number;
}

interface EventBaseRow {
  id: string;
  title: string;
  description: string;
  type: EventType;
  starts_at: Date;
  location: string;
  capacity: number;
  status: EventStatus;
  created_by: string;
}

interface EventBookingRow {
  id: string;
  seat_number: number | null;
  status: string;
  created_at: Date;
  participant_name: string;
  participant_email: string;
}

const EVENT_SELECT = `
  SELECT e.id, e.title, e.description, e.type::text AS type, e.starts_at,
         e.location, e.capacity, e.status::text AS status, e.created_by,
         e.created_at, e.updated_at, u.name AS organizer_name,
         COALESCE(COUNT(b.id) FILTER (WHERE b.status = 'CONFERMATA'), 0)::int AS booked_count,
         (e.capacity - COALESCE(COUNT(b.id) FILTER (WHERE b.status = 'CONFERMATA'), 0))::int AS available_seats
  FROM events e
  JOIN users u ON u.id = e.created_by
  LEFT JOIN bookings b ON b.event_id = e.id
`;

function mapEvent(row: EventRow): EventDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    startsAt: row.starts_at.toISOString(),
    location: row.location,
    capacity: row.capacity,
    status: row.status,
    createdBy: row.created_by,
    organizerName: row.organizer_name,
    bookedCount: row.booked_count,
    availableSeats: row.available_seats,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface EventListResult {
  events: EventDto[];
  meta: { page: number; limit: number; total: number };
}

export async function listEvents(
  filters: ListEventsQuery,
): Promise<EventListResult> {
  const conditions = ["e.status = 'PUBBLICATO'"];
  const params: unknown[] = [];

  if (filters.type) {
    params.push(filters.type);
    conditions.push(`e.type = $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    conditions.push(
      `(e.title ILIKE $${params.length} OR e.location ILIKE $${params.length} OR e.description ILIKE $${params.length})`,
    );
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`e.starts_at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    conditions.push(`e.starts_at <= $${params.length}`);
  }
  if (filters.period === 'upcoming') {
    conditions.push('e.starts_at >= now()');
  } else if (filters.period === 'past') {
    conditions.push('e.starts_at < now()');
  }

  const where = conditions.join(' AND ');
  const having = filters.available
    ? "HAVING e.capacity - COUNT(b.id) FILTER (WHERE b.status = 'CONFERMATA') > 0"
    : '';

  const countSql = `
    SELECT COUNT(*)::int AS total FROM (
      SELECT e.id
      FROM events e
      LEFT JOIN bookings b ON b.event_id = e.id
      WHERE ${where}
      GROUP BY e.id
      ${having}
    ) AS filtered
  `;
  const countResult = await pool.query<{ total: number }>(countSql, params);

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);
  const dataSql = `
    ${EVENT_SELECT}
    WHERE ${where}
    GROUP BY e.id, u.name
    ${having}
    ORDER BY e.starts_at ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const { rows } = await pool.query<EventRow>(dataSql, params);
  return {
    events: rows.map(mapEvent),
    meta: {
      page: filters.page,
      limit: filters.limit,
      total: countResult.rows[0]?.total ?? 0,
    },
  };
}

export async function listOrganizerEvents(
  organizerId: string,
): Promise<EventDto[]> {
  const { rows } = await pool.query<EventRow>(
    `${EVENT_SELECT}
     WHERE e.created_by = $1
     GROUP BY e.id, u.name
     ORDER BY (e.status = 'PUBBLICATO') DESC, e.starts_at DESC`,
    [organizerId],
  );
  return rows.map(mapEvent);
}

export async function getEventById(id: string): Promise<EventDto> {
  const { rows } = await pool.query<EventRow>(
    `${EVENT_SELECT} WHERE e.id = $1 GROUP BY e.id, u.name`,
    [id],
  );
  const event = rows[0];
  if (!event) throw notFound('Evento non trovato.');
  return mapEvent(event);
}

export async function createEvent(
  user: AuthUser,
  input: CreateEventInput,
): Promise<EventDto> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO events (title, description, type, starts_at, location, capacity, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.title,
      input.description,
      input.type,
      input.startsAt,
      input.location,
      input.capacity,
      user.id,
    ],
  );

  const created = rows[0];
  if (!created) throw new Error('Creazione evento fallita');
  return getEventById(created.id);
}

export async function updateEvent(
  user: AuthUser,
  id: string,
  input: UpdateEventInput,
): Promise<EventDto> {
  const { rows } = await pool.query<EventBaseRow>(
    `SELECT id, title, description, type::text AS type, starts_at, location,
            capacity, status::text AS status, created_by
     FROM events WHERE id = $1`,
    [id],
  );
  const existing = rows[0];
  if (!existing) throw notFound('Evento non trovato.');
  if (existing.created_by !== user.id) {
    throw new HttpError(
      403,
      'FORBIDDEN',
      'Puoi modificare solo gli eventi che hai creato.',
    );
  }
  if (existing.status === 'ANNULLATO') {
    throw new HttpError(
      409,
      'EVENT_CANCELLED',
      'Non puoi modificare un evento annullato.',
    );
  }

  const nextCapacity = input.capacity ?? existing.capacity;
  if (nextCapacity !== existing.capacity) {
    const active = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM bookings
       WHERE event_id = $1 AND status = 'CONFERMATA'`,
      [id],
    );
    const booked = active.rows[0]?.count ?? 0;
    if (nextCapacity < booked) {
      throw new HttpError(
        409,
        'CAPACITY_TOO_LOW',
        `La capienza non può essere inferiore ai ${booked} posti già prenotati.`,
      );
    }
  }

  await pool.query(
    `UPDATE events
     SET title = $2, description = $3, type = $4, starts_at = $5,
         location = $6, capacity = $7, updated_at = now()
     WHERE id = $1`,
    [
      id,
      input.title ?? existing.title,
      input.description ?? existing.description,
      input.type ?? existing.type,
      input.startsAt ?? existing.starts_at,
      input.location ?? existing.location,
      nextCapacity,
    ],
  );

  return getEventById(id);
}

export async function cancelEvent(
  user: AuthUser,
  id: string,
): Promise<{ event: EventDto; cancelledBookings: number }> {
  const client = await pool.connect();
  let cancelledBookings = 0;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ created_by: string; status: EventStatus }>(
      'SELECT created_by, status::text AS status FROM events WHERE id = $1 FOR UPDATE',
      [id],
    );
    const event = rows[0];
    if (!event) throw notFound('Evento non trovato.');
    if (event.created_by !== user.id) {
      throw new HttpError(
        403,
        'FORBIDDEN',
        'Puoi annullare solo gli eventi che hai creato.',
      );
    }
    if (event.status === 'ANNULLATO') {
      throw new HttpError(
        409,
        'ALREADY_CANCELLED',
        'Questo evento è già stato annullato.',
      );
    }

    await client.query(
      "UPDATE events SET status = 'ANNULLATO', updated_at = now() WHERE id = $1",
      [id],
    );
    const update = await client.query(
      `UPDATE bookings
       SET status = 'ANNULLATA', cancelled_at = now()
       WHERE event_id = $1 AND status = 'CONFERMATA'`,
      [id],
    );
    cancelledBookings = update.rowCount ?? 0;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return { event: await getEventById(id), cancelledBookings };
}

export async function listEventBookings(
  user: AuthUser,
  eventId: string,
): Promise<
  Array<{
    id: string;
    seatNumber: number | null;
    status: string;
    createdAt: string;
    participant: { name: string; email: string };
  }>
> {
  const owner = await pool.query<{ created_by: string }>(
    'SELECT created_by FROM events WHERE id = $1',
    [eventId],
  );
  if (!owner.rowCount) throw notFound('Evento non trovato.');
  if (owner.rows[0]?.created_by !== user.id) {
    throw new HttpError(
      403,
      'FORBIDDEN',
      'Puoi consultare le prenotazioni solo dei tuoi eventi.',
    );
  }

  const { rows } = await pool.query<EventBookingRow>(
    `SELECT b.id, b.seat_number, b.status::text AS status, b.created_at,
            u.name AS participant_name, u.email AS participant_email
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     WHERE b.event_id = $1
     ORDER BY b.created_at ASC`,
    [eventId],
  );

  return rows.map((row) => ({
    id: row.id,
    seatNumber: row.seat_number,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    participant: { name: row.participant_name, email: row.participant_email },
  }));
}
