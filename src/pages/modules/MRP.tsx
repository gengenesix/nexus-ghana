import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cpu, TrendingDown, TrendingUp, AlertTriangle, Play } from "lucide-react";

export default function MRP() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">MRP — Material Requirements Planning</h1>
        <p className="text-muted-foreground">Forecast-driven procurement and production planning</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Cpu className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">—</p><p className="text-xs text-muted-foreground">Last MRP Run</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingDown className="h-8 w-8 text-red-500" /><div><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Shortage Alerts</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingUp className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Recommended POs</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-orange-500" /><div><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Overstock Warnings</p></div></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run MRP Wizard</CardTitle>
          <CardDescription>Analyze demand from sales orders, forecasts, and minimum stock levels to generate purchase and production recommendations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button className="gold-gradient text-primary-foreground"><Play className="h-4 w-4 mr-2" />Run MRP</Button>
            <Button variant="outline">View Last Results</Button>
          </div>
          <div className="text-center py-8 text-muted-foreground">
            <Cpu className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-sm">Set up inventory items with reorder levels, then run MRP to get automated procurement recommendations.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
