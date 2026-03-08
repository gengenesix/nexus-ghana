import { useState } from "react";
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
import { Search, Plus, Users, Eye, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  region: string;
  totalPurchases: number;
  outstanding: number;
  loyaltyPoints: number;
}

const initialCustomers: Customer[] = [
  { id: 1, name: "Ama Mensah", phone: "0241234567", email: "ama@email.com", region: "Greater Accra", totalPurchases: 12450, outstanding: 1200, loyaltyPoints: 124 },
  { id: 2, name: "Kofi Boateng", phone: "0551234567", email: "kofi@email.com", region: "Ashanti", totalPurchases: 8900, outstanding: 0, loyaltyPoints: 89 },
  { id: 3, name: "Yaa Asantewaa", phone: "0271234567", email: "yaa@email.com", region: "Eastern", totalPurchases: 15600, outstanding: 3200, loyaltyPoints: 156 },
  { id: 4, name: "Kweku Annan", phone: "0201234567", email: "kweku@email.com", region: "Central", totalPurchases: 5300, outstanding: 780, loyaltyPoints: 53 },
  { id: 5, name: "Abena Osei", phone: "0501234567", email: "abena@email.com", region: "Western", totalPurchases: 21000, outstanding: 0, loyaltyPoints: 210 },
];

export default function Customers() {
  const [customers] = useState<Customer[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">{customers.length} customers · {formatGHS(customers.reduce((s, c) => s + c.outstanding, 0))} outstanding</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gold-gradient text-primary-foreground">
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
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Outstanding</TableHead>
                <TableHead className="text-center hidden md:table-cell">Points</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(customer => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{customer.phone}</TableCell>
                  <TableCell className="hidden md:table-cell"><Badge variant="secondary">{customer.region}</Badge></TableCell>
                  <TableCell className="text-right">{formatGHS(customer.totalPurchases)}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    {customer.outstanding > 0 ? <span className="text-destructive">{formatGHS(customer.outstanding)}</span> : <span className="text-success">Nil</span>}
                  </TableCell>
                  <TableCell className="text-center hidden md:table-cell">
                    <Badge variant="secondary" className="text-primary">{customer.loyaltyPoints}</Badge>
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
          <DialogHeader><DialogTitle className="font-display">Add Customer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Full Name</Label><Input placeholder="e.g. Kwame Asante" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input placeholder="024XXXXXXX" /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="email@example.com" /></div>
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
              <Select><SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent>{GHANA_REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea placeholder="Additional notes..." /></div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => { setShowAdd(false); toast.success("Customer added!"); }}>
              Add Customer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
