import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function StockTransferDialog({ open, onOpenChange }: Props) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    from_warehouse_id: "", to_warehouse_id: "", product_id: "",
    quantity: "", date: format(new Date(), "yyyy-MM-dd"), notes: "",
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("id, name, code").eq("business_id", business!.id).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id && open,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-transfer", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, qty").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id && open,
  });

  useEffect(() => {
    if (!open) setForm({ from_warehouse_id: "", to_warehouse_id: "", product_id: "", quantity: "", date: format(new Date(), "yyyy-MM-dd"), notes: "" });
  }, [open]);

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.from_warehouse_id || !form.to_warehouse_id || !form.product_id || !form.quantity) {
      toast.error("All fields except notes are required");
      return;
    }
    if (form.from_warehouse_id === form.to_warehouse_id) {
      toast.error("Source and destination warehouses must be different");
      return;
    }
    const qty = parseInt(form.quantity);
    if (!qty || qty <= 0) { toast.error("Quantity must be positive"); return; }

    setSaving(true);
    try {
      const transferNum = `TRF-${Date.now().toString().slice(-6)}`;
      const { error } = await supabase.from("stock_transfers").insert({
        business_id: business!.id,
        transfer_number: transferNum,
        from_warehouse_id: form.from_warehouse_id,
        to_warehouse_id: form.to_warehouse_id,
        product_id: form.product_id,
        quantity: qty,
        date: form.date,
        status: "completed",
        notes: form.notes || null,
      });
      if (error) throw error;
      toast.success(`Transfer ${transferNum} recorded`);
      queryClient.invalidateQueries({ queryKey: ["stock_transfers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedProduct = (products as any[]).find(p => p.id === form.product_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" /> New Stock Transfer
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>From Warehouse *</Label>
              <Select value={form.from_warehouse_id} onValueChange={v => f("from_warehouse_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  {(warehouses as any[]).map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>To Warehouse *</Label>
              <Select value={form.to_warehouse_id} onValueChange={v => f("to_warehouse_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>
                  {(warehouses as any[]).filter(w => w.id !== form.from_warehouse_id).map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Product *</Label>
            <Select value={form.product_id} onValueChange={v => f("product_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {(products as any[]).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} (stock: {p.qty})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProduct && (
              <p className="text-xs text-muted-foreground">Available: {selectedProduct.qty} units</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Quantity *</Label>
              <Input type="number" min="1" value={form.quantity} onChange={e => f("quantity", e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => f("date", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => f("notes", e.target.value)} rows={2} placeholder="Reason for transfer, etc." />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowRightLeft className="h-4 w-4 mr-1" />}
            Record Transfer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
