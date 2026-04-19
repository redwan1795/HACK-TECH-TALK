import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ListingsPage from './pages/ListingsPage';
import CreateListingPage from './pages/CreateListingPage';
import ProducerDashboard from './pages/ProducerDashboard';
import LandingPage from './pages/LandingPage';
import CheckoutPage from './pages/CheckoutPage';
import AISearchPage from './pages/AISearchPage';
import CartPage from './pages/CartPage';
import CartCheckoutPage from './pages/CartCheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import OrdersListPage from './pages/OrdersListPage';
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
      {/* Public landing */}
      <Route path="/" element={<LandingPage />} />

      {/* Auth */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Any authenticated user */}
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />
      <Route path="/search" element={
        <ProtectedRoute><AISearchPage /></ProtectedRoute>
      } />
      <Route path="/browse" element={
        <ProtectedRoute><ListingsPage /></ProtectedRoute>
      } />
      <Route path="/checkout/:listingId" element={
        <ProtectedRoute><CheckoutPage /></ProtectedRoute>
      } />
      <Route path="/checkout" element={
        <ProtectedRoute><CartCheckoutPage /></ProtectedRoute>
      } />
      <Route path="/cart" element={
        <ProtectedRoute><CartPage /></ProtectedRoute>
      } />
      <Route path="/orders/:id/confirmation" element={
        <ProtectedRoute><OrderConfirmationPage /></ProtectedRoute>
      } />
      <Route path="/orders" element={
        <ProtectedRoute><OrdersListPage /></ProtectedRoute>
      } />
      <Route path="/future-orders" element={
        <ProtectedRoute><PlaceholderPage name="Future Orders — coming in M4" /></ProtectedRoute>
      } />

      {/* Any authenticated user can sell */}
      <Route path="/producer/dashboard" element={
        <ProtectedRoute><ProducerDashboard /></ProtectedRoute>
      } />
      <Route path="/listings/new" element={
        <ProtectedRoute><CreateListingPage /></ProtectedRoute>
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
