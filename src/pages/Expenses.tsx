import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatGHS, EXPENSE_CATEGORIES } from "@/lib/ghana";
import { Plus, Receipt, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";

interface Expense {
  id: number;
  date: string;
  category: string;
  amount: number;
  description: string;
  paidBy: string;
}

const initialExpenses: Expense[] = [
  { id: 1, date: "2025-03-06", category: "Rent", amount: 3500, description: "Shop rent for March", paidBy: "Bank Transfer" },
  { id: 2, date: "2025-03-05", category: "Utilities", amount: 450, description: "ECG electricity bill", paidBy: "MTN MoMo" },
  { id: 3, date: "2025-03-04", category: "Stock Purchase", amount: 5200, description: "Bulk order from De-Heer Foods", paidBy: "Bank Transfer" },
  { id: 4, date: "2025-03-03", category: "Transport", amount: 180, description: "Delivery to customers", paidBy: "Cash" },
  { id: 5, date: "2025-03-02", category: "Marketing", amount: 800, description: "Facebook & Instagram ads", paidBy: "Card" },
];

const monthlyData = [
  { month: "Jan", amount: 8500 },
  { month: "Feb", amount: 9200 },
  { month: "Mar", amount: 10130 },
];

export default function Expenses() {
  const [expenses] = useState<Expense[]>(initialExpenses);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = expenses.filter(e => e.description.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase()));
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Expenses</h1>
          <p className="text-muted-foreground text-sm">Total: {formatGHS(totalExpenses)} this month</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gold-gradient text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Log Expense
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Monthly Expenses</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 20%)" />
              <XAxis dataKey="month" stroke="hsl(215, 15%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(220, 35%, 12%)", border: "1px solid hsl(220, 20%, 20%)", borderRadius: 8, color: "hsl(210, 40%, 96%)" }} formatter={(v: number) => [formatGHS(v), "Expenses"]} />
              <Bar dataKey="amount" fill="hsl(0, 72%, 51%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search expenses..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden sm:table-cell">Description</TableHead>
                <TableHead className="hidden md:table-cell">Paid By</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(expense => (
                <TableRow key={expense.id}>
                  <TableCell className="text-muted-foreground">{expense.date}</TableCell>
                  <TableCell><Badge variant="secondary">{expense.category}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell">{expense.description}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{expense.paidBy}</TableCell>
                  <TableCell className="text-right font-medium text-destructive">{formatGHS(expense.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Log Expense</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Date</Label><Input type="date" /></div>
              <div className="space-y-2"><Label>Amount (GHS)</Label><Input type="number" placeholder="0.00" /></div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea placeholder="What was this expense for?" /></div>
            <div className="space-y-2">
              <Label>Paid By</Label>
              <Select><SelectTrigger><SelectValue placeholder="Payment method" /></SelectTrigger>
                <SelectContent>
                  {["Cash", "MTN MoMo", "Bank Transfer", "Card"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => { setShowAdd(false); toast.success("Expense logged!"); }}>
              Log Expense
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
