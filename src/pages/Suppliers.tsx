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
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Trash2, Loader2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { exportSuppliersCsv } from "@/lib/export";
import CsvImportDialog from "@/components/CsvImportDialog";

export default function Suppliers() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formName, setFormName] = useState("");
  const [formContact, setFormContact] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formProducts, setFormProducts] = useState("");

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const filtered = suppliers.filter((s: any) => s.name.toLowerCase().includes(search.toLowerCase()));

  const resetForm = () => { setFormName(""); setFormContact(""); setFormPhone(""); setFormLocation(""); setFormProducts(""); };

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("suppliers").insert({
        business_id: business!.id,
        name: formName.trim(),
        contact_person: formContact,
        phone: formPhone,
        location: formLocation,
        products_supplied: formProducts,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setShowAdd(false); resetForm();
      toast.success("Supplier added!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier deleted");
    },
  });

  const handleImport = async (rows: Record<string, string>[]) => {
    const records = rows.map(r => ({
      business_id: business!.id,
      name: r["Name"] || r["name"] || "",
      contact_person: r["Contact Person"] || r["contact_person"] || "",
      phone: r["Phone"] || r["phone"] || "",
      location: r["Location"] || r["location"] || "",
      products_supplied: r["Products"] || r["products_supplied"] || "",
    })).filter(r => r.name);

    for (let i = 0; i < records.length; i += 50) {
      const chunk = records.slice(i, i + 50);
      const { error } = await supabase.from("suppliers").insert(chunk);
      if (error) throw error;
    }
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Suppliers</h1>
          <p className="text-muted-foreground text-sm">{suppliers.length} suppliers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => { exportSuppliersCsv(suppliers); toast.success("Exported!"); }}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gold-gradient text-primary-foreground" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Supplier
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search suppliers..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead className="hidden sm:table-cell">Contact</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead className="hidden lg:table-cell">Products</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{isLoading ? "Loading..." : "No suppliers yet."}</TableCell></TableRow>
              ) : filtered.map((supplier: any) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{supplier.contact_person} · {supplier.phone}</TableCell>
                  <TableCell className="hidden md:table-cell">{supplier.location || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{supplier.products_supplied || "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(supplier.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add Supplier</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Company Name *</Label><Input placeholder="e.g. ABC Trading Ltd" value={formName} onChange={e => setFormName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Contact Person</Label><Input placeholder="Mr./Mrs. ..." value={formContact} onChange={e => setFormContact(e.target.value)} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input placeholder="0XXXXXXXXX" value={formPhone} onChange={e => setFormPhone(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Location</Label><Input placeholder="e.g. Tema, Accra" value={formLocation} onChange={e => setFormLocation(e.target.value)} /></div>
            <div className="space-y-2"><Label>Products Supplied</Label><Textarea placeholder="e.g. Noodles, Rice, Cooking Oil" value={formProducts} onChange={e => setFormProducts(e.target.value)} /></div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => addMutation.mutate()} disabled={!formName.trim() || addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Supplier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CsvImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        type="suppliers"
        onImport={handleImport}
      />
    </div>
  );
}
