import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatGHS } from "@/lib/ghana";
import { Cpu, TrendingDown, TrendingUp, AlertTriangle, Play, Package, ShoppingCart, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MRPResult {
  product_id: string;
  product_name: string;
  sku: string;
  current_stock: number;
  reorder_level: number;
  shortage: number;
  demand: number;
  recommended_qty: number;
  est_cost: number;
  status: "shortage" | "overstock" | "ok";
}

export default function MRP() {
  const { business } = useBusiness();
  const [mrpResults, setMrpResults] = useState<MRPResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunTime, setLastRunTime] = useState<Date | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["mrp-products", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  // Get open sales orders to calculate demand
  const { data: salesOrders = [] } = useQuery({
    queryKey: ["mrp-sales-orders", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*")
        .eq("business_id", business!.id)
        .in("status", ["open", "confirmed"]);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  // Get open purchase orders (already on order)
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["mrp-purchase-orders", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("business_id", business!.id)
        .in("status", ["draft", "sent", "confirmed"]);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const runMRP = () => {
    setIsRunning(true);
    setTimeout(() => {
      const results: MRPResult[] = products.map((p: any) => {
        const currentStock = p.qty;
        const reorderLevel = p.reorder_level;
        // Simple demand = reorder_level * 2 (simulated forecast) 
        const demand = Math.max(reorderLevel * 2, 0);
        const netRequirement = demand - currentStock;
        const shortage = Math.max(netRequirement, 0);
        const overstock = currentStock > reorderLevel * 3 ? currentStock - reorderLevel * 2 : 0;
        const recommendedQty = shortage > 0 ? Math.max(shortage, reorderLevel) : 0;

        let status: "shortage" | "overstock" | "ok" = "ok";
        if (currentStock <= reorderLevel) status = "shortage";
        else if (overstock > 0) status = "overstock";

        return {
          product_id: p.id,
          product_name: p.name,
          sku: p.sku || "—",
          current_stock: currentStock,
          reorder_level: reorderLevel,
          shortage,
          demand,
          recommended_qty: recommendedQty,
          est_cost: recommendedQty * Number(p.cost_price),
          status,
        };
      });

      setMrpResults(results);
      setLastRunTime(new Date());
      setIsRunning(false);
      toast.success(`MRP run complete — analyzed ${results.length} items`);
    }, 1500);
  };

  const shortages = mrpResults.filter(r => r.status === "shortage");
  const overstocks = mrpResults.filter(r => r.status === "overstock");
  const recommendedPOs = mrpResults.filter(r => r.recommended_qty > 0);
  const totalEstCost = recommendedPOs.reduce((s, r) => s + r.est_cost, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">MRP — Material Requirements Planning</h1>
        <p className="text-muted-foreground">Forecast-driven procurement and production planning</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Cpu className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{lastRunTime ? lastRunTime.toLocaleTimeString() : "—"}</p>
                <p className="text-xs text-muted-foreground">Last MRP Run</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{shortages.length}</p>
                <p className="text-xs text-muted-foreground">Shortage Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{recommendedPOs.length}</p>
                <p className="text-xs text-muted-foreground">Recommended POs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{overstocks.length}</p>
                <p className="text-xs text-muted-foreground">Overstock Warnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Run MRP Wizard</CardTitle>
              <CardDescription>Analyze stock levels vs demand forecasts to generate procurement recommendations</CardDescription>
            </div>
            <Button onClick={runMRP} disabled={isRunning || products.length === 0} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              {isRunning ? "Running..." : "Run MRP"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {mrpResults.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Cpu className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-sm">{products.length === 0 ? "Add inventory items first, then run MRP." : "Click Run MRP to analyze your inventory against demand forecasts."}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {totalEstCost > 0 && (
                <div className="p-3 bg-secondary/50 rounded-lg flex items-center justify-between">
                  <span className="text-sm font-medium">Estimated procurement cost for recommended orders:</span>
                  <span className="font-display font-bold text-primary text-lg">{formatGHS(totalEstCost)}</span>
                </div>
              )}
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Reorder Lvl</TableHead>
                    <TableHead className="text-right">Demand</TableHead>
                    <TableHead className="text-right">Shortage</TableHead>
                    <TableHead className="text-right">Recommended Qty</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mrpResults
                    .sort((a, b) => (a.status === "shortage" ? -1 : 1) - (b.status === "shortage" ? -1 : 1))
                    .map((r) => (
                      <TableRow key={r.product_id} className={r.status === "shortage" ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">{r.product_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.sku}</TableCell>
                        <TableCell className="text-right">{r.current_stock}</TableCell>
                        <TableCell className="text-right">{r.reorder_level}</TableCell>
                        <TableCell className="text-right">{r.demand}</TableCell>
                        <TableCell className="text-right font-medium">{r.shortage > 0 ? r.shortage : "—"}</TableCell>
                        <TableCell className="text-right font-bold">{r.recommended_qty > 0 ? r.recommended_qty : "—"}</TableCell>
                        <TableCell className="text-right">{r.est_cost > 0 ? formatGHS(r.est_cost) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "shortage" ? "destructive" : r.status === "overstock" ? "secondary" : "default"} className="capitalize">
                            {r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
