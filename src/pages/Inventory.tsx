import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatGHS } from "@/lib/ghana";
import { Search, Plus, Package, Edit, Trash2, AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  qty: number;
  reorderLevel: number;
  costPrice: number;
  sellingPrice: number;
}

const initialProducts: Product[] = [
  { id: 1, name: "Indomie Noodles (Carton)", sku: "IND-001", category: "Food", qty: 48, reorderLevel: 20, costPrice: 8, sellingPrice: 12 },
  { id: 2, name: "Frytol Cooking Oil 5L", sku: "FRY-001", category: "Food", qty: 15, reorderLevel: 10, costPrice: 30, sellingPrice: 40 },
  { id: 3, name: "Peak Milk (Tin)", sku: "PEK-001", category: "Dairy", qty: 3, reorderLevel: 15, costPrice: 5, sellingPrice: 7 },
  { id: 4, name: "Sugar 1kg", sku: "SUG-001", category: "Food", qty: 40, reorderLevel: 25, costPrice: 7, sellingPrice: 9 },
  { id: 5, name: "Milo 400g", sku: "MIL-001", category: "Beverages", qty: 28, reorderLevel: 15, costPrice: 15, sellingPrice: 20 },
  { id: 6, name: "Rice 5kg (Aroma)", sku: "RIC-001", category: "Food", qty: 8, reorderLevel: 10, costPrice: 35, sellingPrice: 45 },
];

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));
  const lowStock = products.filter(p => p.qty <= p.reorderLevel);

  const deleteProduct = (id: number) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    toast.success("Product deleted");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">{products.length} products · {lowStock.length} low stock</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gold-gradient text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Add Product
        </Button>
      </div>

      {lowStock.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <div>
              <p className="text-sm font-medium">Low Stock Alert</p>
              <p className="text-xs text-muted-foreground">
                {lowStock.map(p => p.name).join(", ")} — need reordering
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search products or SKU..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="hidden sm:table-cell">SKU</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Cost</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="hidden md:table-cell text-right">Margin</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(product => {
                const margin = ((product.sellingPrice - product.costPrice) / product.sellingPrice * 100).toFixed(0);
                const isLow = product.qty <= product.reorderLevel;
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{product.sku}</TableCell>
                    <TableCell className="hidden md:table-cell"><Badge variant="secondary">{product.category}</Badge></TableCell>
                    <TableCell className="text-center">
                      <Badge variant={isLow ? "destructive" : "secondary"}>{product.qty}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right">{formatGHS(product.costPrice)}</TableCell>
                    <TableCell className="text-right font-medium">{formatGHS(product.sellingPrice)}</TableCell>
                    <TableCell className="hidden md:table-cell text-right text-success">{margin}%</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProduct(product.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Add New Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Product Name</Label><Input placeholder="e.g. Milo 400g" /></div>
              <div className="space-y-2"><Label>SKU</Label><Input placeholder="e.g. MIL-001" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Cost Price (GHS)</Label><Input type="number" placeholder="0.00" /></div>
              <div className="space-y-2"><Label>Selling Price (GHS)</Label><Input type="number" placeholder="0.00" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Quantity</Label><Input type="number" placeholder="0" /></div>
              <div className="space-y-2"><Label>Reorder Level</Label><Input type="number" placeholder="10" /></div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {["Food", "Beverages", "Dairy", "Household", "Electronics", "Other"].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => { setShowAdd(false); toast.success("Product added!"); }}>
              Add Product
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
