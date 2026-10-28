import { Router } from 'express';
import { currentUser, requireAuth, requireRole } from '../middleware/auth.js';
import {
  createEventSchema,
  listEventsQuerySchema,
  updateEventSchema,
} from '../schemas/event.schema.js';
import { createBooking } from '../services/booking.service.js';
import {
  cancelEvent,
  createEvent,
  getEventById,
  listEventBookings,
  listEvents,
  listOrganizerEvents,
  updateEvent,
} from '../services/event.service.js';
import { notFound } from '../utils/http-error.js';
import { parseBody } from '../utils/validate.js';

export const eventsRouter = Router();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function eventId(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw notFound('Evento non trovato.');
  }
  return value;
}

eventsRouter.get('/', async (req, res) => {
  const filters = parseBody(listEventsQuerySchema, req.query);
  const result = await listEvents(filters);
  res.status(200).json(result);
});

eventsRouter.get('/mine', requireAuth, requireRole('ORGANIZZATORE'), async (req, res) => {
  const events = await listOrganizerEvents(currentUser(req).id);
  res.status(200).json({ events });
});

eventsRouter.get('/:id', async (req, res) => {
  const event = await getEventById(eventId(req.params.id));
  res.status(200).json({ event });
});

eventsRouter.post('/', requireAuth, requireRole('ORGANIZZATORE'), async (req, res) => {
  const input = parseBody(createEventSchema, req.body);
  const event = await createEvent(currentUser(req), input);
  res.status(201).json({ event });
});

eventsRouter.put(
  '/:id',
  requireAuth,
  requireRole('ORGANIZZATORE'),
  async (req, res) => {
    const id = eventId(req.params.id);
    const input = parseBody(updateEventSchema, req.body);
    const event = await updateEvent(currentUser(req), id, input);
    res.status(200).json({ event });
  },
);

eventsRouter.post(
  '/:id/cancel',
  requireAuth,
  requireRole('ORGANIZZATORE'),
  async (req, res) => {
    const result = await cancelEvent(currentUser(req), eventId(req.params.id));
    res.status(200).json(result);
  },
);

eventsRouter.get(
  '/:id/bookings',
  requireAuth,
  requireRole('ORGANIZZATORE'),
  async (req, res) => {
    const bookings = await listEventBookings(
      currentUser(req),
      eventId(req.params.id),
    );
    res.status(200).json({ bookings });
  },
);

eventsRouter.post('/:id/bookings', requireAuth, async (req, res) => {
  const booking = await createBooking(
    currentUser(req).id,
    eventId(req.params.id),
  );
  res.status(201).json({ booking });
});
