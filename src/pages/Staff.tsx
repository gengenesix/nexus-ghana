import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatGHS } from "@/lib/ghana";
import { Search, Plus, Trash2, Loader2, Pencil, Shield, Eye, EyeOff, UserCog, Users, Circle, RefreshCw, Key, BarChart3, Award } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const DEFAULT_ROLES = ["Administrator", "Manager", "Supervisor", "Cashier", "Sales Rep", "Warehouse", "Accountant", "Staff"];

const EXTENDED_ROLES = [
  "System Administrator", "CFO / Finance Manager", "Accountant",
  "Sales Manager", "Sales Representative", "Purchasing Manager",
  "Warehouse Manager", "Production Planner", "HR Manager",
  "Project Manager", "Service Technician", "Executive / CEO",
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  Administrator: "Full system access — manage staff, settings, reports",
  Manager: "Dashboard, POS, inventory, invoices, customers, suppliers, expenses, reports, staff",
  Supervisor: "Dashboard, POS, inventory, invoices, customers, reports",
  Cashier: "POS and customer management",
  "Sales Rep": "POS, customers, invoices",
  Warehouse: "Inventory and suppliers management",
  Accountant: "Expenses, invoices, reports",
  Staff: "POS and inventory access only",
};

const COLORS = ["hsl(140,28%,16%)", "hsl(86,68%,52%)", "hsl(142,60%,38%)", "hsl(210,70%,48%)", "hsl(0,72%,51%)", "hsl(280,50%,50%)"];
const tooltipStyle = { background: "white", border: "1px solid hsl(45,15%,87%)", borderRadius: 8, color: "hsl(140,28%,16%)" };

export default function Staff() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [showResetPin, setShowResetPin] = useState(false);
  const [resetPinStaffId, setResetPinStaffId] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailStaff, setDetailStaff] = useState<any>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("Staff");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formConfirmPin, setFormConfirmPin] = useState("");
  const [formStaffId, setFormStaffId] = useState("");

  const { data: staffMembers = [], isLoading } = useQuery({
    queryKey: ["staff", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("*")
        .eq("business_id", business!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business,
    refetchInterval: 30000,
  });

  // Sales data for performance metrics
  const { data: sales = [] } = useQuery({
    queryKey: ["staff-sales", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("id, total, staff_id, created_at").eq("business_id", business!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  // Detail staff sales
  const { data: detailSales = [] } = useQuery({
    queryKey: ["staff-detail-sales", detailStaff?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, total, payment_method, created_at")
        .eq("business_id", business!.id)
        .eq("staff_id", detailStaff!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!detailStaff?.id && !!business,
  });

  const filtered = staffMembers.filter((s: any) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.staff_id && s.staff_id.toLowerCase().includes(search.toLowerCase())) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = staffMembers.filter((s: any) => s.is_online).length;
  const activeCount = staffMembers.filter((s: any) => s.status === "active").length;

  // Staff performance map
  const staffPerfMap: Record<string, { txCount: number; revenue: number }> = {};
  staffMembers.forEach((s: any) => { staffPerfMap[s.id] = { txCount: 0, revenue: 0 }; });
  sales.forEach((s: any) => {
    if (s.staff_id && staffPerfMap[s.staff_id]) {
      staffPerfMap[s.staff_id].txCount += 1;
      staffPerfMap[s.staff_id].revenue += Number(s.total);
    }
  });

  // Role distribution
  const roleCountMap: Record<string, number> = {};
  staffMembers.forEach((s: any) => { roleCountMap[s.role] = (roleCountMap[s.role] || 0) + 1; });
  const roleDistribution = Object.entries(roleCountMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const generateStaffId = (name: string) => {
    return name.trim().toLowerCase().replace(/\s+/g, ".").replace(/[^a-z.]/g, "");
  };

  const resetForm = () => {
    setFormName(""); setFormRole("Staff"); setFormPhone(""); setFormEmail("");
    setFormPin(""); setFormConfirmPin(""); setFormStaffId("");
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (formPin.length < 6) throw new Error("PIN must be 6 digits");
      if (formPin !== formConfirmPin) throw new Error("PINs do not match");
      const staffId = formStaffId.trim() || generateStaffId(formName);
      const existing = staffMembers.find((s: any) => s.staff_id === staffId);
      if (existing) throw new Error(`Staff ID "${staffId}" already exists`);
      const { error } = await supabase.from("staff_members").insert({
        business_id: business!.id,
        name: formName.trim(),
        role: formRole,
        phone: formPhone,
        email: formEmail,
        pin: formPin,
        staff_id: staffId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setShowAdd(false); resetForm();
      toast.success("Staff member added!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingStaff) return;
      const { error } = await supabase.from("staff_members").update({
        name: formName.trim(),
        role: formRole,
        phone: formPhone,
        email: formEmail,
        staff_id: formStaffId.trim() || generateStaffId(formName),
      }).eq("id", editingStaff.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setShowEdit(false); setEditingStaff(null); resetForm();
      toast.success("Staff member updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetPinMutation = useMutation({
    mutationFn: async () => {
      if (newPin.length < 6) throw new Error("PIN must be 6 digits");
      if (newPin !== confirmNewPin) throw new Error("PINs do not match");
      const { error } = await supabase.from("staff_members").update({ pin: newPin }).eq("id", resetPinStaffId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setShowResetPin(false); setResetPinStaffId(null); setNewPin(""); setConfirmNewPin("");
      toast.success("PIN has been reset!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("staff_members").update({
        status: status === "active" ? "inactive" : "active",
        is_online: false,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff member removed");
    },
  });

  const openEdit = (s: any) => {
    setEditingStaff(s);
    setFormName(s.name);
    setFormRole(s.role);
    setFormPhone(s.phone || "");
    setFormEmail(s.email || "");
    setFormStaffId(s.staff_id || "");
    setShowEdit(true);
  };

  const openResetPin = (id: string) => {
    setResetPinStaffId(id);
    setNewPin("");
    setConfirmNewPin("");
    setShowResetPin(true);
  };

  const openDetail = (s: any) => {
    setDetailStaff(s);
    setShowDetail(true);
  };

  const detailPerf = detailStaff ? staffPerfMap[detailStaff.id] : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
            <UserCog className="h-7 w-7 text-primary" /> Staff Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {staffMembers.length} members · {activeCount} active · <span className="text-green-500">{onlineCount} online</span>
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gold-gradient text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Add Staff
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{staffMembers.length}</p>
            <p className="text-xs text-muted-foreground">Total Staff</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{onlineCount}</p>
            <p className="text-xs text-muted-foreground">Online Now</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{staffMembers.length - activeCount}</p>
            <p className="text-xs text-muted-foreground">Inactive</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{Object.keys(roleCountMap).length}</p>
            <p className="text-xs text-muted-foreground">Roles Used</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, ID, or role..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({staffMembers.length})</TabsTrigger>
          <TabsTrigger value="online">Online ({onlineCount})</TabsTrigger>
          <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({staffMembers.length - activeCount})</TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" />Performance</TabsTrigger>
        </TabsList>

        {["all", "online", "active", "inactive"].map(tab => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Staff ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden md:table-cell">Sales</TableHead>
                      <TableHead className="hidden md:table-cell">Revenue</TableHead>
                      <TableHead className="hidden lg:table-cell">Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      let rows = filtered;
                      if (tab === "online") rows = rows.filter((s: any) => s.is_online);
                      if (tab === "active") rows = rows.filter((s: any) => s.status === "active");
                      if (tab === "inactive") rows = rows.filter((s: any) => s.status !== "active");

                      if (rows.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              {isLoading ? "Loading..." : "No staff members found."}
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return rows.map((s: any) => {
                        const perf = staffPerfMap[s.id] || { txCount: 0, revenue: 0 };
                        return (
                          <TableRow key={s.id} className={`${s.status !== "active" ? "opacity-50" : ""} cursor-pointer hover:bg-accent/50`} onClick={() => openDetail(s)}>
                            <TableCell>
                              <Circle className={`h-2.5 w-2.5 fill-current ${s.is_online ? "text-green-500" : "text-muted-foreground/30"}`} />
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{s.staff_id || "—"}</TableCell>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell>
                              <Badge variant={s.role === "Administrator" || s.role === "Manager" ? "default" : "secondary"} className={s.role === "Administrator" ? "bg-primary/20 text-primary border-primary/30" : ""}>
                                {s.role === "Administrator" && <Shield className="h-3 w-3 mr-1" />}
                                {s.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm">{perf.txCount}</TableCell>
                            <TableCell className="hidden md:table-cell text-sm font-medium text-primary">{formatGHS(perf.revenue)}</TableCell>
                            <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                              {s.last_login ? formatDistanceToNow(new Date(s.last_login), { addSuffix: true }) : "Never"}
                            </TableCell>
                            <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} title="Edit">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openResetPin(s.id)} title="Reset PIN">
                                  <Key className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-8 w-8 ${s.status === "active" ? "text-yellow-500" : "text-green-500"}`}
                                  onClick={() => toggleStatus.mutate({ id: s.id, status: s.status })}
                                  title={s.status === "active" ? "Deactivate" : "Activate"}
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(s.id)} title="Delete">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            {roleDistribution.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Role Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={roleDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(45,15%,87%)" />
                      <XAxis dataKey="name" stroke="hsl(215, 15%, 55%)" fontSize={10} angle={-30} textAnchor="end" height={60} />
                      <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Staff Count">
                        {roleDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> Top Performers</CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  const ranked = staffMembers
                    .map((s: any) => ({ ...s, ...(staffPerfMap[s.id] || { txCount: 0, revenue: 0 }) }))
                    .filter((s: any) => s.revenue > 0)
                    .sort((a: any, b: any) => b.revenue - a.revenue)
                    .slice(0, 5);
                  if (ranked.length === 0) return <p className="text-center text-muted-foreground py-8">No sales data yet</p>;
                  return (
                    <div className="space-y-3">
                      {ranked.map((s: any, i: number) => (
                        <div key={s.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                            <div>
                              <p className="text-sm font-medium">{s.name}</p>
                              <p className="text-xs text-muted-foreground">{s.txCount} transactions</p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-primary">{formatGHS(s.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Role Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Role Permissions</CardTitle>
          <CardDescription>Overview of what each role can access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {DEFAULT_ROLES.map(role => (
              <div key={role} className="flex items-start gap-3 py-1.5">
                <Badge variant="outline" className="shrink-0 w-28 justify-center text-xs">{role}</Badge>
                <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role] || "Custom role"}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Staff Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Circle className={`h-3 w-3 fill-current ${detailStaff?.is_online ? "text-green-500" : "text-muted-foreground/30"}`} />
              {detailStaff?.name}
            </DialogTitle>
            <DialogDescription>{detailStaff?.role} · ID: {detailStaff?.staff_id || "—"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{detailPerf?.txCount || 0}</p><p className="text-xs text-muted-foreground">Sales</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-primary">{formatGHS(detailPerf?.revenue || 0)}</p><p className="text-xs text-muted-foreground">Revenue</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{detailPerf && detailPerf.txCount > 0 ? formatGHS(detailPerf.revenue / detailPerf.txCount) : "—"}</p><p className="text-xs text-muted-foreground">Avg Order</p></CardContent></Card>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Phone:</span> {detailStaff?.phone || "—"}</div>
              <div><span className="text-muted-foreground">Email:</span> {detailStaff?.email || "—"}</div>
              <div><span className="text-muted-foreground">Status:</span> <Badge variant={detailStaff?.status === "active" ? "default" : "secondary"}>{detailStaff?.status}</Badge></div>
              <div><span className="text-muted-foreground">Last Login:</span> {detailStaff?.last_login ? formatDistanceToNow(new Date(detailStaff.last_login), { addSuffix: true }) : "Never"}</div>
            </div>
            {detailSales.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2">Recent Sales</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {detailSales.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-secondary/30">
                        <span className="text-muted-foreground text-xs">{new Date(s.created_at).toLocaleDateString()}</span>
                        <Badge variant="outline" className="text-xs">{s.payment_method}</Badge>
                        <span className="font-medium text-primary">{formatGHS(Number(s.total))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Staff Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add Staff Member</DialogTitle>
            <DialogDescription>Create a new user with a Staff ID and 6-digit PIN</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input placeholder="e.g. Kwame Asante" value={formName} onChange={e => {
                setFormName(e.target.value);
                if (!formStaffId) setFormStaffId(generateStaffId(e.target.value));
              }} />
            </div>
            <div className="space-y-2">
              <Label>Staff ID (username)</Label>
              <Input placeholder="e.g. kwame.asante" value={formStaffId} onChange={e => setFormStaffId(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, ""))} />
              <p className="text-xs text-muted-foreground">Used for login identification. Auto-generated from name if left empty.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input placeholder="024XXXXXXX" value={formPhone} onChange={e => setFormPhone(e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="email@company.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__separator_basic" disabled><span className="text-xs font-semibold text-muted-foreground">— Basic Roles —</span></SelectItem>
                  {DEFAULT_ROLES.map(r => (
                    <SelectItem key={r} value={r}>
                      <span className="flex items-center gap-2">
                        {r === "Administrator" && <Shield className="h-3 w-3" />}
                        {r}
                      </span>
                    </SelectItem>
                  ))}
                  <SelectItem value="__separator_enterprise" disabled><span className="text-xs font-semibold text-muted-foreground">— Enterprise Roles —</span></SelectItem>
                  {EXTENDED_ROLES.filter(r => !DEFAULT_ROLES.includes(r)).map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <p className="text-sm font-medium">Set Login PIN</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>6-digit PIN *</Label>
                <div className="relative">
                  <Input
                    type={showPin ? "text" : "password"}
                    placeholder="••••••"
                    maxLength={6}
                    value={formPin}
                    onChange={e => setFormPin(e.target.value.replace(/\D/g, ""))}
                  />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPin(!showPin)}>
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirm PIN *</Label>
                <Input type="password" placeholder="••••••" maxLength={6} value={formConfirmPin} onChange={e => setFormConfirmPin(e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => addMutation.mutate()} disabled={!formName.trim() || formPin.length < 6 || addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Staff Member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Staff Member</DialogTitle>
            <DialogDescription>Update staff details. Use "Reset PIN" to change their password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Staff ID</Label>
              <Input value={formStaffId} onChange={e => setFormStaffId(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, ""))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input value={formPhone} onChange={e => setFormPhone(e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__separator_basic2" disabled><span className="text-xs font-semibold text-muted-foreground">— Basic Roles —</span></SelectItem>
                  {DEFAULT_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  <SelectItem value="__separator_enterprise2" disabled><span className="text-xs font-semibold text-muted-foreground">— Enterprise Roles —</span></SelectItem>
                  {EXTENDED_ROLES.filter(r => !DEFAULT_ROLES.includes(r)).map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => editMutation.mutate()} disabled={!formName.trim() || editMutation.isPending}>
              {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset PIN Dialog */}
      <Dialog open={showResetPin} onOpenChange={setShowResetPin}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><Key className="h-5 w-5 text-primary" /> Reset Staff PIN</DialogTitle>
            <DialogDescription>Set a new 6-digit login PIN for this staff member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New PIN (6 digits)</Label>
              <Input type="password" placeholder="••••••" maxLength={6} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Confirm New PIN</Label>
              <Input type="password" placeholder="••••••" maxLength={6} value={confirmNewPin} onChange={e => setConfirmNewPin(e.target.value.replace(/\D/g, ""))} />
            </div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => resetPinMutation.mutate()} disabled={newPin.length < 6 || resetPinMutation.isPending}>
              {resetPinMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset PIN"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
