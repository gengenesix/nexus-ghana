import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Warehouse, ArrowRightLeft, Plus, Package } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import WarehouseDialog from "@/components/warehouse/WarehouseDialog";
import StockTransferDialog from "@/components/warehouse/StockTransferDialog";

export default function Warehouses() {
  const { business } = useBusiness();
  const [activeTab, setActiveTab] = useState("locations");
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("*").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["stock_transfers", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_transfers")
        .select("*, products(name), from_wh:warehouses!from_warehouse_id(name, code), to_wh:warehouses!to_warehouse_id(name, code)")
        .eq("business_id", business!.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const mtdTransfers = (transfers as any[]).filter(t => {
    const d = new Date(t.date);
    return d >= startOfMonth(new Date());
  }).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Warehouses</h1>
        <p className="text-muted-foreground">Multi-location stock control and transfers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Warehouse className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{warehouses.length}</p><p className="text-xs text-muted-foreground">Locations</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><ArrowRightLeft className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{mtdTransfers}</p><p className="text-xs text-muted-foreground">Transfers (MTD)</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Package className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{(warehouses as any[]).filter(w => w.is_active).length}</p><p className="text-xs text-muted-foreground">Active</p></div></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="transfers">Stock Transfers</TabsTrigger>
        </TabsList>

        {/* ── Locations ── */}
        <TabsContent value="locations" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">All Warehouses</h3>
            <Button onClick={() => setWarehouseOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Warehouse</Button>
          </div>
          <Card><CardContent className="pt-4">
            {(warehouses as any[]).length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Address</TableHead><TableHead>Default</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{(warehouses as any[]).map(w => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-sm">{w.code}</TableCell>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell className="text-muted-foreground">{w.address || "—"}</TableCell>
                    <TableCell>{w.is_default ? <Badge variant="default">Default</Badge> : "—"}</TableCell>
                    <TableCell><Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Warehouse className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No warehouses yet. Add your storage locations.</p>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* ── Stock Transfers ── */}
        <TabsContent value="transfers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Stock Transfers</h3>
            <Button onClick={() => setTransferOpen(true)} disabled={(warehouses as any[]).length < 2}>
              <ArrowRightLeft className="h-4 w-4 mr-1" />New Transfer
            </Button>
          </div>
          {(warehouses as any[]).length < 2 && (
            <p className="text-sm text-muted-foreground">You need at least 2 warehouses to record transfers.</p>
          )}
          <Card><CardContent className="pt-4">
            {(transfers as any[]).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transfer #</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{(transfers as any[]).map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-sm">{t.transfer_number}</TableCell>
                    <TableCell>{t.products?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.from_wh?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.to_wh?.name || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{t.quantity}</TableCell>
                    <TableCell className="text-sm">{format(new Date(t.date), "MMM d, yyyy")}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{t.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transfers yet. Move stock between locations.</p>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <WarehouseDialog open={warehouseOpen} onOpenChange={setWarehouseOpen} />
      <StockTransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
}
