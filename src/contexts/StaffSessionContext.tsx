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
  setOwnerAccess:  () => void;
  loginWithPin: (
    businessId: string,
    pin: string,
    staffId?: string
  ) => Promise<{ success: true; session: StaffSession } | { success: false; reason: string }>;
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

  // Auto-create staff session for Supabase-linked staff accounts
  useEffect(() => {
    if (!user || staff) return;
    supabase
      .from("staff_members")
      .select("id, name, role, custom_role_id, business_id, businesses(owner_id)")
      .eq("supabase_user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const biz = data.businesses as any;
        if (biz?.owner_id === user.id) return;
        const session: StaffSession = {
          id:           data.id,
          name:         data.name,
          role:         data.role,
          customRoleId: (data as any).custom_role_id ?? null,
        };
        setStaff(session);
        sessionStorage.setItem("nexus_staff_session", JSON.stringify(session));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loginWithPin = useCallback(async (
    businessId: string,
    pin: string,
    staffId?: string
  ): Promise<{ success: true; session: StaffSession } | { success: false; reason: string }> => {
    const { data, error } = await supabase.rpc("verify_staff_pin", {
      _business_id: businessId,
      _pin:         pin,
      _staff_id:    staffId ?? null,
    });

    if (error || !data || data.length === 0) {
      return { success: false, reason: "Invalid PIN or staff not found." };
    }

    const staffData = data[0];

    // Time-based access check (Africa/Accra)
    try {
      const { data: timeCheck } = await supabase.rpc("check_time_access", {
        _staff_id: staffData.id,
      });
      if (timeCheck && !(timeCheck as any).allowed) {
        return { success: false, reason: (timeCheck as any).message ?? "Access restricted at this time." };
      }
    } catch {
      // If the RPC doesn't exist yet (pre-migration), allow login
    }

    const session: StaffSession = {
      id:           staffData.id,
      name:         staffData.name,
      role:         staffData.role,
      customRoleId: (staffData as any).custom_role_id ?? null,
    };

    setStaff(session);
    sessionStorage.setItem("nexus_staff_session", JSON.stringify(session));
    return { success: true, session };
  }, []);

  const logout = useCallback(() => {
    if (staff) {
      supabase.rpc("staff_logout", { _staff_id: staff.id }).then(() => {});
    }
    setStaff(null);
    setOwnerBypass(false);
    setPermissions(EMPTY_PERMISSIONS);
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
        ownerBypass, setOwnerAccess,
        loginWithPin, logout, canAccess, can,
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
