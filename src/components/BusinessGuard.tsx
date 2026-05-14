import { useBusiness } from "@/hooks/useBusiness";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

export function BusinessGuard({ children }: { children: React.ReactNode }) {
  const { loading: authLoading } = useAuth();
  const { business, isError, status } = useBusiness();

  // 1. Wait for the Supabase auth session to restore on page refresh.
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 2. Wait for the business query to settle.
  //    status === 'pending' covers ALL sub-states:
  //      - query disabled (user=null)
  //      - micro-task gap (enabled just flipped true, fetch not started yet)
  //      - actively fetching
  //    We only move forward once status becomes 'success' or 'error'.
  if (status === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 3. Query threw (network error, RLS error, etc.).
  //    Show a retry screen — do NOT redirect to /onboarding, that would
  //    cause a duplicate-business creation loop.
  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "var(--forest)" }}
        >
          <AlertCircle className="h-8 w-8 text-white" />
        </div>
        <p className="text-xl font-bold" style={{ color: "var(--forest)" }}>
          Could not load your business
        </p>
        <p className="max-w-sm text-sm" style={{ color: "var(--muted-foreground)" }}>
          There was a problem connecting to the server. Check your internet connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition-all active:scale-95"
          style={{ backgroundColor: "var(--forest)" }}
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  // 4. status === 'success' and no business → new user, send to onboarding.
  if (!business) {
    return <Navigate to="/onboarding" replace />;
  }

  // 5. All good — render the app.
  return <>{children}</>;
}
