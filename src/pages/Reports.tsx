import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatGHS } from "@/lib/ghana";
import { exportSalesCsv, exportInventoryCsv, exportExpensesCsv, exportProfitLossCsv } from "@/lib/export";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Download, TrendingUp, TrendingDown, Award, Calendar, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const COLORS = ["hsl(37, 90%, 55%)", "hsl(210, 92%, 45%)", "hsl(142, 76%, 36%)", "hsl(215, 15%, 55%)", "hsl(0, 72%, 51%)"];
const tooltipStyle = { background: "hsl(220, 35%, 12%)", border: "1px solid hsl(220, 20%, 20%)", borderRadius: 8, color: "hsl(210, 40%, 96%)" };

export default function Reports() {
  const { business } = useBusiness();
  const [dateFrom, setDateFrom] = useState(() => format(subMonths(new Date(), 11), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const { data: sales = [] } = useQuery({
    queryKey: ["all-sales", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: saleItems = [] } = useQuery({
    queryKey: ["all-sale-items", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select("product_name, qty, unit_price, sale_id, sales!inner(business_id)")
        .eq("sales.business_id", business!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["all-expenses", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("business_id", business!.id).order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-report", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("business_id", business!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  // Chart of accounts for financial statements
  const { data: accounts = [] } = useQuery({
    queryKey: ["coa-report", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("chart_of_accounts").select("*").eq("business_id", business!.id).eq("is_active", true).order("account_code");
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices-report", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").eq("business_id", business!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  // Monthly P&L data
  const monthlyMap: Record<string, { revenue: number; expenses: number }> = {};
  const monthOrder: string[] = [];
  
  sales.forEach((s: any) => {
    const d = new Date(s.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[key]) { monthlyMap[key] = { revenue: 0, expenses: 0 }; monthOrder.push(key); }
    monthlyMap[key].revenue += Number(s.total);
  });
  expenses.forEach((e: any) => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[key]) { monthlyMap[key] = { revenue: 0, expenses: 0 }; monthOrder.push(key); }
    monthlyMap[key].expenses += Number(e.amount);
  });

  const sortedMonths = [...new Set(monthOrder)].sort();
  const monthlyData = sortedMonths.map(key => {
    const d = new Date(key + "-01");
    return {
      month: d.toLocaleString("en", { month: "short", year: "2-digit" }),
      revenue: monthlyMap[key].revenue,
      expenses: monthlyMap[key].expenses,
      profit: monthlyMap[key].revenue - monthlyMap[key].expenses,
    };
  });

  // Top-selling products
  const productSalesMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  saleItems.forEach((item: any) => {
    const name = item.product_name;
    if (!productSalesMap[name]) productSalesMap[name] = { name, qty: 0, revenue: 0 };
    productSalesMap[name].qty += item.qty;
    productSalesMap[name].revenue += item.qty * Number(item.unit_price);
  });
  const topProducts = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Payment method breakdown
  const paymentMap: Record<string, number> = {};
  sales.forEach((s: any) => { paymentMap[s.payment_method] = (paymentMap[s.payment_method] || 0) + Number(s.total); });
  const paymentData = Object.entries(paymentMap).map(([name, value]) => ({ name, value }));

  // Expense category breakdown
  const expCatMap: Record<string, number> = {};
  expenses.forEach((e: any) => { expCatMap[e.category] = (expCatMap[e.category] || 0) + Number(e.amount); });
  const expenseCatData = Object.entries(expCatMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const totalRevenue = sales.reduce((s: number, r: any) => s + Number(r.total), 0);
  const totalExpensesAmt = expenses.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const netProfit = totalRevenue - totalExpensesAmt;
  const totalInventoryValue = products.reduce((s: number, p: any) => s + Number(p.selling_price) * p.qty, 0);
  const totalCostValue = products.reduce((s: number, p: any) => s + Number(p.cost_price) * p.qty, 0);
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCostValue) / totalRevenue * 100) : 0;

  // Financial statements helpers
  const groupAccountsByType = (type: string) => accounts.filter((a: any) => a.account_type === type);
  const totalByType = (type: string) => groupAccountsByType(type).reduce((s: number, a: any) => s + Number(a.balance), 0);

  // Trial Balance
  const trialBalanceData = accounts.map((a: any) => {
    const bal = Number(a.balance);
    const isDebitNormal = ["asset", "expense", "cost_of_goods"].includes(a.account_type);
    return {
      code: a.account_code,
      name: a.name,
      type: a.account_type,
      debit: isDebitNormal ? Math.max(bal, 0) : Math.max(-bal, 0),
      credit: isDebitNormal ? Math.max(-bal, 0) : Math.max(bal, 0),
    };
  });
  const totalTrialDebit = trialBalanceData.reduce((s, r) => s + r.debit, 0);
  const totalTrialCredit = trialBalanceData.reduce((s, r) => s + r.credit, 0);

  // Balance Sheet
  const totalAssets = totalByType("asset") + totalByType("bank") + totalByType("receivable");
  const totalLiabilities = totalByType("liability") + totalByType("payable");
  const totalEquity = totalByType("equity");

  // Aging report
  const today = new Date();
  const agingBuckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
  invoices.filter((i: any) => ["sent", "overdue", "partial"].includes(i.status)).forEach((inv: any) => {
    const due = new Date(inv.due_date);
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    const amt = Number(inv.total);
    if (diff <= 0) agingBuckets.current += amt;
    else if (diff <= 30) agingBuckets.days30 += amt;
    else if (diff <= 60) agingBuckets.days60 += amt;
    else if (diff <= 90) agingBuckets.days90 += amt;
    else agingBuckets.over90 += amt;
  });
  const agingData = [
    { name: "Current", value: agingBuckets.current },
    { name: "1-30 Days", value: agingBuckets.days30 },
    { name: "31-60 Days", value: agingBuckets.days60 },
    { name: "61-90 Days", value: agingBuckets.days90 },
    { name: "90+ Days", value: agingBuckets.over90 },
  ];

  const handleExportSales = () => { exportSalesCsv(sales); toast.success("Sales exported!"); };
  const handleExportInventory = () => { exportInventoryCsv(products); toast.success("Inventory exported!"); };
  const handleExportExpenses = () => { exportExpensesCsv(expenses); toast.success("Expenses exported!"); };
  const handleExportPL = () => { exportProfitLossCsv(monthlyData); toast.success("P&L report exported!"); };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm">Financial statements, insights and business intelligence</p>
        </div>
      </div>

      <Tabs defaultValue="pnl">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-8 gap-1">
          <TabsTrigger value="pnl">P&L</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="top-products">Top Products</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        {/* Profit & Loss */}
        <TabsContent value="pnl" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 justify-between">
            <div className="flex gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[150px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[150px]" />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportPL}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          </div>
          <div className="grid sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-display font-bold text-primary">{formatGHS(totalRevenue)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Expenses</p><p className="text-2xl font-display font-bold text-destructive">{formatGHS(totalExpensesAmt)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground flex items-center justify-center gap-1">{netProfit >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-destructive" />} Net Profit</p><p className={`text-2xl font-display font-bold ${netProfit >= 0 ? "text-green-500" : "text-destructive"}`}>{formatGHS(netProfit)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Gross Margin</p><p className="text-2xl font-display font-bold">{grossMargin.toFixed(1)}%</p></CardContent></Card>
          </div>
          {monthlyData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Monthly Trends</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 20%)" />
                    <XAxis dataKey="month" stroke="hsl(215, 15%, 55%)" fontSize={12} />
                    <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatGHS(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(37, 90%, 55%)" strokeWidth={2} dot={{ r: 4 }} name="Revenue" />
                    <Line type="monotone" dataKey="expenses" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ r: 4 }} name="Expenses" />
                    <Line type="monotone" dataKey="profit" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={{ r: 4 }} name="Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance-sheet" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display">Balance Sheet</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {accounts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Set up your Chart of Accounts in Financials module first.</p>
              ) : (
                <>
                  {/* Assets */}
                  <div>
                    <h3 className="font-semibold text-sm mb-2 text-primary">ASSETS</h3>
                    <Table>
                      <TableBody>
                        {[...groupAccountsByType("asset"), ...groupAccountsByType("bank"), ...groupAccountsByType("receivable")].map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs text-muted-foreground w-20">{a.account_code}</TableCell>
                            <TableCell className="text-sm">{a.name}</TableCell>
                            <TableCell className="text-right font-medium">{formatGHS(Number(a.balance))}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2">
                          <TableCell colSpan={2}>Total Assets</TableCell>
                          <TableCell className="text-right text-primary">{formatGHS(totalAssets)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  {/* Liabilities */}
                  <div>
                    <h3 className="font-semibold text-sm mb-2 text-destructive">LIABILITIES</h3>
                    <Table>
                      <TableBody>
                        {[...groupAccountsByType("liability"), ...groupAccountsByType("payable")].map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs text-muted-foreground w-20">{a.account_code}</TableCell>
                            <TableCell className="text-sm">{a.name}</TableCell>
                            <TableCell className="text-right font-medium">{formatGHS(Number(a.balance))}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2">
                          <TableCell colSpan={2}>Total Liabilities</TableCell>
                          <TableCell className="text-right text-destructive">{formatGHS(totalLiabilities)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  {/* Equity */}
                  <div>
                    <h3 className="font-semibold text-sm mb-2">EQUITY</h3>
                    <Table>
                      <TableBody>
                        {groupAccountsByType("equity").map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs text-muted-foreground w-20">{a.account_code}</TableCell>
                            <TableCell className="text-sm">{a.name}</TableCell>
                            <TableCell className="text-right font-medium">{formatGHS(Number(a.balance))}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2">
                          <TableCell colSpan={2}>Total Equity</TableCell>
                          <TableCell className="text-right">{formatGHS(totalEquity)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <Card className="bg-secondary/30">
                    <CardContent className="p-4 flex justify-between items-center">
                      <span className="font-bold">Liabilities + Equity</span>
                      <span className="font-display font-bold text-lg">{formatGHS(totalLiabilities + totalEquity)}</span>
                    </CardContent>
                  </Card>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trial Balance */}
        <TabsContent value="trial-balance" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display">Trial Balance</CardTitle></CardHeader>
            <CardContent>
              {trialBalanceData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No accounts found. Set up Chart of Accounts first.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trialBalanceData.map((row) => (
                      <TableRow key={row.code}>
                        <TableCell className="text-xs text-muted-foreground">{row.code}</TableCell>
                        <TableCell className="text-sm">{row.name}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize text-xs">{row.type.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell className="text-right">{row.debit > 0 ? formatGHS(row.debit) : "—"}</TableCell>
                        <TableCell className="text-right">{row.credit > 0 ? formatGHS(row.credit) : "—"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={3}>TOTALS</TableCell>
                      <TableCell className="text-right text-primary">{formatGHS(totalTrialDebit)}</TableCell>
                      <TableCell className="text-right text-primary">{formatGHS(totalTrialCredit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
              {trialBalanceData.length > 0 && Math.abs(totalTrialDebit - totalTrialCredit) > 0.01 && (
                <div className="mt-3 p-3 bg-destructive/10 rounded-lg text-sm text-destructive flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Out of balance by {formatGHS(Math.abs(totalTrialDebit - totalTrialCredit))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aging Report */}
        <TabsContent value="aging" className="space-y-4">
          <div className="grid sm:grid-cols-5 gap-3">
            {agingData.map((b, i) => (
              <Card key={b.name}>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">{b.name}</p>
                  <p className={`text-xl font-display font-bold ${i >= 3 ? "text-destructive" : i >= 1 ? "text-orange-500" : "text-primary"}`}>{formatGHS(b.value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Accounts Receivable Aging</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={agingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 20%)" />
                  <XAxis dataKey="name" stroke="hsl(215, 15%, 55%)" fontSize={12} />
                  <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatGHS(v)} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Outstanding">
                    {agingData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales */}
        <TabsContent value="sales" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportSales}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-display font-bold text-primary">{formatGHS(totalRevenue)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Avg. Order Value</p><p className="text-2xl font-display font-bold">{formatGHS(sales.length > 0 ? totalRevenue / sales.length : 0)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Transactions</p><p className="text-2xl font-display font-bold">{sales.length}</p></CardContent></Card>
          </div>
          {monthlyData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Sales vs Expenses</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 20%)" />
                    <XAxis dataKey="month" stroke="hsl(215, 15%, 55%)" />
                    <YAxis stroke="hsl(215, 15%, 55%)" />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatGHS(v)} />
                    <Bar dataKey="revenue" fill="hsl(37, 90%, 55%)" radius={[6, 6, 0, 0]} name="Sales" />
                    <Bar dataKey="expenses" fill="hsl(0, 72%, 51%)" radius={[6, 6, 0, 0]} name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {paymentData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Payment Methods</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${formatGHS(value)}`}>
                      {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatGHS(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Top Products */}
        <TabsContent value="top-products" className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> Top Selling Products</CardTitle></CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No sales data yet</p>
                ) : (
                  <div className="space-y-3">
                    {topProducts.map((p, i) => (
                      <div key={p.name} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.qty} units sold</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-primary">{formatGHS(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            {topProducts.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="font-display text-base">Revenue by Product</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topProducts.slice(0, 7)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 20%)" />
                      <XAxis type="number" stroke="hsl(215, 15%, 55%)" fontSize={11} tickFormatter={(v) => `₵${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" width={100} stroke="hsl(215, 15%, 55%)" fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatGHS(v)} />
                      <Bar dataKey="revenue" fill="hsl(37, 90%, 55%)" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Inventory */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportInventory}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          </div>
          <div className="grid sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Products</p><p className="text-2xl font-display font-bold">{products.length}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Retail Value</p><p className="text-2xl font-display font-bold text-primary">{formatGHS(totalInventoryValue)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Cost Value</p><p className="text-2xl font-display font-bold">{formatGHS(totalCostValue)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Low Stock</p><p className="text-2xl font-display font-bold text-destructive">{products.filter((p: any) => p.qty <= p.reorder_level).length}</p></CardContent></Card>
          </div>
        </TabsContent>

        {/* Expenses */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportExpenses}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Expenses</p><p className="text-2xl font-display font-bold text-destructive">{formatGHS(totalExpensesAmt)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Net Profit</p><p className={`text-2xl font-display font-bold ${netProfit >= 0 ? "text-green-500" : "text-destructive"}`}>{formatGHS(netProfit)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Expense Categories</p><p className="text-2xl font-display font-bold">{expenseCatData.length}</p></CardContent></Card>
          </div>
          {expenseCatData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Expenses by Category</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={expenseCatData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${formatGHS(value)}`}>
                      {expenseCatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatGHS(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
