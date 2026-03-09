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
import { Search, Plus, Trash2, Loader2, Pencil, Shield, Eye, EyeOff, UserCog, Users, Circle, RefreshCw, Key } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const DEFAULT_ROLES = ["Administrator", "Manager", "Supervisor", "Cashier", "Sales Rep", "Warehouse", "Accountant", "Staff"];

// Extended roles from SAP-style role templates
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
    refetchInterval: 30000, // Refresh every 30s for online status
  });

  const filtered = staffMembers.filter((s: any) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.staff_id && s.staff_id.toLowerCase().includes(search.toLowerCase())) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = staffMembers.filter((s: any) => s.is_online).length;
  const activeCount = staffMembers.filter((s: any) => s.status === "active").length;

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
      // Check uniqueness
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                      <TableHead className="hidden md:table-cell">Phone</TableHead>
                      <TableHead className="hidden md:table-cell">Last Login</TableHead>
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
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              {isLoading ? "Loading..." : "No staff members found."}
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return rows.map((s: any) => (
                        <TableRow key={s.id} className={s.status !== "active" ? "opacity-50" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Circle className={`h-2.5 w-2.5 fill-current ${s.is_online ? "text-green-500" : "text-muted-foreground/30"}`} />
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{s.staff_id || "—"}</TableCell>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>
                            <Badge variant={s.role === "Administrator" || s.role === "Manager" ? "default" : "secondary"} className={s.role === "Administrator" ? "bg-primary/20 text-primary border-primary/30" : ""}>
                              {s.role === "Administrator" && <Shield className="h-3 w-3 mr-1" />}
                              {s.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{s.phone || "—"}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                            {s.last_login ? formatDistanceToNow(new Date(s.last_login), { addSuffix: true }) : "Never"}
                          </TableCell>
                          <TableCell className="text-right">
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
                      ));
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
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
