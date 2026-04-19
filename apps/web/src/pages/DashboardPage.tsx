import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const ROLE_BADGE: Record<string, string> = {
  consumer: 'bg-blue-100 text-blue-700',
  producer: 'bg-garden-100 text-garden-700',
  broker:   'bg-purple-100 text-purple-700',
  admin:    'bg-red-100 text-red-700',
};

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-garden-50 flex flex-col items-center justify-center gap-4 p-4">
      <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">🌱</div>
        <h1 className="text-2xl font-bold text-gray-800">Welcome, {user?.name}</h1>
        <p className="text-gray-500 text-sm mt-1">{user?.email}</p>
        {user?.role && (
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold capitalize ${ROLE_BADGE[user.role] ?? ''}`}>
            {user.role}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="mt-6 w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>
      <p className="text-gray-400 text-xs">Listings and search coming in M2 / M3</p>
    </div>
  );
}
