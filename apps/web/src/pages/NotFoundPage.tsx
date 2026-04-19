import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-garden-50">
      <div className="text-center p-8">
        <div className="text-6xl font-bold text-garden-700">404</div>
        <p className="text-xl text-gray-500 mt-2">Page not found</p>
        <p className="text-sm text-gray-400 mt-1">The page you're looking for doesn't exist.</p>
        <Link
          to="/"
          className="mt-6 inline-block px-6 py-2.5 bg-garden-600 hover:bg-garden-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
