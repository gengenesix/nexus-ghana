import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Headphones, AlertCircle, Clock, CheckCircle2, Plus } from "lucide-react";
import { format } from "date-fns";
import ServiceCallDialog from "@/components/service/ServiceCallDialog";

export default function ServiceModule() {
  const { business } = useBusiness();
  const [activeTab, setActiveTab] = useState("calls");
  const [callOpen, setCallOpen] = useState(false);

  const { data: serviceCalls = [] } = useQuery({
    queryKey: ["service_calls", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_calls").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const openCalls = serviceCalls.filter((c: any) => c.status === "open").length;
  const resolvedCalls = serviceCalls.filter((c: any) => c.status === "resolved").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Service</h1>
        <p className="text-muted-foreground">Post-sales support, service calls, and contract management</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Headphones className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{serviceCalls.length}</p><p className="text-xs text-muted-foreground">Total Calls</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><AlertCircle className="h-8 w-8 text-red-500" /><div><p className="text-2xl font-bold">{openCalls}</p><p className="text-xs text-muted-foreground">Open</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-yellow-500" /><div><p className="text-2xl font-bold">{serviceCalls.filter((c: any) => c.status === "in_progress").length}</p><p className="text-xs text-muted-foreground">In Progress</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><CheckCircle2 className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{resolvedCalls}</p><p className="text-xs text-muted-foreground">Resolved</p></div></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="calls">Service Calls</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
        </TabsList>

        <TabsContent value="calls" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Service Calls</h3><Button onClick={() => setCallOpen(true)}><Plus className="h-4 w-4 mr-1" />New Call</Button></div>
          <Card><CardContent className="pt-4">
            {serviceCalls.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Call #</TableHead><TableHead>Customer</TableHead><TableHead>Subject</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Opened</TableHead></TableRow></TableHeader>
                <TableBody>{serviceCalls.map((sc: any) => (
                  <TableRow key={sc.id}>
                    <TableCell className="font-mono">{sc.call_number}</TableCell>
                    <TableCell>{sc.customer_name}</TableCell>
                    <TableCell>{sc.subject}</TableCell>
                    <TableCell><Badge variant={sc.priority === "high" || sc.priority === "critical" ? "destructive" : "outline"} className="capitalize">{sc.priority}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{sc.status}</Badge></TableCell>
                    <TableCell className="text-xs">{format(new Date(sc.opened_at), "MMM d, HH:mm")}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><Headphones className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No service calls yet.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="contracts"><Card><CardContent className="text-center py-12 text-muted-foreground"><CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Service contracts and SLA management.</p></CardContent></Card></TabsContent>
        <TabsContent value="equipment"><Card><CardContent className="text-center py-12 text-muted-foreground"><Headphones className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Customer equipment cards and service history.</p></CardContent></Card></TabsContent>
      </Tabs>

      <ServiceCallDialog open={callOpen} onOpenChange={setCallOpen} />
    </div>
  );
}
