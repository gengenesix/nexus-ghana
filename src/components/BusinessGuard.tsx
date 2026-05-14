import { useBusiness } from "@/hooks/useBusiness";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export function BusinessGuard({ children }: { children: React.ReactNode }) {
  const { loading: authLoading } = useAuth();
  const { business, isLoading, isFetching } = useBusiness();

  // Wait for auth session to restore (authLoading), for the initial fetch
  // (isLoading), or for a fetch when there's still no cached data yet.
  // We deliberately do NOT block on background refetches when data is present.
  if (authLoading || isLoading || (isFetching && !business)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!business) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
