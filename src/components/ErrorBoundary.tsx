import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto mt-10 bg-white border border-red-200 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Dogodila se neočekivana greška</h2>
          <p className="text-gray-700 mb-4">Aplikacija se srušila. Ovo je tehnički opis greške:</p>
          <div className="bg-red-50 p-4 rounded-lg overflow-auto mb-4 text-sm font-mono text-red-800">
            {this.state.error && this.state.error.toString()}
          </div>
          {this.state.errorInfo && (
            <details className="text-xs text-gray-500 font-mono mt-4">
              <summary className="cursor-pointer mb-2 font-semibold">Prikaži detalje (Stack trace)</summary>
              <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
          <button 
            className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            onClick={() => window.location.reload()}
          >
            Osvježi stranicu
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
