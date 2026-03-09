import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Hash } from "lucide-react";

export default function NumberingTab() {
  const { business } = useBusiness();

  const { data: numberSeries = [] } = useQuery({
    queryKey: ["number_series", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("number_series")
        .select("*")
        .eq("business_id", business!.id)
        .order("document_type");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Numbering Series</CardTitle>
        <CardDescription>Configure auto-numbering for each document type</CardDescription>
      </CardHeader>
      <CardContent>
        {numberSeries.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Type</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Next Number</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {numberSeries.map((ns: any) => (
                <TableRow key={ns.id}>
                  <TableCell className="font-medium capitalize">{ns.document_type.replace(/_/g, " ")}</TableCell>
                  <TableCell>{ns.prefix}</TableCell>
                  <TableCell>{ns.next_number}</TableCell>
                  <TableCell>
                    <Badge variant={ns.is_active ? "default" : "secondary"}>
                      {ns.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Hash className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No number series configured yet. They will be auto-created as you use each module.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
