import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface LeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: any[];
  leaveRequest?: any;
}

export default function LeaveDialog({ open, onOpenChange, employees, leaveRequest }: LeaveDialogProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    employee_id: leaveRequest?.employee_id || "",
    leave_type: leaveRequest?.leave_type || "annual",
    start_date: leaveRequest?.start_date || new Date().toISOString().split("T")[0],
    end_date: leaveRequest?.end_date || new Date().toISOString().split("T")[0],
    reason: leaveRequest?.reason || "",
  });

  const days = Math.max(1, Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000) + 1);

  const handleSubmit = async () => {
    if (!form.employee_id || !business?.id) return;
    setLoading(true);

    const payload = {
      ...form,
      days,
      business_id: business.id,
      status: "pending",
    };

    const { error } = leaveRequest
      ? await supabase.from("leave_requests").update(payload).eq("id", leaveRequest.id)
      : await supabase.from("leave_requests").insert(payload);

    if (error) { toast.error(error.message); }
    else {
      toast.success(leaveRequest ? "Leave request updated" : "Leave request submitted");
      queryClient.invalidateQueries({ queryKey: ["leave_requests"] });
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{leaveRequest ? "Edit Leave Request" : "New Leave Request"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Leave Type</Label>
            <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Annual Leave</SelectItem>
                <SelectItem value="sick">Sick Leave</SelectItem>
                <SelectItem value="personal">Personal Leave</SelectItem>
                <SelectItem value="maternity">Maternity Leave</SelectItem>
                <SelectItem value="paternity">Paternity Leave</SelectItem>
                <SelectItem value="unpaid">Unpaid Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{days} day{days > 1 ? "s" : ""} requested</p>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Optional reason..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !form.employee_id}>
            {loading ? "Saving…" : leaveRequest ? "Update" : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
