import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ListingsPage from './pages/ListingsPage';
import ListingDetailPage from './pages/ListingDetailPage';
import CreateListingPage from './pages/CreateListingPage';
import ProducerDashboard from './pages/ProducerDashboard';
import LandingPage from './pages/LandingPage';
import CheckoutPage from './pages/CheckoutPage';
import AISearchPage from './pages/AISearchPage';
import CartPage from './pages/CartPage';
import CartCheckoutPage from './pages/CartCheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import OrdersListPage from './pages/OrdersListPage';
import FutureOrderPage from './pages/FutureOrderPage';
import FutureOrdersListPage from './pages/FutureOrdersListPage';
import AdminConfigPage from './pages/AdminConfigPage';
import BrokerDashboardPage from './pages/BrokerDashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

function ExchangePlaceholder() {
  return (
    <div className="min-h-screen bg-garden-50 flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <div className="text-5xl mb-4">🔄</div>
        <h1 className="text-2xl font-bold text-garden-700">Exchange</h1>
        <p className="text-gray-500 mt-2 text-sm">
          Produce exchange marketplace coming soon.
        </p>
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
        <ProtectedRoute>
          <ErrorBoundary><AISearchPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/browse" element={
        <ProtectedRoute><ListingsPage /></ProtectedRoute>
      } />
      <Route path="/listings/:id" element={
        <ProtectedRoute><ListingDetailPage /></ProtectedRoute>
      } />
      <Route path="/checkout/:listingId" element={
        <ProtectedRoute>
          <ErrorBoundary><CheckoutPage /></ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/checkout" element={
        <ProtectedRoute>
          <ErrorBoundary><CartCheckoutPage /></ErrorBoundary>
        </ProtectedRoute>
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
      <Route path="/future-orders/new" element={
        <ProtectedRoute><FutureOrderPage /></ProtectedRoute>
      } />
      <Route path="/future-orders" element={
        <ProtectedRoute><FutureOrdersListPage /></ProtectedRoute>
      } />
      <Route path="/exchange" element={
        <ProtectedRoute><ExchangePlaceholder /></ProtectedRoute>
      } />

      {/* Producer */}
      <Route path="/producer/dashboard" element={
        <ProtectedRoute><ProducerDashboard /></ProtectedRoute>
      } />
      <Route path="/listings/new" element={
        <ProtectedRoute><CreateListingPage /></ProtectedRoute>
      } />

      {/* Broker */}
      <Route path="/broker" element={
        <ProtectedRoute roles={['broker']}>
          <BrokerDashboardPage />
        </ProtectedRoute>
      } />

      {/* Admin */}
      <Route path="/admin" element={
        <ProtectedRoute roles={['admin']}>
          <AdminConfigPage />
        </ProtectedRoute>
      } />

      <Route path="/unauthorized" element={
        <div className="flex items-center justify-center min-h-screen bg-garden-50">
          <div className="text-center p-8">
            <div className="text-5xl font-bold text-red-400">403</div>
            <p className="text-gray-500 mt-2">You don't have permission to view this page.</p>
          </div>
        </div>
      } />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
