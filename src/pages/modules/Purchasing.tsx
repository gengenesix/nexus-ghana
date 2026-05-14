import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Truck, Package, FileCheck, Plus, PackageCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import PurchaseOrderDialog from "@/components/purchasing/PurchaseOrderDialog";

export default function Purchasing() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("orders");
  const [poOpen, setPoOpen] = useState(false);
  const [receivingPo, setReceivingPo] = useState<any>(null);

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchase_orders", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const { data: poItems = [] } = useQuery({
    queryKey: ["po-items", receivingPo?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_order_items").select("*").eq("po_id", receivingPo!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!receivingPo,
  });

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("receive_purchase_order", {
        p_po_id: receivingPo!.id,
        p_business_id: business!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setReceivingPo(null);
      toast.success("Purchase order received — stock updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Purchasing</h1>
        <p className="text-muted-foreground">Purchase Request → PO → Goods Receipt → AP Invoice → Payment</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><ShoppingCart className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{purchaseOrders.length}</p><p className="text-xs text-muted-foreground">Purchase Orders</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Package className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Goods Receipts</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><FileCheck className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">AP Invoices</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Truck className="h-8 w-8 text-orange-500" /><div><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Returns</p></div></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="receipts">Goods Receipts</TabsTrigger>
          <TabsTrigger value="invoices">AP Invoices</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Purchase Orders</h3><Button onClick={() => setPoOpen(true)}><Plus className="h-4 w-4 mr-1" />New PO</Button></div>
          <Card><CardContent className="pt-4">
            {purchaseOrders.length > 0 ? (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="w-[120px]"></TableHead></TableRow></TableHeader>
                <TableBody>{purchaseOrders.map((po: any) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono">{po.po_number}</TableCell>
                    <TableCell>{po.supplier_name}</TableCell>
                    <TableCell>{format(new Date(po.date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right font-mono">GHS {Number(po.total).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{po.status}</Badge></TableCell>
                    <TableCell>
                      {po.status !== "received" && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600 hover:bg-green-600/10" onClick={() => setReceivingPo(po)}>
                          <PackageCheck className="h-3.5 w-3.5 mr-1" /> Receive
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No purchase orders yet.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="receipts"><Card><CardContent className="text-center py-12 text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Goods receipt tracking. Create a PO first.</p></CardContent></Card></TabsContent>
        <TabsContent value="invoices"><Card><CardContent className="text-center py-12 text-muted-foreground"><FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Accounts payable invoices.</p></CardContent></Card></TabsContent>
        <TabsContent value="returns"><Card><CardContent className="text-center py-12 text-muted-foreground"><Truck className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Vendor returns & debit memos.</p></CardContent></Card></TabsContent>
      </Tabs>

      <PurchaseOrderDialog open={poOpen} onOpenChange={setPoOpen} />

      {/* Receive PO Dialog */}
      <Dialog open={!!receivingPo} onOpenChange={(v) => { if (!v) setReceivingPo(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive Purchase Order</DialogTitle>
          </DialogHeader>
          {receivingPo && (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/50 p-3 text-sm space-y-1">
                <p className="font-semibold">{receivingPo.po_number}</p>
                <p className="text-muted-foreground">{receivingPo.supplier_name} · {format(new Date(receivingPo.date), "MMM d, yyyy")}</p>
              </div>

              {poItems.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items to receive</p>
                  <div className="divide-y divide-border rounded-lg border overflow-hidden">
                    {poItems.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="flex-1">{item.description}</span>
                        <span className="text-muted-foreground">×{item.qty}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Items linked to products will have their stock incremented automatically.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">This PO has no saved line items. Confirming receipt will mark it as received.</p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setReceivingPo(null)}>Cancel</Button>
                <Button className="flex-1 bg-[#1a3a22] text-white hover:bg-[#152e1a]" onClick={() => receiveMutation.mutate()} disabled={receiveMutation.isPending}>
                  {receiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><PackageCheck className="h-4 w-4 mr-1" /> Confirm Receipt</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
