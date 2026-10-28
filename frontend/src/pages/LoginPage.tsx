import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
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

export function LoginPage() {
  const { user, login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return <Navigate to={redirect ?? (user.role === 'ORGANIZZATORE' ? '/organizer' : '/')} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const logged = await login(email, password);
      showToast(`Bentornato, ${logged.name.split(' ')[0]}.`);
      navigate(
        redirect ?? (logged.role === 'ORGANIZZATORE' ? '/organizer' : '/'),
        { replace: true },
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Accesso non riuscito. Riprova tra poco.',
      );
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(kind: 'organizer' | 'participant') {
    if (kind === 'organizer') {
      setEmail('marco@accordo.test');
      setPassword('Organizza123!');
    } else {
      setEmail('giulia@accordo.test');
      setPassword('Partecipa123!');
    }
    setError(null);
  }

  return (
    <AuthLayout
      eyebrow="Area riservata"
      title="Bentornato."
      subtitle="Accedi per prenotare un posto o gestire i tuoi eventi."
      footer={
        <>
          Non hai ancora un account? <Link to="/register">Registrati</Link>
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
        </label>

        <label className="field">
          <span>Password</span>
          <span className="field__control">
            <LockKeyhole size={17} aria-hidden="true" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="La tua password"
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
        </label>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? 'Accesso in corso…' : 'Accedi'}
        </button>

        <div className="demo-box">
          <p>Account demo</p>
          <div className="demo-box__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => fillDemo('organizer')}>
              Organizzatore
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => fillDemo('participant')}>
              Partecipante
            </button>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}
