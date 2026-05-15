import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { isApproverRole, APPROVAL_ACTION_LABELS } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldAlert, CheckCircle2, XCircle, Clock, ClipboardList, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-lime-600/20 text-lime-700 border-lime-600/30">Approved</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="outline" className="border-amber-500/40 text-amber-600">Pending</Badge>;
}

export default function Approvals() {
  const { business } = useBusiness();
  const { staff, ownerBypass } = useStaffSession();
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [note, setNote] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  const isOwner = !!user && !!business && business.owner_id === user.id;
  const canReview = isOwner || ownerBypass || (staff && isApproverRole(staff.role));

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["approval-requests", business?.id, tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_requests")
        .select("*")
        .eq("business_id", business!.id)
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!business,
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["approval-requests-pending-count", business?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("approval_requests")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business!.id)
        .eq("status", "pending");
      return count ?? 0;
    },
    enabled: !!business,
    refetchInterval: 30000,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action, note }: { id: string; action: "approved" | "rejected"; note: string }) => {
      const reviewerName = staff?.name ?? "Owner";
      const reviewerId   = staff?.id ?? null;
      const { error } = await supabase
        .from("approval_requests")
        .update({
          status:        action,
          reviewed_by:   reviewerId,
          reviewer_name: reviewerName,
          reviewer_note: note || null,
          reviewed_at:   new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      return { id, action };
    },
    onSuccess: async ({ id, action }) => {
      await logAction(`approval.${action}`, "approvals", id);
      toast.success(action === "approved" ? "Request approved." : "Request rejected.");
      queryClient.invalidateQueries({ queryKey: ["approval-requests"] });
      setReviewTarget(null);
      setNote("");
    },
    onError: () => toast.error("Action failed."),
  });

  const handleReview = async (action: "approved" | "rejected") => {
    if (!reviewTarget) return;
    setIsApproving(true);
    await reviewMutation.mutateAsync({ id: reviewTarget.id, action, note });
    setIsApproving(false);
  };

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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Approval Requests</h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount > 0
              ? `${pendingCount} pending request${pendingCount !== 1 ? "s" : ""} need your review`
              : "No pending requests"}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
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
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Approved
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="h-4 w-4" />
            Rejected
          </TabsTrigger>
        </TabsList>

        {(["pending", "approved", "rejected"] as const).map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <ClipboardList className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No {t} requests.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {requests.map((req: any) => (
                  <Card key={req.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusBadge status={req.status} />
                            <span className="font-semibold text-sm">
                              {APPROVAL_ACTION_LABELS[req.action_type as keyof typeof APPROVAL_ACTION_LABELS] ?? req.action_type}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">
                              · {req.module}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Requested by{" "}
                            <span className="font-medium text-foreground">{req.requester_name}</span>
                            {" · "}
                            {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                          </p>
                          {req.reviewer_note && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              Note: {req.reviewer_note}
                            </p>
                          )}
                          {req.reviewed_at && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Reviewed by {req.reviewer_name}{" "}
                              {formatDistanceToNow(new Date(req.reviewed_at), { addSuffix: true })}
                            </p>
                          )}
                          {/* Payload summary */}
                          {req.payload && Object.keys(req.payload).length > 0 && (
                            <div className="mt-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs font-mono text-muted-foreground">
                              {Object.entries(req.payload).map(([k, v]) => (
                                <div key={k}>{k}: {String(v)}</div>
                              ))}
                            </div>
                          )}
                        </div>
                        {req.status === "pending" && canReview && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setReviewTarget(req); setNote(""); }}
                          >
                            Review
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Review dialog */}
      <Dialog open={!!reviewTarget} onOpenChange={() => { setReviewTarget(null); setNote(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Request</DialogTitle>
            <DialogDescription>
              {reviewTarget && (
                <>
                  <strong>{APPROVAL_ACTION_LABELS[reviewTarget.action_type as keyof typeof APPROVAL_ACTION_LABELS] ?? reviewTarget.action_type}</strong>
                  {" — requested by "}
                  <strong>{reviewTarget?.requester_name}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {reviewTarget?.payload && Object.keys(reviewTarget.payload).length > 0 && (
            <div className="rounded-lg bg-secondary/40 px-3 py-2 text-xs font-mono text-muted-foreground">
              {Object.entries(reviewTarget.payload).map(([k, v]) => (
                <div key={k}>{k}: {String(v)}</div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Note (optional)</label>
            <Textarea
              placeholder="Add a note for the requester..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1 bg-lime-600 hover:bg-lime-700 text-white"
              onClick={() => handleReview("approved")}
              disabled={isApproving}
            >
              {isApproving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Approve
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => handleReview("rejected")}
              disabled={isApproving}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
