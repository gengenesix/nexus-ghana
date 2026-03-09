import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";

export default function ApprovalsTab() {
  const { business } = useBusiness();

  const { data: workflows = [] } = useQuery({
    queryKey: ["approval_workflows", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_workflows")
        .select("*")
        .eq("business_id", business!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval Workflows</CardTitle>
        <CardDescription>Define multi-step approval chains for documents</CardDescription>
      </CardHeader>
      <CardContent>
        {workflows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Document Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((wf: any) => (
                <TableRow key={wf.id}>
                  <TableCell className="font-medium">{wf.name}</TableCell>
                  <TableCell className="capitalize">{wf.document_type.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <Badge variant={wf.is_active ? "default" : "secondary"}>
                      {wf.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No approval workflows configured. Create one to require approval on high-value documents.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
