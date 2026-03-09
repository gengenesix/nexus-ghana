import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const METHODS = ["cash", "bank_transfer", "mobile_money", "check", "card"];

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "incoming" | "outgoing";
}

export default function PaymentDialog({ open, onOpenChange, type }: PaymentDialogProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: "", payment_method: "cash", reference: "", notes: "", date: new Date().toISOString().split("T")[0], bank_account_id: "" });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank_accounts", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("id, name").eq("business_id", business!.id).eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id && open,
  });

  const handleSave = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast.error("Valid amount is required"); return; }
    setSaving(true);
    try {
      const paymentNum = `${type === "incoming" ? "PMT-IN" : "PMT-OUT"}-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("payments").insert({
        business_id: business!.id,
        payment_number: paymentNum,
        type,
        amount,
        payment_method: form.payment_method,
        reference: form.reference || null,
        notes: form.notes || null,
        date: form.date,
        bank_account_id: form.bank_account_id || null,
      });
      if (error) throw error;
      toast.success(`${type === "incoming" ? "Incoming" : "Outgoing"} payment recorded`);
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      onOpenChange(false);
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{type === "incoming" ? "Record Incoming Payment" : "Record Outgoing Payment"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Amount (GHS) *</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" /></div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Method</Label>
              <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Bank Account</Label>
              <Select value={form.bank_account_id} onValueChange={v => setForm(f => ({ ...f, bank_account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{bankAccounts.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Reference</Label><Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Invoice # or receipt ref" /></div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Record Payment</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
