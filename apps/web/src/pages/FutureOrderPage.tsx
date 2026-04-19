import { useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, format, parseISO } from 'date-fns';
import { apiClient } from '../lib/api';

interface DemandIntent {
  product_keyword: string;
  quantity: number;
  unit: string;
  needed_by_date: string | null;
  max_price_cents: number | null;
  zip: string | null;
  proximity_miles: number;
}

type PageState = 'input' | 'confirm' | 'success';

export default function FutureOrderPage() {
  const [state, setState] = useState<PageState>('input');
  const [queryText, setQueryText] = useState('');
  const [intent, setIntent] = useState<DemandIntent | null>(null);
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    if (!queryText.trim()) return;
    setParsing(true);
    setParseError('');
    try {
      const res = await apiClient.post('/ai/parse-demand', { query: queryText });
      setIntent(res.data as DemandIntent);
      setState('confirm');
    } catch (err: unknown) {
      const serverMsg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? '';
      // Don't expose raw API error JSON to the user
      const isApiError = serverMsg.includes('x-api-key') || serverMsg.includes('authentication');
      setParseError(
        isApiError
          ? 'AI service is temporarily unavailable. Please try again later.'
          : serverMsg || 'Could not parse your request. Please try rephrasing.'
      );
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    if (!intent) return;
    setSaving(true);
    setSaveError('');
    try {
      const expiresAt = intent.needed_by_date
        ? intent.needed_by_date
        : addDays(new Date(), 7).toISOString();

      await apiClient.post('/future-orders', {
        product_query:   queryText,
        product_keyword: intent.product_keyword,
        quantity_needed: intent.quantity,
        unit:            intent.unit,
        zip:             intent.zip ?? '88001',
        needed_by_date:  intent.needed_by_date,
        max_price_cents: intent.max_price_cents,
        proximity_miles: intent.proximity_miles,
        expires_at:      expiresAt,
      });
      setState('success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setSaveError(msg ?? 'Failed to save your request. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen bg-garden-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🌱</div>
          <h2 className="text-2xl font-bold text-garden-700 mb-2">Request saved!</h2>
          <p className="text-gray-600 mb-6">
            We'll notify you when a matching listing is published nearby.
          </p>
          <Link
            to="/future-orders"
            className="inline-block bg-garden-600 text-white px-6 py-2 rounded-lg hover:bg-garden-700 transition-colors"
          >
            View my requests
          </Link>
        </div>
      </div>
    );
  }

  if (state === 'confirm' && intent) {
    return (
      <div className="min-h-screen bg-garden-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-garden-700 mb-1">Confirm your request</h2>
          <p className="text-sm text-gray-500 mb-6">Review what we understood — then save it.</p>

          <dl className="space-y-3 mb-6">
            <div className="flex justify-between">
              <dt className="text-gray-500 text-sm">Product</dt>
              <dd className="font-semibold capitalize">{intent.product_keyword}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 text-sm">Quantity</dt>
              <dd className="font-semibold">{intent.quantity} {intent.unit}</dd>
            </div>
            {intent.needed_by_date && (
              <div className="flex justify-between">
                <dt className="text-gray-500 text-sm">Needed by</dt>
                <dd className="font-semibold">
                  {format(parseISO(intent.needed_by_date), 'MMM d, yyyy')}
                </dd>
              </div>
            )}
            {intent.zip && (
              <div className="flex justify-between">
                <dt className="text-gray-500 text-sm">Near ZIP</dt>
                <dd className="font-semibold">{intent.zip}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500 text-sm">Radius</dt>
              <dd className="font-semibold">{intent.proximity_miles} miles</dd>
            </div>
            {intent.max_price_cents && (
              <div className="flex justify-between">
                <dt className="text-gray-500 text-sm">Max price</dt>
                <dd className="font-semibold">${(intent.max_price_cents / 100).toFixed(2)}</dd>
              </div>
            )}
          </dl>

          {saveError && (
            <p className="text-red-500 text-sm mb-4">{saveError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setState('input')}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 bg-garden-600 text-white px-4 py-2 rounded-lg hover:bg-garden-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Confirm & Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-garden-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-garden-700 mb-1">Post a future request</h2>
        <p className="text-sm text-gray-500 mb-6">
          Describe what you need in plain language. We'll notify you when a match is listed nearby.
        </p>

        <form onSubmit={handleParse} className="space-y-4">
          <textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder='e.g. "I need 10 lbs of oranges in 2 days near 88001"'
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-400 resize-none"
          />
          {parseError && (
            <p className="text-red-500 text-sm">{parseError}</p>
          )}
          <button
            type="submit"
            disabled={parsing || !queryText.trim()}
            className="w-full bg-garden-600 text-white px-4 py-2 rounded-lg hover:bg-garden-700 transition-colors disabled:opacity-50"
          >
            {parsing ? 'Parsing…' : 'Parse my request'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/future-orders" className="text-sm text-garden-600 hover:underline">
            View my existing requests →
          </Link>
        </div>
      </div>
    </div>
  );
}
