import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="container page-message">
      <p className="eyebrow">404</p>
      <h1>Questa pagina non è in scaletta</h1>
      <p>Il link potrebbe essere cambiato, oppure la serata è già finita.</p>
      <Link to="/" className="btn btn--primary">
        <Compass size={17} aria-hidden="true" /> Torna al programma
      </Link>
    </div>
  );
}
