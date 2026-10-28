import { Router } from 'express';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { cancelBooking, listMyBookings } from '../services/booking.service.js';
import { notFound } from '../utils/http-error.js';

export const bookingsRouter = Router();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

bookingsRouter.get('/me', requireAuth, async (req, res) => {
  const bookings = await listMyBookings(currentUser(req).id);
  res.status(200).json({ bookings });
});

bookingsRouter.delete('/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    throw notFound('Prenotazione non trovata.');
  }
  const booking = await cancelBooking(currentUser(req), id);
  res.status(200).json({ booking });
});
