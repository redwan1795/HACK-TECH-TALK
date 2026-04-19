import type { Category } from '../../../shared/types';

interface Chip {
  value: Category | null;
  label: string;
  emoji: string;
}

const CHIPS: Chip[] = [
  { value: null,        label: 'All',        emoji: '' },
  { value: 'vegetable', label: 'Vegetables', emoji: '🥦' },
  { value: 'fruit',     label: 'Fruits',     emoji: '🍎' },
  { value: 'herb',      label: 'Herbs',      emoji: '🌿' },
  { value: 'egg',       label: 'Eggs',       emoji: '🥚' },
  { value: 'flower',    label: 'Flowers',    emoji: '🌸' },
  { value: 'dairy',     label: 'Dairy',      emoji: '🥛' },
];

interface Props {
  active: Category | null;
  onChange: (c: Category | null) => void;
}

export default function FilterPanel({ active, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {CHIPS.map((c) => {
        const isActive = c.value === active;
        return (
          <button
            key={c.label}
            onClick={() => onChange(c.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
              isActive
                ? 'bg-brand-50 border-brand-300 text-brand-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {c.emoji && <span className="mr-1">{c.emoji}</span>}
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
