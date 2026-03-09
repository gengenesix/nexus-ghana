import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Users, Target, Activity, Mail, Plus, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";

const LEAD_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];
const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-500", contacted: "bg-yellow-500/10 text-yellow-500",
  qualified: "bg-purple-500/10 text-purple-500", proposal: "bg-orange-500/10 text-orange-500",
  negotiation: "bg-cyan-500/10 text-cyan-500", won: "bg-green-500/10 text-green-500", lost: "bg-red-500/10 text-red-500",
};

export default function CRM() {
  const { business } = useBusiness();
  const [activeTab, setActiveTab] = useState("leads");
  const [search, setSearch] = useState("");

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ["opportunities", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activities", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("activities").select("*").eq("business_id", business!.id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const pipelineValue = opportunities.filter((o: any) => o.status === "open").reduce((sum: number, o: any) => sum + Number(o.value || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">CRM</h1>
        <p className="text-muted-foreground">Customer relationship management — leads, opportunities, and activities</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{leads.length}</p><p className="text-xs text-muted-foreground">Total Leads</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Target className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{opportunities.length}</p><p className="text-xs text-muted-foreground">Opportunities</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Activity className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{activities.length}</p><p className="text-xs text-muted-foreground">Activities</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Target className="h-8 w-8 text-orange-500" /><div><p className="text-2xl font-bold">GHS {pipelineValue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Pipeline Value</p></div></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search leads..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button><Plus className="h-4 w-4 mr-1" />New Lead</Button>
          </div>
          <Card>
            <CardContent className="pt-4">
              {leadsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : leads.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.filter((l: any) => l.name.toLowerCase().includes(search.toLowerCase())).map((lead: any) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.name}</TableCell>
                        <TableCell>{lead.company || "—"}</TableCell>
                        <TableCell>{lead.source || "—"}</TableCell>
                        <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[lead.status] || ""}`}>{lead.status}</span></TableCell>
                        <TableCell className="text-right font-mono">GHS {Number(lead.value || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{format(new Date(lead.created_at), "MMM d, yyyy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="font-semibold text-lg">No Leads Yet</h3>
                  <p className="text-sm">Start capturing leads to build your sales pipeline.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Opportunity Pipeline</h3>
            <Button><Plus className="h-4 w-4 mr-1" />New Opportunity</Button>
          </div>
          {opportunities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {["prospecting", "qualification", "proposal", "negotiation", "closed_won"].map((stage) => (
                <div key={stage} className="space-y-2">
                  <h4 className="text-sm font-medium capitalize px-1">{stage.replace("_", " ")}</h4>
                  {opportunities.filter((o: any) => o.stage === stage).map((opp: any) => (
                    <Card key={opp.id} className="cursor-pointer hover:border-primary/50">
                      <CardContent className="p-3">
                        <p className="font-medium text-sm">{opp.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">GHS {Number(opp.value).toLocaleString()}</p>
                        <Badge variant="outline" className="mt-2 text-xs">{opp.probability}%</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <Card><CardContent className="text-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold text-lg">No Opportunities</h3>
              <p className="text-sm">Create opportunities to track your sales pipeline.</p>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="activities">
          <Card><CardContent className="pt-6">
            {activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((act: any) => (
                  <div key={act.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Activity className="h-4 w-4 mt-1 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{act.subject}</p>
                      <p className="text-xs text-muted-foreground">{act.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(act.created_at), "MMM d, HH:mm")}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No activities logged yet.</p>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card><CardContent className="text-center py-12 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-semibold text-lg">Marketing Campaigns</h3>
            <p className="text-sm">Create and track marketing campaigns. Coming soon.</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
