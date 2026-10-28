import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Disc3,
  GraduationCap,
  MapPin,
  Music2,
  Users,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { EventTypeBadge } from '../components/Badges';
import { PageLoader } from '../components/ProtectedRoute';
import { useToast } from '../components/ToastProvider';
import type { EventType } from '../types';
import {
  EVENT_TYPE_DESCRIPTION,
  EVENT_TYPE_LABEL,
  formatDateTime,
  toDateTimeLocal,
} from '../utils/date';

const TYPE_OPTIONS: Array<{
  value: EventType;
  icon: typeof Music2;
}> = [
  { value: 'CONCERTO', icon: Music2 },
  { value: 'WORKSHOP', icon: GraduationCap },
  { value: 'DJ_SET', icon: Disc3 },
];

function defaultDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  date.setHours(21, 0, 0, 0);
  return toDateTimeLocal(date.toISOString());
}

interface FormState {
  title: string;
  description: string;
  type: EventType;
  startsAt: string;
  location: string;
  capacity: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  type: 'CONCERTO',
  startsAt: defaultDate(),
  location: '',
  capacity: '100',
};

export function EventFormPage() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [bookedCount, setBookedCount] = useState(0);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    api.events
      .get(id)
      .then(({ event }) => {
        if (!active) return;
        setForm({
          title: event.title,
          description: event.description,
          type: event.type,
          startsAt: toDateTimeLocal(event.startsAt),
          location: event.location,
          capacity: String(event.capacity),
        });
        setBookedCount(event.bookedCount);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(
          err instanceof ApiError ? err.message : 'Non riusciamo a caricare l’evento.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: '' }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const errors: Record<string, string> = {};
    if (form.title.trim().length < 3) {
      errors.title = 'Inserisci un titolo di almeno 3 caratteri.';
    }
    if (form.location.trim().length < 2) {
      errors.location = 'Indica il luogo dell’evento.';
    }
    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      errors.capacity = 'Inserisci una capienza valida.';
    } else if (editing && capacity < bookedCount) {
      errors.capacity = `Ci sono già ${bookedCount} prenotazioni: la capienza non può essere inferiore.`;
    }
    const startsAtDate = new Date(form.startsAt);
    if (!form.startsAt || Number.isNaN(startsAtDate.getTime())) {
      errors.startsAt = 'Inserisci data e ora dell’evento.';
    } else if (startsAtDate.getTime() <= Date.now()) {
      errors.startsAt = 'La data deve essere futura.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setBusy(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      startsAt: startsAtDate.toISOString(),
      location: form.location.trim(),
      capacity,
    };

    try {
      if (editing && id) {
        await api.events.update(id, payload);
        showToast('Evento aggiornato.');
      } else {
        await api.events.create(payload);
        showToast('Evento creato e pubblicato.');
      }
      navigate('/organizer');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details?.length) {
          setFieldErrors(
            Object.fromEntries(err.details.map((detail) => [detail.field, detail.message])),
          );
        }
      } else {
        setError('Salvataggio non riuscito. Riprova tra poco.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageLoader label="Carico l’evento…" />;

  if (loadError) {
    return (
      <div className="container page-message">
        <h1>Evento non disponibile</h1>
        <p>{loadError}</p>
        <Link to="/organizer" className="btn btn--primary">
          Torna alla dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="container page-section">
      <Link to="/organizer" className="back-link">
        <ArrowLeft size={17} aria-hidden="true" /> Dashboard
      </Link>

      <header className="page-head">
        <div>
          <p className="eyebrow">{editing ? 'Modifica' : 'Nuova serata'}</p>
          <h1>{editing ? 'Aggiorna l’evento' : 'Crea un evento'}</h1>
          <p className="page-head__lead">
            {editing
              ? 'Le modifiche sono visibili subito nella pagina pubblica.'
              : 'Compila i dettagli, scegli il formato e apri le prenotazioni.'}
          </p>
        </div>
      </header>

      {error && (
        <div className="alert alert--error alert--compact" role="alert">
          {error}
        </div>
      )}

      <div className="event-form-grid">
        <form className="form-card" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="form-section">
            <div className="form-section__head">
              <span className="form-section__number">01</span>
              <div>
                <h2>Identità dell’evento</h2>
                <p>Titolo e descrizione: quello che il pubblico vede per primo.</p>
              </div>
            </div>

            <label className="field">
              <span>Titolo *</span>
              <input
                type="text"
                value={form.title}
                onChange={(event) => setField('title', event.target.value)}
                placeholder="Es. Notturno Elettrico"
                maxLength={120}
                required
              />
              {fieldErrors.title && <small className="field__error">{fieldErrors.title}</small>}
            </label>

            <label className="field">
              <span>Descrizione</span>
              <textarea
                value={form.description}
                onChange={(event) => setField('description', event.target.value)}
                placeholder="Racconta la serata: lineup, atmosfera, informazioni utili…"
                rows={5}
                maxLength={4000}
              />
              <small className="field__hint">{form.description.length}/4000 caratteri</small>
            </label>
          </div>

          <div className="form-section">
            <div className="form-section__head">
              <span className="form-section__number">02</span>
              <div>
                <h2>Formato</h2>
                <p>Ogni formato ha regole di accesso diverse.</p>
              </div>
            </div>

            <div className="type-options" role="radiogroup" aria-label="Tipo di evento">
              {TYPE_OPTIONS.map(({ value, icon: Icon }) => (
                <label
                  key={value}
                  className={`type-option ${form.type === value ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={value}
                    checked={form.type === value}
                    onChange={() => setField('type', value)}
                  />
                  <Icon size={21} aria-hidden="true" />
                  <strong>{EVENT_TYPE_LABEL[value]}</strong>
                  <small>{EVENT_TYPE_DESCRIPTION[value]}</small>
                </label>
              ))}
            </div>
          </div>

          <div className="form-section">
            <div className="form-section__head">
              <span className="form-section__number">03</span>
              <div>
                <h2>Quando e dove</h2>
                <p>Data, luogo e capienza: i dati operativi della serata.</p>
              </div>
            </div>

            <div className="field-row">
              <label className="field">
                <span>Data e ora *</span>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => setField('startsAt', event.target.value)}
                  required
                />
                {fieldErrors.startsAt && (
                  <small className="field__error">{fieldErrors.startsAt}</small>
                )}
              </label>

              <label className="field">
                <span>Capienza *</span>
                <input
                  type="number"
                  min={Math.max(1, bookedCount)}
                  max={10000}
                  value={form.capacity}
                  onChange={(event) => setField('capacity', event.target.value)}
                  required
                />
                {fieldErrors.capacity ? (
                  <small className="field__error">{fieldErrors.capacity}</small>
                ) : (
                  <small className="field__hint">
                    {editing
                      ? `${bookedCount} posti già prenotati.`
                      : 'Numero massimo di partecipanti.'}
                  </small>
                )}
              </label>
            </div>

            <label className="field">
              <span>Luogo *</span>
              <input
                type="text"
                value={form.location}
                onChange={(event) => setField('location', event.target.value)}
                placeholder="Es. Ex Macello, Bologna"
                maxLength={160}
                required
              />
              {fieldErrors.location && (
                <small className="field__error">{fieldErrors.location}</small>
              )}
            </label>
          </div>

          <div className="form-actions">
            <Link to="/organizer" className="btn btn--ghost">
              Annulla
            </Link>
            <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
              {busy ? 'Salvataggio…' : editing ? 'Salva modifiche' : 'Pubblica evento'}
            </button>
          </div>
        </form>

        <aside className="form-preview">
          <p className="eyebrow">Anteprima</p>
          <div className="preview-card">
            <div className="preview-card__top">
              <EventTypeBadge type={form.type} />
              <span>{Number(form.capacity) || 0} posti</span>
            </div>
            <h3>{form.title.trim() || 'Titolo dell’evento'}</h3>
            <p className="preview-card__meta">
              <CalendarDays size={15} aria-hidden="true" />
              {form.startsAt
                ? formatDateTime(new Date(form.startsAt).toISOString())
                : 'Data da definire'}
            </p>
            <p className="preview-card__meta">
              <MapPin size={15} aria-hidden="true" />
              {form.location.trim() || 'Luogo da definire'}
            </p>
            <p className="preview-card__description">
              {form.description.trim() || 'La descrizione comparirà qui.'}
            </p>
            <div className="preview-card__footer">
              <Users size={15} aria-hidden="true" />
              {EVENT_TYPE_DESCRIPTION[form.type]}
            </div>
          </div>

          <div className="form-tips">
            <h3>Prima di pubblicare</h3>
            <ul>
              <li>Controlla che data e luogo siano corretti.</li>
              <li>Imposta una capienza realistica per lo spazio.</li>
              <li>Per i concerti i posti vengono numerati automaticamente.</li>
              {editing && <li>Non puoi ridurre la capienza sotto i posti già prenotati.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
