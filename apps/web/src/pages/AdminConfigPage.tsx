import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export default function AdminConfigPage() {
  const queryClient = useQueryClient();
  const [feeInput, setFeeInput] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-config'],
    queryFn: async () => {
      const res = await apiClient.get<{ fee_percent: number }>('/admin/config');
      return res.data;
    },
    onSuccess: (d: { fee_percent: number }) => {
      setFeeInput(String(d.fee_percent));
    },
  } as any);

  const mutation = useMutation({
    mutationFn: async (fee: number) => {
      const res = await apiClient.patch<{ fee_percent: number }>('/admin/config', { fee_percent: fee });
      return res.data;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['admin-config'] });
      setSuccessMsg(`Fee updated to ${d.fee_percent}%`);
      setErrorMsg('');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: () => {
      setErrorMsg('Failed to update fee. Please try again.');
      setSuccessMsg('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(feeInput);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      setErrorMsg('Fee must be between 0 and 100');
      return;
    }
    setErrorMsg('');
    mutation.mutate(parsed);
  };

  return (
    <div className="min-h-screen bg-garden-50">
      <div className="max-w-lg mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-garden-700 mb-6">Platform Configuration</h1>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Platform Fee</h2>
          <p className="text-sm text-gray-500 mb-4">
            Applied to every order. Visible to consumers as a line item at checkout.
          </p>

          {isLoading ? (
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse w-full" />
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-3 items-end">
              <div className="flex-1">
                <label htmlFor="fee-input" className="block text-xs font-medium text-gray-600 mb-1">
                  Fee %
                </label>
                <div className="relative">
                  <input
                    id="fee-input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={feeInput}
                    onChange={(e) => setFeeInput(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500 pr-8"
                    placeholder={data ? String(data.fee_percent) : '7'}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
              </div>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="bg-garden-600 hover:bg-garden-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {mutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </form>
          )}

          {data && !isLoading && (
            <p className="text-xs text-gray-400 mt-2">Current fee: {data.fee_percent}%</p>
          )}

          {successMsg && (
            <div className="mt-3 bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-sm text-green-700">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mt-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
