import { useStaffSession } from "@/contexts/StaffSessionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/hooks/useBusiness";
import { RbacAction } from "@/lib/rbac";

/**
 * usePermission(module, action)
 *
 * Returns true if the current user may perform `action` on `module`.
 *
 * Business owners always return true.
 * Staff with ownerBypass (Administrator session) always return true.
 * All others are checked against the DB-loaded role_permissions.
 *
 * @example
 *   const canDelete = usePermission('invoices', 'delete');
 */
export function usePermission(module: string, action: RbacAction): boolean {
  const { user } = useAuth();
  const { business } = useBusiness();
  const { ownerBypass, can } = useStaffSession();

  const isOwner = !!user && !!business && business.owner_id === user.id;
  if (isOwner || ownerBypass) return true;
  return can(module, action);
}
