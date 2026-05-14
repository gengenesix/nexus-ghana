import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface StaffSession {
  id: string;
  name: string;
  role: string;
}

interface StaffSessionContextType {
  staff: StaffSession | null;
  isStaffLoggedIn: boolean;
  ownerBypass: boolean;
  setOwnerAccess: () => void;
  loginWithPin: (businessId: string, pin: string, staffId?: string) => Promise<StaffSession | null>;
  logout: () => void;
  canAccess: (feature: string) => boolean;
}

const StaffSessionContext = createContext<StaffSessionContextType | undefined>(undefined);

// Role-based access control rules — SAP-style
const ROLE_PERMISSIONS: Record<string, string[]> = {
  "System Administrator": ["dashboard", "pos", "inventory", "invoices", "customers", "suppliers", "expenses", "reports", "staff", "settings", "administration", "financials", "crm", "sales", "purchasing", "production", "mrp", "projects", "opportunities", "service", "hr", "banking"],
  Administrator: ["dashboard", "pos", "inventory", "invoices", "customers", "suppliers", "expenses", "reports", "staff", "settings", "administration", "financials", "crm", "sales", "purchasing", "production", "mrp", "projects", "opportunities", "service", "hr", "banking"],
  Manager: ["dashboard", "pos", "inventory", "invoices", "customers", "suppliers", "expenses", "reports", "staff", "settings", "crm", "sales", "purchasing", "projects", "banking"],
  "CFO / Finance Manager": ["dashboard", "financials", "banking", "reports", "expenses", "invoices"],
  Accountant: ["dashboard", "financials", "banking", "expenses", "invoices", "reports"],
  "Sales Manager": ["dashboard", "pos", "crm", "sales", "opportunities", "invoices", "customers", "reports"],
  "Sales Representative": ["pos", "crm", "sales", "opportunities", "customers", "invoices"],
  Supervisor: ["dashboard", "pos", "inventory", "invoices", "customers", "reports", "crm"],
  "Purchasing Manager": ["dashboard", "purchasing", "inventory", "mrp", "suppliers"],
  "Warehouse Manager": ["dashboard", "inventory", "production", "purchasing", "suppliers"],
  "Production Planner": ["dashboard", "production", "mrp", "inventory"],
  "HR Manager": ["dashboard", "hr", "reports"],
  "Project Manager": ["dashboard", "projects", "service", "reports"],
  "Service Technician": ["service", "inventory"],
  "Executive / CEO": ["dashboard", "reports", "financials", "crm", "sales", "purchasing", "inventory", "production", "hr", "banking", "projects", "service", "opportunities"],
  Cashier: ["pos", "customers"],
  "Sales Rep": ["pos", "customers", "invoices", "crm"],
  Warehouse: ["inventory", "suppliers", "purchasing"],
  Staff: ["pos", "inventory"],
};

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [staff, setStaff] = useState<StaffSession | null>(() => {
    const saved = sessionStorage.getItem("nexus_staff_session");
    return saved ? JSON.parse(saved) : null;
  });

  const [ownerBypass, setOwnerBypass] = useState(() =>
    sessionStorage.getItem("nexus_owner_session") === "1"
  );

  const setOwnerAccess = useCallback(() => {
    sessionStorage.setItem("nexus_owner_session", "1");
    setOwnerBypass(true);
  }, []);

  // Auto-create staff session for users who have their own Supabase account
  // linked to a staff_members record (the "Join a Business" flow).
  // This means they never see a PIN gate — they authenticated with email+password.
  useEffect(() => {
    if (!user || staff) return; // Already have a session
    supabase
      .from("staff_members")
      .select("id, name, role, business_id, businesses(owner_id)")
      .eq("supabase_user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        // Safety: don't auto-create a staff session for the business owner
        const biz = data.businesses as any;
        if (biz?.owner_id === user.id) return;
        const session: StaffSession = { id: data.id, name: data.name, role: data.role };
        setStaff(session);
        sessionStorage.setItem("nexus_staff_session", JSON.stringify(session));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loginWithPin = useCallback(async (businessId: string, pin: string, staffId?: string): Promise<StaffSession | null> => {
    const { data, error } = await supabase.rpc("verify_staff_pin", {
      _business_id: businessId,
      _pin: pin,
      _staff_id: staffId ?? null,
    });

    if (error || !data || data.length === 0) {
      return null;
    }

    const staffData = data[0];
    const session: StaffSession = {
      id: staffData.id,
      name: staffData.name,
      role: staffData.role,
    };

    setStaff(session);
    sessionStorage.setItem("nexus_staff_session", JSON.stringify(session));
    return session;
  }, []);

  const logout = useCallback(() => {
    if (staff) {
      supabase.rpc("staff_logout", { _staff_id: staff.id }).then(() => {});
    }
    setStaff(null);
    setOwnerBypass(false);
    sessionStorage.removeItem("nexus_staff_session");
    sessionStorage.removeItem("nexus_owner_session");
  }, [staff]);

  const canAccess = useCallback((feature: string): boolean => {
    if (!staff) return false;
    const permissions = ROLE_PERMISSIONS[staff.role] || [];
    return permissions.includes(feature);
  }, [staff]);

  return (
    <StaffSessionContext.Provider value={{ staff, isStaffLoggedIn: !!staff, ownerBypass, setOwnerAccess, loginWithPin, logout, canAccess }}>
      {children}
    </StaffSessionContext.Provider>
  );
}

export function useStaffSession() {
  const context = useContext(StaffSessionContext);
  if (!context) {
    throw new Error("useStaffSession must be used within StaffSessionProvider");
  }
  return context;
}
