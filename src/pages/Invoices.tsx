import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatGHS, calculateTaxes } from "@/lib/ghana";
import { generateInvoicePDF } from "@/lib/pdf";
import { exportInvoicesCsv } from "@/lib/export";
import { Search, Plus, Eye, Send, Loader2, Download, RotateCcw, FileText, Clock, DollarSign, AlertTriangle, CreditCard, Trash2, MessageSquare } from "lucide-react";
import { TableSkeleton } from "@/components/TableSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { MobileFab } from "@/components/MobileFab";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { toast } from "sonner";
import { differenceInDays, format } from "date-fns";
import RecurringInvoicesTab from "@/components/invoices/RecurringInvoicesTab";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const today = new Date().toISOString().split("T")[0];

const lineItemSchema = z.object({
  product_id: z.string().nullable().default(null),
  description: z.string().min(1, "Description required"),
  qty: z.coerce.number().min(1, "Min 1"),
  unit_price: z.coerce.number().min(0, "Must be ≥ 0"),
});

const invoiceSchema = z.object({
  customer_id: z.string().default(""),
  date: z.string().min(1, "Invoice date is required"),
  due_date: z.string().default(""),
  notes: z.string().default(""),
  apply_vat: z.boolean().default(true),
  apply_nhil: z.boolean().default(true),
  apply_getfl: z.boolean().default(true),
  line_items: z.array(lineItemSchema).min(1, "Add at least one line item"),
});
type InvoiceForm = z.infer<typeof invoiceSchema>;

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
  partial: "bg-warning/10 text-warning",
};

export default function Invoices() {
  const { business } = useBusiness();
  const { can } = useStaffSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeMainTab, setActiveMainTab] = useState("invoices");
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  // Create form
  const invoiceForm = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customer_id: "",
      date: today,
      due_date: "",
      notes: "",
      apply_vat: true,
      apply_nhil: true,
      apply_getfl: true,
      line_items: [{ product_id: null, description: "", qty: 1, unit_price: 0 }],
    },
  });
  const { fields: lineFields, append: appendLine, remove: removeLine } = useFieldArray({
    control: invoiceForm.control,
    name: "line_items",
  });
  const watchedLines = invoiceForm.watch("line_items");
  const watchedSubtotal = watchedLines.reduce((s, item) => s + (Number(item.qty) || 0) * (Number(item.unit_price) || 0), 0);
  const watchedVat = invoiceForm.watch("apply_vat");
  const watchedNhil = invoiceForm.watch("apply_nhil");
  const watchedGetfl = invoiceForm.watch("apply_getfl");

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

  const { data: invoiceLineItems = [] } = useQuery({
    queryKey: ["invoice-items", selectedInvoice?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("id, description, qty, unit_price")
        .eq("invoice_id", selectedInvoice!.id)
        .order("id");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedInvoice,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments-invoices", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").eq("business_id", business!.id).eq("type", "incoming").order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const filteredByStatus = statusFilter === "all" ? invoices : invoices.filter((i: any) => i.status === statusFilter);
  const filtered = filteredByStatus.filter((i: any) => (i.customer_name || "").toLowerCase().includes(search.toLowerCase()) || i.invoice_number.toLowerCase().includes(search.toLowerCase()));

  // KPI calculations
  const kpis = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const totalInvoiced = invoices.reduce((s: number, i: any) => s + Number(i.total), 0);
    const paid = invoices.filter((i: any) => i.status === "paid");
    const totalPaid = paid.reduce((s: number, i: any) => s + Number(i.total), 0);
    const unpaid = invoices.filter((i: any) => ["sent", "overdue", "partial"].includes(i.status));
    const totalUnpaid = unpaid.reduce((s: number, i: any) => s + Number(i.total), 0);
    const overdue = invoices.filter((i: any) => i.status !== "paid" && i.due_date < today);
    const totalOverdue = overdue.reduce((s: number, i: any) => s + Number(i.total), 0);

    // Aging buckets
    const aging = { current: 0, thirtyDays: 0, sixtyDays: 0, ninetyPlus: 0 };
    unpaid.forEach((inv: any) => {
      const days = differenceInDays(new Date(), new Date(inv.due_date));
      const amt = Number(inv.total);
      if (days <= 0) aging.current += amt;
      else if (days <= 30) aging.thirtyDays += amt;
      else if (days <= 60) aging.sixtyDays += amt;
      else aging.ninetyPlus += amt;
    });

    return { totalInvoiced, totalPaid, totalUnpaid, totalOverdue, overdueCount: overdue.length, paidCount: paid.length, aging };
  }, [invoices]);

  const subtotalNum = watchedSubtotal;
  const taxCalc = calculateTaxes(subtotalNum, { vat: watchedVat, nhil: watchedNhil, getfl: watchedGetfl });

  // Invoice payments
  const invoicePayments = useMemo(() => {
    if (!selectedInvoice) return [];
    return payments.filter((p: any) => p.invoice_id === selectedInvoice.id);
  }, [selectedInvoice, payments]);

  const totalPaidForInvoice = invoicePayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const balanceDue = selectedInvoice ? Number(selectedInvoice.total) - totalPaidForInvoice : 0;

  const createMutation = useMutation({
    mutationFn: async (values: InvoiceForm) => {
      const { data: invNum, error: rpcErr } = await supabase.rpc("generate_invoice_number");
      if (rpcErr) throw rpcErr;
      const customer = customers.find((c: any) => c.id === values.customer_id);
      const sub = values.line_items.reduce((s, item) => s + Number(item.qty) * Number(item.unit_price), 0);
      const tc = calculateTaxes(sub, { vat: values.apply_vat, nhil: values.apply_nhil, getfl: values.apply_getfl });
      const { data: invoice, error } = await supabase.from("invoices").insert({
        business_id: business!.id,
        invoice_number: invNum,
        customer_id: values.customer_id || null,
        customer_name: customer?.name || "Walk-in Customer",
        status: "draft",
        date: values.date,
        due_date: values.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        subtotal: sub,
        vat_amount: values.apply_vat ? tc.vatAmount : 0,
        nhil_amount: values.apply_nhil ? tc.nhilAmount : 0,
        getfl_amount: values.apply_getfl ? tc.getflAmount : 0,
        total: tc.total,
        notes: values.notes,
        apply_vat: values.apply_vat,
        apply_nhil: values.apply_nhil,
        apply_getfl: values.apply_getfl,
      }).select().single();
      if (error) throw error;

      // Insert line items
      const items = values.line_items.map(item => ({
        invoice_id: invoice.id,
        product_id: item.product_id || null,
        description: item.description,
        qty: Number(item.qty),
        unit_price: Number(item.unit_price),
      }));
      const { error: itemsErr } = await supabase.from("invoice_items").insert(items);
      if (itemsErr) throw itemsErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setShowCreate(false);
      invoiceForm.reset();
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

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!selectedInvoice) return;
      const amt = Number(paymentAmount) || 0;
      if (amt <= 0) throw new Error("Enter a valid amount");
      const payNum = `PAY-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("payments").insert({
        business_id: business!.id,
        payment_number: payNum,
        invoice_id: selectedInvoice.id,
        customer_id: selectedInvoice.customer_id,
        amount: amt,
        payment_method: paymentMethod,
        type: "incoming",
        status: "completed",
        date: new Date().toISOString().split("T")[0],
        notes: `Payment for ${selectedInvoice.invoice_number}`,
      });
      if (error) throw error;

      // Update invoice status
      const newPaid = totalPaidForInvoice + amt;
      const invTotal = Number(selectedInvoice.total);
      const newStatus = newPaid >= invTotal ? "paid" : "partial";
      await supabase.from("invoices").update({ status: newStatus }).eq("id", selectedInvoice.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["payments-invoices"] });
      setShowPayment(false);
      setPaymentAmount("");
      toast.success("Payment recorded!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const downloadInvoice = (invoice: any) => {
    generateInvoicePDF(invoice, business || { name: "Nexis" });
  };

  const createCreditNote = useMutation({
    mutationFn: async (invoice: any) => {
      const creditNum = `CN-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("credit_notes").insert({
        business_id: business!.id,
        credit_number: creditNum,
        invoice_id: invoice.id,
        customer_name: invoice.customer_name,
        customer_id: invoice.customer_id,
        date: new Date().toISOString().split("T")[0],
        reason: `Return/Credit for Invoice ${invoice.invoice_number}`,
        subtotal: invoice.subtotal,
        tax_amount: Number(invoice.vat_amount) + Number(invoice.nhil_amount || 0) + Number(invoice.getfl_amount || 0),
        total: invoice.total,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit_notes"] });
      toast.success("Credit note created — view it in Sales → Credit Notes tab");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Invoices</h1>
          <p className="text-muted-foreground text-sm">{invoices.length} invoices · {invoices.filter((i: any) => i.status === "overdue").length} overdue</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { if (invoices.length > 0) exportInvoicesCsv(invoices); else toast.error("No invoices"); }}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          {can("invoices", "create") && (
            <Button onClick={() => setShowCreate(true)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 hidden md:inline-flex">
              <Plus className="h-4 w-4 mr-1" /> New Invoice
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
        <TabsList>
          <TabsTrigger value="invoices">All Invoices</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
        </TabsList>

        <TabsContent value="recurring">
          <RecurringInvoicesTab />
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><FileText className="h-3.5 w-3.5" /> Total Invoiced</div>
            <p className="text-xl font-bold">{formatGHS(kpis.totalInvoiced)}</p>
            <p className="text-xs text-muted-foreground mt-1">{invoices.length} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs mb-1 text-green-500"><DollarSign className="h-3.5 w-3.5" /> Collected</div>
            <p className="text-xl font-bold text-green-500">{formatGHS(kpis.totalPaid)}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpis.paidCount} paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs mb-1 text-yellow-500"><Clock className="h-3.5 w-3.5" /> Outstanding</div>
            <p className="text-xl font-bold text-yellow-500">{formatGHS(kpis.totalUnpaid)}</p>
            <p className="text-xs text-muted-foreground mt-1">{invoices.length - kpis.paidCount} unpaid</p>
          </CardContent>
        </Card>
        <Card className={kpis.overdueCount > 0 ? "border-destructive/30" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs mb-1 text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> Overdue</div>
            <p className="text-xl font-bold text-destructive">{formatGHS(kpis.totalOverdue)}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpis.overdueCount} overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Aging Summary */}
      {kpis.totalUnpaid > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="font-display text-sm">Aging Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Current", value: kpis.aging.current, color: "bg-green-500" },
                { label: "1-30 Days", value: kpis.aging.thirtyDays, color: "bg-yellow-500" },
                { label: "31-60 Days", value: kpis.aging.sixtyDays, color: "bg-orange-500" },
                { label: "90+ Days", value: kpis.aging.ninetyPlus, color: "bg-destructive" },
              ].map(bucket => (
                <div key={bucket.label} className="text-center">
                  <div className={`h-1.5 rounded-full mb-2 ${bucket.color}`} style={{ opacity: bucket.value > 0 ? 1 : 0.2 }} />
                  <p className="text-xs text-muted-foreground">{bucket.label}</p>
                  <p className="text-sm font-bold">{formatGHS(bucket.value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {["all", "draft", "sent", "paid", "overdue"].map(status => (
          <Button key={status} variant={statusFilter === status ? "default" : "secondary"} size="sm" className="capitalize shrink-0" onClick={() => setStatusFilter(status)}>
            {status} ({status === "all" ? invoices.length : invoices.filter((i: any) => i.status === status).length})
          </Button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by invoice # or customer..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Due</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10 sm:w-auto"></TableHead>
              </TableRow>
            </TableHeader>
            {isLoading ? (
              <TableSkeleton rows={7} cols={7} />
            ) : (
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0 border-0">
                    <EmptyState
                      icon={FileText}
                      title={search ? "No invoices found" : "No invoices yet"}
                      description={search ? `No invoices match your search.` : "Create your first invoice to start billing customers and tracking payments."}
                      actionLabel={!search ? "New Invoice" : undefined}
                      onAction={!search ? () => setShowCreate(true) : undefined}
                      canAct={can("invoices", "create")}
                      size="sm"
                    />
                  </TableCell>
                </TableRow>
              ) : filtered.map((invoice: any) => {
                const isOverdue = invoice.status !== "paid" && invoice.due_date < new Date().toISOString().split("T")[0];
                return (
                  <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedInvoice(invoice)}>
                    <TableCell className="font-mono text-sm text-primary">{invoice.invoice_number}</TableCell>
                    <TableCell className="font-medium">{invoice.customer_name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{invoice.date}</TableCell>
                    <TableCell className={`hidden md:table-cell ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>{invoice.due_date}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={statusColors[invoice.status] + " capitalize"}>{invoice.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatGHS(Number(invoice.total))}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        <div className="hidden sm:flex items-center gap-0.5">
                          <Select value={invoice.status} onValueChange={(s) => updateStatus.mutate({ id: invoice.id, status: s })}>
                            <SelectTrigger className="h-8 text-xs w-[90px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["draft", "sent", "paid", "overdue", "partial"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => downloadInvoice(invoice)} title="Download PDF"><Download className="h-4 w-4" /></Button>
                          {["sent", "partial", "overdue"].includes(invoice.status) && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-500 hover:bg-green-500/10" onClick={() => { setSelectedInvoice(invoice); setPaymentAmount(String(Number(invoice.total))); setShowPayment(true); }} title="Record Payment">
                              <CreditCard className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedInvoice(invoice)} title="View"><Eye className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            )}
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice && !showPayment} onOpenChange={(open) => { if (!open) setSelectedInvoice(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedInvoice && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  {selectedInvoice.invoice_number}
                  <Badge className={statusColors[selectedInvoice.status] + " capitalize"}>{selectedInvoice.status}</Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Customer</p>
                    <p className="font-medium">{selectedInvoice.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Invoice Date</p>
                    <p className="font-medium">{selectedInvoice.date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due Date</p>
                    <p className={`font-medium ${selectedInvoice.due_date < new Date().toISOString().split("T")[0] && selectedInvoice.status !== "paid" ? "text-destructive" : ""}`}>
                      {selectedInvoice.due_date}
                      {selectedInvoice.due_date < new Date().toISOString().split("T")[0] && selectedInvoice.status !== "paid" && (
                        <span className="text-xs ml-1">({differenceInDays(new Date(), new Date(selectedInvoice.due_date))} days overdue)</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="font-medium">{format(new Date(selectedInvoice.created_at), "dd MMM yyyy")}</p>
                  </div>
                </div>

                {invoiceLineItems.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-semibold mb-2">Line Items</p>
                      <div className="space-y-1.5">
                        {invoiceLineItems.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <div className="flex-1 min-w-0">
                              <p className="truncate">{item.description}</p>
                              <p className="text-xs text-muted-foreground">{item.qty} × {formatGHS(Number(item.unit_price))}</p>
                            </div>
                            <span className="ml-2 font-medium">{formatGHS(Number(item.qty) * Number(item.unit_price))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatGHS(Number(selectedInvoice.subtotal))}</span></div>
                  {selectedInvoice.apply_vat && <div className="flex justify-between"><span className="text-muted-foreground">VAT (15%)</span><span>{formatGHS(Number(selectedInvoice.vat_amount))}</span></div>}
                  {selectedInvoice.apply_nhil && <div className="flex justify-between"><span className="text-muted-foreground">NHIL (2.5%)</span><span>{formatGHS(Number(selectedInvoice.nhil_amount))}</span></div>}
                  {selectedInvoice.apply_getfl && <div className="flex justify-between"><span className="text-muted-foreground">GETFL (1%)</span><span>{formatGHS(Number(selectedInvoice.getfl_amount))}</span></div>}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-primary">{formatGHS(Number(selectedInvoice.total))}</span></div>
                  {invoicePayments.length > 0 && (
                    <>
                      <div className="flex justify-between text-green-500"><span>Paid</span><span>{formatGHS(totalPaidForInvoice)}</span></div>
                      <div className="flex justify-between font-bold"><span>Balance Due</span><span className={balanceDue > 0 ? "text-destructive" : "text-green-500"}>{formatGHS(balanceDue)}</span></div>
                    </>
                  )}
                </div>

                {selectedInvoice.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{selectedInvoice.notes}</p>
                    </div>
                  </>
                )}

                {/* Payment History */}
                {invoicePayments.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-semibold mb-2">Payment History</p>
                      <div className="space-y-2">
                        {invoicePayments.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between text-sm rounded-lg bg-secondary/50 px-3 py-2">
                            <div>
                              <p className="font-medium">{p.payment_number}</p>
                              <p className="text-xs text-muted-foreground">{p.date} · {p.payment_method}</p>
                            </div>
                            <span className="font-medium text-green-500">{formatGHS(Number(p.amount))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => downloadInvoice(selectedInvoice)}>
                    <Download className="h-4 w-4 mr-1" /> PDF
                  </Button>
                  {["sent", "partial", "overdue"].includes(selectedInvoice.status) && (
                    <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => { setPaymentAmount(String(balanceDue > 0 ? balanceDue : Number(selectedInvoice.total))); setShowPayment(true); }}>
                      <CreditCard className="h-4 w-4 mr-1" /> Record Payment
                    </Button>
                  )}
                  {(selectedInvoice.status === "paid" || selectedInvoice.status === "sent") && (
                    <Button variant="outline" className="text-orange-500 hover:bg-orange-500/10" onClick={() => createCreditNote.mutate(selectedInvoice)} disabled={createCreditNote.isPending}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Credit Note
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={(open) => { if (!open) setShowPayment(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Record Payment</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/50 p-3 text-sm">
                <p className="font-medium">{selectedInvoice.invoice_number}</p>
                <p className="text-muted-foreground">{selectedInvoice.customer_name}</p>
                <div className="flex justify-between mt-2">
                  <span>Invoice Total</span>
                  <span className="font-bold">{formatGHS(Number(selectedInvoice.total))}</span>
                </div>
                {totalPaidForInvoice > 0 && (
                  <div className="flex justify-between">
                    <span>Already Paid</span>
                    <span className="text-green-500">{formatGHS(totalPaidForInvoice)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold">
                  <span>Balance Due</span>
                  <span className="text-primary">{formatGHS(balanceDue > 0 ? balanceDue : Number(selectedInvoice.total))}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Amount (GHS) *</Label>
                <Input type="number" placeholder="0.00" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["cash", "MTN MoMo", "Telecel Cash", "AirtelTigo Money", "bank_transfer", "card", "cheque"].map(m => (
                      <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => recordPayment.mutate()} disabled={!paymentAmount || recordPayment.isPending}>
                {recordPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="h-4 w-4 mr-2" /> Record Payment</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Customer</Label>
                <Controller
                  control={invoiceForm.control}
                  name="customer_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>
                        {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label>Invoice Date *</Label>
                <Input type="date" {...invoiceForm.register("date")} />
                {invoiceForm.formState.errors.date && <p className="text-xs text-destructive">{invoiceForm.formState.errors.date.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Due Date</Label>
                <Input type="date" {...invoiceForm.register("due_date")} />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input placeholder="Optional notes..." {...invoiceForm.register("notes")} />
              </div>
            </div>

            <Separator />

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Line Items *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => appendLine({ product_id: null, description: "", qty: 1, unit_price: 0 })}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                </Button>
              </div>
              {invoiceForm.formState.errors.line_items && !Array.isArray(invoiceForm.formState.errors.line_items) && (
                <p className="text-xs text-destructive">{invoiceForm.formState.errors.line_items.message}</p>
              )}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left text-xs font-medium">Description</th>
                      <th className="p-2 text-right text-xs font-medium w-16">Qty</th>
                      <th className="p-2 text-right text-xs font-medium w-24">Price</th>
                      <th className="p-2 text-right text-xs font-medium w-24">Total</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineFields.map((field, index) => {
                      const qty = Number(watchedLines[index]?.qty) || 0;
                      const price = Number(watchedLines[index]?.unit_price) || 0;
                      return (
                        <tr key={field.id} className="border-t">
                          <td className="p-1">
                            <Input
                              className="h-7 text-xs"
                              placeholder="Item description"
                              {...invoiceForm.register(`line_items.${index}.description`)}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              className="h-7 text-xs text-right"
                              type="number"
                              min={1}
                              {...invoiceForm.register(`line_items.${index}.qty`)}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              className="h-7 text-xs text-right"
                              type="number"
                              step="0.01"
                              min={0}
                              placeholder="0.00"
                              {...invoiceForm.register(`line_items.${index}.unit_price`)}
                            />
                          </td>
                          <td className="p-1 text-right font-mono text-xs pr-2 text-primary">
                            {formatGHS(qty * price)}
                          </td>
                          <td className="p-1">
                            {lineFields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => removeLine(index)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <Separator />

            {/* Tax toggles */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center justify-between rounded-lg border p-2">
                <Label className="text-xs">VAT 15%</Label>
                <Controller control={invoiceForm.control} name="apply_vat" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <Label className="text-xs">NHIL 2.5%</Label>
                <Controller control={invoiceForm.control} name="apply_nhil" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <Label className="text-xs">GETFL 1%</Label>
                <Controller control={invoiceForm.control} name="apply_getfl" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              </div>
            </div>

            <div className="rounded-lg bg-secondary/50 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatGHS(subtotalNum)}</span></div>
              {watchedVat && <div className="flex justify-between"><span className="text-muted-foreground">VAT (15%)</span><span>{formatGHS(taxCalc.vatAmount)}</span></div>}
              {watchedNhil && <div className="flex justify-between"><span className="text-muted-foreground">NHIL (2.5%)</span><span>{formatGHS(taxCalc.nhilAmount)}</span></div>}
              {watchedGetfl && <div className="flex justify-between"><span className="text-muted-foreground">GETFL (1%)</span><span>{formatGHS(taxCalc.getflAmount)}</span></div>}
              <Separator />
              <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-primary">{formatGHS(taxCalc.total)}</span></div>
            </div>

            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={invoiceForm.handleSubmit((values) => createMutation.mutate(values))}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" /> Create Invoice</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </TabsContent>
      </Tabs>

      <MobileFab
        icon={Plus}
        label="New Invoice"
        onClick={() => setShowCreate(true)}
        hidden={!can("invoices", "create")}
      />
    </div>
  );
}
