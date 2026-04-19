import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import { useNotifications } from '../hooks/useNotifications';
import { logoutUser } from '../../features/auth/api';

function initials(name: string | null, email: string) {
  const base = (name ?? email).trim();
  const parts = base.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

const linkBase = 'text-sm font-medium transition-colors';
const linkInactive = 'text-gray-600 hover:text-brand-700';
const linkActive = 'text-brand-600';

export default function Navbar() {
  const navigate = useNavigate();
  const { user, refreshToken, isAuthenticated, isProducer, clear } = useAuthStore();
  const cartCount = useCartStore((s) => s.itemCount());
  const { unreadCount } = useNotifications();
  const authed = isAuthenticated();

  async function handleLogout() {
    await logoutUser(refreshToken);
    clear();
    navigate('/login');
  }

  const isConsumerOrBroker = user?.role === 'consumer' || user?.role === 'broker';

  return (
    <header className="bg-white shadow-nav sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center text-xl">🌱</div>
          <div className="hidden sm:block">
            <div className="text-brand-700 font-bold leading-none">Community</div>
            <div className="text-brand-700 text-sm leading-none">Garden</div>
          </div>
        </Link>

        <nav className="flex items-center gap-5 ml-6 overflow-x-auto">
          <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
            Discover
          </NavLink>

          <NavLink to="/exchange" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
            Exchange
          </NavLink>

          {authed && isConsumerOrBroker && (
            <NavLink to="/future-orders" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
              Future Orders
            </NavLink>
          )}

          {authed && (
            <NavLink to="/orders" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
              My Orders
            </NavLink>
          )}

          {authed && isProducer() && (
            <NavLink to="/producer" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
              My Listings
            </NavLink>
          )}

          {authed && user?.role === 'broker' && (
            <NavLink to="/broker" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
              Broker
            </NavLink>
          )}

          {authed && user?.role === 'operator' && (
            <NavLink to="/admin" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
              Admin
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {authed && (
            <Link to="/future-orders" className="relative text-gray-600 hover:text-brand-700 p-1" aria-label="Notifications">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </Link>
          )}

          <Link to="/cart" className="relative text-gray-600 hover:text-brand-700 p-1" aria-label="Cart">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                {cartCount}
              </span>
            )}
          </Link>

          {!authed && (
            <>
              <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-brand-700">Sign in</Link>
              <Link to="/register" className="text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg">
                Get started
              </Link>
            </>
          )}

          {authed && user && (
            <>
              <div className="text-right hidden md:block">
                <div className="text-sm font-medium text-gray-900 leading-tight">
                  {user.displayName ?? user.email}
                </div>
                <div className="text-xs text-gray-500 leading-tight capitalize">
                  {user.role.replace('_', ' ')}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand-100 border-2 border-brand-500 text-brand-700 flex items-center justify-center text-sm font-bold" title={user.email}>
                {initials(user.displayName, user.email)}
              </div>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-gray-500 hover:text-red-600 border border-gray-200 rounded-lg px-3 py-1.5"
              >Logout</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
