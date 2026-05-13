import { useStaffSession } from "@/contexts/StaffSessionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/hooks/useBusiness";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Props {
  feature: string;
  children: React.ReactNode;
}

/**
 * Wraps a route element and blocks access if the current staff member
 * does not have permission for the given feature.
 *
 * Business owners (auth user = business.owner_id) always pass through.
 */
export function RoleGuard({ feature, children }: Props) {
  const { user } = useAuth();
  const { business } = useBusiness();
  const { staff, canAccess } = useStaffSession();
  const navigate = useNavigate();

  const isOwner = !!user && !!business && business.owner_id === user.id;

  if (isOwner || canAccess(feature)) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
        <ShieldAlert className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h2 className="text-xl font-display font-bold">Access Restricted</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {staff
            ? `Your role (${staff.role}) does not have access to this section.`
            : "You need to log in as staff to access this section."}
        </p>
      </div>
      <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
    </div>
  );
}
