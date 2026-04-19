import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, type UserRole } from '../../../shared/stores/authStore';

interface Props {
  children: React.ReactNode;
  roles?: UserRole[];
}

export default function ProtectedRoute({ children, roles }: Props) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-gray-900">Access denied</h1>
          <p className="text-gray-500 mt-2">
            This page requires one of: <span className="font-mono">{roles.join(', ')}</span>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
