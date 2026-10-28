import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Armchair,
  CalendarDays,
  CheckCircle2,
  Info,
  MapPin,
  Ticket,
  UserRound,
  Users,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AvailabilityBar } from '../components/EventCard';
import { EventTypeBadge } from '../components/Badges';
import { useToast } from '../components/ToastProvider';
import type { Booking, Event } from '../types';
import {
  EVENT_TYPE_DESCRIPTION,
  formatDateTime,
  isPast,
  pluralizePosti,
} from '../utils/date';

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [event, setEvent] = useState<Event | null>(null);
  const [myBooking, setMyBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [{ event: nextEvent }, bookingsResult] = await Promise.all([
        api.events.get(id),
        user ? api.bookings.mine() : Promise.resolve({ bookings: [] as Booking[] }),
      ]);
      setEvent(nextEvent);
      setMyBooking(
        bookingsResult.bookings.find(
          (booking) =>
            booking.eventId === id && booking.status === 'CONFERMATA',
        ) ?? null,
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Non riusciamo a caricare questo evento.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    void load();
  }, [load]);

  async function handleBook() {
    if (!event) return;
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }

    setBookingBusy(true);
    try {
      const { booking } = await api.events.book(event.id);
      setMyBooking(booking);
      showToast(
        booking.seatNumber
          ? `Prenotazione confermata. Il tuo posto è il numero ${booking.seatNumber}.`
          : 'Prenotazione confermata. Ci vediamo all’ingresso!',
      );
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Prenotazione non riuscita.',
        'error',
      );
    } finally {
      setBookingBusy(false);
    }
  }

  if (loading || authLoading) {
    return (
      <div className="container detail-loading" aria-busy="true">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--line" />
        <div className="skeleton skeleton--block" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container page-message">
        <p className="eyebrow">404</p>
        <h1>Evento non trovato</h1>
        <p>Forse è stato rimosso o il link non è corretto.</p>
        <Link to="/" className="btn btn--primary">
          Torna agli eventi
        </Link>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="container page-message">
        <h1>Qualcosa è andato storto</h1>
        <p>{error ?? 'Evento non disponibile.'}</p>
        <button type="button" className="btn btn--primary" onClick={() => void load()}>
          Riprova
        </button>
      </div>
    );
  }

  const past = isPast(event.startsAt);
  const cancelled = event.status === 'ANNULLATO';
  const soldOut = event.availableSeats <= 0;
  const isOwner = user?.id === event.createdBy;

  let ctaLabel = 'Prenota il posto';
  if (bookingBusy) ctaLabel = 'Prenotazione in corso…';
  else if (cancelled) ctaLabel = 'Evento annullato';
  else if (past) ctaLabel = 'Evento concluso';
  else if (soldOut) ctaLabel = 'Evento esaurito';
  else if (myBooking) ctaLabel = 'Prenotazione confermata';
  else if (!user) ctaLabel = 'Accedi per prenotare';

  return (
    <div className="container detail-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={17} aria-hidden="true" /> Torna agli eventi
      </Link>

      <header className="detail-header">
        <div className="detail-header__badges">
          <EventTypeBadge type={event.type} />
          {cancelled && <span className="badge badge--cancelled">Annullato</span>}
          {past && !cancelled && <span className="badge badge--muted">Concluso</span>}
        </div>
        <h1>{event.title}</h1>
        <div className="detail-header__meta">
          <span>
            <CalendarDays size={17} aria-hidden="true" />
            {formatDateTime(event.startsAt)}
          </span>
          <span>
            <MapPin size={17} aria-hidden="true" />
            {event.location}
          </span>
        </div>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="detail-section">
            <h2>La serata</h2>
            <p className="detail-description">
              {event.description || 'Descrizione in arrivo.'}
            </p>
          </section>

          <section className="detail-section">
            <h2>Informazioni</h2>
            <div className="info-grid">
              <div className="info-card">
                <CalendarDays size={19} aria-hidden="true" />
                <span>Data e ora</span>
                <strong>{formatDateTime(event.startsAt)}</strong>
              </div>
              <div className="info-card">
                <MapPin size={19} aria-hidden="true" />
                <span>Luogo</span>
                <strong>{event.location}</strong>
              </div>
              <div className="info-card">
                <UserRound size={19} aria-hidden="true" />
                <span>Organizzatore</span>
                <strong>{event.organizerName}</strong>
              </div>
              <div className="info-card">
                <Users size={19} aria-hidden="true" />
                <span>Capienza</span>
                <strong>{event.capacity} posti</strong>
              </div>
            </div>
          </section>

          <section className="detail-section">
            <div className="notice">
              <Info size={18} aria-hidden="true" />
              <p>
                {EVENT_TYPE_DESCRIPTION[event.type]}. In questa versione demo
                non è previsto alcun pagamento online: la prenotazione è
                gratuita e immediata.
              </p>
            </div>
          </section>

          {isOwner && (
            <section className="detail-section">
              <div className="owner-panel">
                <div>
                  <h2>Stai organizzando questo evento</h2>
                  <p>Modifica i dettagli o annulla la serata dalla dashboard.</p>
                </div>
                <Link to="/organizer" className="btn btn--ghost">
                  Vai alla dashboard
                </Link>
              </div>
            </section>
          )}
        </div>

        <aside className="booking-card">
          <div className="booking-card__head">
            <span className="booking-card__label">Disponibilità</span>
            <strong>
              {event.availableSeats}{' '}
              <small>{pluralizePosti(event.availableSeats)}</small>
            </strong>
            <span className="booking-card__capacity">su {event.capacity}</span>
          </div>
          <AvailabilityBar booked={event.bookedCount} capacity={event.capacity} />

          {cancelled ? (
            <div className="alert alert--error alert--compact" role="status">
              Questo evento è stato annullato. Le prenotazioni sono chiuse.
            </div>
          ) : past ? (
            <div className="alert alert--info alert--compact" role="status">
              L’evento si è già svolto. Le prenotazioni sono chiuse.
            </div>
          ) : myBooking ? (
            <div className="booking-confirmed" role="status">
              <CheckCircle2 size={22} aria-hidden="true" />
              <div>
                <strong>Ci sei!</strong>
                <p>
                  {myBooking.seatNumber
                    ? `Posto numero ${myBooking.seatNumber}`
                    : 'Ingresso libero fino a capienza'}
                </p>
              </div>
            </div>
          ) : (
            <p className="booking-card__hint">
              {event.type === 'CONCERTO'
                ? 'Il posto viene assegnato automaticamente al momento della prenotazione.'
                : 'Prenota per riservare il tuo accesso fino a esaurimento capienza.'}
            </p>
          )}

          {myBooking ? (
            <Link to="/my-bookings" className="btn btn--primary btn--lg btn--block">
              <Ticket size={18} aria-hidden="true" />
              Vedi i miei posti
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--lg btn--block"
              onClick={() => void handleBook()}
              disabled={bookingBusy || cancelled || past || soldOut || Boolean(myBooking)}
            >
              {myBooking ? <CheckCircle2 size={18} /> : <Ticket size={18} />}
              {ctaLabel}
            </button>
          )}

          {!user && !cancelled && !past && !soldOut && (
            <p className="booking-card__login">
              Non hai un account?{' '}
              <Link to="/register">Registrati in 30 secondi</Link>
            </p>
          )}

          <div className="booking-card__detail">
            <Armchair size={16} aria-hidden="true" />
            <span>
              {event.type === 'CONCERTO'
                ? 'Posti numerati'
                : event.type === 'WORKSHOP'
                  ? 'Posti limitati'
                  : 'Ingresso libero'}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
