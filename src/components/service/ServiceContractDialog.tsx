import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const TYPES = ["maintenance", "warranty", "service", "support"];
const STATUSES = ["active", "pending", "expired", "cancelled"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract?: any;
}

export default function ServiceContractDialog({ open, onOpenChange, contract }: Props) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: "", contract_number: "", type: "maintenance",
    start_date: "", end_date: "", value: "", status: "active", notes: "",
  });

  useEffect(() => {
    if (contract) {
      setForm({
        customer_name: contract.customer_name || "",
        contract_number: contract.contract_number || "",
        type: contract.type || "maintenance",
        start_date: contract.start_date || "",
        end_date: contract.end_date || "",
        value: String(contract.value || ""),
        status: contract.status || "active",
        notes: contract.notes || "",
      });
    } else {
      setForm({ customer_name: "", contract_number: "", type: "maintenance", start_date: "", end_date: "", value: "", status: "active", notes: "" });
    }
  }, [contract, open]);

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.customer_name.trim() || !form.contract_number.trim() || !form.start_date || !form.end_date) {
      toast.error("Customer, contract number, and dates are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        business_id: business!.id,
        customer_name: form.customer_name,
        contract_number: form.contract_number,
        type: form.type,
        start_date: form.start_date,
        end_date: form.end_date,
        value: parseFloat(form.value) || 0,
        status: form.status,
        notes: form.notes || null,
      };
      if (contract?.id) {
        const { error } = await supabase.from("service_contracts").update(payload).eq("id", contract.id);
        if (error) throw error;
        toast.success("Contract updated");
      } else {
        const { error } = await supabase.from("service_contracts").insert(payload);
        if (error) throw error;
        toast.success("Contract created");
      }
      queryClient.invalidateQueries({ queryKey: ["service_contracts"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{contract ? "Edit Contract" : "New Service Contract"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Customer Name *</Label>
            <Input value={form.customer_name} onChange={e => f("customer_name", e.target.value)} placeholder="Customer or company name" />
          </div>
          <div className="space-y-1">
            <Label>Contract # *</Label>
            <Input value={form.contract_number} onChange={e => f("contract_number", e.target.value)} placeholder="SVC-001" />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={v => f("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Start Date *</Label>
            <Input type="date" value={form.start_date} onChange={e => f("start_date", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>End Date *</Label>
            <Input type="date" value={form.end_date} onChange={e => f("end_date", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Value (GHS)</Label>
            <Input type="number" value={form.value} onChange={e => f("value", e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => f("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => f("notes", e.target.value)} rows={2} placeholder="Coverage details, SLAs, etc." />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {contract ? "Save Changes" : "Create Contract"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
