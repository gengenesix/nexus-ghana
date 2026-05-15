import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { RbacAction } from "@/lib/rbac";

interface Props {
  module:   string;
  action:   RbacAction;
  children: React.ReactNode;
  /** Custom fallback instead of the default access-denied panel */
  fallback?: React.ReactNode;
}

/**
 * PermissionGuard — wraps any content/route and shows an Access Denied
 * panel if the current user lacks the required CRUD permission.
 *
 * @example
 *   <PermissionGuard module="invoices" action="delete">
 *     <DeleteButton />
 *   </PermissionGuard>
 */
export function PermissionGuard({ module, action, children, fallback }: Props) {
  const allowed = usePermission(module, action);
  const navigate = useNavigate();

  if (allowed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
        <ShieldAlert className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h2 className="text-xl font-display font-bold">Access Denied</h2>
        <p className="text-muted-foreground text-sm mt-1 max-w-xs">
          Your role does not have permission to{" "}
          <span className="font-semibold">{action}</span>{" "}
          <span className="font-semibold">{module}</span>. Contact your Administrator.
        </p>
      </div>
      <Button variant="outline" onClick={() => navigate(-1)}>
        Go Back
      </Button>
    </div>
  );
}
