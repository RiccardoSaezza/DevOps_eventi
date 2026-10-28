import { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  MapPin,
  RotateCcw,
  Ticket,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { BookingStatusBadge, EventTypeBadge } from '../components/Badges';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/Modal';
import { PageLoader } from '../components/ProtectedRoute';
import { useToast } from '../components/ToastProvider';
import type { Booking } from '../types';
import {
  formatDateLong,
  formatDay,
  formatMonth,
  formatTime,
  isPast,
} from '../utils/date';

function BookingCard({
  booking,
  onCancel,
}: {
  booking: Booking;
  onCancel: (booking: Booking) => void;
}) {
  const event = booking.event;
  if (!event) return null;

  const past = isPast(event.startsAt);
  const active = booking.status === 'CONFERMATA' && !past && event.status === 'PUBBLICATO';
  const cancelledEvent = event.status === 'ANNULLATO';

  return (
    <article className={`booking-row ${active ? '' : 'booking-row--muted'}`}>
      <div className="booking-row__date">
        <span>{formatMonth(event.startsAt)}</span>
        <strong>{formatDay(event.startsAt)}</strong>
        <small>{formatTime(event.startsAt)}</small>
      </div>

      <div className="booking-row__main">
        <div className="booking-row__badges">
          <EventTypeBadge type={event.type} />
          <BookingStatusBadge status={booking.status} />
          {cancelledEvent && <span className="badge badge--cancelled">Evento annullato</span>}
          {past && booking.status === 'CONFERMATA' && !cancelledEvent && (
            <span className="badge badge--muted">Concluso</span>
          )}
        </div>
        <h3>
          <Link to={`/events/${event.id}`}>{event.title}</Link>
        </h3>
        <p className="booking-row__meta">
          <MapPin size={15} aria-hidden="true" /> {event.location}
        </p>
        <p className="booking-row__meta">
          <CalendarDays size={15} aria-hidden="true" /> {formatDateLong(event.startsAt)} · ore{' '}
          {formatTime(event.startsAt)}
        </p>
      </div>

      <div className="booking-row__side">
        <span className={`seat-pill ${booking.seatNumber ? '' : 'seat-pill--free'}`}>
          {booking.seatNumber ? `Posto ${booking.seatNumber}` : 'Ingresso libero'}
        </span>
        <div className="booking-row__actions">
          <Link to={`/events/${event.id}`} className="btn btn--ghost btn--sm">
            Dettaglio <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          {active && (
            <button
              type="button"
              className="btn btn--danger-ghost btn--sm"
              onClick={() => onCancel(booking)}
            >
              <XCircle size={15} aria-hidden="true" /> Annulla
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function MyBookingsPage() {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.bookings.mine();
      setBookings(result.bookings);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Non riusciamo a caricare le tue prenotazioni.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmCancel() {
    if (!selected) return;
    setCancelling(true);
    try {
      const { booking } = await api.bookings.cancel(selected.id);
      setBookings((current) =>
        current.map((item) => (item.id === booking.id ? { ...item, ...booking } : item)),
      );
      showToast('Prenotazione annullata. Il posto è tornato disponibile.');
      setSelected(null);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Annullamento non riuscito.',
        'error',
      );
    } finally {
      setCancelling(false);
    }
  }

  const upcoming = bookings.filter(
    (booking) =>
      booking.status === 'CONFERMATA' &&
      booking.event &&
      !isPast(booking.event.startsAt) &&
      booking.event.status === 'PUBBLICATO',
  );
  const pastAndCancelled = bookings.filter((booking) => !upcoming.includes(booking));

  if (loading) return <PageLoader label="Carico i tuoi posti…" />;

  return (
    <div className="container page-section">
      <header className="page-head">
        <div>
          <p className="eyebrow">Area personale</p>
          <h1>I miei posti</h1>
          <p className="page-head__lead">
            Tutte le tue prenotazioni, con posto assegnato e stato aggiornato.
          </p>
        </div>
        <Link to="/" className="btn btn--ghost">
          <RotateCcw size={16} aria-hidden="true" /> Cerca altri eventi
        </Link>
      </header>

      {error ? (
        <div className="alert alert--error" role="alert">
          <div>
            <strong>Qualcosa non ha funzionato.</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void load()}>
            Riprova
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<Ticket size={30} />}
          title="Il tuo prossimo posto ti aspetta"
          description="Non hai ancora prenotazioni. Sfoglia il programma e scegli la serata giusta."
          action={
            <Link to="/" className="btn btn--primary">
              Scopri gli eventi
            </Link>
          }
        />
      ) : (
        <>
          <section className="bookings-section">
            <h2>
              In arrivo <span>{upcoming.length}</span>
            </h2>
            {upcoming.length === 0 ? (
              <p className="muted-copy">
                Nessun evento in arrivo.{' '}
                <Link to="/">Dai un’occhiata al programma</Link>.
              </p>
            ) : (
              <div className="booking-list">
                {upcoming.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} onCancel={setSelected} />
                ))}
              </div>
            )}
          </section>

          {pastAndCancelled.length > 0 && (
            <section className="bookings-section">
              <h2>
                Passati e annullati <span>{pastAndCancelled.length}</span>
              </h2>
              <div className="booking-list">
                {pastAndCancelled.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} onCancel={setSelected} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(selected)}
        title="Annullare la prenotazione?"
        description={
          selected?.event
            ? `Il posto per “${selected.event.title}” tornerà disponibile per altre persone. L’operazione non può essere annullata.`
            : 'Il posto tornerà disponibile per altre persone.'
        }
        confirmLabel="Annulla prenotazione"
        cancelLabel="Mantieni il posto"
        danger
        busy={cancelling}
        onConfirm={() => void confirmCancel()}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
