import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Settings, Shield, Hash, Bell, History, CheckCircle, Plus, Loader2, Lock } from "lucide-react";

import CompanySettings from "@/components/administration/CompanySettings";
import PermissionMatrix from "@/components/administration/PermissionMatrix";
import NumberingTab from "@/components/administration/NumberingTab";
import ApprovalsTab from "@/components/administration/ApprovalsTab";
import AuditLogTab from "@/components/administration/AuditLogTab";
import NotificationsTab from "@/components/administration/NotificationsTab";

const ROLE_TEMPLATES_DEFAULT = [
  { name: "System Administrator", description: "Full access to all modules", license_tier: "professional" as const, permissions: { dashboard: true, pos: true, inventory: true, invoices: true, customers: true, suppliers: true, expenses: true, reports: true, staff: true, settings: true, administration: true, financials: true, crm: true, sales: true, purchasing: true, production: true, mrp: true, projects: true, opportunities: true, service: true, hr: true, banking: true } },
  { name: "CFO / Finance Manager", description: "Financials, Banking, Reporting — Full", license_tier: "limited_financial" as const, permissions: { dashboard: true, financials: true, banking: true, reports: true, expenses: true, invoices: true } },
  { name: "Accountant", description: "Financials, Banking — Full; Sales/Purchasing — Read Only", license_tier: "limited_financial" as const, permissions: { dashboard: true, financials: true, banking: true, expenses: true, invoices: true, reports: true } },
  { name: "Sales Manager", description: "CRM, Sales, Opportunities, Reporting — Full", license_tier: "limited_sales_crm" as const, permissions: { dashboard: true, pos: true, crm: true, sales: true, opportunities: true, invoices: true, customers: true, reports: true } },
  { name: "Sales Representative", description: "CRM, Sales, Opportunities — Full (own records only)", license_tier: "limited_sales_crm" as const, permissions: { pos: true, crm: true, sales: true, opportunities: true, customers: true, invoices: true } },
  { name: "Purchasing Manager", description: "Purchasing, Inventory, MRP — Full", license_tier: "limited_logistics" as const, permissions: { dashboard: true, purchasing: true, inventory: true, mrp: true, suppliers: true } },
  { name: "Warehouse Manager", description: "Inventory, Production — Full; Purchasing — Read Only", license_tier: "limited_logistics" as const, permissions: { dashboard: true, inventory: true, production: true, purchasing: true, suppliers: true } },
  { name: "Production Planner", description: "Production, MRP, Inventory — Full", license_tier: "limited_logistics" as const, permissions: { dashboard: true, production: true, mrp: true, inventory: true } },
  { name: "HR Manager", description: "Human Resources — Full; Financials — Read Only", license_tier: "professional" as const, permissions: { dashboard: true, hr: true, reports: true } },
  { name: "Project Manager", description: "Project Management, Service — Full", license_tier: "professional" as const, permissions: { dashboard: true, projects: true, service: true, reports: true } },
  { name: "Service Technician", description: "Service — Full; Inventory — Read Only", license_tier: "limited_logistics" as const, permissions: { service: true, inventory: true } },
  { name: "Executive / CEO", description: "All modules — Read Only + Reporting Full", license_tier: "professional" as const, permissions: { dashboard: true, reports: true, financials: true, crm: true, sales: true, purchasing: true, inventory: true, production: true, hr: true, banking: true, projects: true, service: true, opportunities: true } },
];

export default function Administration() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("company");

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

  const seedTemplates = useMutation({
    mutationFn: async () => {
      const inserts = ROLE_TEMPLATES_DEFAULT.map((t) => ({
        business_id: business!.id,
        name: t.name,
        description: t.description,
        license_tier: t.license_tier,
        is_system: true,
        permissions: t.permissions,
      }));
      const { error } = await supabase.from("role_templates").upsert(inserts, { onConflict: "business_id,name" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role_templates"] });
      toast.success("Default role templates with permissions created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Administration</h1>
        <p className="text-muted-foreground">System configuration, authorization, and security management</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-7 gap-1">
          <TabsTrigger value="company" className="flex items-center gap-1.5"><Settings className="h-3.5 w-3.5" />Company</TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Roles</TabsTrigger>
          <TabsTrigger value="authorization" className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Authorization</TabsTrigger>
          <TabsTrigger value="numbering" className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" />Numbering</TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" />Approvals</TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5"><History className="h-3.5 w-3.5" />Audit Log</TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" />Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-4">
          <CompanySettings />
        </TabsContent>

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
            {roleTemplates.map((rt: any) => {
              const perms = (rt.permissions && typeof rt.permissions === "object") ? rt.permissions as Record<string, boolean> : {};
              const accessCount = Object.values(perms).filter(Boolean).length;
              return (
                <Card key={rt.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{rt.name}</CardTitle>
                      {rt.is_system && <Badge variant="secondary" className="text-xs">System</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{rt.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">{rt.license_tier}</Badge>
                      <Badge variant="outline" className="text-xs">{accessCount} modules</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {roleTemplates.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No Role Templates</h3>
                <p className="text-muted-foreground text-sm max-w-md mt-1">Click "Generate Default Templates" to create SAP-style role templates with module permissions.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="authorization" className="space-y-4">
          <PermissionMatrix />
        </TabsContent>

        <TabsContent value="numbering" className="space-y-4">
          <NumberingTab />
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          <ApprovalsTab />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditLogTab />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
