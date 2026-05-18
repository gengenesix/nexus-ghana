import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { isApproverRole, APPROVAL_ACTION_LABELS } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  ShieldAlert, CheckCircle2, XCircle, Clock,
  ClipboardList, Loader2, FileText, CalendarDays,
  BookOpen, AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { formatGHS } from "@/lib/ghana";

// ── Unified item type ──────────────────────────────────────────────────────
type ItemKind = "invoice" | "leave" | "journal" | "workflow";

interface PendingItem {
  id:       string;
  kind:     ItemKind;
  title:    string;
  subtitle: string;
  meta?:    string;
  payload?: Record<string, unknown>;
  raw:      Record<string, unknown>;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function kindIcon(kind: ItemKind) {
  if (kind === "invoice")  return <FileText   className="h-4 w-4 text-blue-500" />;
  if (kind === "leave")    return <CalendarDays className="h-4 w-4 text-amber-500" />;
  if (kind === "journal")  return <BookOpen   className="h-4 w-4 text-purple-500" />;
  return                          <AlertCircle className="h-4 w-4 text-orange-500" />;
}

function kindLabel(kind: ItemKind) {
  if (kind === "invoice")  return "Draft Invoice";
  if (kind === "leave")    return "Leave Request";
  if (kind === "journal")  return "Journal Entry";
  return "Workflow Request";
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved" || status === "sent" || status === "posted")
    return <Badge className="bg-lime-600/20 text-lime-700 border-lime-600/30 text-[11px]">Approved</Badge>;
  if (status === "rejected")
    return <Badge variant="destructive" className="text-[11px]">Rejected</Badge>;
  return <Badge variant="outline" className="border-amber-500/40 text-amber-600 text-[11px]">Pending</Badge>;
}

// ── Main component ─────────────────────────────────────────────────────────
export default function Approvals() {
  const { business } = useBusiness();
  const { staff, ownerBypass } = useStaffSession();
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const queryClient = useQueryClient();

  const [tab, setTab]                   = useState<"pending" | "done">("pending");
  const [reviewTarget, setReviewTarget] = useState<PendingItem | null>(null);
  const [note, setNote]                 = useState("");
  const [acting, setActing]             = useState(false);

  const isOwner  = !!user && !!business && business.owner_id === user.id;
  const canReview = isOwner || ownerBypass || (!!staff && isApproverRole(staff.role));

  // ── Pending queries ──────────────────────────────────────────────────────
  const { data: pendingInvoices = [], isLoading: liLoading } = useQuery({
    queryKey: ["approvals-invoices-pending", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, customer_name, total, created_at")
        .eq("business_id", business!.id)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map<PendingItem>((d) => ({
        id:       d.id,
        kind:     "invoice",
        title:    `Invoice ${d.invoice_number ?? ""}`,
        subtitle: d.customer_name ?? "Unknown customer",
        meta:     d.total != null ? formatGHS(d.total) : undefined,
        raw:      d as any,
      }));
    },
    enabled: !!business && canReview,
  });

  const { data: pendingLeaves = [], isLoading: llLoading } = useQuery({
    queryKey: ["approvals-leaves-pending", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, leave_type, days, reason, start_date, end_date, employee_id, created_at")
        .eq("business_id", business!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map<PendingItem>((d) => ({
        id:       d.id,
        kind:     "leave",
        title:    `Leave: ${d.leave_type}`,
        subtitle: `${d.days} day${d.days !== 1 ? "s" : ""} · ${d.start_date ?? ""} → ${d.end_date ?? ""}`,
        meta:     d.reason ?? undefined,
        raw:      d as any,
      }));
    },
    enabled: !!business && canReview,
  });

  const { data: pendingJournals = [], isLoading: ljLoading } = useQuery({
    queryKey: ["approvals-journals-pending", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("id, entry_number, description, total_debit, created_at")
        .eq("business_id", business!.id)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map<PendingItem>((d) => ({
        id:       d.id,
        kind:     "journal",
        title:    `Journal ${d.entry_number ?? ""}`,
        subtitle: d.description ?? "No description",
        meta:     d.total_debit != null ? formatGHS(d.total_debit) : undefined,
        raw:      d as any,
      }));
    },
    enabled: !!business && canReview,
  });

  const { data: pendingWorkflow = [], isLoading: lwLoading } = useQuery({
    queryKey: ["approvals-workflow-pending", business?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("approval_requests")
        .select("id, action_type, module, requester_name, payload, created_at")
        .eq("business_id", business!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        // Table might not exist yet — return empty silently
        if (error.code === "42P01") return [];
        throw error;
      }
      return ((data as any[]) ?? []).map<PendingItem>((d) => ({
        id:       d.id,
        kind:     "workflow",
        title:    APPROVAL_ACTION_LABELS[d.action_type as keyof typeof APPROVAL_ACTION_LABELS] ?? d.action_type,
        subtitle: `Requested by ${d.requester_name} · ${d.module}`,
        payload:  d.payload,
        raw:      d as any,
      }));
    },
    enabled: !!business && canReview,
  });

  // ── Done queries (approved + rejected items from last 30 days) ───────────
  const { data: doneInvoices = [], isLoading: diLoading } = useQuery({
    queryKey: ["approvals-invoices-done", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, customer_name, total, status, updated_at")
        .eq("business_id", business!.id)
        .in("status", ["sent", "paid", "void"])
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map<PendingItem & { status: string; doneAt: string }>((d) => ({
        id:       d.id,
        kind:     "invoice",
        title:    `Invoice ${d.invoice_number ?? ""}`,
        subtitle: d.customer_name ?? "",
        meta:     d.total != null ? formatGHS(d.total) : undefined,
        status:   d.status,
        doneAt:   d.updated_at ?? "",
        raw:      d as any,
      }));
    },
    enabled: !!business && canReview && tab === "done",
  });

  const { data: doneLeaves = [], isLoading: dlLoading } = useQuery({
    queryKey: ["approvals-leaves-done", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, leave_type, days, status, start_date, end_date, updated_at")
        .eq("business_id", business!.id)
        .in("status", ["approved", "rejected"])
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map<PendingItem & { status: string; doneAt: string }>((d) => ({
        id:       d.id,
        kind:     "leave",
        title:    `Leave: ${d.leave_type}`,
        subtitle: `${d.days} day${d.days !== 1 ? "s" : ""} · ${d.start_date ?? ""} → ${d.end_date ?? ""}`,
        status:   d.status,
        doneAt:   (d as any).updated_at ?? "",
        raw:      d as any,
      }));
    },
    enabled: !!business && canReview && tab === "done",
  });

  const { data: doneWorkflow = [], isLoading: dwLoading } = useQuery({
    queryKey: ["approvals-workflow-done", business?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("approval_requests")
        .select("id, action_type, module, requester_name, reviewer_name, reviewer_note, status, reviewed_at")
        .eq("business_id", business!.id)
        .in("status", ["approved", "rejected"])
        .order("reviewed_at", { ascending: false })
        .limit(20);
      if (error) { if (error.code === "42P01") return []; throw error; }
      return ((data as any[]) ?? []).map<PendingItem & { status: string; doneAt: string }>((d) => ({
        id:       d.id,
        kind:     "workflow",
        title:    APPROVAL_ACTION_LABELS[d.action_type as keyof typeof APPROVAL_ACTION_LABELS] ?? d.action_type,
        subtitle: `${d.requester_name} · reviewed by ${d.reviewer_name}`,
        meta:     d.reviewer_note ?? undefined,
        status:   d.status,
        doneAt:   d.reviewed_at ?? "",
        raw:      d as any,
      }));
    },
    enabled: !!business && canReview && tab === "done",
  });

  const allPending = [...pendingWorkflow, ...pendingInvoices, ...pendingLeaves, ...pendingJournals];
  const allDone    = [...doneWorkflow, ...doneInvoices, ...doneLeaves];
  const isLoading  = liLoading || llLoading || ljLoading || lwLoading;
  const isDoneLoading = diLoading || dlLoading || dwLoading;
  const pendingCount = allPending.length;

  // ── Approve mutation ─────────────────────────────────────────────────────
  const approve = useMutation({
    mutationFn: async ({ item, note }: { item: PendingItem; note: string }) => {
      const reviewerName = staff?.name ?? "Owner";
      const reviewerId   = staff?.id ?? null;

      if (item.kind === "invoice") {
        const { error } = await supabase.from("invoices").update({ status: "sent" }).eq("id", item.id);
        if (error) throw error;
      } else if (item.kind === "leave") {
        const { error } = await supabase.from("leave_requests").update({ status: "approved" }).eq("id", item.id);
        if (error) throw error;
      } else if (item.kind === "journal") {
        const { error } = await supabase.from("journal_entries").update({ status: "posted" }).eq("id", item.id);
        if (error) throw error;
      } else if (item.kind === "workflow") {
        const { error } = await (supabase as any)
          .from("approval_requests")
          .update({ status: "approved", reviewed_by: reviewerId, reviewer_name: reviewerName, reviewer_note: note || null, reviewed_at: new Date().toISOString() })
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: async (_, { item }) => {
      await logAction("approval.approved", "approvals", item.id).catch(() => {});
      toast.success(`Approved: ${item.title}`);
      invalidateAll();
      setReviewTarget(null);
      setNote("");
    },
    onError: (err: any) => toast.error(`Approval failed: ${err?.message ?? "Unknown error"}`),
  });

  // ── Reject mutation ──────────────────────────────────────────────────────
  const reject = useMutation({
    mutationFn: async ({ item, note }: { item: PendingItem; note: string }) => {
      const reviewerName = staff?.name ?? "Owner";
      const reviewerId   = staff?.id ?? null;

      if (item.kind === "leave") {
        const { error } = await supabase.from("leave_requests").update({ status: "rejected" }).eq("id", item.id);
        if (error) throw error;
      } else if (item.kind === "workflow") {
        const { error } = await (supabase as any)
          .from("approval_requests")
          .update({ status: "rejected", reviewed_by: reviewerId, reviewer_name: reviewerName, reviewer_note: note || null, reviewed_at: new Date().toISOString() })
          .eq("id", item.id);
        if (error) throw error;
      } else {
        // Invoices and journals don't have a "rejected" state — just leave as draft
        toast.info("This item type cannot be rejected — leave it as draft or delete it.");
        return;
      }
    },
    onSuccess: async (_, { item }) => {
      await logAction("approval.rejected", "approvals", item.id).catch(() => {});
      toast.success(`Rejected: ${item.title}`);
      invalidateAll();
      setReviewTarget(null);
      setNote("");
    },
    onError: (err: any) => toast.error(`Rejection failed: ${err?.message ?? "Unknown error"}`),
  });

  function invalidateAll() {
    ["approvals-invoices-pending","approvals-leaves-pending","approvals-journals-pending",
     "approvals-workflow-pending","approvals-invoices-done","approvals-leaves-done","approvals-workflow-done",
     "inbox-invoices","inbox-leaves","inbox-journals","inbox-approval-requests",
     "approval-requests","approval-requests-pending-count"
    ].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  }

  const handleAction = async (action: "approve" | "reject") => {
    if (!reviewTarget) return;
    setActing(true);
    if (action === "approve") await approve.mutateAsync({ item: reviewTarget, note });
    else await reject.mutateAsync({ item: reviewTarget, note });
    setActing(false);
  };

  // ── Access guard ─────────────────────────────────────────────────────────
  if (!canReview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold">Access Restricted</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Only Managers and Administrators can review approval requests.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Approval Queue</h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount > 0
              ? `${pendingCount} item${pendingCount !== 1 ? "s" : ""} awaiting your review`
              : "No pending items — all caught up"}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "done")}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending
            {pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="done" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Done
          </TabsTrigger>
        </TabsList>

        {/* ── Pending tab ── */}
        <TabsContent value="pending" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allPending.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
                <ClipboardList className="h-10 w-10 opacity-25" />
                <p className="font-medium">Nothing to review</p>
                <p className="text-xs text-center max-w-xs">
                  Draft invoices, leave requests, journal entries, and staff workflow requests will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {allPending.map((item) => (
                <Card key={`${item.kind}-${item.id}`} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                          {kindIcon(item.kind)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{item.title}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {kindLabel(item.kind)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>
                          {item.meta && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.meta}</p>
                          )}
                          {item.payload && Object.keys(item.payload).length > 0 && (
                            <div className="mt-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs font-mono text-muted-foreground">
                              {Object.entries(item.payload).map(([k, v]) => (
                                <div key={k}>{k}: {String(v)}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="bg-lime-600 hover:bg-lime-700 text-white h-8 px-3"
                          onClick={() => { setReviewTarget(item); setNote(""); }}
                        >
                          Review
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Done tab ── */}
        <TabsContent value="done" className="mt-4">
          {isDoneLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allDone.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-14 gap-2 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 opacity-25" />
                <p className="font-medium">No reviewed items yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {(allDone as any[]).map((item) => (
                <Card key={`done-${item.kind}-${item.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        {kindIcon(item.kind)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={item.status} />
                          <span className="font-medium text-sm">{item.title}</span>
                          <Badge variant="outline" className="text-[10px]">{kindLabel(item.kind)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>
                        {item.meta && <p className="text-xs text-muted-foreground italic mt-0.5">{item.meta}</p>}
                        {item.doneAt && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(item.doneAt), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Review dialog ── */}
      <Dialog open={!!reviewTarget} onOpenChange={() => { setReviewTarget(null); setNote(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Review: {reviewTarget?.title}</DialogTitle>
            <DialogDescription>{reviewTarget?.subtitle}</DialogDescription>
          </DialogHeader>

          {reviewTarget?.meta && (
            <p className="text-sm text-muted-foreground -mt-2">{reviewTarget.meta}</p>
          )}

          {reviewTarget?.payload && Object.keys(reviewTarget.payload).length > 0 && (
            <div className="rounded-lg bg-secondary/40 px-3 py-2 text-xs font-mono text-muted-foreground">
              {Object.entries(reviewTarget.payload).map(([k, v]) => (
                <div key={k}>{k}: {String(v)}</div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Note (optional)</label>
            <Textarea
              placeholder="Add context for your decision..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1 bg-lime-600 hover:bg-lime-700 text-white"
              onClick={() => handleAction("approve")}
              disabled={acting}
            >
              {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Approve
            </Button>
            {(reviewTarget?.kind === "leave" || reviewTarget?.kind === "workflow") && (
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleAction("reject")}
                disabled={acting}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => { setReviewTarget(null); setNote(""); }}
              disabled={acting}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
