import {
  createContext, useContext, useState, useCallback,
  useEffect, ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  LoadedPermissions, OWNER_PERMISSIONS, EMPTY_PERMISSIONS,
  actionKey, RbacAction,
} from "@/lib/rbac";

export interface StaffSession {
  id:           string;
  name:         string;
  role:         string;
  customRoleId: string | null;
}

interface StaffSessionContextType {
  staff:           StaffSession | null;
  permissions:     LoadedPermissions;
  isStaffLoggedIn: boolean;
  ownerBypass:     boolean;
  staffLoading:    boolean;   // true while initial DB check is in progress
  setOwnerAccess:  () => void;
  logout:    () => void;
  /** Legacy compat — true if role has any read access to the module */
  canAccess: (module: string) => boolean;
  /** Granular CRUD check */
  can:       (module: string, action: RbacAction) => boolean;
}

const StaffSessionContext = createContext<StaffSessionContextType | undefined>(undefined);

// ─── helpers ────────────────────────────────────────────────

async function loadPermissionsForRole(
  roleName: string,
  customRoleId: string | null
): Promise<LoadedPermissions> {
  let roleId: string | null = customRoleId ?? null;

  if (!roleId) {
    const { data: roleRow } = await supabase
      .from("roles")
      .select("id")
      .eq("name", roleName)
      .is("business_id", null)
      .maybeSingle();
    roleId = roleRow?.id ?? null;
  }

  if (!roleId) return EMPTY_PERMISSIONS;

  const [{ data: perms }, { data: fields }] = await Promise.all([
    supabase
      .from("role_permissions")
      .select("module,can_create,can_read,can_update,can_delete,can_approve")
      .eq("role_id", roleId),
    supabase
      .from("field_permissions")
      .select("module,field_name,is_visible")
      .eq("role_id", roleId),
  ]);

  const modules: LoadedPermissions["modules"] = {};
  for (const p of perms ?? []) {
    modules[p.module] = {
      can_create:  p.can_create,
      can_read:    p.can_read,
      can_update:  p.can_update,
      can_delete:  p.can_delete,
      can_approve: p.can_approve,
    };
  }

  const fieldMap: LoadedPermissions["fields"] = {};
  for (const f of fields ?? []) {
    if (!fieldMap[f.module]) fieldMap[f.module] = {};
    fieldMap[f.module][f.field_name] = f.is_visible;
  }

  return { roleId, modules, fields: fieldMap };
}

// ─── provider ───────────────────────────────────────────────

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [staff, setStaff] = useState<StaffSession | null>(() => {
    const saved = sessionStorage.getItem("nexus_staff_session");
    return saved ? JSON.parse(saved) : null;
  });

  const [permissions, setPermissions] = useState<LoadedPermissions>(EMPTY_PERMISSIONS);

  const [ownerBypass, setOwnerBypass] = useState(() =>
    sessionStorage.getItem("nexus_owner_session") === "1"
  );

  // True while we're waiting for the DB check to resolve after login/refresh
  const [staffLoading, setStaffLoading] = useState(true);

  const setOwnerAccess = useCallback(() => {
    sessionStorage.setItem("nexus_owner_session", "1");
    setOwnerBypass(true);
    setPermissions(OWNER_PERMISSIONS);
  }, []);

  // Load permissions whenever staff session or ownerBypass changes
  useEffect(() => {
    if (ownerBypass) {
      setPermissions(OWNER_PERMISSIONS);
      return;
    }
    if (!staff) {
      setPermissions(EMPTY_PERMISSIONS);
      return;
    }
    loadPermissionsForRole(staff.role, staff.customRoleId).then(setPermissions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff?.id, staff?.role, staff?.customRoleId, ownerBypass]);

  // On every auth state change (login / refresh):
  // 1. Check if logged-in user is the business owner → auto-bypass, no click needed
  // 2. Check if logged-in user is a staff member → set staff session from DB (tamper-proof)
  // 3. If neither → clear any stale session
  useEffect(() => {
    if (!user) {
      setStaffLoading(false);
      return;
    }

    setStaffLoading(true);

    supabase
      .from("staff_members")
      .select("id, name, role, custom_role_id, business_id, businesses(owner_id)")
      .eq("supabase_user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          // No staff record for this user — clear any stale session
          setStaff(null);
          setPermissions(EMPTY_PERMISSIONS);
          sessionStorage.removeItem("nexus_staff_session");
          setStaffLoading(false);
          return;
        }

        const biz = data.businesses as any;

        // Business owner — grant full bypass automatically (no button click needed)
        if (biz?.owner_id === user.id) {
          setOwnerAccess();
          setStaffLoading(false);
          return;
        }

        // Regular staff — always pull role from DB (prevents session tampering)
        const freshSession: StaffSession = {
          id:           data.id,
          name:         data.name,
          role:         data.role,
          customRoleId: (data as any).custom_role_id ?? null,
        };
        setStaff(freshSession);
        sessionStorage.setItem("nexus_staff_session", JSON.stringify(freshSession));
        setStaffLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const logout = useCallback(() => {
    if (staff) {
      supabase.rpc("staff_logout", { _staff_id: staff.id }).then(() => {});
    }
    setStaff(null);
    setOwnerBypass(false);
    setPermissions(EMPTY_PERMISSIONS);
    setStaffLoading(false);
    sessionStorage.removeItem("nexus_staff_session");
    sessionStorage.removeItem("nexus_owner_session");
  }, [staff]);

  const canAccess = useCallback((module: string): boolean => {
    if (ownerBypass) return true;
    return permissions.modules[module]?.can_read ?? false;
  }, [permissions, ownerBypass]);

  const can = useCallback((module: string, action: RbacAction): boolean => {
    if (ownerBypass) return true;
    const key = actionKey(action);
    return permissions.modules[module]?.[key] ?? false;
  }, [permissions, ownerBypass]);

  return (
    <StaffSessionContext.Provider
      value={{
        staff, permissions, isStaffLoggedIn: !!staff,
        ownerBypass, staffLoading, setOwnerAccess,
        logout, canAccess, can,
      }}
    >
      {children}
    </StaffSessionContext.Provider>
  );
}

export function useStaffSession() {
  const context = useContext(StaffSessionContext);
  if (!context) throw new Error("useStaffSession must be used within StaffSessionProvider");
  return context;
}
