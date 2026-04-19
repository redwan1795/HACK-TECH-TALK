import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { searchListings } from '../../listings/api';
import type { Listing } from '../../../shared/types';
import { listExchanges, proposeExchange, updateExchangeStatus, type Exchange } from '../api';

export default function ExchangePage() {
  const [exchangeListings, setExchangeListings] = useState<Listing[] | null>(null);
  const [exchanges, setExchanges] = useState<Exchange[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showPropose, setShowPropose] = useState<Listing | null>(null);
  const [offer, setOffer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const [all, mine] = await Promise.all([searchListings({ limit: 50 }), listExchanges()]);
      setExchangeListings(all.listings.filter((l) => l.priceCents === null));
      setExchanges(mine);
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Failed to load');
    }
  }
  useEffect(() => { load(); }, []);

  async function submitProposal() {
    if (!showPropose) return;
    if (offer.trim().length < 2) return;
    setSubmitting(true);
    try {
      await proposeExchange(showPropose.id, offer.trim());
      setShowPropose(null);
      setOffer('');
      load();
    } catch (e: any) {
      alert(e.response?.data?.error?.message ?? 'Failed to propose');
    } finally {
      setSubmitting(false);
    }
  }

  async function respond(id: string, status: 'accepted' | 'declined') {
    try {
      await updateExchangeStatus(id, status);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error?.message ?? 'Failed');
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Exchange Marketplace</h1>
      <p className="text-gray-500 mt-1 text-sm">Trade produce without money. Propose an exchange on any barter listing.</p>

      {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{error}</div>}

      {/* Available exchange listings */}
      <section className="mt-6">
        <h2 className="font-semibold text-gray-900 mb-3">Available for exchange</h2>
        {exchangeListings === null && <p className="text-gray-500">Loading…</p>}
        {exchangeListings && exchangeListings.length === 0 && (
          <div className="bg-white rounded-xl shadow-card p-6 text-gray-500">
            No exchange-only listings yet.
          </div>
        )}
        {exchangeListings && exchangeListings.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            {exchangeListings.map((l) => (
              <div key={l.id} className="bg-white rounded-xl shadow-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-600 text-white">
                      ⇄ Exchange
                    </span>
                    <Link to={`/listing/${l.id}`}>
                      <h3 className="font-bold text-gray-900 mt-2 hover:text-brand-700">{l.title}</h3>
                    </Link>
                    <p className="text-sm text-gray-500">{l.producer.name}</p>
                    {l.exchangeFor && (
                      <p className="text-sm text-cyan-700 mt-2">
                        Willing to trade for: <span className="font-medium">{l.exchangeFor}</span>
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setShowPropose(l); setOffer(''); }}
                  className="w-full mt-4 border-2 border-cyan-600 text-cyan-700 font-semibold py-2 rounded-lg hover:bg-cyan-50"
                >
                  ⇄ Propose Exchange
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* My exchanges */}
      <section className="mt-8">
        <h2 className="font-semibold text-gray-900 mb-3">My exchanges</h2>
        {exchanges === null && <p className="text-gray-500">Loading…</p>}
        {exchanges && exchanges.length === 0 && (
          <div className="bg-white rounded-xl shadow-card p-6 text-gray-500">
            No exchanges yet. Propose one above!
          </div>
        )}
        {exchanges && exchanges.length > 0 && (
          <div className="space-y-3">
            {exchanges.map((x) => (
              <div key={x.id} className="bg-white rounded-xl shadow-card p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                      x.status === 'pending' ? 'bg-yellow-100 text-yellow-700'
                      : x.status === 'accepted' ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                    }`}>{x.status}</span>
                    {x.isOwner && <span className="text-xs text-gray-500">← for your listing</span>}
                  </div>
                  <p className="font-medium text-gray-900 mt-1 truncate">
                    {x.initiatorName} offers "<span className="italic">{x.offeredItem}</span>" for{' '}
                    <Link to={`/listing/${x.listingId}`} className="text-brand-700 hover:underline">{x.listingTitle}</Link>
                  </p>
                </div>
                {x.isOwner && x.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => respond(x.id, 'accepted')}
                      className="text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold px-3 py-1.5 rounded-lg"
                    >Accept</button>
                    <button
                      onClick={() => respond(x.id, 'declined')}
                      className="text-sm border border-gray-300 text-gray-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50"
                    >Decline</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Propose modal */}
      {showPropose && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => setShowPropose(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Propose exchange for "{showPropose.title}"</h3>
            {showPropose.exchangeFor && (
              <p className="text-sm text-gray-500 mt-2">
                Grower wants: <span className="text-cyan-700 font-medium">{showPropose.exchangeFor}</span>
              </p>
            )}

            <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">What are you offering?</label>
            <input
              type="text" value={offer} onChange={(e) => setOffer(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="2 dozen fresh eggs"
            />

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowPropose(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-semibold"
              >Cancel</button>
              <button
                onClick={submitProposal}
                disabled={submitting || offer.trim().length < 2}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-2 rounded-lg font-semibold disabled:opacity-50"
              >{submitting ? 'Sending…' : 'Propose'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
