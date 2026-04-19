import { Link } from 'react-router-dom';

interface NavHeaderProps {
  backHref?: string;
}

export function NavHeader({ backHref = '/dashboard' }: NavHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-100 px-6 py-4">
      <Link to={backHref} className="flex items-center gap-2 w-fit group">
        <span className="text-2xl">🌿</span>
        <span className="font-bold text-garden-700 text-lg group-hover:text-garden-500 transition-colors">
          Community Garden
        </span>
      </Link>
    </div>
  );
}
