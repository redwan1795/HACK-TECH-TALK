import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import { ProtectedRoute } from './components/ProtectedRoute';

function PlaceholderPage({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-garden-50">
      <div className="text-center p-8">
        <div className="text-5xl mb-4">🌱</div>
        <h1 className="text-3xl font-bold text-garden-700 mb-2">Community Garden</h1>
        <p className="text-gray-500">{name}</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Any authenticated user */}
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute><PlaceholderPage name="AI Search — coming in M3" /></ProtectedRoute>
      } />
      <Route path="/browse" element={
        <ProtectedRoute><PlaceholderPage name="Browse Listings — coming in M2" /></ProtectedRoute>
      } />
      <Route path="/listings/:id" element={
        <ProtectedRoute><PlaceholderPage name="Listing Detail — coming in M2" /></ProtectedRoute>
      } />
      <Route path="/cart" element={
        <ProtectedRoute><PlaceholderPage name="Cart — coming in M3" /></ProtectedRoute>
      } />
      <Route path="/checkout" element={
        <ProtectedRoute><PlaceholderPage name="Checkout — coming in M3" /></ProtectedRoute>
      } />
      <Route path="/orders" element={
        <ProtectedRoute><PlaceholderPage name="Orders — coming in M3" /></ProtectedRoute>
      } />
      <Route path="/future-orders/new" element={
        <ProtectedRoute><PlaceholderPage name="Future Order Form — coming in M4" /></ProtectedRoute>
      } />
      <Route path="/future-orders" element={
        <ProtectedRoute><PlaceholderPage name="Future Orders — coming in M4" /></ProtectedRoute>
      } />

      {/* Producer / broker / admin only */}
      <Route path="/producer/dashboard" element={
        <ProtectedRoute roles={['producer', 'broker', 'admin']}>
          <PlaceholderPage name="Producer Dashboard — coming in M2" />
        </ProtectedRoute>
      } />

      {/* Admin only */}
      <Route path="/admin" element={
        <ProtectedRoute roles={['admin']}>
          <PlaceholderPage name="Admin Config — coming in M5" />
        </ProtectedRoute>
      } />

      <Route path="/unauthorized" element={
        <PlaceholderPage name="403 — You don't have permission to view this page" />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
