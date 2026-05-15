import { useStaffSession } from "@/contexts/StaffSessionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/hooks/useBusiness";

/**
 * useFieldPermission(module, fieldName)
 *
 * Returns true if the current role may see this field.
 * Business owners and Administrator always see everything.
 *
 * @example
 *   const showSalary = useFieldPermission('staff', 'salary');
 */
export function useFieldPermission(module: string, fieldName: string): boolean {
  const { user } = useAuth();
  const { business } = useBusiness();
  const { ownerBypass, permissions } = useStaffSession();

  const isOwner = !!user && !!business && business.owner_id === user.id;
  if (isOwner || ownerBypass) return true;

  const moduleFields = permissions.fields[module];
  if (!moduleFields) return true; // no explicit restriction → visible

  return moduleFields[fieldName] !== false; // undefined → visible, false → hidden
}
