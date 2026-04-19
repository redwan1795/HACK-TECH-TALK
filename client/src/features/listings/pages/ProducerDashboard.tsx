import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyListings, togglePublish, deleteListing } from '../api';
import type { Listing } from '../../../shared/types';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

export default function ProducerDashboard() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setListings(await fetchMyListings());
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Failed to load');
    }
  }

  useEffect(() => { load(); }, []);

  async function onTogglePublish(id: string) {
    try {
      await togglePublish(id);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error?.message ?? 'Failed');
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Remove this listing?')) return;
    try {
      await deleteListing(id);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error?.message ?? 'Failed');
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
        <Link
          to="/producer/new"
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-semibold"
        >
          + New listing
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">{error}</div>
      )}

      {listings === null && <p className="text-gray-500">Loading…</p>}

      {listings && listings.length === 0 && (
        <div className="bg-white rounded-xl shadow-card p-10 text-center">
          <div className="text-5xl mb-3">🌱</div>
          <h2 className="text-lg font-semibold text-gray-900">No listings yet</h2>
          <p className="text-gray-500 mt-1">Create your first listing to start selling.</p>
          <Link
            to="/producer/new"
            className="inline-block mt-4 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-semibold"
          >
            + Create your first listing
          </Link>
        </div>
      )}

      {listings && listings.length > 0 && (
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-left px-4 py-3 font-medium">Price</th>
                <th className="text-left px-4 py-3 font-medium">Qty</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link to={`/listing/${l.id}`} className="hover:text-brand-700">
                      {l.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{l.category}</td>
                  <td className="px-4 py-3 text-gray-900">{formatCurrency(l.priceCents, l.unit)}</td>
                  <td className="px-4 py-3 text-gray-600">{l.quantityAvailable}</td>
                  <td className="px-4 py-3">
                    {l.isAvailable ? (
                      <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        ● Published
                      </span>
                    ) : (
                      <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        ○ Unpublished
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => onTogglePublish(l.id)}
                      className="text-xs text-brand-700 hover:underline"
                    >
                      {l.isAvailable ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      onClick={() => onDelete(l.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
