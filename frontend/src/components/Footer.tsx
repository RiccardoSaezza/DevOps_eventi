import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Brand } from './Brand';

export function Footer() {
  const { user } = useAuth();
  const isOrganizer = user?.role === 'ORGANIZZATORE';

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <Brand />
          <p>Eventi dal vivo, prenotazioni semplici. Nato per chi organizza, pensato per chi partecipa.</p>
        </div>
        <div className="footer__columns">
          <div>
            <h4>Esplora</h4>
            <Link to="/">Tutti gli eventi</Link>
            <Link to="/my-bookings">I miei posti</Link>
          </div>
          <div>
            <h4>{isOrganizer ? 'Organizza' : 'Account'}</h4>
            {isOrganizer ? (
              <>
                <Link to="/organizer">Dashboard</Link>
                <Link to="/organizer/events/new">Crea un evento</Link>
              </>
            ) : user ? (
              <>
                <Link to="/my-bookings">I miei posti</Link>
                <Link to="/">Cerca eventi</Link>
              </>
            ) : (
              <>
                <Link to="/register">Registrati</Link>
                <Link to="/login">Accedi</Link>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="container footer__bottom">
        <span>© {new Date().getFullYear()} Accordo</span>
        <span>Progetto didattico — Sviluppo Agile e DevOps</span>
      </div>
    </footer>
  );
}
