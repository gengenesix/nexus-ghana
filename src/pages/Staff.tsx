import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatGHS } from "@/lib/ghana";
import { Search, Plus, UserCog, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface Staff {
  id: number;
  name: string;
  role: string;
  phone: string;
  email: string;
  salesCount: number;
  salesTotal: number;
  status: "active" | "off";
}

const initialStaff: Staff[] = [
  { id: 1, name: "Kwame Asante", role: "Manager", phone: "0241111111", email: "kwame@nexus.com", salesCount: 145, salesTotal: 12500, status: "active" },
  { id: 2, name: "Esi Mensah", role: "Cashier", phone: "0242222222", email: "esi@nexus.com", salesCount: 230, salesTotal: 18900, status: "active" },
  { id: 3, name: "Kofi Owusu", role: "Cashier", phone: "0243333333", email: "kofi@nexus.com", salesCount: 198, salesTotal: 15600, status: "off" },
  { id: 4, name: "Abena Darko", role: "Staff", phone: "0244444444", email: "abena@nexus.com", salesCount: 0, salesTotal: 0, status: "active" },
];

export default function Staff() {
  const [staff] = useState<Staff[]>(initialStaff);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = staff.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Staff Management</h1>
          <p className="text-muted-foreground text-sm">{staff.length} staff members · {staff.filter(s => s.status === "active").length} active</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gold-gradient text-primary-foreground">
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
                <TableHead className="text-center hidden md:table-cell">Sales</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Revenue</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><Badge variant="secondary">{s.role}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{s.phone}</TableCell>
                  <TableCell className="text-center hidden md:table-cell">{s.salesCount}</TableCell>
                  <TableCell className="text-right hidden sm:table-cell">{formatGHS(s.salesTotal)}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={s.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                      {s.status === "active" ? "Active" : "Off"}
                    </Badge>
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
            <div className="space-y-2"><Label>Full Name</Label><Input placeholder="e.g. Kwame Asante" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input placeholder="024XXXXXXX" /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="email@nexus.com" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {["Manager", "Cashier", "Staff"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>POS PIN</Label><Input type="password" placeholder="4-digit PIN" maxLength={4} /></div>
            </div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => { setShowAdd(false); toast.success("Staff member added!"); }}>
              Add Staff
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
