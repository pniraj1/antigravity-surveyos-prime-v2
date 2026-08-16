'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** Component stack — names the component that threw. */
  stack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    stack: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in tab:', error, errorInfo);
    this.setState({ stack: errorInfo.componentStack?.trim() || null });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
          <p className="text-slate-500 max-w-sm mb-4 leading-relaxed">
            The app hit an unexpected error while rendering this tab.
          </p>
          {/* The old copy blamed "the PDF engine" and threw the real error away,
              which made a claim-specific crash impossible to diagnose from a
              screenshot. Show it — the surveyor can paste it into a report. */}
          {this.state.error && (
            <pre className="max-w-xl mb-8 p-3 text-left text-xs font-mono text-red-700 bg-red-50 border border-red-200 rounded-xl overflow-auto max-h-48 whitespace-pre-wrap">
              {this.state.error.message}
              {this.state.stack ? `\n\n${this.state.stack}` : ''}
            </pre>
          )}
          <div className="flex gap-4">
            <button
              onClick={() => this.setState({ hasError: false, error: null, stack: null })}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
            >
              <RotateCcw size={16} />
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              Refresh App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
