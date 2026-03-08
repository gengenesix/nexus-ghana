import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Truck, Edit, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

interface Supplier {
  id: number;
  name: string;
  contact: string;
  phone: string;
  location: string;
  productsSupplied: string;
  activePOs: number;
}

const initialSuppliers: Supplier[] = [
  { id: 1, name: "De-Heer Foods Ltd", contact: "Mr. Mensah", phone: "0301234567", location: "Tema", productsSupplied: "Noodles, Seasonings", activePOs: 2 },
  { id: 2, name: "Fan Milk Ghana", contact: "Mrs. Owusu", phone: "0302345678", location: "Accra", productsSupplied: "Dairy, Ice Cream", activePOs: 1 },
  { id: 3, name: "Kasapreko Company", contact: "Mr. Adjei", phone: "0303456789", location: "Accra", productsSupplied: "Beverages, Water", activePOs: 0 },
  { id: 4, name: "Unilever Ghana", contact: "Ms. Agyeman", phone: "0304567890", location: "Tema", productsSupplied: "Detergents, Personal Care", activePOs: 1 },
];

export default function Suppliers() {
  const [suppliers] = useState<Supplier[]>(initialSuppliers);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Suppliers</h1>
          <p className="text-muted-foreground text-sm">{suppliers.length} suppliers</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gold-gradient text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Add Supplier
        </Button>
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
                <TableHead className="text-center">Active POs</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(supplier => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{supplier.contact} · {supplier.phone}</TableCell>
                  <TableCell className="hidden md:table-cell">{supplier.location}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{supplier.productsSupplied}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={supplier.activePOs > 0 ? "default" : "secondary"}>{supplier.activePOs}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-3.5 w-3.5" /></Button>
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
            <div className="space-y-2"><Label>Company Name</Label><Input placeholder="e.g. ABC Trading Ltd" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Contact Person</Label><Input placeholder="Mr./Mrs. ..." /></div>
              <div className="space-y-2"><Label>Phone</Label><Input placeholder="0XXXXXXXXX" /></div>
            </div>
            <div className="space-y-2"><Label>Location</Label><Input placeholder="e.g. Tema, Accra" /></div>
            <div className="space-y-2"><Label>Products Supplied</Label><Textarea placeholder="e.g. Noodles, Rice, Cooking Oil" /></div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => { setShowAdd(false); toast.success("Supplier added!"); }}>
              Add Supplier
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
