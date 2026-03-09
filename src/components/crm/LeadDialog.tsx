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

const SOURCES = ["Website", "Referral", "Social Media", "Cold Call", "Trade Show", "Advertisement", "Other"];
const STATUSES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];

interface LeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: any;
}

export default function LeadDialog({ open, onOpenChange, lead }: LeadDialogProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: lead?.name || "",
    company: lead?.company || "",
    email: lead?.email || "",
    phone: lead?.phone || "",
    source: lead?.source || "",
    status: lead?.status || "new",
    value: lead?.value?.toString() || "0",
    notes: lead?.notes || "",
  });

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        business_id: business!.id,
        name: form.name.trim(),
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        source: form.source || null,
        status: form.status,
        value: parseFloat(form.value) || 0,
        notes: form.notes || null,
      };
      if (lead) {
        const { error } = await supabase.from("leads").update(payload).eq("id", lead.id);
        if (error) throw error;
        toast.success("Lead updated");
      } else {
        const { error } = await supabase.from("leads").insert(payload);
        if (error) throw error;
        toast.success("Lead created");
      }
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onOpenChange(false);
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{lead ? "Edit Lead" : "New Lead"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Company</Label><Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Estimated Value (GHS)</Label><Input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{lead ? "Update" : "Create"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
