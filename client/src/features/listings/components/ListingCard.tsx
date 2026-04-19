import { Link } from 'react-router-dom';
import type { Listing } from '../../../shared/types';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { formatDistance } from '../../../shared/utils/formatDistance';

const CATEGORY_STYLES: Record<string, { bg: string; text: string; emoji: string; pillBg: string; pillText: string }> = {
  vegetable: { bg: 'bg-green-100',  text: 'text-green-800',  emoji: '🥦', pillBg: 'bg-green-100',  pillText: 'text-green-800' },
  fruit:     { bg: 'bg-orange-100', text: 'text-orange-800', emoji: '🍎', pillBg: 'bg-orange-100', pillText: 'text-orange-800' },
  herb:      { bg: 'bg-teal-100',   text: 'text-teal-800',   emoji: '🌿', pillBg: 'bg-teal-100',   pillText: 'text-teal-800' },
  flower:    { bg: 'bg-pink-100',   text: 'text-pink-800',   emoji: '🌸', pillBg: 'bg-pink-100',   pillText: 'text-pink-800' },
  egg:       { bg: 'bg-yellow-100', text: 'text-yellow-800', emoji: '🥚', pillBg: 'bg-yellow-100', pillText: 'text-yellow-800' },
  dairy:     { bg: 'bg-blue-100',   text: 'text-blue-800',   emoji: '🥛', pillBg: 'bg-blue-100',   pillText: 'text-blue-800' },
  other:     { bg: 'bg-gray-100',   text: 'text-gray-800',   emoji: '📦', pillBg: 'bg-gray-100',   pillText: 'text-gray-800' },
};

interface Props {
  listing: Listing;
}

export default function ListingCard({ listing: l }: Props) {
  const style = CATEGORY_STYLES[l.category] ?? CATEGORY_STYLES.other;
  const lowStock = l.quantityAvailable > 0 && l.quantityAvailable <= 5;
  const isExchange = l.priceCents === null;

  return (
    <div className="bg-white rounded-xl shadow-card overflow-hidden flex hover:shadow-lg transition-shadow">
      {/* Image area */}
      <Link to={`/listing/${l.id}`} className={`w-36 ${style.bg} flex items-center justify-center text-6xl flex-shrink-0 relative`}>
        {l.images && l.images.length > 0 ? (
          <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover" />
        ) : (
          <span>{style.emoji}</span>
        )}

        {lowStock && (
          <span className="absolute top-2 left-2 text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded">
            Low Stock
          </span>
        )}
        {isExchange && (
          <span className="absolute top-2 left-2 text-[10px] font-bold text-white bg-cyan-600 px-2 py-0.5 rounded">
            ⇄ Exchange
          </span>
        )}
      </Link>

      {/* Body */}
      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className={`${style.pillBg} ${style.pillText} text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide`}>
            {style.emoji} {l.category}
          </span>
          {l.distanceMiles !== null && (
            <span className="text-xs text-gray-500">📍 {formatDistance(l.distanceMiles)}</span>
          )}
        </div>

        <Link to={`/listing/${l.id}`}>
          <h3 className="font-bold text-gray-900 mt-2 truncate hover:text-brand-700">
            {l.title}
          </h3>
        </Link>

        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-sm text-gray-500 truncate">{l.producer.name ?? 'Unknown'}</p>
          {l.producer.licensed && (
            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">✓ Verified</span>
          )}
        </div>

        <div className="mt-3 text-lg font-bold text-gray-900">
          {formatCurrency(l.priceCents, l.unit)}
        </div>
        <p className={`text-xs mt-1 ${lowStock ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
          {lowStock
            ? `⚠ Only ${l.quantityAvailable} ${l.unit}${l.quantityAvailable !== 1 ? 's' : ''} left!`
            : `${l.quantityAvailable} ${l.unit}${l.quantityAvailable !== 1 ? 's' : ''} available · ZIP ${l.locationZip}`}
        </p>
      </div>
    </div>
  );
}
