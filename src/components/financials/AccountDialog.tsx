import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"];

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: any;
}

export default function AccountDialog({ open, onOpenChange, account }: AccountDialogProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    account_code: account?.account_code || "",
    name: account?.name || "",
    account_type: account?.account_type || "asset",
    description: account?.description || "",
    balance: account?.balance?.toString() || "0",
  });

  const handleSave = async () => {
    if (!form.account_code.trim() || !form.name.trim()) { toast.error("Code and name are required"); return; }
    setSaving(true);
    try {
      const payload = {
        business_id: business!.id,
        account_code: form.account_code.trim(),
        name: form.name.trim(),
        account_type: form.account_type,
        description: form.description || null,
        balance: parseFloat(form.balance) || 0,
      };
      if (account) {
        const { error } = await supabase.from("chart_of_accounts").update(payload).eq("id", account.id);
        if (error) throw error;
        toast.success("Account updated");
      } else {
        const { error } = await supabase.from("chart_of_accounts").insert(payload);
        if (error) throw error;
        toast.success("Account created");
      }
      queryClient.invalidateQueries({ queryKey: ["chart_of_accounts"] });
      onOpenChange(false);
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{account ? "Edit Account" : "New Account"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Account Code *</Label><Input value={form.account_code} onChange={e => setForm(f => ({ ...f, account_code: e.target.value }))} placeholder="1000" /></div>
            <div className="space-y-1.5"><Label>Type *</Label>
              <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Account Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Opening Balance (GHS)</Label><Input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{account ? "Update" : "Create"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
