import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  CalendarDays,
  Disc3,
  Search,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  X,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EventCard } from '../components/EventCard';
import { EmptyState } from '../components/EmptyState';
import type { Event, EventFilters, EventType } from '../types';
import {
  EVENT_TYPE_LABEL,
  formatDay,
  formatMonth,
  formatTime,
} from '../utils/date';

const TYPE_OPTIONS: Array<{ value: EventType | ''; label: string }> = [
  { value: '', label: 'Tutti' },
  { value: 'CONCERTO', label: 'Concerti' },
  { value: 'WORKSHOP', label: 'Workshop' },
  { value: 'DJ_SET', label: 'DJ set' },
];

export function HomePage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<EventFilters>({});

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFilters((current) => ({ ...current, q: search.trim() || undefined }));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api.events
      .list(filters)
      .then(({ events: next }) => {
        if (active) setEvents(next);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? err.message
            : 'Non riusciamo a caricare gli eventi.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, reloadKey]);

  const activeFilters = useMemo(
    () =>
      Boolean(
        filters.q ||
          filters.type ||
          filters.available ||
          filters.from ||
          search.trim(),
      ),
    [filters, search],
  );

  const nextEvent = events[0];
  const totalAvailable = events.reduce(
    (sum, event) => sum + event.availableSeats,
    0,
  );

  function resetFilters() {
    setSearch('');
    setFilters({});
  }

  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <p className="eyebrow">
              <span className="eyebrow__pulse" aria-hidden="true" />
              Dal vivo, senza caos
            </p>
            <h1>
              La musica accade.
              <br />
              <em>Il resto fila liscio.</em>
            </h1>
            <p className="hero__lead">
              Concerti, workshop e DJ set in un unico posto. Prenota il tuo
              posto in pochi clic, senza fogli Excel e senza chat infinite.
            </p>
            <div className="hero__cta">
              <a href="#eventi" className="btn btn--primary btn--lg">
                Scopri gli eventi <ArrowDown size={18} aria-hidden="true" />
              </a>
              {!user && (
                <a href="#come-funziona" className="btn btn--ghost btn--lg">
                  Come funziona
                </a>
              )}
            </div>
            <dl className="hero__stats">
              <div>
                <dt>Formati</dt>
                <dd>03</dd>
              </div>
              <div>
                <dt>Posti liberi</dt>
                <dd>{loading ? '—' : totalAvailable}</dd>
              </div>
              <div>
                <dt>Prenotazione</dt>
                <dd>&lt; 1 min</dd>
              </div>
            </dl>
          </div>

          <div className="hero__visual">
            <div className="vinyl" aria-hidden="true">
              <div className="vinyl__grooves" />
              <div className="vinyl__label">
                <Disc3 size={28} strokeWidth={1.4} />
                <span>ACCORDO</span>
                <small>LIVE SESSIONS</small>
              </div>
            </div>

            <div className="ticket">
              <div className="ticket__notch ticket__notch--left" aria-hidden="true" />
              <div className="ticket__notch ticket__notch--right" aria-hidden="true" />
              <div className="ticket__head">
                <span className="ticket__label">Prossimo evento</span>
                <Sparkles size={15} aria-hidden="true" />
              </div>
              {nextEvent ? (
                <>
                  <p className="ticket__date">
                    {formatDay(nextEvent.startsAt)} {formatMonth(nextEvent.startsAt)} ·{' '}
                    {formatTime(nextEvent.startsAt)}
                  </p>
                  <h3>{nextEvent.title}</h3>
                  <p className="ticket__location">{nextEvent.location}</p>
                  <span className="ticket__type">
                    {EVENT_TYPE_LABEL[nextEvent.type]}
                  </span>
                </>
              ) : (
                <>
                  <p className="ticket__date">Programma in arrivo</p>
                  <h3>La prossima serata è quasi pronta</h3>
                  <p className="ticket__location">
                    Torna tra poco per scoprire date e posti disponibili.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          {Array.from({ length: 2 }).map((_, group) => (
            <span key={group}>
              Concerti <b>✦</b> Workshop <b>✦</b> DJ set <b>✦</b> Posti numerati{' '}
              <b>✦</b> Prenotazioni semplici <b>✦</b>
            </span>
          ))}
        </div>
      </div>

      <section className="events-section container" id="eventi">
        <div className="section-head">
          <div>
            <p className="eyebrow">Programma</p>
            <h2>Prossimi eventi</h2>
          </div>
          <p className="section-head__note">
            {loading ? 'Caricamento…' : `${events.length} eventi in programma`}
          </p>
        </div>

        <div className="filter-bar">
          <label className="search-field">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Cerca eventi</span>
            <input
              type="search"
              placeholder="Cerca per titolo o luogo…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                className="search-field__clear"
                onClick={() => setSearch('')}
                aria-label="Cancella ricerca"
              >
                <X size={15} />
              </button>
            )}
          </label>

          <div className="filter-pills" role="group" aria-label="Filtra per tipo di evento">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                className={`filter-pill ${(filters.type ?? '') === option.value ? 'is-active' : ''}`}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    type: option.value || undefined,
                  }))
                }
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="filter-date">
            <CalendarDays size={17} aria-hidden="true" />
            <label htmlFor="filter-date" className="sr-only">
              A partire dal
            </label>
            <input
              id="filter-date"
              type="date"
              value={filters.from?.slice(0, 10) ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  from: event.target.value
                    ? new Date(`${event.target.value}T00:00:00`).toISOString()
                    : undefined,
                }))
              }
            />
          </div>

          <label className="check-field">
            <input
              type="checkbox"
              checked={filters.available ?? false}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  available: event.target.checked || undefined,
                }))
              }
            />
            <span>Solo disponibili</span>
          </label>

          {activeFilters && (
            <button type="button" className="filter-reset" onClick={resetFilters}>
              <SlidersHorizontal size={15} aria-hidden="true" />
              Azzera filtri
            </button>
          )}
        </div>

        {error ? (
          <div className="alert alert--error" role="alert">
            <div>
              <strong>Qualcosa non ha funzionato.</strong>
              <p>{error}</p>
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Riprova
            </button>
          </div>
        ) : loading ? (
          <div className="event-grid" aria-busy="true" aria-label="Caricamento eventi">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="event-card event-card--skeleton" key={index}>
                <div className="skeleton skeleton--chip" />
                <div className="skeleton skeleton--title" />
                <div className="skeleton skeleton--line" />
                <div className="skeleton skeleton--bar" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<Ticket size={30} />}
            title="Nessun evento trovato"
            description={
              activeFilters
                ? 'Prova ad allargare la ricerca: cambia tipo, data o rimuovi il filtro sulla disponibilità.'
                : 'Il prossimo evento è in preparazione. Torna presto per scoprire il programma.'
            }
            action={
              activeFilters ? (
                <button type="button" className="btn btn--primary" onClick={resetFilters}>
                  Azzera i filtri
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="event-grid">
            {events.map((event, index) => (
              <EventCard key={event.id} event={event} index={index} />
            ))}
          </div>
        )}
      </section>

      <section className="how container" id="come-funziona">
        <div className="section-head">
          <div>
            <p className="eyebrow">Semplice davvero</p>
            <h2>Tre passi, un posto tuo</h2>
          </div>
        </div>
        <div className="how__grid">
          <article className="how__step">
            <span className="how__number">01</span>
            <h3>Scegli l’evento</h3>
            <p>
              Filtra per tipo o data e apri la scheda: trovi luogo, orario e
              posti aggiornati in tempo reale.
            </p>
          </article>
          <article className="how__step">
            <span className="how__number">02</span>
            <h3>Prenota il posto</h3>
            <p>
              Accedi o crea un account. Per i concerti il posto è numerato e
              viene assegnato automaticamente.
            </p>
          </article>
          <article className="how__step">
            <span className="how__number">03</span>
            <h3>Presentati all’ingresso</h3>
            <p>
              Ritrovi tutto in “I miei posti”, con la possibilità di annullare
              la prenotazione se cambiano i piani.
            </p>
          </article>
        </div>
      </section>

      {!user && (
        <section className="cta-band container">
          <div>
            <p className="eyebrow">Per chi organizza</p>
            <h2>Hai una serata in mente?</h2>
            <p>
              Crea l’evento, apri le prenotazioni e segui l’occupazione dalla
              dashboard. Niente più fogli condivisi.
            </p>
          </div>
          <div className="cta-band__actions">
            <Link to="/register" className="btn btn--primary btn--lg">
              Crea il tuo account
            </Link>
            <Link to="/login" className="btn btn--ghost btn--lg">
              Ho già un account
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
