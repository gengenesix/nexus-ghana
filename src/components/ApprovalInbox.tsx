import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClipboardCheck, Check, X, Loader2 } from "lucide-react";

export function ApprovalInbox() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Gather pending items: draft invoices, pending leave requests, draft journal entries
  const { data: pendingInvoices = [] } = useQuery({
    queryKey: ["pending-approvals-invoices", business?.id],
    queryFn: async () => {
      const { data } = await supabase.from("invoices").select("id, invoice_number, customer_name, total, status").eq("business_id", business!.id).eq("status", "draft").limit(20);
      return (data || []).map((d: any) => ({ ...d, type: "invoice" }));
    },
    enabled: !!business,
  });

  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ["pending-approvals-leaves", business?.id],
    queryFn: async () => {
      const { data } = await supabase.from("leave_requests").select("id, leave_type, days, status, employees(first_name, last_name)").eq("business_id", business!.id).eq("status", "pending").limit(20);
      return (data || []).map((d: any) => ({ ...d, type: "leave" }));
    },
    enabled: !!business,
  });

  const { data: pendingJournals = [] } = useQuery({
    queryKey: ["pending-approvals-journals", business?.id],
    queryFn: async () => {
      const { data } = await supabase.from("journal_entries").select("id, entry_number, description, total_debit, status").eq("business_id", business!.id).eq("status", "draft").limit(20);
      return (data || []).map((d: any) => ({ ...d, type: "journal" }));
    },
    enabled: !!business,
  });

  const allPending = [...pendingInvoices, ...pendingLeaves, ...pendingJournals];
  const count = allPending.length;

  const approveMutation = useMutation({
    mutationFn: async (item: any) => {
      if (item.type === "invoice") {
        await supabase.from("invoices").update({ status: "sent" }).eq("id", item.id);
      } else if (item.type === "leave") {
        await supabase.from("leave_requests").update({ status: "approved" }).eq("id", item.id);
      } else if (item.type === "journal") {
        await supabase.from("journal_entries").update({ status: "posted" }).eq("id", item.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-approvals-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["pending-approvals-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["pending-approvals-journals"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (item: any) => {
      if (item.type === "leave") {
        await supabase.from("leave_requests").update({ status: "rejected" }).eq("id", item.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pending-approvals-leaves"] }),
  });

  const getLabel = (item: any) => {
    if (item.type === "invoice") return `Invoice ${item.invoice_number} — ${item.customer_name}`;
    if (item.type === "leave") return `Leave: ${item.employees?.first_name || ""} ${item.employees?.last_name || ""} (${item.days}d)`;
    if (item.type === "journal") return `Journal ${item.entry_number}`;
    return "Item";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <ClipboardCheck className="h-4 w-4" />
          {count > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] bg-orange-500 text-white border-0">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <p className="font-semibold text-sm">Pending Approvals</p>
          <p className="text-xs text-muted-foreground">{count} items awaiting review</p>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {count === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">All caught up! 🎉</div>
          ) : allPending.map((item: any) => (
            <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 px-3 py-2 border-b last:border-0 hover:bg-muted/50">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{getLabel(item)}</p>
                <Badge variant="outline" className="text-[10px] capitalize">{item.type}</Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => approveMutation.mutate(item)} disabled={approveMutation.isPending}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              {item.type === "leave" && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => rejectMutation.mutate(item)} disabled={rejectMutation.isPending}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
