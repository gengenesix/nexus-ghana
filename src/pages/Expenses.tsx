import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatGHS, EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/ghana";
import { Plus, Search, Loader2, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";

export default function Expenses() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPaidBy, setFormPaidBy] = useState("Cash");

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("business_id", business!.id).order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const filtered = expenses.filter((e: any) => (e.description || "").toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase()));
  const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

  // Group by month for chart
  const monthlyData = expenses.reduce((acc: any[], e: any) => {
    const month = new Date(e.date).toLocaleString("en", { month: "short" });
    const existing = acc.find(a => a.month === month);
    if (existing) existing.amount += Number(e.amount);
    else acc.push({ month, amount: Number(e.amount) });
    return acc;
  }, []).reverse().slice(-6);

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({
        business_id: business!.id,
        date: formDate,
        amount: Number(formAmount) || 0,
        category: formCategory,
        description: formDescription,
        paid_by: formPaidBy,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setShowAdd(false);
      setFormAmount(""); setFormCategory(""); setFormDescription("");
      toast.success("Expense logged!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted");
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Expenses</h1>
          <p className="text-muted-foreground text-sm">Total: {formatGHS(totalExpenses)}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gold-gradient text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Log Expense
        </Button>
      </div>

      {monthlyData.length > 0 && (
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
      )}

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
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{isLoading ? "Loading..." : "No expenses yet."}</TableCell></TableRow>
              ) : filtered.map((expense: any) => (
                <TableRow key={expense.id}>
                  <TableCell className="text-muted-foreground">{expense.date}</TableCell>
                  <TableCell><Badge variant="secondary">{expense.category}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell">{expense.description || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{expense.paid_by}</TableCell>
                  <TableCell className="text-right font-medium text-destructive">{formatGHS(Number(expense.amount))}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(expense.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
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
              <div className="space-y-2"><Label>Date</Label><Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Amount (GHS) *</Label><Input type="number" placeholder="0.00" value={formAmount} onChange={e => setFormAmount(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea placeholder="What was this expense for?" value={formDescription} onChange={e => setFormDescription(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Paid By</Label>
              <Select value={formPaidBy} onValueChange={setFormPaidBy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Cash", "MTN MoMo", "Bank Transfer", "Card"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => addMutation.mutate()} disabled={!formCategory || !formAmount || addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log Expense"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
