import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const ACTIONS = [
  {
    icon: '✨',
    title: 'AI Search',
    description: 'Just ask in plain English — "I want fresh eggs" or "zucchini near me".',
    href: '/search',
    cta: 'Search with AI',
    color: 'border-garden-300 bg-garden-50 hover:border-garden-500',
    ctaColor: 'bg-garden-600 hover:bg-garden-700 text-white',
  },
  {
    icon: '🌾',
    title: 'My Listings',
    description: 'Create, publish, and manage the produce you\'re selling.',
    href: '/producer/dashboard',
    cta: 'Go to My Listings',
    color: 'border-green-200 bg-green-50 hover:border-green-400',
    ctaColor: 'bg-green-700 hover:bg-green-800 text-white',
  },
  {
    icon: '🔍',
    title: 'Browse Listings',
    description: 'Filter by keyword, category, or ZIP code.',
    href: '/browse',
    cta: 'Browse All',
    color: 'border-blue-200 bg-blue-50 hover:border-blue-400',
    ctaColor: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  {
    icon: '📦',
    title: 'My Orders',
    description: 'View your purchase history and order status.',
    href: '/orders',
    cta: 'View Orders',
    color: 'border-amber-200 bg-amber-50 hover:border-amber-400',
    ctaColor: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
];

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-garden-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌿</span>
          <span className="font-bold text-garden-700 text-lg">Community Garden</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            You can buy from and sell to your local community — all from one account.
          </p>
        </div>

        {/* Action cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          {ACTIONS.map((a) => (
            <div
              key={a.href}
              className={`border-2 rounded-2xl p-5 flex flex-col gap-3 transition-colors ${a.color}`}
            >
              <div className="text-3xl">{a.icon}</div>
              <div>
                <h2 className="font-bold text-gray-800">{a.title}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{a.description}</p>
              </div>
              <Link
                to={a.href}
                className={`mt-auto text-sm font-semibold px-4 py-2 rounded-lg text-center transition-colors ${a.ctaColor}`}
              >
                {a.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Quick create listing shortcut */}
        <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="font-semibold text-gray-800 text-sm">Have something to sell?</p>
            <p className="text-xs text-gray-400 mt-0.5">Create a new listing in under 2 minutes.</p>
          </div>
          <Link
            to="/listings/new"
            className="bg-garden-600 hover:bg-garden-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            + New Listing
          </Link>
        </div>
      </div>
    </div>
  );
}
