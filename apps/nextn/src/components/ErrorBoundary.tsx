"use client";

import {
  Component,
  type ErrorInfo,
  type ReactNode,
  type ContextType,
} from "react";
import { LanguageContext } from "@/contexts/LanguageContext";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  static contextType = LanguageContext;
  declare context: ContextType<typeof LanguageContext>;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="text-center space-y-3 p-8">
              <p className="text-2xl font-bold text-foreground">
                {this.context.t("errorBoundaryTitle")}
              </p>
              <p className="text-muted-foreground text-sm max-w-xs">
                {this.state.error?.message ?? this.context.t("errorBoundaryUnknown")}
              </p>
              <button
                onClick={() =>
                  this.setState({ hasError: false, error: undefined })
                }
                className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
              >
                {this.context.t("errorBoundaryRetry")}
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
