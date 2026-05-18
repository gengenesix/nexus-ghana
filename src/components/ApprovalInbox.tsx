import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { useAuth } from "@/contexts/AuthContext";
import { isApproverRole, APPROVAL_ACTION_LABELS } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ClipboardCheck, Check, X, Loader2, ArrowRight,
  FileText, CalendarDays, BookOpen, ShieldAlert,
} from "lucide-react";

type QuickItem = {
  id: string;
  label: string;
  sub: string;
  type: "invoice" | "leave" | "journal" | "approval_request";
  icon: React.ReactNode;
  canReject: boolean;
};

export function ApprovalInbox() {
  const { business } = useBusiness();
  const { staff, ownerBypass } = useStaffSession();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const isOwner = !!user && !!business && business.owner_id === user.id;
  const canReview = isOwner || ownerBypass || (!!staff && isApproverRole(staff.role));

  // ── Data fetches ───────────────────────────────────────────────────────────
  const { data: pendingInvoices = [] } = useQuery({
    queryKey: ["inbox-invoices", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, customer_name, total")
        .eq("business_id", business!.id)
        .eq("status", "draft")
        .limit(10);
      if (error) throw error;
      return (data ?? []).map((d) => ({
        id: d.id,
        label: `Invoice ${d.invoice_number}`,
        sub: d.customer_name ?? "",
        type: "invoice" as const,
        icon: <FileText className="h-3.5 w-3.5 text-blue-500" />,
        canReject: false,
      }));
    },
    enabled: !!business && canReview,
  });

  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ["inbox-leaves", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, leave_type, days, employee_id")
        .eq("business_id", business!.id)
        .eq("status", "pending")
        .limit(10);
      if (error) throw error;
      return (data ?? []).map((d) => ({
        id: d.id,
        label: `Leave: ${d.leave_type}`,
        sub: `${d.days} day${d.days !== 1 ? "s" : ""}`,
        type: "leave" as const,
        icon: <CalendarDays className="h-3.5 w-3.5 text-amber-500" />,
        canReject: true,
      }));
    },
    enabled: !!business && canReview,
  });

  const { data: pendingJournals = [] } = useQuery({
    queryKey: ["inbox-journals", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("id, entry_number, description")
        .eq("business_id", business!.id)
        .eq("status", "draft")
        .limit(10);
      if (error) throw error;
      return (data ?? []).map((d) => ({
        id: d.id,
        label: `Journal ${d.entry_number ?? ""}`,
        sub: d.description ?? "",
        type: "journal" as const,
        icon: <BookOpen className="h-3.5 w-3.5 text-purple-500" />,
        canReject: false,
      }));
    },
    enabled: !!business && canReview,
  });

  const { data: pendingApprovalRequests = [] } = useQuery({
    queryKey: ["inbox-approval-requests", business?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("approval_requests")
        .select("id, action_type, module, requester_name, payload")
        .eq("business_id", business!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return ((data as any[]) ?? []).map((d) => ({
        id: d.id,
        label: APPROVAL_ACTION_LABELS[d.action_type as keyof typeof APPROVAL_ACTION_LABELS] ?? d.action_type,
        sub: `by ${d.requester_name}`,
        type: "approval_request" as const,
        icon: <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />,
        canReject: true,
      }));
    },
    enabled: !!business && canReview,
  });

  const allItems: QuickItem[] = [
    ...pendingApprovalRequests,
    ...pendingInvoices,
    ...pendingLeaves,
    ...pendingJournals,
  ];
  const count = allItems.length;

  // ── Mutations ───────────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async (item: QuickItem) => {
      setActingId(item.id);
      let error: any;

      if (item.type === "invoice") {
        ({ error } = await supabase.from("invoices").update({ status: "sent" }).eq("id", item.id));
      } else if (item.type === "leave") {
        ({ error } = await supabase.from("leave_requests").update({ status: "approved" }).eq("id", item.id));
      } else if (item.type === "journal") {
        ({ error } = await supabase.from("journal_entries").update({ status: "posted" }).eq("id", item.id));
      } else if (item.type === "approval_request") {
        const reviewerName = staff?.name ?? "Owner";
        const reviewerId = staff?.id ?? null;
        ({ error } = await (supabase as any)
          .from("approval_requests")
          .update({
            status: "approved",
            reviewed_by: reviewerId,
            reviewer_name: reviewerName,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", item.id));
      }

      if (error) throw error;
    },
    onSuccess: (_, item) => {
      toast.success(`Approved: ${item.label}`);
      invalidateAll();
    },
    onError: (err: any, item) => {
      toast.error(`Failed to approve "${item.label}": ${err?.message ?? "Unknown error"}`);
    },
    onSettled: () => setActingId(null),
  });

  const rejectMutation = useMutation({
    mutationFn: async (item: QuickItem) => {
      setActingId(item.id);
      let error: any;

      if (item.type === "leave") {
        ({ error } = await supabase.from("leave_requests").update({ status: "rejected" }).eq("id", item.id));
      } else if (item.type === "approval_request") {
        const reviewerName = staff?.name ?? "Owner";
        const reviewerId = staff?.id ?? null;
        ({ error } = await (supabase as any)
          .from("approval_requests")
          .update({
            status: "rejected",
            reviewed_by: reviewerId,
            reviewer_name: reviewerName,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", item.id));
      }

      if (error) throw error;
    },
    onSuccess: (_, item) => {
      toast.success(`Rejected: ${item.label}`);
      invalidateAll();
    },
    onError: (err: any, item) => {
      toast.error(`Failed to reject "${item.label}": ${err?.message ?? "Unknown error"}`);
    },
    onSettled: () => setActingId(null),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["inbox-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-leaves"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-journals"] });
    queryClient.invalidateQueries({ queryKey: ["inbox-approval-requests"] });
    queryClient.invalidateQueries({ queryKey: ["approval-requests"] });
    queryClient.invalidateQueries({ queryKey: ["approval-requests-pending-count"] });
  }

  // Don't render for staff without approver role
  if (!canReview) return null;

  const isPending = (id: string) =>
    actingId === id && (approveMutation.isPending || rejectMutation.isPending);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <ClipboardCheck className="h-4 w-4" />
          {count > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] bg-orange-500 text-white border-0">
              {count > 99 ? "99+" : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[340px] p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="font-semibold text-sm">Pending Approvals</p>
            <p className="text-xs text-muted-foreground">
              {count === 0 ? "All caught up" : `${count} item${count !== 1 ? "s" : ""} need review`}
            </p>
          </div>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1 h-7 px-2"
              onClick={() => { setOpen(false); navigate("/approvals"); }}
            >
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Items */}
        <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
          {count === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <ClipboardCheck className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nothing pending</p>
            </div>
          ) : (
            allItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate leading-tight">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isPending(item.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                        onClick={() => approveMutation.mutate(item)}
                        title="Approve"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      {item.canReject && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => rejectMutation.mutate(item)}
                          title="Reject"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {count > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full text-sm gap-2 h-8"
                onClick={() => { setOpen(false); navigate("/approvals"); }}
              >
                Open full approvals queue <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
