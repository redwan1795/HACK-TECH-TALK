import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface Listing {
  id: string;
  title: string;
  category: string;
  price_cents: number | null;
  quantity_available: number;
  location_zip: string;
  is_available: boolean;
  created_at: string;
}

export default function ProducerDashboard() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [actionError, setActionError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['myListings'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Listing[]; total: number }>(
        '/listings?limit=100'
      );
      return res.data.data;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async ({ id, publish }: { id: string; publish: boolean }) => {
      await apiClient.patch(`/listings/${id}/publish`, { publish });
    },
    onSuccess: () => {
      setActionError('');
      qc.invalidateQueries({ queryKey: ['myListings'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Action failed';
      setActionError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/listings/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myListings'] }),
  });

  return (
    <div className="min-h-screen bg-garden-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-garden-700">Producer Dashboard</h1>
            <p className="text-gray-500 text-sm">{user?.name} · {user?.email}</p>
          </div>
          <Link
            to="/listings/new"
            className="bg-garden-600 hover:bg-garden-700 text-white font-semibold px-4 py-2 rounded-lg text-sm"
          >
            + New Listing
          </Link>
        </div>

        {actionError && (
          <p className="text-red-500 text-sm bg-red-50 p-2 rounded mb-4">{actionError}</p>
        )}

        {isLoading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {data && data.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-gray-500 mb-4">No listings yet.</p>
            <Link to="/listings/new" className="text-garden-600 hover:underline text-sm">
              Create your first listing →
            </Link>
          </div>
        )}

        {data && data.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((listing) => (
                  <tr key={listing.id} className="border-b last:border-0 hover:bg-garden-50">
                    <td className="px-4 py-3 font-medium">{listing.title}</td>
                    <td className="px-4 py-3 capitalize text-gray-500">{listing.category}</td>
                    <td className="px-4 py-3">
                      {listing.price_cents != null
                        ? `$${(listing.price_cents / 100).toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">{listing.quantity_available}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        listing.is_available
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {listing.is_available ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <button
                        onClick={() =>
                          publishMutation.mutate({ id: listing.id, publish: !listing.is_available })
                        }
                        disabled={publishMutation.isPending}
                        className="text-xs text-garden-600 hover:underline disabled:opacity-50"
                      >
                        {listing.is_available ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this listing?')) deleteMutation.mutate(listing.id);
                        }}
                        className="text-xs text-red-500 hover:underline"
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
      </div>
    </div>
  );
}
