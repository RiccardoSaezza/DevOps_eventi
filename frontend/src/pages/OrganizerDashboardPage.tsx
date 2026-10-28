import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  CalendarX2,
  MapPin,
  Pencil,
  Plus,
  Ticket,
  Users,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { AvailabilityBar } from '../components/EventCard';
import { EventStatusBadge, EventTypeBadge } from '../components/Badges';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/Modal';
import { PageLoader } from '../components/ProtectedRoute';
import { useToast } from '../components/ToastProvider';
import type { Event } from '../types';
import { formatDateShort, formatTime, isPast } from '../utils/date';

export function OrganizerDashboardPage() {
  const { showToast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Event | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.events.mine();
      setEvents(result.events);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Non riusciamo a caricare i tuoi eventi.',
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
      const result = await api.events.cancel(selected.id);
      setEvents((current) =>
        current.map((event) => (event.id === result.event.id ? result.event : event)),
      );
      showToast(
        result.cancelledBookings > 0
          ? `Evento annullato. ${result.cancelledBookings} prenotazioni chiuse.`
          : 'Evento annullato. Non c’erano prenotazioni attive.',
      );
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

  if (loading) return <PageLoader label="Carico la tua dashboard…" />;

  const published = events.filter((event) => event.status === 'PUBBLICATO');
  const upcoming = published.filter((event) => !isPast(event.startsAt));
  const totalBooked = events.reduce((sum, event) => sum + event.bookedCount, 0);
  const totalCapacity = events.reduce((sum, event) => sum + event.capacity, 0);
  const occupancy = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;

  return (
    <div className="container page-section">
      <header className="page-head">
        <div>
          <p className="eyebrow">Area organizzatore</p>
          <h1>Le tue serate</h1>
          <p className="page-head__lead">
            Crea eventi, controlla l’occupazione e gestisci le date già
            pubblicate.
          </p>
        </div>
        <Link to="/organizer/events/new" className="btn btn--primary">
          <Plus size={18} aria-hidden="true" /> Nuovo evento
        </Link>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-card__icon"><CalendarDays size={20} aria-hidden="true" /></span>
          <span className="stat-card__label">Eventi in programma</span>
          <strong>{upcoming.length}</strong>
          <small>{published.length} pubblicati in totale</small>
        </div>
        <div className="stat-card">
          <span className="stat-card__icon"><Ticket size={20} aria-hidden="true" /></span>
          <span className="stat-card__label">Posti prenotati</span>
          <strong>{totalBooked}</strong>
          <small>su {totalCapacity} disponibili</small>
        </div>
        <div className="stat-card">
          <span className="stat-card__icon"><Users size={20} aria-hidden="true" /></span>
          <span className="stat-card__label">Occupazione media</span>
          <strong>{occupancy}%</strong>
          <small>calcolata su tutti gli eventi</small>
        </div>
      </div>

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
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarX2 size={30} />}
          title="Nessun evento ancora"
          description="La tua prima serata parte da qui: crea un evento, indica capienza e data, e apri le prenotazioni."
          action={
            <Link to="/organizer/events/new" className="btn btn--primary">
              <Plus size={17} aria-hidden="true" /> Crea il primo evento
            </Link>
          }
        />
      ) : (
        <section className="admin-panel">
          <div className="admin-panel__head">
            <h2>Tutti gli eventi</h2>
            <span>{events.length}</span>
          </div>

          <div className="admin-table" role="table" aria-label="I tuoi eventi">
            <div className="admin-table__head" role="row">
              <span role="columnheader">Evento</span>
              <span role="columnheader">Data</span>
              <span role="columnheader">Occupazione</span>
              <span role="columnheader">Stato</span>
              <span role="columnheader">Azioni</span>
            </div>

            {events.map((event) => {
              const past = isPast(event.startsAt);
              const canManage = event.status === 'PUBBLICATO' && !past;
              return (
                <div className="admin-table__row" role="row" key={event.id}>
                  <div className="admin-table__event" role="cell" data-label="Evento">
                    <div className="admin-table__title">
                      <Link to={`/events/${event.id}`}>{event.title}</Link>
                      <EventTypeBadge type={event.type} />
                    </div>
                    <span className="admin-table__location">
                      <MapPin size={14} aria-hidden="true" /> {event.location}
                    </span>
                  </div>

                  <div className="admin-table__date" role="cell" data-label="Data">
                    <strong>{formatDateShort(event.startsAt)}</strong>
                    <span>ore {formatTime(event.startsAt)}</span>
                    {past && <small>Concluso</small>}
                  </div>

                  <div className="admin-table__occupancy" role="cell" data-label="Occupazione">
                    <div>
                      <strong>{event.bookedCount}</strong>
                      <span>/ {event.capacity}</span>
                      <small>{event.availableSeats} liberi</small>
                    </div>
                    <AvailabilityBar
                      booked={event.bookedCount}
                      capacity={event.capacity}
                      compact
                    />
                  </div>

                  <div role="cell" data-label="Stato">
                    <EventStatusBadge status={event.status} />
                  </div>

                  <div className="admin-table__actions" role="cell" data-label="Azioni">
                    {canManage ? (
                      <>
                        <Link
                          to={`/organizer/events/${event.id}/edit`}
                          className="icon-button icon-button--bordered"
                          aria-label={`Modifica ${event.title}`}
                          title="Modifica evento"
                        >
                          <Pencil size={16} />
                        </Link>
                        <button
                          type="button"
                          className="icon-button icon-button--bordered icon-button--danger"
                          onClick={() => setSelected(event)}
                          aria-label={`Annulla ${event.title}`}
                          title="Annulla evento"
                        >
                          <XCircle size={16} />
                        </button>
                      </>
                    ) : (
                      <Link
                        to={`/events/${event.id}`}
                        className="btn btn--ghost btn--sm"
                      >
                        Vedi
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={Boolean(selected)}
        title="Annullare questo evento?"
        description={
          selected
            ? `“${selected.title}” verrà segnato come annullato e le ${selected.bookedCount} prenotazioni attive saranno chiuse. In questa versione demo non vengono inviate email.`
            : ''
        }
        confirmLabel="Annulla evento"
        cancelLabel="Torna indietro"
        danger
        busy={cancelling}
        onConfirm={() => void confirmCancel()}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
