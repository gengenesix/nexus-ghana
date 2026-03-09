import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatGHS } from "@/lib/ghana";
import { Plus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function RecurringInvoicesTab() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [formCustomerName, setFormCustomerName] = useState("");
  const [formFrequency, setFormFrequency] = useState("monthly");
  const [formNextDate, setFormNextDate] = useState(new Date().toISOString().split("T")[0]);
  const [formSubtotal, setFormSubtotal] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const { data: recurring = [], isLoading } = useQuery({
    queryKey: ["recurring_invoices", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_invoices")
        .select("*")
        .eq("business_id", business!.id)
        .order("next_date");
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("recurring_invoices").insert({
        business_id: business!.id,
        customer_name: formCustomerName.trim() || "Walk-in Customer",
        frequency: formFrequency,
        next_date: formNextDate,
        subtotal: Number(formSubtotal) || 0,
        notes: formNotes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_invoices"] });
      setShowAdd(false);
      setFormCustomerName(""); setFormSubtotal(""); setFormNotes("");
      toast.success("Recurring invoice schedule created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("recurring_invoices").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring_invoices"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_invoices"] });
      toast.success("Deleted");
    },
  });

  const generateNow = useMutation({
    mutationFn: async (rec: any) => {
      const invNum = `NXG-${new Date().getFullYear()}-R${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("invoices").insert({
        business_id: business!.id,
        invoice_number: invNum,
        customer_name: rec.customer_name,
        customer_id: rec.customer_id,
        status: "sent",
        date: new Date().toISOString().split("T")[0],
        due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        subtotal: rec.subtotal,
        total: rec.subtotal,
        notes: rec.notes || "Auto-generated from recurring schedule",
        apply_vat: rec.apply_vat,
        apply_nhil: rec.apply_nhil,
        apply_getfl: rec.apply_getfl,
      });
      if (error) throw error;
      await supabase.from("recurring_invoices").update({ last_generated: new Date().toISOString().split("T")[0] }).eq("id", rec.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice generated from recurring schedule");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Recurring Invoices</h3>
          <p className="text-sm text-muted-foreground">Auto-generate invoices on a schedule</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> New Schedule</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : recurring.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No recurring invoices yet</TableCell></TableRow>
              ) : recurring.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.customer_name}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{r.frequency}</Badge></TableCell>
                  <TableCell>{r.next_date}</TableCell>
                  <TableCell className="text-right">{formatGHS(Number(r.subtotal))}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={r.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: r.id, active: v })} />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => generateNow.mutate(r)} title="Generate Now">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Recurring Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Customer Name</Label><Input value={formCustomerName} onChange={e => setFormCustomerName(e.target.value)} placeholder="Customer name" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={formFrequency} onValueChange={setFormFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Next Date</Label><Input type="date" value={formNextDate} onChange={e => setFormNextDate(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Amount (GHS)</Label><Input type="number" value={formSubtotal} onChange={e => setFormSubtotal(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-2"><Label>Notes</Label><Input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes" /></div>
            <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Schedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
