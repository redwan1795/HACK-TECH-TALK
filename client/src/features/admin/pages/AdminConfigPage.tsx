import { useEffect, useState } from 'react';
import { fetchConfig, patchConfig, fetchStats, type ConfigRow, type Stats } from '../api';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

export default function AdminConfigPage() {
  const [config, setConfig] = useState<ConfigRow[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fee percent form state
  const [feeDraft, setFeeDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function load() {
    setError(null);
    try {
      const [c, s] = await Promise.all([fetchConfig(), fetchStats()]);
      setConfig(c);
      setStats(s);
      const feeRow = c.find((r) => r.key === 'fee_percent');
      if (feeRow) setFeeDraft(feeRow.value);
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Failed to load');
    }
  }

  useEffect(() => { load(); }, []);

  async function saveFee() {
    setSaving(true);
    setError(null);
    try {
      await patchConfig('fee_percent', feeDraft);
      setSavedAt(new Date());
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      <p className="text-gray-500 mt-1 text-sm">Platform configuration and live stats</p>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{error}</div>
      )}

      {/* Config section */}
      <section className="mt-6 bg-white rounded-xl shadow-card p-6">
        <h2 className="font-semibold text-gray-900">Platform fee</h2>
        <p className="text-sm text-gray-500 mt-1">
          Percentage added to every order. Applies immediately to the next order.
        </p>

        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">Fee percent</label>
            <div className="relative">
              <input
                type="number" min="0" max="30" step="0.1"
                value={feeDraft}
                onChange={(e) => setFeeDraft(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
            </div>
          </div>
          <button
            onClick={saveFee}
            disabled={saving}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {savedAt && (
            <span className="text-xs text-brand-700 font-medium">
              ✓ Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="mt-6 grid md:grid-cols-2 gap-4">
        {!stats ? (
          <div className="md:col-span-2 bg-white rounded-xl shadow-card p-6 text-gray-500">Loading stats…</div>
        ) : (
          <>
            <StatCard title="Listings">
              <Row label="Total"    value={String(stats.listings.total)} />
              <Row label="Active"   value={String(stats.listings.active)} />
              <Row label="Inactive" value={String(stats.listings.inactive)} />
            </StatCard>

            <StatCard title="Platform revenue">
              <Row label="Paid orders" value={String(stats.fees.paid_orders)} />
              <Row label="Total fees collected" value={formatCurrency(stats.fees.total_fees_cents)} highlight />
            </StatCard>

            <StatCard title="Users by role">
              {stats.usersByRole.map((r) => (
                <Row key={r.role} label={r.role.replace('_', ' ')} value={String(r.count)} />
              ))}
            </StatCard>

            <StatCard title="Orders by status">
              {stats.ordersByStatus.length === 0
                ? <div className="text-gray-400 text-sm">No orders yet</div>
                : stats.ordersByStatus.map((o) => (
                    <Row key={o.status}
                         label={o.status}
                         value={`${o.count} · ${formatCurrency(o.revenue_cents)}`} />
                  ))}
            </StatCard>

            <StatCard title="Future orders">
              {stats.futureOrdersByStatus.length === 0
                ? <div className="text-gray-400 text-sm">No demand signals yet</div>
                : stats.futureOrdersByStatus.map((f) => (
                    <Row key={f.status} label={f.status} value={String(f.count)} />
                  ))}
            </StatCard>

            <StatCard title="Config">
              {config?.map((c) => (
                <Row key={c.key} label={c.key} value={c.value} />
              ))}
            </StatCard>
          </>
        )}
      </section>
    </main>
  );
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-card p-5">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-sm capitalize">
      <span className="text-gray-600">{label}</span>
      <span className={highlight ? 'font-bold text-brand-700' : 'font-medium text-gray-900'}>
        {value}
      </span>
    </div>
  );
}
