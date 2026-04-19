import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex items-center justify-center min-h-screen bg-garden-50">
          <div className="text-center p-8 max-w-sm">
            <p className="text-lg font-semibold text-red-600">Something went wrong.</p>
            <p className="text-sm text-gray-500 mt-1">An unexpected error occurred.</p>
            <button
              className="mt-4 px-5 py-2 bg-garden-600 hover:bg-garden-700 text-white text-sm font-semibold rounded-lg transition-colors"
              onClick={() => this.setState({ hasError: false })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
