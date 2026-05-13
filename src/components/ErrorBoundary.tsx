import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-5 text-center px-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold">
              {this.props.fallbackTitle ?? "Something went wrong"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              This section failed to load. Your data is safe — try refreshing.
            </p>
            {this.state.error && (
              <p className="text-xs text-muted-foreground/60 font-mono mt-2 max-w-xs truncate">
                {this.state.error.message}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" /> Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
