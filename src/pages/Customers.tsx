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
import { Textarea } from "@/components/ui/textarea";
import { formatGHS, GHANA_REGIONS } from "@/lib/ghana";
import { Search, Plus, Eye, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Customers() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRegion, setFormRegion] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const filtered = customers.filter((c: any) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || "").includes(search));

  const resetForm = () => { setFormName(""); setFormPhone(""); setFormEmail(""); setFormRegion(""); setFormNotes(""); };

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").insert({
        business_id: business!.id,
        name: formName.trim(),
        phone: formPhone,
        email: formEmail,
        region: formRegion,
        notes: formNotes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setShowAdd(false);
      resetForm();
      toast.success("Customer added!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deleted");
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">{customers.length} customers</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gold-gradient text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Add Customer
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or phone..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">Region</TableHead>
                <TableHead className="text-center hidden md:table-cell">Points</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{isLoading ? "Loading..." : "No customers yet."}</TableCell></TableRow>
              ) : filtered.map((customer: any) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{customer.phone || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{customer.region ? <Badge variant="secondary">{customer.region}</Badge> : "—"}</TableCell>
                  <TableCell className="text-center hidden md:table-cell">
                    <Badge variant="secondary" className="text-primary">{customer.loyalty_points}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(customer.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add Customer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Full Name *</Label><Input placeholder="e.g. Kwame Asante" value={formName} onChange={e => setFormName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input placeholder="024XXXXXXX" value={formPhone} onChange={e => setFormPhone(e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="email@example.com" value={formEmail} onChange={e => setFormEmail(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={formRegion} onValueChange={setFormRegion}>
                <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent>{GHANA_REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea placeholder="Additional notes..." value={formNotes} onChange={e => setFormNotes(e.target.value)} /></div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => addMutation.mutate()} disabled={!formName.trim() || addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Customer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
