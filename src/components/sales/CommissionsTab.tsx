import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQuery } from "@tanstack/react-query";
import { DollarSign } from "lucide-react";
import { format } from "date-fns";

export function CommissionsTab() {
  const { business } = useBusiness();

  const { data: commissions = [] } = useQuery({
    queryKey: ["commissions", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("commissions").select("*").eq("business_id", business!.id).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff_for_commission", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_members").select("id, name").eq("business_id", business!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const getStaffName = (id: string) => staff.find((s: any) => s.id === id)?.name || "Unknown";
  const totalPending = commissions.filter((c: any) => c.status === "pending").reduce((s: number, c: any) => s + Number(c.amount), 0);
  const totalPaid = commissions.filter((c: any) => c.status === "paid").reduce((s: number, c: any) => s + Number(c.amount), 0);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Commission Tracking</h3>
        <p className="text-sm text-muted-foreground">Sales rep commissions are calculated per invoice/sale</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Records</p><p className="text-xl font-bold">{commissions.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Pending Payout</p><p className="text-xl font-bold font-mono text-yellow-500">GHS {totalPending.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Paid</p><p className="text-xl font-bold font-mono text-green-500">GHS {totalPaid.toLocaleString()}</p></CardContent></Card>
      </div>

      <Card><CardContent className="pt-4">
        {commissions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Date</TableHead><TableHead>Sales Rep</TableHead><TableHead>Rate</TableHead><TableHead className="text-right">Base Amount</TableHead><TableHead className="text-right">Commission</TableHead><TableHead>Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{format(new Date(c.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell className="font-medium">{getStaffName(c.staff_id)}</TableCell>
                  <TableCell>{Number(c.rate).toFixed(1)}%</TableCell>
                  <TableCell className="text-right font-mono">GHS {Number(c.base_amount).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">GHS {Number(c.amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "paid" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No commissions recorded yet. Commissions are generated from sales and invoices.</p>
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}
