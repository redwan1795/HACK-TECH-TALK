import { useState, useEffect } from 'react';

interface Props {
  initialQ?: string;
  initialZip?: string;
  initialRadius?: number;
  onSearch: (q: string, zip: string, radius: number) => void;
}

export default function SearchBar({ initialQ = '', initialZip = '', initialRadius = 25, onSearch }: Props) {
  const [q, setQ] = useState(initialQ);
  const [zip, setZip] = useState(initialZip);
  const [radius, setRadius] = useState(initialRadius);

  useEffect(() => { setQ(initialQ); }, [initialQ]);
  useEffect(() => { setZip(initialZip); }, [initialZip]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    onSearch(q.trim(), zip.trim(), radius);
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-full shadow-card border border-gray-200 px-2 py-1.5 flex items-center gap-2">
      {/* Magnifier + query */}
      <div className="flex items-center gap-2 flex-1 px-3">
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10 17a7 7 0 100-14 7 7 0 000 14z" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find me some zucchini near Las Cruces..."
          className="w-full py-2 outline-none text-gray-800 placeholder-gray-400"
        />
      </div>

      {/* ZIP */}
      <div className="hidden md:flex items-center gap-1.5 border-l border-gray-200 pl-3">
        <span className="text-gray-400">📍</span>
        <input
          type="text"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          placeholder="ZIP"
          maxLength={5}
          className="w-16 py-2 outline-none text-gray-800 placeholder-gray-400"
        />
      </div>

      {/* Radius */}
      <div className="hidden lg:flex items-center gap-2 border-l border-gray-200 pl-3 pr-2">
        <span className="text-xs text-gray-500">Within</span>
        <select
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="bg-transparent outline-none text-sm text-gray-700 font-medium"
        >
          <option value={5}>5 mi</option>
          <option value={10}>10 mi</option>
          <option value={25}>25 mi</option>
          <option value={50}>50 mi</option>
          <option value={100}>100 mi</option>
        </select>
      </div>

      <button
        type="submit"
        className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-2.5 rounded-full transition-colors"
      >
        Search
      </button>
    </form>
  );
}
