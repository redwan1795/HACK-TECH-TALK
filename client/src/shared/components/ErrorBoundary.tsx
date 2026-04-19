import React from 'react';
import { Link } from 'react-router-dom';

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-card p-8 max-w-md text-center">
            <div className="text-5xl mb-3">💥</div>
            <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
            <p className="text-sm text-gray-500 mt-2">
              {this.state.error?.message ?? 'Unexpected error'}
            </p>
            <div className="flex gap-3 mt-6 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-semibold"
              >
                Reload
              </button>
              <Link to="/" className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold">
                Home
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
