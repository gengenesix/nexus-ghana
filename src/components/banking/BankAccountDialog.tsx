import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const BANKS = ["GCB Bank", "Ecobank", "Stanbic Bank", "Absa Ghana", "Fidelity Bank", "CalBank", "Republic Bank", "Standard Chartered", "Zenith Bank", "Access Bank", "UBA Ghana", "FNB Ghana", "Prudential Bank", "ADB", "Mobile Money (MTN)", "Mobile Money (Telecel)", "Mobile Money (AirtelTigo)", "Other"];
const TYPES = ["checking", "savings", "mobile_money", "fixed_deposit"];

interface BankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BankAccountDialog({ open, onOpenChange }: BankAccountDialogProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", bank_name: "", account_number: "", account_type: "checking", balance: "0", currency: "GHS" });

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Account name is required"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("bank_accounts").insert({
        business_id: business!.id,
        name: form.name.trim(),
        bank_name: form.bank_name,
        account_number: form.account_number || null,
        account_type: form.account_type,
        balance: parseFloat(form.balance) || 0,
        currency: form.currency,
      });
      if (error) throw error;
      toast.success("Bank account added");
      queryClient.invalidateQueries({ queryKey: ["bank_accounts"] });
      onOpenChange(false);
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5"><Label>Account Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Main Business Account" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Bank</Label>
              <Select value={form.bank_name} onValueChange={v => setForm(f => ({ ...f, bank_name: v }))}>
                <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                <SelectContent>{BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Account Type</Label>
              <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Account Number</Label><Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Opening Balance (GHS)</Label><Input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add Account</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
