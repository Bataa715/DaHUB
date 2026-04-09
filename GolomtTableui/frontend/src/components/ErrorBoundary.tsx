'use client';
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-6">
          <div className="bg-surface-card border border-surface-border rounded-xl p-8 max-w-md w-full text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-txt">Алдаа гарлаа</h2>
            <p className="text-xs text-txt-dim">
              Системд гэнэтийн алдаа гарлаа. Хуудсыг дахин ачаална уу.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-golomt-500 text-white text-sm font-medium rounded-lg hover:bg-golomt-600 transition-colors"
            >
              <RefreshCw size={14} />
              Дахин ачаалах
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
