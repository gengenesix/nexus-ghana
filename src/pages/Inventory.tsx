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
import { formatGHS } from "@/lib/ghana";
import { Search, Plus, Edit, Trash2, AlertTriangle, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 25;

export default function Inventory() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const { page, from, to, nextPage, prevPage, resetPage } = usePagination(PAGE_SIZE);
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formCostPrice, setFormCostPrice] = useState("");
  const [formSellingPrice, setFormSellingPrice] = useState("");
  const [formQty, setFormQty] = useState("");
  const [formReorderLevel, setFormReorderLevel] = useState("10");

  const { data, isLoading } = useQuery({
    queryKey: ["products", business?.id, debouncedSearch, page],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*", { count: "exact" })
        .eq("business_id", business!.id)
        .order("name")
        .range(from, to);

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { products: data ?? [], total: count ?? 0 };
    },
    enabled: !!business,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const products = data?.products ?? [];
  const totalCount = data?.total ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const lowStockCount = products.filter((p: any) => p.qty <= p.reorder_level).length;

  const resetForm = () => {
    setFormName(""); setFormSku(""); setFormCostPrice(""); setFormSellingPrice(""); setFormQty(""); setFormReorderLevel("10");
    setEditingProduct(null);
  };

  const openEdit = (p: any) => {
    setFormName(p.name); setFormSku(p.sku || ""); setFormCostPrice(String(p.cost_price));
    setFormSellingPrice(String(p.selling_price)); setFormQty(String(p.qty)); setFormReorderLevel(String(p.reorder_level));
    setEditingProduct(p);
    setShowAdd(true);
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: business!.id,
        name: formName.trim(),
        sku: formSku.trim(),
        cost_price: Number(formCostPrice) || 0,
        selling_price: Number(formSellingPrice) || 0,
        qty: Number(formQty) || 0,
        reorder_level: Number(formReorderLevel) || 10,
      };
      if (editingProduct) {
        const { error } = await supabase.from("products").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowAdd(false);
      resetForm();
      toast.success(editingProduct ? "Product updated!" : "Product added!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSearch = (val: string) => {
    setSearch(val);
    resetPage();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">{totalCount} products · {lowStockCount} low stock</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} className="gold-gradient text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Add Product
        </Button>
      </div>

      {lowStockCount > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm font-medium">{lowStockCount} product(s) need reordering</p>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search products or SKU..." className="pl-10" value={search} onChange={e => handleSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="hidden sm:table-cell">SKU</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Cost</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="hidden md:table-cell text-right">Margin</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No products found.</TableCell></TableRow>
              ) : products.map((product: any) => {
                const margin = Number(product.selling_price) > 0
                  ? ((Number(product.selling_price) - Number(product.cost_price)) / Number(product.selling_price) * 100).toFixed(0)
                  : "0";
                const isLow = product.qty <= product.reorder_level;
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{product.sku || "—"}</TableCell>
                    <TableCell className="text-center"><Badge variant={isLow ? "destructive" : "secondary"}>{product.qty}</Badge></TableCell>
                    <TableCell className="hidden sm:table-cell text-right">{formatGHS(Number(product.cost_price))}</TableCell>
                    <TableCell className="text-right font-medium">{formatGHS(Number(product.selling_price))}</TableCell>
                    <TableCell className="hidden md:table-cell text-right text-success">{margin}%</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(product)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(product.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page + 1} of {totalPages} ({totalCount} total)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevPage} disabled={page === 0}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextPage} disabled={page >= totalPages - 1}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={(v) => { setShowAdd(v); if (!v) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Product Name</Label><Input placeholder="e.g. Milo 400g" value={formName} onChange={e => setFormName(e.target.value)} /></div>
              <div className="space-y-2"><Label>SKU</Label><Input placeholder="e.g. MIL-001" value={formSku} onChange={e => setFormSku(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Cost Price (GHS)</Label><Input type="number" placeholder="0.00" value={formCostPrice} onChange={e => setFormCostPrice(e.target.value)} /></div>
              <div className="space-y-2"><Label>Selling Price (GHS)</Label><Input type="number" placeholder="0.00" value={formSellingPrice} onChange={e => setFormSellingPrice(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Quantity</Label><Input type="number" placeholder="0" value={formQty} onChange={e => setFormQty(e.target.value)} /></div>
              <div className="space-y-2"><Label>Reorder Level</Label><Input type="number" placeholder="10" value={formReorderLevel} onChange={e => setFormReorderLevel(e.target.value)} /></div>
            </div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => addMutation.mutate()} disabled={!formName.trim() || addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingProduct ? "Update Product" : "Add Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
