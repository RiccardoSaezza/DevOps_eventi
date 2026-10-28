import { Link } from 'react-router-dom';
import { Brand } from './Brand';

export function Footer() {
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
            <h4>Organizza</h4>
            <Link to="/organizer">Dashboard</Link>
            <Link to="/organizer/events/new">Crea un evento</Link>
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
