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

const STAGES = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"];

interface OpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: any;
}

export default function OpportunityDialog({ open, onOpenChange, opportunity }: OpportunityDialogProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: opportunity?.name || "",
    stage: opportunity?.stage || "prospecting",
    value: opportunity?.value?.toString() || "0",
    probability: opportunity?.probability?.toString() || "10",
    expected_close: opportunity?.expected_close || "",
    notes: opportunity?.notes || "",
  });

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        business_id: business!.id,
        name: form.name.trim(),
        stage: form.stage,
        status: form.stage.startsWith("closed") ? (form.stage === "closed_won" ? "won" : "lost") : "open",
        value: parseFloat(form.value) || 0,
        probability: parseInt(form.probability) || 10,
        expected_close: form.expected_close || null,
        notes: form.notes || null,
      };
      if (opportunity) {
        const { error } = await supabase.from("opportunities").update(payload).eq("id", opportunity.id);
        if (error) throw error;
        toast.success("Opportunity updated");
      } else {
        const { error } = await supabase.from("opportunities").insert(payload);
        if (error) throw error;
        toast.success("Opportunity created");
      }
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      onOpenChange(false);
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{opportunity ? "Edit Opportunity" : "New Opportunity"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5"><Label>Deal Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Stage</Label>
              <Select value={form.stage} onValueChange={v => setForm(f => ({ ...f, stage: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Probability %</Label><Input type="number" min="0" max="100" value={form.probability} onChange={e => setForm(f => ({ ...f, probability: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Value (GHS)</Label><Input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Expected Close</Label><Input type="date" value={form.expected_close} onChange={e => setForm(f => ({ ...f, expected_close: e.target.value }))} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{opportunity ? "Update" : "Create"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
