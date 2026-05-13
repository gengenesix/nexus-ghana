import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface LineItem { description: string; qty: string; unit_price: string; }

interface PurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PurchaseOrderDialog({ open, onOpenChange }: PurchaseOrderDialogProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier_name: "",
    date: new Date().toISOString().split("T")[0],
    expected_date: "",
    notes: "",
  });
  const [lines, setLines] = useState<LineItem[]>([{ description: "", qty: "1", unit_price: "" }]);

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.unit_price) || 0), 0);

  const handleSave = async () => {
    if (!form.supplier_name.trim()) { toast.error("Supplier name is required"); return; }
    const validLines = lines.filter(l => l.description && parseFloat(l.unit_price));
    if (validLines.length === 0) { toast.error("Add at least one line item"); return; }
    setSaving(true);
    try {
      const poNum = `PO-${Date.now().toString(36).toUpperCase()}`;
      const { data: po, error } = await supabase.from("purchase_orders").insert({
        business_id: business!.id,
        po_number: poNum,
        supplier_name: form.supplier_name.trim(),
        date: form.date,
        expected_date: form.expected_date || null,
        notes: form.notes || null,
        subtotal,
        total: subtotal,
        status: "draft",
      }).select().single();
      if (error) throw error;

      const itemRows = validLines.map(l => ({
        po_id: po.id,
        description: l.description,
        qty: parseFloat(l.qty) || 1,
        unit_price: parseFloat(l.unit_price) || 0,
      }));
      await supabase.from("purchase_order_items").insert(itemRows);

      toast.success("Purchase order created");
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      onOpenChange(false);
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label>Supplier *</Label><Input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Expected Delivery</Label><Input type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} /></div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label>Line Items</Label>
              <Button variant="ghost" size="sm" onClick={() => setLines(prev => [...prev, { description: "", qty: "1", unit_price: "" }])}><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="p-2 text-left">Description</th><th className="p-2 text-right w-20">Qty</th><th className="p-2 text-right w-28">Unit Price</th><th className="p-2 text-right w-28">Total</th><th className="w-10"></th></tr></thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1"><Input className="h-8 text-xs" value={line.description} onChange={e => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, description: e.target.value } : l))} placeholder="Item description" /></td>
                      <td className="p-1"><Input className="h-8 text-xs text-right" type="number" value={line.qty} onChange={e => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, qty: e.target.value } : l))} /></td>
                      <td className="p-1"><Input className="h-8 text-xs text-right" type="number" value={line.unit_price} onChange={e => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, unit_price: e.target.value } : l))} placeholder="0.00" /></td>
                      <td className="p-2 text-right font-mono text-xs">{((parseFloat(line.qty) || 0) * (parseFloat(line.unit_price) || 0)).toFixed(2)}</td>
                      <td className="p-1">{lines.length > 1 && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/30 font-medium"><td colSpan={3} className="p-2 text-right">Subtotal</td><td className="p-2 text-right font-mono">GHS {subtotal.toFixed(2)}</td><td></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create PO</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
