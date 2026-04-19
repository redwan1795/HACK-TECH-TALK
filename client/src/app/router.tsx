import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from '../shared/components/Navbar';
import NotificationStack from '../shared/components/NotificationStack';
import { ErrorBoundary } from '../shared/components/ErrorBoundary';

import ListingsPage from '../features/listings/pages/ListingsPage';
import ListingDetailPage from '../features/listings/pages/ListingDetailPage';
import CreateListingPage from '../features/listings/pages/CreateListingPage';
import ProducerDashboard from '../features/listings/pages/ProducerDashboard';

import LoginPage from '../features/auth/pages/LoginPage';
import RegisterPage from '../features/auth/pages/RegisterPage';
import ProtectedRoute from '../features/auth/components/ProtectedRoute';

import CartPage from '../features/checkout/pages/CartPage';
import CheckoutPage from '../features/checkout/pages/CheckoutPage';
import OrderConfirmationPage from '../features/checkout/pages/OrderConfirmationPage';
import MyOrdersPage from '../features/checkout/pages/MyOrdersPage';

import FutureOrderPage from '../features/future-orders/pages/FutureOrderPage';
import FutureOrdersListPage from '../features/future-orders/pages/FutureOrdersListPage';

import AdminConfigPage from '../features/admin/pages/AdminConfigPage';
import BrokerDashboard from '../features/broker/pages/BrokerDashboard';
import ExchangePage from '../features/exchange/pages/ExchangePage';

export default function AppRouter() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="*"
            element={
              <div className="min-h-screen bg-gray-50">
                <Navbar />
                <NotificationStack />
                <Routes>
                  <Route path="/" element={<ListingsPage />} />
                  <Route path="/listing/:id" element={<ListingDetailPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/exchange" element={<ExchangePage />} />

                  <Route path="/checkout" element={
                    <ProtectedRoute roles={['consumer', 'broker']}><CheckoutPage /></ProtectedRoute>
                  } />
                  <Route path="/order/:id" element={
                    <ProtectedRoute><OrderConfirmationPage /></ProtectedRoute>
                  } />
                  <Route path="/orders" element={
                    <ProtectedRoute><MyOrdersPage /></ProtectedRoute>
                  } />

                  <Route path="/future-orders" element={
                    <ProtectedRoute roles={['consumer', 'broker']}><FutureOrdersListPage /></ProtectedRoute>
                  } />
                  <Route path="/future-orders/new" element={
                    <ProtectedRoute roles={['consumer', 'broker']}><FutureOrderPage /></ProtectedRoute>
                  } />

                  <Route path="/producer" element={
                    <ProtectedRoute roles={['producer_home', 'producer_farmer']}><ProducerDashboard /></ProtectedRoute>
                  } />
                  <Route path="/producer/new" element={
                    <ProtectedRoute roles={['producer_home', 'producer_farmer']}><CreateListingPage /></ProtectedRoute>
                  } />

                  <Route path="/broker" element={
                    <ProtectedRoute roles={['broker']}><BrokerDashboard /></ProtectedRoute>
                  } />

                  <Route path="/admin" element={
                    <ProtectedRoute roles={['operator']}><AdminConfigPage /></ProtectedRoute>
                  } />

                  <Route path="*" element={
                    <div className="max-w-7xl mx-auto px-6 py-20 text-center">
                      <div className="text-6xl mb-3">🌾</div>
                      <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
                      <p className="text-gray-500 mt-2">This field hasn't been planted yet.</p>
                    </div>
                  } />
                </Routes>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
