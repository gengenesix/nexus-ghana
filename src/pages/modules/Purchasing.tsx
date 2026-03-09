import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Truck, Package, FileCheck, Plus } from "lucide-react";
import { format } from "date-fns";

export default function Purchasing() {
  const { business } = useBusiness();
  const [activeTab, setActiveTab] = useState("orders");

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchase_orders", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
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
          <div className="flex justify-between"><h3 className="font-semibold">Purchase Orders</h3><Button><Plus className="h-4 w-4 mr-1" />New PO</Button></div>
          <Card><CardContent className="pt-4">
            {purchaseOrders.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{purchaseOrders.map((po: any) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono">{po.po_number}</TableCell>
                    <TableCell>{po.supplier_name}</TableCell>
                    <TableCell>{format(new Date(po.date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right font-mono">GHS {Number(po.total).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{po.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No purchase orders yet.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="receipts"><Card><CardContent className="text-center py-12 text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Goods receipt tracking. Create a PO first.</p></CardContent></Card></TabsContent>
        <TabsContent value="invoices"><Card><CardContent className="text-center py-12 text-muted-foreground"><FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Accounts payable invoices.</p></CardContent></Card></TabsContent>
        <TabsContent value="returns"><Card><CardContent className="text-center py-12 text-muted-foreground"><Truck className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Vendor returns & debit memos.</p></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
