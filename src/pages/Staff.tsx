import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatGHS } from "@/lib/ghana";
import { Search, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Staff() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("Staff");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPin, setFormPin] = useState("");

  const { data: staffMembers = [], isLoading } = useQuery({
    queryKey: ["staff", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_members").select("*").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const filtered = staffMembers.filter((s: any) => s.name.toLowerCase().includes(search.toLowerCase()));

  const resetForm = () => { setFormName(""); setFormRole("Staff"); setFormPhone(""); setFormEmail(""); setFormPin(""); };

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff_members").insert({
        business_id: business!.id,
        name: formName.trim(),
        role: formRole,
        phone: formPhone,
        email: formEmail,
        pin: formPin,
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

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("staff_members").update({ status: status === "active" ? "off" : "active" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Staff Management</h1>
          <p className="text-muted-foreground text-sm">{staffMembers.length} staff members · {staffMembers.filter((s: any) => s.status === "active").length} active</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gold-gradient text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Add Staff
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search staff..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{isLoading ? "Loading..." : "No staff members yet."}</TableCell></TableRow>
              ) : filtered.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><Badge variant="secondary">{s.role}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{s.phone || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={`cursor-pointer ${s.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                      onClick={() => toggleStatus.mutate({ id: s.id, status: s.status })}
                    >
                      {s.status === "active" ? "Active" : "Off"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add Staff Member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Full Name *</Label><Input placeholder="e.g. Kwame Asante" value={formName} onChange={e => setFormName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input placeholder="024XXXXXXX" value={formPhone} onChange={e => setFormPhone(e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="email@nexus.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Manager", "Cashier", "Staff"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>POS PIN</Label><Input type="password" placeholder="4-digit PIN" maxLength={4} value={formPin} onChange={e => setFormPin(e.target.value)} /></div>
            </div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => addMutation.mutate()} disabled={!formName.trim() || addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Staff"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
