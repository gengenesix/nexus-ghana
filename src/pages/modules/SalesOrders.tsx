import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, ShoppingBag, Truck, RotateCcw, Plus, ArrowRight, Loader2, PackageCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import QuotationDialog from "@/components/sales/QuotationDialog";
import { PriceListsTab } from "@/components/sales/PriceListsTab";
import { CommissionsTab } from "@/components/sales/CommissionsTab";

export default function SalesOrders() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("quotations");
  const [quotationOpen, setQuotationOpen] = useState(false);

  const { data: quotations = [] } = useQuery({
    queryKey: ["sales_quotations", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_quotations").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ["sales_orders", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_orders").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["delivery_notes", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_notes").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const { data: creditNotes = [] } = useQuery({
    queryKey: ["credit_notes", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("credit_notes").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  // Convert Quotation → Sales Order
  const convertToOrder = useMutation({
    mutationFn: async (quotation: any) => {
      const orderNum = `SO-${Date.now().toString(36).toUpperCase()}`;
      const { error: orderErr } = await supabase.from("sales_orders").insert({
        business_id: business!.id, order_number: orderNum,
        customer_name: quotation.customer_name, customer_id: quotation.customer_id,
        quotation_id: quotation.id, date: new Date().toISOString().split("T")[0],
        subtotal: quotation.subtotal, tax_amount: quotation.tax_amount || 0,
        total: quotation.total, status: "open",
        notes: `Created from quotation ${quotation.quotation_number}`,
      });
      if (orderErr) throw orderErr;
      await supabase.from("sales_quotations").update({ status: "converted" }).eq("id", quotation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_quotations"] });
      queryClient.invalidateQueries({ queryKey: ["sales_orders"] });
      toast.success("Quotation converted to Sales Order");
      setActiveTab("orders");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Convert Sales Order → Delivery Note
  const convertToDelivery = useMutation({
    mutationFn: async (order: any) => {
      const delNum = `DN-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("delivery_notes").insert({
        business_id: business!.id, delivery_number: delNum,
        sales_order_id: order.id, customer_name: order.customer_name,
        customer_id: order.customer_id, date: new Date().toISOString().split("T")[0],
        status: "pending", notes: `Delivery for Sales Order ${order.order_number}`,
      });
      if (error) throw error;
      await supabase.from("sales_orders").update({ status: "delivered" }).eq("id", order.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_orders"] });
      queryClient.invalidateQueries({ queryKey: ["delivery_notes"] });
      toast.success("Delivery Note created");
      setActiveTab("deliveries");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Convert Sales Order → Invoice
  const convertToInvoice = useMutation({
    mutationFn: async (order: any) => {
      const invoiceNum = `INV-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
      const { error: invErr } = await supabase.from("invoices").insert({
        business_id: business!.id, invoice_number: invoiceNum,
        customer_name: order.customer_name, customer_id: order.customer_id,
        date: new Date().toISOString().split("T")[0],
        due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        subtotal: order.subtotal, vat_amount: order.tax_amount || 0,
        total: order.total, status: "sent",
        notes: `Created from Sales Order ${order.order_number}`,
      });
      if (invErr) throw invErr;
      await supabase.from("sales_orders").update({ status: "invoiced" }).eq("id", order.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_orders"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Sales Order converted to Invoice");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Update delivery status
  const updateDeliveryStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("delivery_notes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery_notes"] });
      toast.success("Delivery status updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Update credit note status
  const updateCreditStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("credit_notes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit_notes"] });
      toast.success("Credit note status updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      draft: "secondary", open: "default", converted: "outline",
      delivered: "default", invoiced: "outline", pending: "secondary",
      shipped: "default", completed: "default", cancelled: "destructive",
      approved: "default",
    };
    return (map[status] || "outline") as any;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Sales</h1>
        <p className="text-muted-foreground">Quotation → Order → Delivery → Invoice → Payment</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><FileText className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{quotations.length}</p><p className="text-xs text-muted-foreground">Quotations</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><ShoppingBag className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{salesOrders.length}</p><p className="text-xs text-muted-foreground">Sales Orders</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Truck className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{deliveries.length}</p><p className="text-xs text-muted-foreground">Deliveries</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><RotateCcw className="h-8 w-8 text-orange-500" /><div><p className="text-2xl font-bold">{creditNotes.length}</p><p className="text-xs text-muted-foreground">Credit Notes</p></div></div></CardContent></Card>
      </div>

      {/* Document Flow Indicator */}
      <Card className="bg-muted/30">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground flex-wrap">
            <Badge variant="outline" className="text-xs">Quote</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline" className="text-xs">Order</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline" className="text-xs">Delivery</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline" className="text-xs">Invoice</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline" className="text-xs">Payment</Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="quotations">Quotations ({quotations.length})</TabsTrigger>
          <TabsTrigger value="orders">Orders ({salesOrders.length})</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries ({deliveries.length})</TabsTrigger>
          <TabsTrigger value="returns">Credit Notes ({creditNotes.length})</TabsTrigger>
        </TabsList>

        {/* Quotations Tab */}
        <TabsContent value="quotations" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Sales Quotations</h3><Button onClick={() => setQuotationOpen(true)}><Plus className="h-4 w-4 mr-1" />New Quotation</Button></div>
          <Card><CardContent className="pt-4">
            {quotations.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Quote #</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Valid Until</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="w-28"></TableHead></TableRow></TableHeader>
                <TableBody>{quotations.map((q: any) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-sm">{q.quotation_number}</TableCell>
                    <TableCell>{q.customer_name}</TableCell>
                    <TableCell className="text-sm">{format(new Date(q.date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm">{format(new Date(q.valid_until), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right font-mono">GHS {Number(q.total).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={statusColor(q.status)} className="capitalize">{q.status}</Badge></TableCell>
                    <TableCell>
                      {q.status === "draft" && (
                        <Button variant="outline" size="sm" onClick={() => convertToOrder.mutate(q)} disabled={convertToOrder.isPending}>
                          {convertToOrder.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><ArrowRight className="h-3.5 w-3.5 mr-1" />To Order</>}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No quotations yet. Create one to start the sales process.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* Sales Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Sales Orders</h3></div>
          <Card><CardContent className="pt-4">
            {salesOrders.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Order #</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="w-48"></TableHead></TableRow></TableHeader>
                <TableBody>{salesOrders.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                    <TableCell>{o.customer_name}</TableCell>
                    <TableCell className="text-sm">{format(new Date(o.date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{o.quotation_id ? <Badge variant="secondary" className="text-xs">From Quote</Badge> : <Badge variant="outline" className="text-xs">Direct</Badge>}</TableCell>
                    <TableCell className="text-right font-mono">GHS {Number(o.total).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={statusColor(o.status)} className="capitalize">{o.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {o.status === "open" && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => convertToDelivery.mutate(o)} disabled={convertToDelivery.isPending}>
                              <Truck className="h-3.5 w-3.5 mr-1" />Deliver
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => convertToInvoice.mutate(o)} disabled={convertToInvoice.isPending}>
                              <FileText className="h-3.5 w-3.5 mr-1" />Invoice
                            </Button>
                          </>
                        )}
                        {o.status === "delivered" && (
                          <Button variant="outline" size="sm" onClick={() => convertToInvoice.mutate(o)} disabled={convertToInvoice.isPending}>
                            <FileText className="h-3.5 w-3.5 mr-1" />Invoice
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No sales orders yet.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* Deliveries Tab */}
        <TabsContent value="deliveries" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Delivery Notes</h3></div>
          <Card><CardContent className="pt-4">
            {deliveries.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Delivery #</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Carrier</TableHead><TableHead>Tracking</TableHead><TableHead>Status</TableHead><TableHead className="w-36"></TableHead></TableRow></TableHeader>
                <TableBody>{deliveries.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-sm">{d.delivery_number}</TableCell>
                    <TableCell>{d.customer_name}</TableCell>
                    <TableCell className="text-sm">{format(new Date(d.date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.carrier || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{d.tracking_number || "—"}</TableCell>
                    <TableCell><Badge variant={statusColor(d.status)} className="capitalize">{d.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {d.status === "pending" && (
                          <Button variant="outline" size="sm" onClick={() => updateDeliveryStatus.mutate({ id: d.id, status: "shipped" })}>
                            <Truck className="h-3.5 w-3.5 mr-1" />Ship
                          </Button>
                        )}
                        {d.status === "shipped" && (
                          <Button variant="outline" size="sm" onClick={() => updateDeliveryStatus.mutate({ id: d.id, status: "completed" })}>
                            <PackageCheck className="h-3.5 w-3.5 mr-1" />Complete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><Truck className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No delivery notes yet. Create a sales order and click "Deliver" to generate one.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* Credit Notes Tab */}
        <TabsContent value="returns" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Credit Notes & Returns</h3></div>
          <Card><CardContent className="pt-4">
            {creditNotes.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Credit #</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="w-28"></TableHead></TableRow></TableHeader>
                <TableBody>{creditNotes.map((cn: any) => (
                  <TableRow key={cn.id}>
                    <TableCell className="font-mono text-sm">{cn.credit_number}</TableCell>
                    <TableCell>{cn.customer_name}</TableCell>
                    <TableCell className="text-sm">{format(new Date(cn.date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{cn.reason || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">-GHS {Number(cn.total).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={statusColor(cn.status)} className="capitalize">{cn.status}</Badge></TableCell>
                    <TableCell>
                      {cn.status === "draft" && (
                        <Button variant="outline" size="sm" onClick={() => updateCreditStatus.mutate({ id: cn.id, status: "approved" })}>
                          Approve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><RotateCcw className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No credit notes yet. Create one from the Invoices module to process a return.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <QuotationDialog open={quotationOpen} onOpenChange={setQuotationOpen} />
    </div>
  );
}
