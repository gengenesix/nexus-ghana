import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { useBusiness } from "@/hooks/useBusiness";

/**
 * useAuditLog()
 *
 * Returns a logAction function that inserts a row into audit_logs.
 * Fire-and-forget — errors are swallowed so they never break the UI flow.
 *
 * @example
 *   const { logAction } = useAuditLog();
 *   logAction('invoice.deleted', 'invoices', invoice.id, invoice, null);
 */
export function useAuditLog() {
  const { staff, ownerBypass } = useStaffSession();
  const { business } = useBusiness();

  const logAction = useCallback(
    async (
      action:    string,
      module:    string,
      recordId:  string | null,
      oldValue?: Record<string, unknown> | null,
      newValue?: Record<string, unknown> | null
    ) => {
      if (!business) return;

      const userName = staff?.name ?? "Owner";
      const role     = staff?.role ?? (ownerBypass ? "Owner" : "Unknown");

      supabase
        .from("audit_logs")
        .insert({
          business_id:  business.id,
          staff_id:     staff?.id ?? null,
          staff_name:   userName,
          role_at_time: role,
          action,
          module,
          record_type:  module,
          record_id:    recordId ?? "",
          old_values:   (oldValue ?? null) as any,
          new_values:   (newValue ?? null) as any,
          ip_address:   "",
          user_agent:   navigator?.userAgent ?? "",
        })
        .then(() => {});
    },
    [business, staff, ownerBypass]
  );

  return { logAction };
}
