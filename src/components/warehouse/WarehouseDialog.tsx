import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface WarehouseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WarehouseDialog({ open, onOpenChange }: WarehouseDialogProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", address: "", is_default: false });

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error("Name and code are required"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("warehouses").insert({
        business_id: business!.id,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        address: form.address || null,
        is_default: form.is_default,
      });
      if (error) throw error;
      toast.success("Warehouse added");
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      onOpenChange(false);
      setForm({ name: "", code: "", address: "", is_default: false });
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Warehouse</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Warehouse Code *</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="WH01" /></div>
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Main Warehouse" /></div>
          </div>
          <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="flex items-center gap-3">
            <Switch checked={form.is_default} onCheckedChange={v => setForm(f => ({ ...f, is_default: v }))} />
            <Label>Set as default warehouse</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add Warehouse</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
