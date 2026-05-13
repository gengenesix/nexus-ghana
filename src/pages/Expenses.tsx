import { useState, useMemo } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatGHS, EXPENSE_CATEGORIES } from "@/lib/ghana";
import { Plus, Search, Loader2, Trash2, Download, Calendar, Edit2, TrendingUp, TrendingDown, DollarSign, AlertTriangle, Paperclip, ExternalLink } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { toast } from "sonner";
import { exportExpensesCsv } from "@/lib/export";
import { useChartColors } from "@/hooks/useChartColors";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from "date-fns";


const COLORS = ["hsl(140,28%,16%)", "hsl(86,68%,52%)", "hsl(142,60%,38%)", "hsl(210,70%,48%)", "hsl(0,72%,51%)", "hsl(280,50%,50%)", "hsl(38,92%,50%)", "hsl(170,55%,40%)", "hsl(330,70%,50%)"];

const QUICK_RANGES = [
  { label: "This Month", from: () => format(startOfMonth(new Date()), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
  { label: "Last Month", from: () => format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"), to: () => format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd") },
  { label: "Last 3 Months", from: () => format(subMonths(new Date(), 3), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
  { label: "Last 6 Months", from: () => format(subMonths(new Date(), 6), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
];

export default function Expenses() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [catFilter, setCatFilter] = useState("all");
  const [paidByFilter, setPaidByFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => format(subMonths(new Date(), 1), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPaidBy, setFormPaidBy] = useState("Cash");
  const [formReceiptFile, setFormReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("business_id", business!.id).order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const dateFiltered = useMemo(() => expenses.filter((e: any) => e.date >= dateFrom && e.date <= dateTo), [expenses, dateFrom, dateTo]);
  const filtered = useMemo(() => {
    let result = dateFiltered;
    if (catFilter !== "all") result = result.filter((e: any) => e.category === catFilter);
    if (paidByFilter !== "all") result = result.filter((e: any) => e.paid_by === paidByFilter);
    if (search) result = result.filter((e: any) => (e.description || "").toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase()));
    return result;
  }, [dateFiltered, catFilter, paidByFilter, search]);

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const nextPage = () => setPage(p => Math.min(p + 1, totalPages));
  const prevPage = () => setPage(p => Math.max(p - 1, 1));
  const totalExpenses = dateFiltered.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const avgPerDay = useMemo(() => {
    const days = differenceInDays(new Date(dateTo), new Date(dateFrom)) || 1;
    return totalExpenses / days;
  }, [totalExpenses, dateFrom, dateTo]);

  // Previous period comparison
  const prevPeriodTotal = useMemo(() => {
    const days = differenceInDays(new Date(dateTo), new Date(dateFrom)) || 1;
    const prevFrom = format(subMonths(new Date(dateFrom), 0), "yyyy-MM-dd");
    const prevTo = format(subMonths(new Date(dateTo), 0), "yyyy-MM-dd");
    const prevFromDate = new Date(dateFrom);
    prevFromDate.setDate(prevFromDate.getDate() - days);
    const prevToDate = new Date(dateFrom);
    prevToDate.setDate(prevToDate.getDate() - 1);
    const pf = format(prevFromDate, "yyyy-MM-dd");
    const pt = format(prevToDate, "yyyy-MM-dd");
    return expenses.filter((e: any) => e.date >= pf && e.date <= pt).reduce((s: number, e: any) => s + Number(e.amount), 0);
  }, [expenses, dateFrom, dateTo]);

  const changePercent = prevPeriodTotal > 0 ? ((totalExpenses - prevPeriodTotal) / prevPeriodTotal * 100) : 0;

  // Category pie chart
  const catMap: Record<string, number> = {};
  dateFiltered.forEach((e: any) => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount); });
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const topCategory = catData[0]?.name || "—";

  // Monthly trend chart (6 months)
  const monthlyTrend = useMemo(() => {
    const months: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, "MMM yyyy");
      months[key] = 0;
    }
    expenses.forEach((e: any) => {
      const key = format(new Date(e.date), "MMM yyyy");
      if (months[key] !== undefined) months[key] += Number(e.amount);
    });
    return Object.entries(months).map(([month, amount]) => ({ month: month.split(" ")[0], amount }));
  }, [expenses]);

  // Payment method breakdown
  const payMethodMap: Record<string, number> = {};
  dateFiltered.forEach((e: any) => { payMethodMap[e.paid_by || "Cash"] = (payMethodMap[e.paid_by || "Cash"] || 0) + Number(e.amount); });
  const payMethodData = Object.entries(payMethodMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const uniqueCategories = useMemo(() => [...new Set(expenses.map((e: any) => e.category))].sort(), [expenses]);
  const uniquePayMethods = useMemo(() => [...new Set(expenses.map((e: any) => e.paid_by || "Cash"))].sort(), [expenses]);

  const openEdit = (expense: any) => {
    setEditingExpense(expense);
    setFormDate(expense.date);
    setFormAmount(String(expense.amount));
    setFormCategory(expense.category);
    setFormDescription(expense.description || "");
    setFormPaidBy(expense.paid_by || "Cash");
    setFormReceiptFile(null);
    setShowAdd(true);
  };

  const resetForm = () => {
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormAmount(""); setFormCategory(""); setFormDescription(""); setFormPaidBy("Cash");
    setFormReceiptFile(null);
    setEditingExpense(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let receipt_url: string | null = editingExpense?.receipt_url ?? null;

      if (formReceiptFile) {
        setUploadingReceipt(true);
        const ext = formReceiptFile.name.split(".").pop();
        const path = `${business!.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("expense-receipts")
          .upload(path, formReceiptFile, { upsert: true });
        setUploadingReceipt(false);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("expense-receipts").getPublicUrl(path);
        receipt_url = urlData.publicUrl;
      }

      const payload = {
        business_id: business!.id,
        date: formDate,
        amount: Number(formAmount) || 0,
        category: formCategory,
        description: formDescription,
        paid_by: formPaidBy,
        receipt_url,
      };
      if (editingExpense) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editingExpense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setShowAdd(false);
      resetForm();
      toast.success(editingExpense ? "Expense updated!" : "Expense logged!");
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
          <p className="text-muted-foreground text-sm">Track & analyze business spending</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { exportExpensesCsv(filtered); toast.success("Exported!"); }}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button onClick={() => { resetForm(); setShowAdd(true); }} size="sm" className="gold-gradient text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> Log Expense
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="h-3.5 w-3.5" /> Period Total</div>
            <p className="text-xl font-bold text-destructive">{formatGHS(totalExpenses)}</p>
            {prevPeriodTotal > 0 && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${changePercent > 0 ? "text-destructive" : "text-green-500"}`}>
                {changePercent > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(changePercent).toFixed(1)}% vs prev period
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Calendar className="h-3.5 w-3.5" /> Avg/Day</div>
            <p className="text-xl font-bold">{formatGHS(avgPerDay)}</p>
            <p className="text-xs text-muted-foreground mt-1">{dateFiltered.length} transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><AlertTriangle className="h-3.5 w-3.5" /> Top Category</div>
            <p className="text-lg font-bold truncate">{topCategory}</p>
            <p className="text-xs text-muted-foreground mt-1">{catData[0] ? formatGHS(catData[0].value) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="h-3.5 w-3.5" /> Categories</div>
            <p className="text-xl font-bold">{catData.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{uniquePayMethods.length} payment methods</p>
          </CardContent>
        </Card>
      </div>

      {/* Date range filter with quick presets */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground mt-5" />
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[150px] h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[150px] h-9" />
          </div>
          <div className="flex gap-1.5 pb-0.5 flex-wrap">
            {QUICK_RANGES.map(r => (
              <Button key={r.label} variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setDateFrom(r.from()); setDateTo(r.to()); }}>
                {r.label}
              </Button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground pb-2">{dateFiltered.length} records</span>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="list">All Expenses</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid lg:grid-cols-3 gap-6">
            {monthlyTrend.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="font-display text-base">6-Month Trend</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(45,15%,87%)" />
                      <XAxis dataKey="month" stroke="hsl(215, 15%, 55%)" fontSize={12} />
                      <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatGHS(v), "Expenses"]} />
                      <Line type="monotone" dataKey="amount" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ fill: "hsl(0, 72%, 51%)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {catData.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="font-display text-base">By Category</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={catData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={4} dataKey="value">
                        {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatGHS(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1 mt-1">
                    {catData.slice(0, 5).map((d, i) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span>{d.name}</span>
                        </div>
                        <span className="text-muted-foreground">{formatGHS(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent expenses quick view */}
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Recent Expenses</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="hidden sm:table-cell">Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dateFiltered.slice(0, 5).map((expense: any) => (
                    <TableRow key={expense.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(expense)}>
                      <TableCell className="text-muted-foreground">{expense.date}</TableCell>
                      <TableCell><Badge variant="secondary">{expense.category}</Badge></TableCell>
                      <TableCell className="hidden sm:table-cell">{expense.description || "—"}</TableCell>
                      <TableCell className="text-right font-medium text-destructive">{formatGHS(Number(expense.amount))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search expenses..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={paidByFilter} onValueChange={setPaidByFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Paid By" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {uniquePayMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
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
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{isLoading ? "Loading..." : "No expenses match filters."}</TableCell></TableRow>
                  ) : paginatedData.map((expense: any) => (
                    <TableRow key={expense.id}>
                      <TableCell className="text-muted-foreground">{expense.date}</TableCell>
                      <TableCell><Badge variant="secondary">{expense.category}</Badge></TableCell>
                      <TableCell className="hidden sm:table-cell max-w-[200px] truncate">{expense.description || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{expense.paid_by}</TableCell>
                      <TableCell className="text-right font-medium text-destructive">{formatGHS(Number(expense.amount))}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(expense)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(expense.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages} · {filtered.length} expenses</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={prevPage} disabled={page === 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={nextPage} disabled={page === totalPages}>Next</Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Monthly bar chart */}
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Monthly Expenses</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(45,15%,87%)" />
                    <XAxis dataKey="month" stroke="hsl(215, 15%, 55%)" fontSize={12} />
                    <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatGHS(v), "Expenses"]} />
                    <Bar dataKey="amount" fill="hsl(0, 72%, 51%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Payment method breakdown */}
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Payment Methods</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={payMethodData} cx="50%" cy="50%" innerRadius={35} outerRadius={70} paddingAngle={4} dataKey="value">
                      {payMethodData.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatGHS(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {payMethodData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[(i + 3) % COLORS.length] }} />
                        <span>{d.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">{formatGHS(d.value)}</span>
                        <span className="text-muted-foreground">({totalExpenses > 0 ? (d.value / totalExpenses * 100).toFixed(0) : 0}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Category ranking */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="font-display text-base">Category Ranking</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {catData.map((d, i) => {
                    const pct = totalExpenses > 0 ? (d.value / totalExpenses * 100) : 0;
                    return (
                      <div key={d.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-5 text-right">{i + 1}.</span>
                            <span className="font-medium">{d.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground text-xs">{pct.toFixed(1)}%</span>
                            <span className="font-medium text-destructive w-24 text-right">{formatGHS(d.value)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editingExpense ? "Edit Expense" : "Log Expense"}</DialogTitle></DialogHeader>
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
                  {["Cash", "MTN MoMo", "Telecel Cash", "AirtelTigo Money", "Bank Transfer", "Card", "Cheque"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Receipt Photo (optional)</Label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm text-muted-foreground hover:border-primary transition-colors">
                  <Paperclip className="h-4 w-4 shrink-0" />
                  <span className="truncate">{formReceiptFile ? formReceiptFile.name : "Choose image..."}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => setFormReceiptFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {editingExpense?.receipt_url && !formReceiptFile && (
                  <a href={editingExpense.receipt_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
            <Button className="w-full gold-gradient text-primary-foreground" onClick={() => saveMutation.mutate()} disabled={!formCategory || !formAmount || saveMutation.isPending || uploadingReceipt}>
              {saveMutation.isPending || uploadingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : editingExpense ? "Update Expense" : "Log Expense"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
