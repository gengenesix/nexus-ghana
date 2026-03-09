import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const DEPARTMENTS = ["Management", "Finance", "Sales", "Marketing", "Operations", "IT", "HR", "Warehouse", "Production", "Logistics", "Customer Service"];
const FREQUENCIES = ["monthly", "bi-weekly", "weekly"];

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: any;
}

export default function EmployeeDialog({ open, onOpenChange, employee }: EmployeeDialogProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: employee?.first_name || "",
    last_name: employee?.last_name || "",
    position: employee?.position || "",
    department: employee?.department || "",
    hire_date: employee?.hire_date || new Date().toISOString().split("T")[0],
    salary: employee?.salary?.toString() || "0",
    salary_frequency: employee?.salary_frequency || "monthly",
    address: employee?.address || "",
    bank_account: employee?.bank_account || "",
    emergency_contact: employee?.emergency_contact || "",
    emergency_phone: employee?.emergency_phone || "",
  });

  const handleSave = async () => {
    if (!form.first_name.trim()) { toast.error("First name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        business_id: business!.id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        position: form.position || null,
        department: form.department || null,
        hire_date: form.hire_date || null,
        salary: parseFloat(form.salary) || 0,
        salary_frequency: form.salary_frequency,
        address: form.address || null,
        bank_account: form.bank_account || null,
        emergency_contact: form.emergency_contact || null,
        emergency_phone: form.emergency_phone || null,
      };
      if (employee) {
        const { error } = await supabase.from("employees").update(payload).eq("id", employee.id);
        if (error) throw error;
        toast.success("Employee updated");
      } else {
        const { error } = await supabase.from("employees").insert(payload);
        if (error) throw error;
        toast.success("Employee added");
      }
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      onOpenChange(false);
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{employee ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>First Name *</Label><Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Last Name</Label><Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Position</Label><Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="e.g. Sales Manager" /></div>
            <div className="space-y-1.5"><Label>Department</Label>
              <Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Hire Date</Label><Input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Salary (GHS)</Label><Input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Pay Frequency</Label>
              <Select value={form.salary_frequency} onValueChange={v => setForm(f => ({ ...f, salary_frequency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Bank Account</Label><Input value={form.bank_account} onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))} /></div>
          </div>
          <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Emergency Contact</Label><Input value={form.emergency_contact} onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Emergency Phone</Label><Input value={form.emergency_phone} onChange={e => setForm(f => ({ ...f, emergency_phone: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{employee ? "Update" : "Add Employee"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
