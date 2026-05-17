import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useStaffSession } from "@/contexts/StaffSessionContext";

/**
 * Session gate — replaces the old kiosk PIN lock screen.
 *
 * All users (staff + owners) must now log in at /login with
 * their individual credentials (Access Code + Staff ID + Password).
 *
 * This component simply:
 *   • Shows a spinner while the DB session check is in progress
 *   • Renders children when a valid session exists (staff or owner)
 *   • Redirects to /login otherwise
 *
 * No PIN entry, no shared-device kiosk, no user enumeration.
 */
export function StaffPinGuard({ children }: { children: React.ReactNode }) {
  const { isStaffLoggedIn, ownerBypass, staffLoading } = useStaffSession();

  // Wait for the DB staff-membership check to complete
  if (staffLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Valid session → let them through
  if (isStaffLoggedIn || ownerBypass) return <>{children}</>;

  // No session → back to login
  return <Navigate to="/login" replace />;
}
