import { useState, useMemo } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatGHS } from "@/lib/ghana";
import { exportInventoryCsv } from "@/lib/export";
import CsvImportDialog from "@/components/CsvImportDialog";
import SerialBatchTab from "@/components/inventory/SerialBatchTab";
import { Search, Plus, Edit, Trash2, AlertTriangle, Loader2, ChevronLeft, ChevronRight, Download, Upload, PackagePlus, PackageMinus } from "lucide-react";
import { TableSkeleton } from "@/components/TableSkeleton";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const PAGE_SIZE = 25;

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  sku: z.string().default(""),
  barcode: z.string().default(""),
  cost_price: z.coerce.number().min(0, "Must be 0 or more"),
  selling_price: z.coerce.number().min(0.01, "Selling price must be greater than 0"),
  qty: z.coerce.number().int().min(0, "Must be 0 or more"),
  reorder_level: z.coerce.number().int().min(0, "Must be 0 or more"),
});
type ProductForm = z.infer<typeof productSchema>;

export default function Inventory() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const { page, from, to, nextPage, prevPage, resetPage } = usePagination(PAGE_SIZE);
  const [showAdd, setShowAdd] = useState(false);
  const [inventoryTab, setInventoryTab] = useState("products");
  const [showImport, setShowImport] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "remove">("add");
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  const productForm = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", sku: "", barcode: "", cost_price: 0, selling_price: 0, qty: 0, reorder_level: 10 },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["products", business?.id, debouncedSearch, page, categoryFilter, stockFilter],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*, categories(name)", { count: "exact" })
        .eq("business_id", business!.id)
        .order("name")
        .range(from, to);

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%`);
      }
      if (categoryFilter !== "all") {
        query = query.eq("category_id", categoryFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      let filtered = data ?? [];
      if (stockFilter === "low") {
        filtered = filtered.filter((p: any) => p.qty <= p.reorder_level);
      } else if (stockFilter === "out") {
        filtered = filtered.filter((p: any) => p.qty === 0);
      }

      return { products: filtered, total: count ?? 0 };
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
    productForm.reset({ name: "", sku: "", cost_price: 0, selling_price: 0, qty: 0, reorder_level: 10 });
    setEditingProduct(null);
  };

  const openEdit = (p: any) => {
    productForm.reset({
      name: p.name, sku: p.sku || "", barcode: p.barcode || "", cost_price: Number(p.cost_price),
      selling_price: Number(p.selling_price), qty: Number(p.qty), reorder_level: Number(p.reorder_level),
    });
    setEditingProduct(p);
    setShowAdd(true);
  };

  const openAdjust = (p: any, type: "add" | "remove") => {
    setAdjustProduct(p);
    setAdjustType(type);
    setAdjustQty("");
    setShowAdjust(true);
  };

  const addMutation = useMutation({
    mutationFn: async (values: ProductForm) => {
      const payload = {
        business_id: business!.id,
        name: values.name,
        sku: values.sku,
        barcode: values.barcode || null,
        cost_price: values.cost_price,
        selling_price: values.selling_price,
        qty: values.qty,
        reorder_level: values.reorder_level,
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

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const qty = Number(adjustQty) || 0;
      if (qty <= 0) throw new Error("Quantity must be positive");
      const newQty = adjustType === "add"
        ? adjustProduct.qty + qty
        : Math.max(0, adjustProduct.qty - qty);
      const { error } = await supabase.from("products").update({ qty: newQty, updated_at: new Date().toISOString() }).eq("id", adjustProduct.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowAdjust(false);
      toast.success(`Stock ${adjustType === "add" ? "added" : "removed"} successfully`);
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}><Upload className="h-4 w-4 mr-1" /> Import</Button>
          <Button variant="outline" size="sm" onClick={() => { if (products.length > 0) exportInventoryCsv(products); else toast.error("No products to export"); }}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1" /> Add Product
          </Button>
        </div>
      </div>

      <Tabs value={inventoryTab} onValueChange={setInventoryTab}>
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="serials">Serial / Batch</TabsTrigger>
        </TabsList>

        <TabsContent value="serials">
          <SerialBatchTab />
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
      {lowStockCount > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm font-medium">{lowStockCount} product(s) need reordering</p>
          </CardContent>
        </Card>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products or SKU..." className="pl-10" value={search} onChange={e => handleSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); resetPage(); }}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={(v) => { setStockFilter(v); resetPage(); }}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="hidden sm:table-cell">SKU</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Cost</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="hidden md:table-cell text-right">Margin</TableHead>
                <TableHead className="w-10 sm:w-[130px]"></TableHead>
              </TableRow>
            </TableHeader>
            {isLoading ? (
              <TableSkeleton rows={8} cols={7} />
            ) : (
            <TableBody>
              {products.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No products found.</TableCell></TableRow>
              ) : products.map((product: any) => {
                const margin = Number(product.selling_price) > 0
                  ? ((Number(product.selling_price) - Number(product.cost_price)) / Number(product.selling_price) * 100).toFixed(0)
                  : "0";
                const isLow = product.qty <= product.reorder_level;
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.categories?.name && <p className="text-xs text-muted-foreground">{product.categories.name}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{product.sku || "—"}</TableCell>
                    <TableCell className="text-center"><Badge variant={isLow ? "destructive" : "secondary"}>{product.qty}</Badge></TableCell>
                    <TableCell className="hidden sm:table-cell text-right">{formatGHS(Number(product.cost_price))}</TableCell>
                    <TableCell className="text-right font-medium">{formatGHS(Number(product.selling_price))}</TableCell>
                    <TableCell className="hidden md:table-cell text-right text-success">{margin}%</TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAdjust(product, "add")} title="Add stock"><PackagePlus className="h-3.5 w-3.5 text-green-500" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAdjust(product, "remove")} title="Remove stock"><PackageMinus className="h-3.5 w-3.5 text-orange-500" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(product)} title="Edit"><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(product.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            )}
          </Table>
          </div>
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

      {/* Add/Edit Product Dialog */}
      <Dialog open={showAdd} onOpenChange={(v) => { setShowAdd(v); if (!v) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Product Name *</Label>
                <Input placeholder="e.g. Milo 400g" {...productForm.register("name")} />
                {productForm.formState.errors.name && <p className="text-xs text-destructive">{productForm.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>SKU</Label>
                <Input placeholder="e.g. MIL-001" {...productForm.register("sku")} />
              </div>
              <div className="space-y-1">
                <Label>Barcode</Label>
                <Input placeholder="e.g. 6001234567890" {...productForm.register("barcode")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Cost Price (GHS)</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...productForm.register("cost_price")} />
                {productForm.formState.errors.cost_price && <p className="text-xs text-destructive">{productForm.formState.errors.cost_price.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Selling Price (GHS) *</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...productForm.register("selling_price")} />
                {productForm.formState.errors.selling_price && <p className="text-xs text-destructive">{productForm.formState.errors.selling_price.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Quantity</Label>
                <Input type="number" placeholder="0" {...productForm.register("qty")} />
                {productForm.formState.errors.qty && <p className="text-xs text-destructive">{productForm.formState.errors.qty.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Reorder Level</Label>
                <Input type="number" placeholder="10" {...productForm.register("reorder_level")} />
                {productForm.formState.errors.reorder_level && <p className="text-xs text-destructive">{productForm.formState.errors.reorder_level.message}</p>}
              </div>
            </div>
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={productForm.handleSubmit((values) => addMutation.mutate(values))}
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingProduct ? "Update Product" : "Add Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {adjustType === "add" ? <PackagePlus className="h-5 w-5 text-green-500" /> : <PackageMinus className="h-5 w-5 text-orange-500" />}
              {adjustType === "add" ? "Add Stock" : "Remove Stock"}
            </DialogTitle>
          </DialogHeader>
          {adjustProduct && (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="font-medium">{adjustProduct.name}</p>
                <p className="text-sm text-muted-foreground">Current stock: <span className="font-semibold">{adjustProduct.qty}</span></p>
              </div>
              <div className="space-y-2">
                <Label>Quantity to {adjustType}</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Enter quantity"
                  value={adjustQty}
                  onChange={e => setAdjustQty(e.target.value)}
                  autoFocus
                />
                {adjustQty && Number(adjustQty) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    New stock: <span className="font-semibold">{adjustType === "add" ? adjustProduct.qty + Number(adjustQty) : Math.max(0, adjustProduct.qty - Number(adjustQty))}</span>
                  </p>
                )}
              </div>
              <Button
                className="w-full"
                variant={adjustType === "add" ? "default" : "destructive"}
                onClick={() => adjustMutation.mutate()}
                disabled={!adjustQty || Number(adjustQty) <= 0 || adjustMutation.isPending}
              >
                {adjustMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `${adjustType === "add" ? "Add" : "Remove"} ${adjustQty || 0} units`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CsvImportDialog open={showImport} onOpenChange={setShowImport} type="products" />
      </TabsContent>
      </Tabs>
    </div>
  );
}
