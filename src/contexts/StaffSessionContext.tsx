import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StaffSession {
  id: string;
  name: string;
  role: string;
}

interface StaffSessionContextType {
  staff: StaffSession | null;
  isStaffLoggedIn: boolean;
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
  const [staff, setStaff] = useState<StaffSession | null>(() => {
    const saved = sessionStorage.getItem("nexus_staff_session");
    return saved ? JSON.parse(saved) : null;
  });

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
    sessionStorage.removeItem("nexus_staff_session");
  }, [staff]);

  const canAccess = useCallback((feature: string): boolean => {
    if (!staff) return false;
    const permissions = ROLE_PERMISSIONS[staff.role] || [];
    return permissions.includes(feature);
  }, [staff]);

  return (
    <StaffSessionContext.Provider value={{ staff, isStaffLoggedIn: !!staff, loginWithPin, logout, canAccess }}>
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
