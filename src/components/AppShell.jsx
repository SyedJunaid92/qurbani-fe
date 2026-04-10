import toast from 'react-hot-toast';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AppShell() {
  const { user, logout, isAdmin } = useAuth();

  function handleLogout() {
    logout();
    toast.success('Signed out');
  }

  return (
    <div className="layout">
      <header className="site-header">
        <div className="site-header__brand">
          <h1>
            <Link to="/">Qurbani bookings</Link>
          </h1>
        </div>
        <nav className="site-nav" aria-label="Main">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? 'site-nav__link site-nav__link--active' : 'site-nav__link'
            }
          >
            Bookings
          </NavLink>
          <NavLink
            to="/new"
            className={({ isActive }) =>
              isActive ? 'site-nav__link site-nav__link--active' : 'site-nav__link'
            }
          >
            Add booking
          </NavLink>
          {isAdmin && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                isActive ? 'site-nav__link site-nav__link--active' : 'site-nav__link'
              }
            >
              Users
            </NavLink>
          )}
        </nav>
        <div className="site-header__user">
          <span className="user-pill" title={user?.email}>
            {user?.name}
          </span>
          <button type="button" className="btn btn--small btn-secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </div>
  );
}
