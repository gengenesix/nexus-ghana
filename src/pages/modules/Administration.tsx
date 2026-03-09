import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Settings, Shield, FileText, Bell, History, Users, Hash,
  Plus, Pencil, Trash2, Search, Loader2, CheckCircle, XCircle,
} from "lucide-react";
import { format } from "date-fns";

const MODULE_LIST = [
  "administration", "financials", "crm", "sales", "purchasing",
  "inventory", "production", "mrp", "projects", "opportunities",
  "service", "hr", "banking", "reports", "pos",
];

const ROLE_TEMPLATES_DEFAULT = [
  { name: "System Administrator", description: "Full access to all modules", license_tier: "professional" as const },
  { name: "CFO / Finance Manager", description: "Financials, Banking, Reporting — Full; All others — Read Only", license_tier: "limited_financial" as const },
  { name: "Accountant", description: "Financials, Banking — Full; Sales/Purchasing — Read Only", license_tier: "limited_financial" as const },
  { name: "Sales Manager", description: "CRM, Sales, Opportunities, Reporting — Full", license_tier: "limited_sales_crm" as const },
  { name: "Sales Representative", description: "CRM, Sales, Opportunities — Full (own records only)", license_tier: "limited_sales_crm" as const },
  { name: "Purchasing Manager", description: "Purchasing, Inventory, MRP — Full", license_tier: "limited_logistics" as const },
  { name: "Warehouse Manager", description: "Inventory, Production — Full; Purchasing — Read Only", license_tier: "limited_logistics" as const },
  { name: "Production Planner", description: "Production, MRP, Inventory — Full", license_tier: "limited_logistics" as const },
  { name: "HR Manager", description: "Human Resources — Full; Financials — Read Only", license_tier: "professional" as const },
  { name: "Project Manager", description: "Project Management, Service — Full; Financials — Read Only", license_tier: "professional" as const },
  { name: "Service Technician", description: "Service — Full (own calls only); Inventory — Read Only", license_tier: "limited_logistics" as const },
  { name: "Executive / CEO", description: "All modules — Read Only + Reporting Full", license_tier: "professional" as const },
];

export default function Administration() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("company");

  // Audit logs
  const { data: auditLogs = [], isLoading: logsLoading } = useQuery({
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

  // Number series
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

  // Role templates
  const { data: roleTemplates = [] } = useQuery({
    queryKey: ["role_templates", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_templates")
        .select("*")
        .eq("business_id", business!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  // Approval workflows
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

  // Notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  // Seed default role templates
  const seedTemplates = useMutation({
    mutationFn: async () => {
      const inserts = ROLE_TEMPLATES_DEFAULT.map((t) => ({
        business_id: business!.id,
        name: t.name,
        description: t.description,
        license_tier: t.license_tier,
        is_system: true,
        permissions: {},
      }));
      const { error } = await supabase.from("role_templates").upsert(inserts, { onConflict: "business_id,name" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role_templates"] });
      toast.success("Default role templates created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Administration</h1>
        <p className="text-muted-foreground">System configuration, users, and security management</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 gap-1">
          <TabsTrigger value="company" className="flex items-center gap-1.5"><Settings className="h-3.5 w-3.5" />Company</TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Roles</TabsTrigger>
          <TabsTrigger value="numbering" className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" />Numbering</TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" />Approvals</TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5"><History className="h-3.5 w-3.5" />Audit Log</TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" />Alerts</TabsTrigger>
        </TabsList>

        {/* Company Settings Tab */}
        <TabsContent value="company" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Profile</CardTitle>
              <CardDescription>General business configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input value={business?.name || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input value="GHS (Ghana Cedi)" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input value="Africa/Accra (GMT+0)" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Input value={business?.region || "Not set"} disabled />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Edit company details in Settings → Business Profile</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Templates Tab */}
        <TabsContent value="roles" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Role Templates</h3>
              <p className="text-sm text-muted-foreground">Pre-built permission sets you can assign to staff members</p>
            </div>
            {roleTemplates.length === 0 && (
              <Button onClick={() => seedTemplates.mutate()} disabled={seedTemplates.isPending}>
                {seedTemplates.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Generate Default Templates
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roleTemplates.map((rt: any) => (
              <Card key={rt.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{rt.name}</CardTitle>
                    {rt.is_system && <Badge variant="secondary" className="text-xs">System</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{rt.description}</p>
                  <Badge className="mt-2" variant="outline">{rt.license_tier}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
          {roleTemplates.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No Role Templates</h3>
                <p className="text-muted-foreground text-sm max-w-md mt-1">Click "Generate Default Templates" to create SAP-style role templates for your organization.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Number Series Tab */}
        <TabsContent value="numbering" className="space-y-4">
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
        </TabsContent>

        {/* Approval Workflows Tab */}
        <TabsContent value="approvals" className="space-y-4">
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
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>Complete log of all system actions</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
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
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Alerts & Notifications</CardTitle>
              <CardDescription>Recent alerts and system notifications</CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((n: any) => (
                    <div key={n.id} className={`flex items-start gap-3 p-3 rounded-lg border ${n.is_read ? "bg-background" : "bg-secondary/30"}`}>
                      <Bell className={`h-4 w-4 mt-1 ${n.is_read ? "text-muted-foreground" : "text-primary"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.created_at), "MMM d, HH:mm")}</p>
                      </div>
                      {n.module && <Badge variant="outline" className="text-xs capitalize">{n.module}</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No notifications yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
