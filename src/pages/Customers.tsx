import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GHANA_REGIONS } from "@/lib/ghana";
import { exportCustomersCsv } from "@/lib/export";
import CsvImportDialog from "@/components/CsvImportDialog";
import { Search, Plus, Loader2, Trash2, ChevronLeft, ChevronRight, Download, Upload } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 25;

export default function Customers() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const { page, from, to, nextPage, prevPage, resetPage } = usePagination(PAGE_SIZE);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRegion, setFormRegion] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["customers", business?.id, debouncedSearch, page],
    queryFn: async () => {
      let query = supabase
        .from("customers")
        .select("*", { count: "exact" })
        .eq("business_id", business!.id)
        .order("name")
        .range(from, to);

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { customers: data ?? [], total: count ?? 0 };
    },
    enabled: !!business,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const customers = data?.customers ?? [];
  const totalCount = data?.total ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const resetForm = () => {
    setFormName(""); setFormPhone(""); setFormEmail(""); setFormRegion(""); setFormNotes("");
  };

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

  const handleSearch = (val: string) => {
    setSearch(val);
    resetPage();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">{totalCount} customers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}><Upload className="h-4 w-4 mr-1" /> Import</Button>
          <Button variant="outline" onClick={() => { if (customers.length > 0) exportCustomersCsv(customers); else toast.error("No customers to export"); }}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gold-gradient text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> Add Customer
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or phone..." className="pl-10" value={search} onChange={e => handleSearch(e.target.value)} />
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
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : customers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No customers found.</TableCell></TableRow>
              ) : customers.map((customer: any) => (
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page + 1} of {totalPages} ({totalCount} total)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevPage} disabled={page === 0}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextPage} disabled={page >= totalPages - 1}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

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

      <CsvImportDialog open={showImport} onOpenChange={setShowImport} type="customers" />
    </div>
  );
}
