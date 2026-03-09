import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Warehouse, ArrowRightLeft, Plus } from "lucide-react";
import WarehouseDialog from "@/components/warehouse/WarehouseDialog";

export default function Warehouses() {
  const { business } = useBusiness();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses").select("*").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Warehouses</h1>
        <p className="text-muted-foreground">Multi-location stock control, bin management, and transfers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Warehouse className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{warehouses.length}</p><p className="text-xs text-muted-foreground">Warehouses</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><ArrowRightLeft className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Transfers (MTD)</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Warehouse className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{warehouses.filter((w: any) => w.is_active).length}</p><p className="text-xs text-muted-foreground">Active</p></div></div></CardContent></Card>
      </div>

      <div className="flex justify-between"><h3 className="font-semibold">All Warehouses</h3><Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Warehouse</Button></div>
      <Card><CardContent className="pt-4">
        {warehouses.length > 0 ? (
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Address</TableHead><TableHead>Default</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{warehouses.map((w: any) => (
              <TableRow key={w.id}>
                <TableCell className="font-mono">{w.code}</TableCell>
                <TableCell className="font-medium">{w.name}</TableCell>
                <TableCell>{w.address || "—"}</TableCell>
                <TableCell>{w.is_default ? <Badge>Default</Badge> : "—"}</TableCell>
                <TableCell><Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? "Active" : "Inactive"}</Badge></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground"><Warehouse className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No warehouses yet. Add your storage locations.</p></div>
        )}
      </CardContent></Card>

      <WarehouseDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
