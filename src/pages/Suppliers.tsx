import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Plus, Trash2, Loader2, Download, Upload, Edit2, Eye, Package, FileText, Phone, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import { exportSuppliersCsv } from "@/lib/export";
import { formatGHS } from "@/lib/ghana";
import CsvImportDialog from "@/components/CsvImportDialog";

import { format } from "date-fns";

export default function Suppliers() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
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

  // Fetch purchase orders for detail view
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["purchase_orders", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("purchase_orders").select("*").eq("business_id", business!.id).order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const filtered = suppliers.filter((s: any) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_person || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.location || "").toLowerCase().includes(search.toLowerCase())
  );

  const { page, totalPages, paginatedData, setPage, nextPage, prevPage } = usePagination(filtered, 20);

  // Supplier metrics
  const supplierMetrics = useMemo(() => {
    const metrics: Record<string, { orderCount: number; totalValue: number; lastOrder: string | null }> = {};
    suppliers.forEach((s: any) => { metrics[s.id] = { orderCount: 0, totalValue: 0, lastOrder: null }; });
    purchaseOrders.forEach((po: any) => {
      if (po.supplier_id && metrics[po.supplier_id]) {
        metrics[po.supplier_id].orderCount++;
        metrics[po.supplier_id].totalValue += Number(po.total);
        if (!metrics[po.supplier_id].lastOrder || po.date > metrics[po.supplier_id].lastOrder!) {
          metrics[po.supplier_id].lastOrder = po.date;
        }
      }
    });
    return metrics;
  }, [suppliers, purchaseOrders]);

  const totalSupplierSpend = purchaseOrders.reduce((s: number, po: any) => s + Number(po.total), 0);

  const resetForm = () => { setFormName(""); setFormContact(""); setFormPhone(""); setFormLocation(""); setFormProducts(""); setEditingSupplier(null); };

  const openEdit = (supplier: any) => {
    setEditingSupplier(supplier);
    setFormName(supplier.name);
    setFormContact(supplier.contact_person || "");
    setFormPhone(supplier.phone || "");
    setFormLocation(supplier.location || "");
    setFormProducts(supplier.products_supplied || "");
    setShowAdd(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: business!.id,
        name: formName.trim(),
        contact_person: formContact,
        phone: formPhone,
        location: formLocation,
        products_supplied: formProducts,
      };
      if (editingSupplier) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editingSupplier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setShowAdd(false); resetForm();
      toast.success(editingSupplier ? "Supplier updated!" : "Supplier added!");
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

  // Selected supplier PO history
  const selectedPOs = useMemo(() => {
    if (!selectedSupplier) return [];
    return purchaseOrders.filter((po: any) => po.supplier_id === selectedSupplier.id);
  }, [selectedSupplier, purchaseOrders]);

  const selectedMetrics = selectedSupplier ? supplierMetrics[selectedSupplier.id] : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Suppliers</h1>
          <p className="text-muted-foreground text-sm">{suppliers.length} suppliers · {formatGHS(totalSupplierSpend)} total PO value</p>
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
        <Input placeholder="Search suppliers by name, contact, or location..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead className="hidden sm:table-cell">Contact</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead className="hidden lg:table-cell">PO Count</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Total Value</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{isLoading ? "Loading..." : "No suppliers yet."}</TableCell></TableRow>
              ) : paginatedData.map((supplier: any) => {
                const m = supplierMetrics[supplier.id];
                return (
                  <TableRow key={supplier.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedSupplier(supplier)}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{supplier.name}</p>
                        {supplier.products_supplied && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{supplier.products_supplied}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {supplier.contact_person && <span>{supplier.contact_person}</span>}
                      {supplier.phone && <span className="block text-xs">{supplier.phone}</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{supplier.location || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {m?.orderCount ? <Badge variant="secondary">{m.orderCount}</Badge> : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right font-medium">{m?.totalValue ? formatGHS(m.totalValue) : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedSupplier(supplier)}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(supplier)}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(supplier.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={prevPage} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={nextPage} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}

      {/* Supplier Detail Dialog */}
      <Dialog open={!!selectedSupplier} onOpenChange={(open) => { if (!open) setSelectedSupplier(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedSupplier && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">{selectedSupplier.name}</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">PO Count</p>
                  <p className="text-lg font-bold">{selectedMetrics?.orderCount || 0}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Value</p>
                  <p className="text-lg font-bold">{formatGHS(selectedMetrics?.totalValue || 0)}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Avg PO</p>
                  <p className="text-lg font-bold">{selectedMetrics?.orderCount ? formatGHS((selectedMetrics.totalValue) / selectedMetrics.orderCount) : "—"}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Last Order</p>
                  <p className="text-sm font-bold">{selectedMetrics?.lastOrder || "None"}</p>
                </CardContent></Card>
              </div>

              {/* Contact info */}
              <Card>
                <CardContent className="p-4 space-y-2">
                  {selectedSupplier.contact_person && (
                    <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-muted-foreground" />{selectedSupplier.contact_person}</div>
                  )}
                  {selectedSupplier.phone && (
                    <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" />{selectedSupplier.phone}</div>
                  )}
                  {selectedSupplier.location && (
                    <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" />{selectedSupplier.location}</div>
                  )}
                  {selectedSupplier.products_supplied && (
                    <div className="flex items-center gap-2 text-sm"><Package className="h-4 w-4 text-muted-foreground" />{selectedSupplier.products_supplied}</div>
                  )}
                </CardContent>
              </Card>

              {/* Purchase Order History */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> Purchase Order History</h3>
                {selectedPOs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No purchase orders for this supplier.</p>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>PO #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedPOs.slice(0, 10).map((po: any) => (
                            <TableRow key={po.id}>
                              <TableCell className="font-medium">{po.po_number}</TableCell>
                              <TableCell className="text-muted-foreground">{po.date}</TableCell>
                              <TableCell>
                                <Badge variant={po.status === "received" ? "default" : po.status === "approved" ? "secondary" : "outline"}>
                                  {po.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">{formatGHS(Number(po.total))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => openEdit(selectedSupplier)}>
                  <Edit2 className="h-4 w-4 mr-1" /> Edit
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editingSupplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Company Name *</Label><Input placeholder="e.g. ABC Trading Ltd" value={formName} onChange={e => setFormName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Contact Person</Label><Input placeholder="Mr./Mrs. ..." value={formContact} onChange={e => setFormContact(e.target.value)} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input placeholder="0XXXXXXXXX" value={formPhone} onChange={e => setFormPhone(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Location</Label><Input placeholder="e.g. Tema, Accra" value={formLocation} onChange={e => setFormLocation(e.target.value)} /></div>
            <div className="space-y-2"><Label>Products Supplied</Label><Textarea placeholder="e.g. Noodles, Rice, Cooking Oil" value={formProducts} onChange={e => setFormProducts(e.target.value)} /></div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => saveMutation.mutate()} disabled={!formName.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingSupplier ? "Update Supplier" : "Add Supplier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CsvImportDialog open={showImport} onOpenChange={setShowImport} type="suppliers" />
    </div>
  );
}
