import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AuthLayout } from '../components/AuthLayout';
import { useToast } from '../components/ToastProvider';

function safeRedirect(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect'));

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [organizerCode, setOrganizerCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    return (
      <Navigate
        to={redirect ?? (user.role === 'ORGANIZZATORE' ? '/organizer' : '/my-bookings')}
        replace
      />
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Le password non coincidono.' });
      return;
    }
    if (password.length < 8) {
      setFieldErrors({ password: 'La password deve avere almeno 8 caratteri.' });
      return;
    }

    setBusy(true);
    try {
      const created = await register({
        name,
        email,
        password,
        organizerCode: isOrganizer ? organizerCode : undefined,
      });
      showToast(
        created.role === 'ORGANIZZATORE'
          ? 'Account organizzatore creato. Buona prima serata!'
          : 'Account creato. Ora puoi prenotare il tuo posto.',
      );
      navigate(redirect ?? (created.role === 'ORGANIZZATORE' ? '/organizer' : '/my-bookings'), {
        replace: true,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details?.length) {
          setFieldErrors(
            Object.fromEntries(err.details.map((detail) => [detail.field, detail.message])),
          );
        }
      } else {
        setError('Registrazione non riuscita. Riprova tra poco.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Nuovo account"
      title="Entra nel giro."
      subtitle="Un account, tutti gli eventi. Puoi prenotare subito e gestire i tuoi posti."
      footer={
        <>
          Hai già un account? <Link to="/login">Accedi</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {error && (
          <div className="alert alert--error alert--compact" role="alert">
            {error}
          </div>
        )}

        <label className="field">
          <span>Nome e cognome</span>
          <span className="field__control">
            <UserRound size={17} aria-hidden="true" />
            <input
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Il tuo nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </span>
          {fieldErrors.name && <small className="field__error">{fieldErrors.name}</small>}
        </label>

        <label className="field">
          <span>Email</span>
          <span className="field__control">
            <Mail size={17} aria-hidden="true" />
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="nome@esempio.it"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </span>
          {fieldErrors.email && <small className="field__error">{fieldErrors.email}</small>}
        </label>

        <div className="field-row">
          <label className="field">
            <span>Password</span>
            <span className="field__control">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                placeholder="Min. 8 caratteri"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="field__toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
            {fieldErrors.password && <small className="field__error">{fieldErrors.password}</small>}
          </label>

          <label className="field">
            <span>Conferma password</span>
            <span className="field__control">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Ripeti la password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </span>
            {fieldErrors.confirmPassword && (
              <small className="field__error">{fieldErrors.confirmPassword}</small>
            )}
          </label>
        </div>

        <label className="check-field check-field--panel">
          <input
            type="checkbox"
            checked={isOrganizer}
            onChange={(event) => setIsOrganizer(event.target.checked)}
          />
          <span>Registrati come organizzatore</span>
        </label>

        {isOrganizer && (
          <label className="field">
            <span>Codice organizzatore</span>
            <span className="field__control">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                type="text"
                name="organizerCode"
                placeholder="Inserisci il codice fornito dal team"
                value={organizerCode}
                onChange={(event) => setOrganizerCode(event.target.value)}
              />
            </span>
            {fieldErrors.organizerCode && (
              <small className="field__error">{fieldErrors.organizerCode}</small>
            )}
            <small className="field__hint">
              Nel progetto demo il codice è <code>ORGANIZZA2026</code>.
            </small>
          </label>
        )}

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? 'Creazione account…' : 'Crea account'}
        </button>

        <p className="auth-terms">
          Creando un account accetti le regole del progetto demo: i dati sono
          locali e non vengono condivisi con servizi esterni.
        </p>
      </form>
    </AuthLayout>
  );
}
