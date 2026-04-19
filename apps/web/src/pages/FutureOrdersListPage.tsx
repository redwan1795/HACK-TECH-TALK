import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { apiClient } from '../lib/api';
import { NavHeader } from '../components/NavHeader';

interface FutureOrder {
  id: string;
  product_keyword: string;
  quantity_needed: number;
  unit: string;
  zip: string;
  expires_at: string;
  status: 'open' | 'matched' | 'expired' | 'cancelled';
  matched_listing_id: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<FutureOrder['status'], string> = {
  open:      'bg-green-100 text-green-800',
  matched:   'bg-blue-100 text-blue-800',
  expired:   'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

export default function FutureOrdersListPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['future-orders'],
    queryFn: async () => {
      const res = await apiClient.get('/future-orders');
      return (res.data as { data: FutureOrder[] }).data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/future-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['future-orders'] });
    },
  });

  return (
    <div className="min-h-screen bg-garden-50">
      <NavHeader />
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-garden-700">My Future Requests</h1>
          <Link
            to="/future-orders/new"
            className="bg-garden-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-garden-700 transition-colors"
          >
            + New Request
          </Link>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl h-20 animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 font-medium text-sm">Failed to load your requests.</p>
            <p className="text-red-400 text-xs mt-1">
              Try signing out and back in — your session may have expired.
            </p>
          </div>
        )}

        {!isLoading && !isError && data?.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-4xl mb-3">🌿</div>
            <p className="text-gray-500 mb-4">You have no future requests yet.</p>
            <Link
              to="/future-orders/new"
              className="text-garden-600 font-medium hover:underline"
            >
              Post a demand →
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {data?.map((fo) => (
            <div key={fo.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold capitalize">{fo.product_keyword}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[fo.status]}`}>
                    {fo.status.charAt(0).toUpperCase() + fo.status.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {fo.quantity_needed} {fo.unit} · ZIP {fo.zip} · Expires {format(parseISO(fo.expires_at), 'MMM d, yyyy')}
                </p>
                {fo.status === 'matched' && fo.matched_listing_id && (
                  <Link
                    to={`/listings/${fo.matched_listing_id}`}
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                  >
                    View matched listing →
                  </Link>
                )}
              </div>

              {fo.status === 'open' && (
                <button
                  onClick={() => cancelMutation.mutate(fo.id)}
                  disabled={cancelMutation.isPending}
                  className="text-sm text-red-500 hover:text-red-700 whitespace-nowrap disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
