import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatGHS, calculateTaxes } from "@/lib/ghana";
import { Search, Plus, FileText, Eye, MessageCircle, Download, Send } from "lucide-react";
import { toast } from "sonner";

interface Invoice {
  id: number;
  number: string;
  customer: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "overdue" | "partial";
  date: string;
  dueDate: string;
}

const initialInvoices: Invoice[] = [
  { id: 1, number: "NXG-2025-001", customer: "Ama Mensah Enterprises", amount: 2450, status: "paid", date: "2025-03-01", dueDate: "2025-03-15" },
  { id: 2, number: "NXG-2025-002", customer: "Kofi's Mini Mart", amount: 1890, status: "sent", date: "2025-03-03", dueDate: "2025-03-17" },
  { id: 3, number: "NXG-2025-003", customer: "Yaa Asantewaa Store", amount: 3200, status: "overdue", date: "2025-02-15", dueDate: "2025-03-01" },
  { id: 4, number: "NXG-2025-004", customer: "Kweku Provisions", amount: 780, status: "draft", date: "2025-03-06", dueDate: "2025-03-20" },
  { id: 5, number: "NXG-2025-005", customer: "Grace Beauty Supplies", amount: 1560, status: "partial", date: "2025-03-04", dueDate: "2025-03-18" },
];

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
  partial: "bg-warning/10 text-warning",
};

export default function Invoices() {
  const [invoices] = useState<Invoice[]>(initialInvoices);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [taxes, setTaxes] = useState({ vat: true, nhil: true, getfl: true });

  const filtered = invoices.filter(i => i.customer.toLowerCase().includes(search.toLowerCase()) || i.number.toLowerCase().includes(search.toLowerCase()));

  const sampleSubtotal = 1500;
  const taxCalc = calculateTaxes(sampleSubtotal, taxes);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Invoices</h1>
          <p className="text-muted-foreground text-sm">{invoices.length} invoices · {invoices.filter(i => i.status === "overdue").length} overdue</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gold-gradient text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> New Invoice
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {["all", "draft", "sent", "paid", "overdue"].map(status => (
          <Button key={status} variant="secondary" size="sm" className="capitalize">
            {status} ({status === "all" ? invoices.length : invoices.filter(i => i.status === status).length})
          </Button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search invoices..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Due</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(invoice => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-sm text-primary">{invoice.number}</TableCell>
                  <TableCell className="font-medium">{invoice.customer}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{invoice.date}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{invoice.dueDate}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={statusColors[invoice.status] + " capitalize"}>{invoice.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatGHS(invoice.amount)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MessageCircle className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Customer</Label>
              <Select><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {["Ama Mensah Enterprises", "Kofi's Mini Mart", "Walk-in Customer"].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Invoice Date</Label><Input type="date" /></div>
              <div className="space-y-2"><Label>Due Date</Label><Input type="date" /></div>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea placeholder="Any additional notes..." /></div>

            <Separator />
            <p className="text-sm font-medium">Ghana Taxes</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>VAT (15%)</Label>
                <Switch checked={taxes.vat} onCheckedChange={v => setTaxes(t => ({ ...t, vat: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label>NHIL (2.5%)</Label>
                <Switch checked={taxes.nhil} onCheckedChange={v => setTaxes(t => ({ ...t, nhil: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label>GETFL (1%)</Label>
                <Switch checked={taxes.getfl} onCheckedChange={v => setTaxes(t => ({ ...t, getfl: v }))} />
              </div>
            </div>

            <Separator />
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatGHS(sampleSubtotal)}</span></div>
              {taxes.vat && <div className="flex justify-between"><span className="text-muted-foreground">VAT (15%)</span><span>{formatGHS(taxCalc.vatAmount)}</span></div>}
              {taxes.nhil && <div className="flex justify-between"><span className="text-muted-foreground">NHIL (2.5%)</span><span>{formatGHS(taxCalc.nhilAmount)}</span></div>}
              {taxes.getfl && <div className="flex justify-between"><span className="text-muted-foreground">GETFL (1%)</span><span>{formatGHS(taxCalc.getflAmount)}</span></div>}
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-primary">{formatGHS(taxCalc.total)}</span></div>
            </div>

            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => { setShowCreate(false); toast.success("Invoice created!"); }}>
              <Send className="h-4 w-4 mr-2" /> Create Invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
