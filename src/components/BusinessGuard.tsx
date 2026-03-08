import { useBusiness } from "@/hooks/useBusiness";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export function BusinessGuard({ children }: { children: React.ReactNode }) {
  const { business, isLoading } = useBusiness();

  if (isLoading) {
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
