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

const PRIORITIES = ["low", "medium", "high", "critical"];

interface ServiceCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ServiceCallDialog({ open, onOpenChange }: ServiceCallDialogProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_name: "", subject: "", description: "", priority: "medium" });

  const handleSave = async () => {
    if (!form.subject.trim()) { toast.error("Subject is required"); return; }
    setSaving(true);
    try {
      const callNum = `SC-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("service_calls").insert({
        business_id: business!.id,
        call_number: callNum,
        customer_name: form.customer_name.trim() || "Walk-in",
        subject: form.subject.trim(),
        description: form.description || null,
        priority: form.priority,
        status: "open",
      });
      if (error) throw error;
      toast.success("Service call created");
      queryClient.invalidateQueries({ queryKey: ["service_calls"] });
      onOpenChange(false);
      setForm({ customer_name: "", subject: "", description: "", priority: "medium" });
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Service Call</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5"><Label>Customer Name</Label><Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Customer name" /></div>
          <div className="space-y-1.5"><Label>Subject *</Label><Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Call</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
