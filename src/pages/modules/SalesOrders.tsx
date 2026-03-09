import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, ShoppingBag, CreditCard, RotateCcw, Plus, ArrowRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import QuotationDialog from "@/components/sales/QuotationDialog";

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

  // Convert Quotation → Sales Order (SAP document chain)
  const convertToOrder = useMutation({
    mutationFn: async (quotation: any) => {
      const orderNum = `SO-${Date.now().toString(36).toUpperCase()}`;
      const { error: orderErr } = await supabase.from("sales_orders").insert({
        business_id: business!.id,
        order_number: orderNum,
        customer_name: quotation.customer_name,
        customer_id: quotation.customer_id,
        quotation_id: quotation.id,
        date: new Date().toISOString().split("T")[0],
        subtotal: quotation.subtotal,
        tax_amount: quotation.tax_amount || 0,
        total: quotation.total,
        status: "open",
        notes: `Created from quotation ${quotation.quotation_number}`,
      });
      if (orderErr) throw orderErr;

      // Update quotation status to "converted"
      const { error: updateErr } = await supabase.from("sales_quotations").update({ status: "converted" }).eq("id", quotation.id);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_quotations"] });
      queryClient.invalidateQueries({ queryKey: ["sales_orders"] });
      toast.success("Quotation converted to Sales Order");
      setActiveTab("orders");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Sales</h1>
        <p className="text-muted-foreground">Quotation → Order → Delivery → Invoice → Payment</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><FileText className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{quotations.length}</p><p className="text-xs text-muted-foreground">Quotations</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><ShoppingBag className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{salesOrders.length}</p><p className="text-xs text-muted-foreground">Sales Orders</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><CreditCard className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Deliveries</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><RotateCcw className="h-8 w-8 text-orange-500" /><div><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Returns</p></div></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
          <TabsTrigger value="orders">Sales Orders</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
          <TabsTrigger value="returns">Returns & Credits</TabsTrigger>
        </TabsList>

        <TabsContent value="quotations" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Sales Quotations</h3><Button onClick={() => setQuotationOpen(true)}><Plus className="h-4 w-4 mr-1" />New Quotation</Button></div>
          <Card><CardContent className="pt-4">
            {quotations.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Quote #</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Valid Until</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="w-28"></TableHead></TableRow></TableHeader>
                <TableBody>{quotations.map((q: any) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono">{q.quotation_number}</TableCell>
                    <TableCell>{q.customer_name}</TableCell>
                    <TableCell>{format(new Date(q.date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{format(new Date(q.valid_until), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right font-mono">GHS {Number(q.total).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{q.status}</Badge></TableCell>
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

        <TabsContent value="orders" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Sales Orders</h3></div>
          <Card><CardContent className="pt-4">
            {salesOrders.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Order #</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{salesOrders.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono">{o.order_number}</TableCell>
                    <TableCell>{o.customer_name}</TableCell>
                    <TableCell>{format(new Date(o.date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{o.quotation_id ? <Badge variant="secondary" className="text-xs">From Quote</Badge> : <Badge variant="outline" className="text-xs">Direct</Badge>}</TableCell>
                    <TableCell className="text-right font-mono">GHS {Number(o.total).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{o.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No sales orders yet. Create a quotation and convert it, or create a direct order.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="deliveries"><Card><CardContent className="text-center py-12 text-muted-foreground"><CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Delivery tracking — create a sales order first.</p></CardContent></Card></TabsContent>
        <TabsContent value="returns"><Card><CardContent className="text-center py-12 text-muted-foreground"><RotateCcw className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Returns & credit notes management.</p></CardContent></Card></TabsContent>
      </Tabs>

      <QuotationDialog open={quotationOpen} onOpenChange={setQuotationOpen} />
    </div>
  );
}
