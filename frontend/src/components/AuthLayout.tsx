import { Disc3, Quote } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand';

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="auth-page">
      <aside className="auth-visual" aria-hidden="true">
        <div className="auth-visual__brand">
          <Disc3 size={30} strokeWidth={1.4} />
          <span>accordo.</span>
        </div>
        <div className="auth-visual__content">
          <Quote size={34} strokeWidth={1.4} />
          <blockquote>
            Prima avevo un foglio Excel e tre chat aperte. Ora apro una
            dashboard e so esattamente chi c’è.
          </blockquote>
          <p>Marco Ferretti — organizzatore</p>
        </div>
        <div className="auth-visual__rings" />
      </aside>

      <main className="auth-panel">
        <div className="auth-panel__top">
          <Brand />
          <Link to="/" className="auth-panel__back">
            Torna agli eventi
          </Link>
        </div>

        <div className="auth-form-wrap">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
      </main>
    </div>
  );
}
