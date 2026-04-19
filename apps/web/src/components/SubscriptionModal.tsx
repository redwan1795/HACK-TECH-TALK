import { useState } from 'react';
import { apiClient } from '../lib/api';
import type { SubscriptionCadence } from '@community-garden/types';

interface Props {
  listingId: string;
  listingTitle: string;
  pricePerUnit: number;
  onClose: () => void;
}

const CADENCE_LABELS: Record<SubscriptionCadence, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
};

export function SubscriptionModal({ listingId, listingTitle, pricePerUnit, onClose }: Props) {
  const [cadence, setCadence] = useState<SubscriptionCadence>('weekly');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const estimatedCents = Math.round(pricePerUnit * quantity);
  const estimatedDisplay = `$${(estimatedCents / 100).toFixed(2)}`;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await apiClient.post('/subscriptions', { listing_id: listingId, cadence, quantity });
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch {
      setError('Failed to create subscription. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
        {success ? (
          <div className="text-center py-4 space-y-2">
            <div className="text-3xl">✓</div>
            <p className="font-semibold text-green-700">Subscription created!</p>
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Subscribe to:</h2>
              <p className="text-sm text-gray-500 mt-0.5">{listingTitle}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cadence</label>
                <select
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value as SubscriptionCadence)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500"
                >
                  {(Object.keys(CADENCE_LABELS) as SubscriptionCadence[]).map((c) => (
                    <option key={c} value={c}>{CADENCE_LABELS[c]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500"
                />
              </div>

              <div className="bg-garden-50 rounded-lg px-3 py-2 text-sm text-garden-800">
                Estimated charge: <strong>{estimatedDisplay}</strong> per delivery
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="flex-1 bg-garden-600 hover:bg-garden-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                {isSubmitting ? 'Creating…' : 'Confirm Subscription'}
              </button>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
