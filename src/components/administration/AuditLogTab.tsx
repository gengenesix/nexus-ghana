import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, History } from "lucide-react";
import { format } from "date-fns";

export default function AuditLogTab() {
  const { business } = useBusiness();

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ["audit_logs", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Trail</CardTitle>
        <CardDescription>Complete log of all system actions</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : auditLogs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(log.created_at), "MMM d, HH:mm")}</TableCell>
                  <TableCell>{log.staff_name || "System"}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{log.module}</Badge></TableCell>
                  <TableCell className="capitalize">{log.action}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{log.record_type} {log.record_id?.slice(0, 8)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No audit records yet. Actions will be logged as you use the system.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
