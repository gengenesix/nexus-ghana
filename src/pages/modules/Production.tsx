import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Factory, Layers, ClipboardList, Calendar, Plus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";
import ProductionOrderDialog from "@/components/production/ProductionOrderDialog";
import { ProductionScheduler } from "@/components/production/ProductionScheduler";

export default function Production() {
  const { business } = useBusiness();
  const [activeTab, setActiveTab] = useState("bom");
  const [prodOrderOpen, setProdOrderOpen] = useState(false);

  const { data: boms = [] } = useQuery({
    queryKey: ["bill_of_materials", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bill_of_materials").select("*").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const { data: prodOrders = [] } = useQuery({
    queryKey: ["production_orders", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("production_orders").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Production</h1>
        <p className="text-muted-foreground">Bill of Materials, production orders, and resource planning</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Layers className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{boms.length}</p><p className="text-xs text-muted-foreground">Bills of Material</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><ClipboardList className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{prodOrders.length}</p><p className="text-xs text-muted-foreground">Production Orders</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Factory className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{prodOrders.filter((p: any) => p.status === "in_progress").length}</p><p className="text-xs text-muted-foreground">In Progress</p></div></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="bom">Bill of Materials</TabsTrigger>
          <TabsTrigger value="orders">Production Orders</TabsTrigger>
          <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
        </TabsList>

        <TabsContent value="bom" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Bills of Material</h3><Button><Plus className="h-4 w-4 mr-1" />New BOM</Button></div>
          <Card><CardContent className="pt-4">
            {boms.length > 0 ? (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Qty to Produce</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{boms.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.quantity_to_produce}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{b.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
              </div>
            ) : (
              <EmptyState icon={Layers} title="No bills of material yet" description="Define the components and quantities needed to produce each finished good." size="sm" />
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Production Orders</h3><Button onClick={() => setProdOrderOpen(true)}><Plus className="h-4 w-4 mr-1" />New Order</Button></div>
          <Card><CardContent className="pt-4">
            {prodOrders.length > 0 ? (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Order #</TableHead><TableHead>Qty</TableHead><TableHead>Planned Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{prodOrders.map((po: any) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono">{po.order_number}</TableCell>
                    <TableCell>{po.quantity}</TableCell>
                    <TableCell>{po.planned_date ? format(new Date(po.planned_date), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{po.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
              </div>
            ) : (
              <EmptyState icon={ClipboardList} title="No production orders yet" description="Create a production order to schedule manufacturing runs from your BOM." size="sm" />
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="scheduling">
          <ProductionScheduler
            orders={prodOrders}
            onOrderClick={() => setProdOrderOpen(true)}
          />
        </TabsContent>
      </Tabs>

      <ProductionOrderDialog open={prodOrderOpen} onOpenChange={setProdOrderOpen} />
    </div>
  );
}
