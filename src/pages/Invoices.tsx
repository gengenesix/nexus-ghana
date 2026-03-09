import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatGHS, calculateTaxes } from "@/lib/ghana";
import { generateInvoicePDF } from "@/lib/pdf";
import { Search, Plus, Eye, MessageCircle, Send, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
  partial: "bg-warning/10 text-warning",
};

export default function Invoices() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  // Create form
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formDueDate, setFormDueDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formSubtotal, setFormSubtotal] = useState("0");
  const [taxes, setTaxes] = useState({ vat: true, nhil: true, getfl: true });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const filteredByStatus = statusFilter === "all" ? invoices : invoices.filter((i: any) => i.status === statusFilter);
  const filtered = filteredByStatus.filter((i: any) => (i.customer_name || "").toLowerCase().includes(search.toLowerCase()) || i.invoice_number.toLowerCase().includes(search.toLowerCase()));

  const subtotalNum = Number(formSubtotal) || 0;
  const taxCalc = calculateTaxes(subtotalNum, taxes);

  const createMutation = useMutation({
    mutationFn: async () => {
      // Generate invoice number via RPC
      const { data: invNum, error: rpcErr } = await supabase.rpc("generate_invoice_number");
      if (rpcErr) throw rpcErr;

      const customer = customers.find((c: any) => c.id === formCustomerId);
      const { error } = await supabase.from("invoices").insert({
        business_id: business!.id,
        invoice_number: invNum,
        customer_id: formCustomerId || null,
        customer_name: customer?.name || "Walk-in Customer",
        status: "draft",
        date: formDate,
        due_date: formDueDate || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        subtotal: subtotalNum,
        vat_amount: taxes.vat ? taxCalc.vatAmount : 0,
        nhil_amount: taxes.nhil ? taxCalc.nhilAmount : 0,
        getfl_amount: taxes.getfl ? taxCalc.getflAmount : 0,
        total: taxCalc.total,
        notes: formNotes,
        apply_vat: taxes.vat,
        apply_nhil: taxes.nhil,
        apply_getfl: taxes.getfl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setShowCreate(false);
      setFormCustomerId(""); setFormNotes(""); setFormSubtotal("0");
      toast.success("Invoice created!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Status updated");
    },
  });

  const downloadInvoice = (invoice: any) => {
    generateInvoicePDF(invoice, business || { name: "NexusGH" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Invoices</h1>
          <p className="text-muted-foreground text-sm">{invoices.length} invoices · {invoices.filter((i: any) => i.status === "overdue").length} overdue</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gold-gradient text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> New Invoice
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {["all", "draft", "sent", "paid", "overdue"].map(status => (
          <Button key={status} variant={statusFilter === status ? "default" : "secondary"} size="sm" className="capitalize" onClick={() => setStatusFilter(status)}>
            {status} ({status === "all" ? invoices.length : invoices.filter((i: any) => i.status === status).length})
          </Button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search invoices..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Due</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[140px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{isLoading ? "Loading..." : "No invoices yet."}</TableCell></TableRow>
              ) : filtered.map((invoice: any) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-sm text-primary">{invoice.invoice_number}</TableCell>
                  <TableCell className="font-medium">{invoice.customer_name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{invoice.date}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{invoice.due_date}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={statusColors[invoice.status] + " capitalize"}>{invoice.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatGHS(Number(invoice.total))}</TableCell>
                  <TableCell>
                    <Select value={invoice.status} onValueChange={(s) => updateStatus.mutate({ id: invoice.id, status: s })}>
                      <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["draft", "sent", "paid", "overdue", "partial"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Customer</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Invoice Date</Label><Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Subtotal (GHS)</Label><Input type="number" placeholder="0.00" value={formSubtotal} onChange={e => setFormSubtotal(e.target.value)} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea placeholder="Any additional notes..." value={formNotes} onChange={e => setFormNotes(e.target.value)} /></div>

            <Separator />
            <p className="text-sm font-medium">Ghana Taxes</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>VAT (15%)</Label><Switch checked={taxes.vat} onCheckedChange={v => setTaxes(t => ({ ...t, vat: v }))} /></div>
              <div className="flex items-center justify-between"><Label>NHIL (2.5%)</Label><Switch checked={taxes.nhil} onCheckedChange={v => setTaxes(t => ({ ...t, nhil: v }))} /></div>
              <div className="flex items-center justify-between"><Label>GETFL (1%)</Label><Switch checked={taxes.getfl} onCheckedChange={v => setTaxes(t => ({ ...t, getfl: v }))} /></div>
            </div>

            <Separator />
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatGHS(subtotalNum)}</span></div>
              {taxes.vat && <div className="flex justify-between"><span className="text-muted-foreground">VAT (15%)</span><span>{formatGHS(taxCalc.vatAmount)}</span></div>}
              {taxes.nhil && <div className="flex justify-between"><span className="text-muted-foreground">NHIL (2.5%)</span><span>{formatGHS(taxCalc.nhilAmount)}</span></div>}
              {taxes.getfl && <div className="flex justify-between"><span className="text-muted-foreground">GETFL (1%)</span><span>{formatGHS(taxCalc.getflAmount)}</span></div>}
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-primary">{formatGHS(taxCalc.total)}</span></div>
            </div>

            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" /> Create Invoice</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
