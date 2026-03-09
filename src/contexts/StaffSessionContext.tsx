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
  loginWithPin: (businessId: string, pin: string) => Promise<StaffSession | null>;
  logout: () => void;
  canAccess: (feature: string) => boolean;
}

const StaffSessionContext = createContext<StaffSessionContextType | undefined>(undefined);

// Role-based access control rules
const ROLE_PERMISSIONS: Record<string, string[]> = {
  Manager: ["dashboard", "pos", "inventory", "invoices", "customers", "suppliers", "expenses", "reports", "staff", "settings"],
  Cashier: ["pos", "customers"],
  Staff: ["pos", "inventory"],
};

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffSession | null>(() => {
    // Restore from sessionStorage on mount
    const saved = sessionStorage.getItem("nexus_staff_session");
    return saved ? JSON.parse(saved) : null;
  });

  const loginWithPin = useCallback(async (businessId: string, pin: string): Promise<StaffSession | null> => {
    const { data, error } = await supabase.rpc("verify_staff_pin", {
      _business_id: businessId,
      _pin: pin,
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
    setStaff(null);
    sessionStorage.removeItem("nexus_staff_session");
  }, []);

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
