import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { useBusiness } from "@/hooks/useBusiness";
import { ApprovalActionType, APPROVAL_ACTION_LABELS } from "@/lib/rbac";
import { toast } from "sonner";

export interface ApprovalRequest {
  id:            string;
  business_id:   string;
  requested_by:  string;
  requester_name:string;
  action_type:   string;
  module:        string;
  payload:       Record<string, unknown>;
  status:        'pending' | 'approved' | 'rejected';
  reviewed_by:   string | null;
  reviewer_name: string;
  reviewer_note: string | null;
  created_at:    string;
  reviewed_at:   string | null;
}

/**
 * useApproval()
 *
 * requestApproval — creates a pending approval_request row.
 * approveRequest / rejectRequest — update the request status.
 *
 * @example
 *   const { requestApproval } = useApproval();
 *   await requestApproval('void_sale', 'pos', { sale_id: '...' });
 */
export function useApproval() {
  const { staff } = useStaffSession();
  const { business } = useBusiness();
  const queryClient = useQueryClient();

  const requestApproval = useCallback(
    async (
      actionType: ApprovalActionType,
      module: string,
      payload: Record<string, unknown>
    ): Promise<string | null> => {
      if (!business || !staff) {
        toast.error("Cannot create approval request: no active session.");
        return null;
      }

      const label = APPROVAL_ACTION_LABELS[actionType] ?? actionType;

      const { data, error } = await supabase
        .from("approval_requests")
        .insert({
          business_id:    business.id,
          requested_by:   staff.id,
          requester_name: staff.name,
          action_type:    actionType,
          module,
          payload,
          status:         "pending",
        })
        .select("id")
        .single();

      if (error || !data) {
        toast.error("Failed to submit approval request.");
        return null;
      }

      toast.success(`Approval requested for: ${label}`);
      queryClient.invalidateQueries({ queryKey: ["approval-requests"] });
      return data.id;
    },
    [business, staff, queryClient]
  );

  const approveRequest = useCallback(
    async (requestId: string, note?: string): Promise<boolean> => {
      if (!staff) return false;
      const { error } = await supabase
        .from("approval_requests")
        .update({
          status:        "approved",
          reviewed_by:   staff.id,
          reviewer_name: staff.name,
          reviewer_note: note ?? null,
          reviewed_at:   new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) { toast.error("Failed to approve request."); return false; }
      toast.success("Request approved.");
      queryClient.invalidateQueries({ queryKey: ["approval-requests"] });
      return true;
    },
    [staff, queryClient]
  );

  const rejectRequest = useCallback(
    async (requestId: string, note: string): Promise<boolean> => {
      if (!staff) return false;
      const { error } = await supabase
        .from("approval_requests")
        .update({
          status:        "rejected",
          reviewed_by:   staff.id,
          reviewer_name: staff.name,
          reviewer_note: note,
          reviewed_at:   new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) { toast.error("Failed to reject request."); return false; }
      toast.success("Request rejected.");
      queryClient.invalidateQueries({ queryKey: ["approval-requests"] });
      return true;
    },
    [staff, queryClient]
  );

  return { requestApproval, approveRequest, rejectRequest };
}
