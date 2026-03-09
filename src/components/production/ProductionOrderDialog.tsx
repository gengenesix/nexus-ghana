import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ProductionOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProductionOrderDialog({ open, onOpenChange }: ProductionOrderDialogProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ product_id: "", bom_id: "", quantity: "1", planned_date: new Date().toISOString().split("T")[0], notes: "" });

  const { data: products = [] } = useQuery({
    queryKey: ["products", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id && open,
  });

  const { data: boms = [] } = useQuery({
    queryKey: ["bill_of_materials", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bill_of_materials").select("id, name").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id && open,
  });

  const handleSave = async () => {
    if (!form.quantity || parseFloat(form.quantity) <= 0) { toast.error("Valid quantity required"); return; }
    setSaving(true);
    try {
      const orderNum = `PRD-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("production_orders").insert({
        business_id: business!.id,
        order_number: orderNum,
        product_id: form.product_id || null,
        bom_id: form.bom_id || null,
        quantity: parseFloat(form.quantity),
        planned_date: form.planned_date,
        notes: form.notes || null,
        status: "planned",
      });
      if (error) throw error;
      toast.success("Production order created");
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
      onOpenChange(false);
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Production Order</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5"><Label>Product</Label>
            <Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Bill of Materials</Label>
            <Select value={form.bom_id} onValueChange={v => setForm(f => ({ ...f, bom_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select BOM (optional)" /></SelectTrigger>
              <SelectContent>{boms.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Quantity *</Label><Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Planned Date</Label><Input type="date" value={form.planned_date} onChange={e => setForm(f => ({ ...f, planned_date: e.target.value }))} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Order</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
