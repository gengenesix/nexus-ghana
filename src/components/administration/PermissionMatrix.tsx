import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Save, Loader2, Shield, Pencil, Trash2 } from "lucide-react";

const MODULES = [
  "dashboard", "pos", "inventory", "invoices", "customers", "suppliers",
  "expenses", "reports", "staff", "settings", "administration", "financials",
  "crm", "sales", "purchasing", "production", "mrp", "projects",
  "opportunities", "service", "hr", "banking",
];

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard", pos: "Point of Sale", inventory: "Inventory",
  invoices: "Invoices", customers: "Customers", suppliers: "Suppliers",
  expenses: "Expenses", reports: "Reports", staff: "Staff Mgmt",
  settings: "Settings", administration: "Administration", financials: "Financials",
  crm: "CRM", sales: "Sales Orders", purchasing: "Purchasing",
  production: "Production", mrp: "MRP", projects: "Projects",
  opportunities: "Opportunities", service: "Service", hr: "Human Resources",
  banking: "Banking",
};

const LICENSE_TIERS = [
  { value: "professional", label: "Professional" },
  { value: "limited_financial", label: "Limited Financial" },
  { value: "limited_sales_crm", label: "Limited Sales/CRM" },
  { value: "limited_logistics", label: "Limited Logistics" },
];

export default function PermissionMatrix() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTier, setFormTier] = useState("professional");
  const [formPermissions, setFormPermissions] = useState<Record<string, boolean>>({});

  const { data: templates = [], isLoading } = useQuery({
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

  const toggleModule = (mod: string) => {
    setFormPermissions(prev => ({ ...prev, [mod]: !prev[mod] }));
  };

  const toggleAll = (checked: boolean) => {
    const perms: Record<string, boolean> = {};
    MODULES.forEach(m => { perms[m] = checked; });
    setFormPermissions(perms);
  };

  const resetForm = () => {
    setFormName(""); setFormDesc(""); setFormTier("professional");
    setFormPermissions({}); setEditingId(null);
  };

  const openEdit = (t: any) => {
    setEditingId(t.id);
    setFormName(t.name);
    setFormDesc(t.description || "");
    setFormTier(t.license_tier);
    const perms: Record<string, boolean> = {};
    if (t.permissions && typeof t.permissions === "object") {
      Object.entries(t.permissions).forEach(([k, v]) => { perms[k] = !!v; });
    }
    setFormPermissions(perms);
    setShowAdd(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: business!.id,
        name: formName.trim(),
        description: formDesc.trim(),
        license_tier: formTier as any,
        permissions: formPermissions,
        is_system: false,
      };
      if (editingId) {
        const { error } = await supabase.from("role_templates").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("role_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role_templates"] });
      setShowAdd(false); resetForm();
      toast.success(editingId ? "Role template updated" : "Role template created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("role_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role_templates"] });
      toast.success("Role template deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const enabledCount = Object.values(formPermissions).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Authorization Matrix</h3>
          <p className="text-sm text-muted-foreground">Define module-level access for each role template</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Role Template
        </Button>
      </div>

      {/* Matrix Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No role templates yet. Create one or generate defaults from the Roles tab.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]">Role</TableHead>
                  {MODULES.map(mod => (
                    <TableHead key={mod} className="text-center text-xs px-1.5 min-w-[70px]">
                      <span className="writing-mode-vertical">{MODULE_LABELS[mod]}</span>
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t: any) => {
                  const perms = (t.permissions && typeof t.permissions === "object") ? t.permissions as Record<string, boolean> : {};
                  const accessCount = Object.values(perms).filter(Boolean).length;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="sticky left-0 bg-background z-10">
                        <div>
                          <span className="font-medium text-sm">{t.name}</span>
                          {t.is_system && <Badge variant="secondary" className="ml-1.5 text-[10px]">System</Badge>}
                          <p className="text-[10px] text-muted-foreground">{accessCount}/{MODULES.length} modules</p>
                        </div>
                      </TableCell>
                      {MODULES.map(mod => (
                        <TableCell key={mod} className="text-center px-1.5">
                          {perms[mod] ? (
                            <div className="h-4 w-4 mx-auto rounded-sm bg-primary/20 border border-primary/40 flex items-center justify-center">
                              <div className="h-2 w-2 rounded-sm bg-primary" />
                            </div>
                          ) : (
                            <div className="h-4 w-4 mx-auto rounded-sm border border-muted-foreground/20" />
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {!t.is_system && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(t.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { if (!open) resetForm(); setShowAdd(open); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Create"} Role Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role Name *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Branch Manager" />
              </div>
              <div className="space-y-2">
                <Label>License Tier</Label>
                <Select value={formTier} onValueChange={setFormTier}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LICENSE_TIERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Brief description of this role's responsibilities" />
            </div>

            {/* Permission Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Module Permissions ({enabledCount}/{MODULES.length})</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>Select All</Button>
                  <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>Clear All</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {MODULES.map(mod => (
                  <label key={mod} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${formPermissions[mod] ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"}`}>
                    <Checkbox checked={!!formPermissions[mod]} onCheckedChange={() => toggleModule(mod)} />
                    <span className="text-sm">{MODULE_LABELS[mod]}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={!formName.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {editingId ? "Update Template" : "Create Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
