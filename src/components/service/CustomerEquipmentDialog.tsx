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

const STATUSES = ["active", "retired", "lost"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipment?: any;
}

export default function CustomerEquipmentDialog({ open, onOpenChange, equipment }: Props) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: "", serial_number: "", model: "", brand: "",
    purchase_date: "", warranty_end: "", status: "active", notes: "",
  });

  useEffect(() => {
    if (equipment) {
      setForm({
        customer_name: equipment.customer_name || "",
        serial_number: equipment.serial_number || "",
        model: equipment.model || "",
        brand: equipment.brand || "",
        purchase_date: equipment.purchase_date || "",
        warranty_end: equipment.warranty_end || "",
        status: equipment.status || "active",
        notes: equipment.notes || "",
      });
    } else {
      setForm({ customer_name: "", serial_number: "", model: "", brand: "", purchase_date: "", warranty_end: "", status: "active", notes: "" });
    }
  }, [equipment, open]);

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.customer_name.trim()) { toast.error("Customer name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        business_id: business!.id,
        customer_name: form.customer_name,
        serial_number: form.serial_number || null,
        model: form.model || null,
        brand: form.brand || null,
        purchase_date: form.purchase_date || null,
        warranty_end: form.warranty_end || null,
        status: form.status,
        notes: form.notes || null,
      };
      if (equipment?.id) {
        const { error } = await supabase.from("customer_equipment").update(payload).eq("id", equipment.id);
        if (error) throw error;
        toast.success("Equipment updated");
      } else {
        const { error } = await supabase.from("customer_equipment").insert(payload);
        if (error) throw error;
        toast.success("Equipment registered");
      }
      queryClient.invalidateQueries({ queryKey: ["customer_equipment"] });
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
        <DialogHeader><DialogTitle>{equipment ? "Edit Equipment" : "Register Equipment"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Customer Name *</Label>
            <Input value={form.customer_name} onChange={e => f("customer_name", e.target.value)} placeholder="Owner name" />
          </div>
          <div className="space-y-1">
            <Label>Brand</Label>
            <Input value={form.brand} onChange={e => f("brand", e.target.value)} placeholder="e.g. Samsung" />
          </div>
          <div className="space-y-1">
            <Label>Model</Label>
            <Input value={form.model} onChange={e => f("model", e.target.value)} placeholder="e.g. Galaxy A54" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Serial Number</Label>
            <Input value={form.serial_number} onChange={e => f("serial_number", e.target.value)} placeholder="Device serial or IMEI" />
          </div>
          <div className="space-y-1">
            <Label>Purchase Date</Label>
            <Input type="date" value={form.purchase_date} onChange={e => f("purchase_date", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Warranty Expires</Label>
            <Input type="date" value={form.warranty_end} onChange={e => f("warranty_end", e.target.value)} />
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
            <Textarea value={form.notes} onChange={e => f("notes", e.target.value)} rows={2} placeholder="Condition, accessories, etc." />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {equipment ? "Save Changes" : "Register"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
