import { useEffect, useState } from 'react';
import { LayoutDashboard, LogOut, Menu, Ticket, X } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Brand } from './Brand';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="navbar">
      <div className="navbar__inner container">
        <Brand />

        <nav className={`navbar__nav ${open ? 'is-open' : ''}`} aria-label="Navigazione principale">
          <NavLink to="/" end className="nav-link">
            Eventi
          </NavLink>

          {user && (
            <NavLink to="/my-bookings" className="nav-link">
              <Ticket size={16} aria-hidden="true" />
              I miei posti
            </NavLink>
          )}

          {user?.role === 'ORGANIZZATORE' && (
            <NavLink to="/organizer" className="nav-link">
              <LayoutDashboard size={16} aria-hidden="true" />
              Dashboard
            </NavLink>
          )}

          <div className="navbar__mobile-auth">
            {user ? (
              <>
                <div className="user-chip">
                  <span className="avatar">{initials(user.name)}</span>
                  <span>
                    <strong>{user.name}</strong>
                    <small>{user.role === 'ORGANIZZATORE' ? 'Organizzatore' : 'Partecipante'}</small>
                  </span>
                </div>
                <button type="button" className="btn btn--ghost btn--block" onClick={handleLogout}>
                  <LogOut size={16} aria-hidden="true" /> Esci
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn--ghost btn--block">
                  Accedi
                </Link>
                <Link to="/register" className="btn btn--primary btn--block">
                  Registrati
                </Link>
              </>
            )}
          </div>
        </nav>

        <div className="navbar__actions">
          {user ? (
            <div className="navbar__user">
              <div className="user-chip">
                <span className="avatar">{initials(user.name)}</span>
                <span className="user-chip__text">
                  <strong>{user.name}</strong>
                  <small>{user.role === 'ORGANIZZATORE' ? 'Organizzatore' : 'Partecipante'}</small>
                </span>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={handleLogout}
                aria-label="Esci dall’account"
                title="Esci"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div className="navbar__guest">
              <Link to="/login" className="btn btn--ghost btn--sm">
                Accedi
              </Link>
              <Link to="/register" className="btn btn--primary btn--sm">
                Registrati
              </Link>
            </div>
          )}

          <button
            type="button"
            className="icon-button navbar__toggle"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? 'Chiudi menu' : 'Apri menu'}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}
