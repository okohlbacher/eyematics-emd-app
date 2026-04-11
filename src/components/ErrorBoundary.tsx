import { Component, type ErrorInfo,type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      // L-03: bilingual error boundary — detect locale from browser since hooks are unavailable
      const de = navigator.language.startsWith('de');
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
            <h2 className="text-xl font-bold text-red-600 mb-2">{de ? 'Anwendungsfehler' : 'Application Error'}</h2>
            <p className="text-gray-600 mb-4">{this.state.error?.message ?? (de ? 'Ein unerwarteter Fehler ist aufgetreten.' : 'An unexpected error occurred.')}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {de ? 'Neu laden' : 'Reload'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
