import { useEffect, useState } from 'react';
import type { Category, Listing } from '../../../shared/types';
import { searchListings } from '../api';
import ListingCard from '../components/ListingCard';
import SearchBar from '../../search/components/SearchBar';
import FilterPanel from '../../search/components/FilterPanel';

export default function ListingsPage() {
  const [q, setQ] = useState('');
  const [zip, setZip] = useState('88001');
  const [radius, setRadius] = useState(25);
  const [category, setCategory] = useState<Category | null>(null);

  const [listings, setListings] = useState<Listing[] | null>(null);
  const [total, setTotal] = useState(0);
  const [anchor, setAnchor] = useState<{ zip: string; lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(qv: string, zipv: string, rad: number, cat: Category | null) {
    setLoading(true);
    setError(null);
    try {
      const res = await searchListings({
        q: qv || undefined,
        zip: zipv || undefined,
        radiusMiles: rad,
        category: cat ?? undefined,
      });
      setListings(res.listings);
      setTotal(res.total);
      setAnchor(res.anchor);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    runSearch(q, zip, radius, category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run on category change
  useEffect(() => {
    runSearch(q, zip, radius, category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  function handleSearch(newQ: string, newZip: string, newRadius: number) {
    setQ(newQ);
    setZip(newZip);
    setRadius(newRadius);
    runSearch(newQ, newZip, newRadius, category);
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-50 to-brand-100 py-10 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <h1 className="text-3xl md:text-4xl font-bold text-brand-700">
            Fresh from your neighborhood
          </h1>
          <p className="text-gray-600 mt-2 text-sm md:text-base">
            Search local growers by keyword, ZIP, and distance
          </p>
          <div className="mt-6">
            <SearchBar
              initialQ={q}
              initialZip={zip}
              initialRadius={radius}
              onSearch={handleSearch}
            />
          </div>
        </div>

        {/* Decorative blobs */}
        <div className="absolute top-10 left-10 w-24 h-24 rounded-full bg-brand-500 opacity-5"></div>
        <div className="absolute bottom-0 right-10 w-32 h-32 rounded-full bg-brand-500 opacity-5"></div>
      </section>

      {/* Filter + result banner */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4 flex-wrap">
          <div className="text-sm text-gray-700">
            {loading
              ? 'Searching…'
              : (
                  <>
                    <span className="font-semibold text-brand-700">{total}</span>{' '}
                    {total === 1 ? 'result' : 'results'}
                    {q && <> for "<span className="italic">{q}</span>"</>}
                    {anchor && (
                      <> · Within <span className="font-semibold">{radius} mi</span> of{' '}
                        <span className="font-semibold">{anchor.zip}</span>
                      </>
                    )}
                  </>
                )}
          </div>
          <div className="flex-1" />
          <FilterPanel active={category} onChange={setCategory} />
        </div>
      </div>

      {/* Results grid */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">
            <strong>Error:</strong> {error}
          </div>
        )}

        {listings && listings.length === 0 && !loading && !error && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🔍</div>
            <h2 className="text-xl font-bold text-gray-900">No results found</h2>
            <p className="text-gray-500 mt-2">Try a broader radius or a different keyword.</p>
          </div>
        )}

        {listings && listings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
