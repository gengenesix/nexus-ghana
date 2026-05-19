import { useState, useMemo, useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatGHS } from "@/lib/ghana";
import { exportSalesCsv, exportInventoryCsv, exportExpensesCsv, exportProfitLossCsv } from "@/lib/export";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area,
} from "recharts";
import { Download, TrendingUp, TrendingDown, Award, Users, DollarSign } from "lucide-react";
import { useChartColors, useChartPalette } from "@/hooks/useChartColors";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";


function ChartSkeleton() {
  return <Skeleton className="w-full h-[300px] rounded-xl" />;
}

function StatSkeleton() {
  return (
    <div className="grid sm:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}><CardContent className="p-4"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-16" /></CardContent></Card>
      ))}
    </div>
  );
}

export default function Reports() {
  const { business } = useBusiness();
  const { tooltipStyle, labelStyle, itemStyle, gridColor, axisColor } = useChartColors();
  const COLORS = useChartPalette();
  const [dateFrom, setDateFrom] = useState(() => format(subMonths(new Date(), 11), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));

  // ── Primary report data: single server-side CTE aggregation (replaces 17k row downloads) ──
  const { data: reportSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ["report-summary", business?.id, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_report_summary", {
        p_business_id: business!.id,
        p_date_from:   dateFrom,
        p_date_to:     dateTo,
      });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any ?? {};
      return {
        totalRevenue:      Number(d.total_revenue      ?? 0),
        totalDiscounts:    Number(d.total_discounts    ?? 0),
        saleCount:         Number(d.sale_count         ?? 0),
        avgSaleValue:      Number(d.avg_sale_value     ?? 0),
        totalExpenses:     Number(d.total_expenses     ?? 0),
        netProfit:         Number(d.net_profit         ?? 0),
        profitMarginPct:   Number(d.profit_margin_pct  ?? 0),
        paymentBreakdown:  (d.payment_breakdown   ?? []) as { method: string; amount: number; count: number }[],
        monthlyRevenue:    (d.monthly_revenue     ?? []) as { label: string; revenue: number }[],
        topProducts:       (d.top_products        ?? []) as { name: string; units_sold: number; revenue: number }[],
        expenseByCategory: (d.expense_by_category ?? []) as { category: string; amount: number }[],
        invoicesPaid:      Number(d.invoices_paid        ?? 0),
        invoicesOverdue:   Number(d.invoices_overdue     ?? 0),
        invoicesOutstanding: Number(d.invoices_outstanding ?? 0),
        overdueAmount:     Number(d.overdue_amount       ?? 0),
        outstandingAmount: Number(d.outstanding_amount   ?? 0),
      };
    },
    enabled: !!business,
    staleTime: 60_000,
  });

  // Lightweight sales query — only staff_id + total needed for staff performance
  const { data: staffSales = [] } = useQuery({
    queryKey: ["report-staff-sales", business?.id, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, total, staff_id")
        .eq("business_id", business!.id)
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59");
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  // Lightweight expenses for monthly trend chart + CSV export
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ["report-expenses", business?.id, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, date, amount, category, description")
        .eq("business_id", business!.id)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  // Sold product names — minimal query for dead-stock computation
  const { data: soldProductNames = [] } = useQuery({
    queryKey: ["report-sold-names", business?.id, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select("product_name, sales!inner(business_id, created_at)")
        .eq("sales.business_id", business!.id)
        .gte("sales.created_at", dateFrom)
        .lte("sales.created_at", dateTo + "T23:59:59");
      if (error) throw error;
      return [...new Set((data ?? []).map((r: any) => r.product_name as string))];
    },
    enabled: !!business,
  });

  // Products are a snapshot — no date filter needed
  const { data: products = [] } = useQuery({
    queryKey: ["report-products", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, qty, reorder_level, cost_price, selling_price")
        .eq("business_id", business!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["report-coa", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("business_id", business!.id)
        .eq("is_active", true)
        .order("account_code");
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["report-invoices", business?.id, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, total, status, due_date, created_at")
        .eq("business_id", business!.id)
        .gte("created_at", dateFrom)
        .lte("created_at", dateTo + "T23:59:59")
        .limit(2000);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: staffMembers = [] } = useQuery({
    queryKey: ["report-staff", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("id, name, role")
        .eq("business_id", business!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["report-payments", business?.id, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("business_id", business!.id)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date")
        .limit(2000);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const isLoading = summaryLoading || expensesLoading;
  const itemsLoading = summaryLoading;

  // ── Derived computations ──────────────────────────────────────────────────

  // Totals come from server-side RPC (no 17k row download)
  const totalRevenue    = reportSummary?.totalRevenue    ?? 0;
  const totalExpensesAmt = reportSummary?.totalExpenses  ?? 0;
  const netProfit       = reportSummary?.netProfit       ?? 0;
  const topProducts     = useMemo(() =>
    (reportSummary?.topProducts ?? []).map(p => ({ name: p.name, qty: p.units_sold, revenue: p.revenue })),
    [reportSummary],
  );
  const paymentData     = useMemo(() =>
    (reportSummary?.paymentBreakdown ?? []).map(p => ({ name: p.method, value: p.amount })),
    [reportSummary],
  );
  const expenseCatData  = useMemo(() =>
    (reportSummary?.expenseByCategory ?? []).map(e => ({ name: e.category, value: e.amount })),
    [reportSummary],
  );

  const totalInventoryValue = useMemo(
    () => products.reduce((s: number, p: any) => s + Number(p.selling_price) * p.qty, 0),
    [products],
  );
  const totalCostValue = useMemo(
    () => products.reduce((s: number, p: any) => s + Number(p.cost_price) * p.qty, 0),
    [products],
  );
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCostValue) / totalRevenue * 100) : 0;

  // Monthly P&L — merge RPC monthly revenue with local expense totals
  const monthlyData = useMemo(() => {
    const map: Record<string, { revenue: number; expenses: number }> = {};
    (reportSummary?.monthlyRevenue ?? []).forEach(r => {
      // label is "Mon YYYY" — convert to "YYYY-MM" key
      const d = new Date(r.label);
      const key = isNaN(d.getTime()) ? r.label : d.toISOString().slice(0, 7);
      if (!map[key]) map[key] = { revenue: 0, expenses: 0 };
      map[key].revenue = r.revenue;
    });
    expenses.forEach((e: any) => {
      const key = (e.date as string).slice(0, 7);
      if (!map[key]) map[key] = { revenue: 0, expenses: 0 };
      map[key].expenses += Number(e.amount);
    });
    return Object.keys(map).sort().map((key) => {
      const d = new Date(key + "-01");
      return {
        month: d.toLocaleString("en", { month: "short", year: "2-digit" }),
        revenue: map[key].revenue,
        expenses: map[key].expenses,
        profit: map[key].revenue - map[key].expenses,
      };
    });
  }, [reportSummary, expenses]);

  // Dead stock & bottom sellers
  const { deadStock, bottomSellers, skuMargins } = useMemo(() => {
    const soldNames = new Set(soldProductNames);
    const dead = (products as any[]).filter(p => !soldNames.has(p.name) && p.qty > 0);
    const bottom = topProducts.length >= 5 ? [...topProducts].sort((a, b) => a.revenue - b.revenue).slice(0, 5) : [];
    const margins = topProducts.map(tp => {
      const prod = (products as any[]).find(p => p.name === tp.name);
      const cost = prod ? Number(prod.cost_price) : 0;
      const sell = prod ? Number(prod.selling_price) : 0;
      const pct = sell > 0 ? ((sell - cost) / sell * 100) : 0;
      return { ...tp, marginPct: pct, cost, sell };
    }).sort((a, b) => b.marginPct - a.marginPct);
    return { deadStock: dead, bottomSellers: bottom, skuMargins: margins };
  }, [topProducts, products, soldProductNames]);

  // Financial statement helpers
  const groupAccountsByType = (type: string) => accounts.filter((a: any) => a.account_type === type);
  const totalByType = (type: string) => groupAccountsByType(type).reduce((s: number, a: any) => s + Number(a.balance), 0);

  // Trial balance
  const trialBalanceData = useMemo(() => accounts.map((a: any) => {
    const bal = Number(a.balance);
    const isDebitNormal = ["asset", "expense", "cost_of_goods"].includes(a.account_type);
    return {
      code: a.account_code,
      name: a.name,
      type: a.account_type,
      debit: isDebitNormal ? Math.max(bal, 0) : Math.max(-bal, 0),
      credit: isDebitNormal ? Math.max(-bal, 0) : Math.max(bal, 0),
    };
  }), [accounts]);

  const totalTrialDebit = trialBalanceData.reduce((s, r) => s + r.debit, 0);
  const totalTrialCredit = trialBalanceData.reduce((s, r) => s + r.credit, 0);

  // Balance Sheet
  const totalAssets = totalByType("asset") + totalByType("bank") + totalByType("receivable");
  const totalLiabilities = totalByType("liability") + totalByType("payable");
  const totalEquity = totalByType("equity");

  // Aging
  const agingData = useMemo(() => {
    const today = new Date();
    const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    invoices
      .filter((i: any) => ["sent", "overdue", "partial"].includes(i.status))
      .forEach((inv: any) => {
        const diff = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000);
        const amt = Number(inv.total);
        if (diff <= 0) buckets.current += amt;
        else if (diff <= 30) buckets.days30 += amt;
        else if (diff <= 60) buckets.days60 += amt;
        else if (diff <= 90) buckets.days90 += amt;
        else buckets.over90 += amt;
      });
    return [
      { name: "Current", value: buckets.current },
      { name: "1-30 Days", value: buckets.days30 },
      { name: "31-60 Days", value: buckets.days60 },
      { name: "61-90 Days", value: buckets.days90 },
      { name: "90+ Days", value: buckets.over90 },
    ];
  }, [invoices]);

  // Staff performance (uses lightweight staffSales — only id, total, staff_id)
  const staffPerformance = useMemo(() => {
    const map: Record<string, { name: string; role: string; txCount: number; revenue: number }> = {};
    staffMembers.forEach((s: any) => { map[s.id] = { name: s.name, role: s.role, txCount: 0, revenue: 0 }; });
    staffSales.forEach((s: any) => {
      if (s.staff_id && map[s.staff_id]) {
        map[s.staff_id].txCount += 1;
        map[s.staff_id].revenue += Number(s.total);
      }
    });
    return Object.values(map)
      .map((s) => ({ ...s, avgOrder: s.txCount > 0 ? s.revenue / s.txCount : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [staffMembers, staffSales]);

  // Cash flow
  const { cashFlowData, totalInflow, totalOutflow } = useMemo(() => {
    const monthly: Record<string, { inflow: number; outflow: number }> = {};
    payments.forEach((p: any) => {
      const key = (p.date as string).slice(0, 7);
      if (!monthly[key]) monthly[key] = { inflow: 0, outflow: 0 };
      if (p.type === "incoming") monthly[key].inflow += Number(p.amount);
      else monthly[key].outflow += Number(p.amount);
    });
    const data = Object.keys(monthly).sort().map((key) => ({
      month: new Date(key + "-01").toLocaleString("en", { month: "short", year: "2-digit" }),
      inflow: monthly[key].inflow,
      outflow: monthly[key].outflow,
      net: monthly[key].inflow - monthly[key].outflow,
    }));
    const inflow = payments.filter((p: any) => p.type === "incoming").reduce((s: number, p: any) => s + Number(p.amount), 0);
    const outflow = payments.filter((p: any) => p.type === "outgoing").reduce((s: number, p: any) => s + Number(p.amount), 0);
    return { cashFlowData: data, totalInflow: inflow, totalOutflow: outflow };
  }, [payments]);

  // ── Date filter row (shared across all tabs) ──────────────────────────────
  const DateFilter = () => (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
      </div>
      {isLoading && <p className="text-xs text-muted-foreground animate-pulse pb-1">Loading…</p>}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground text-sm">Financial statements, insights and business intelligence</p>
      </div>

      <Tabs defaultValue="pnl">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pnl">P&L</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
          <TabsTrigger value="staff-perf">Staff</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="top-products">Products</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        {/* ── Profit & Loss ── */}
        <TabsContent value="pnl" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <DateFilter />
            <Button variant="outline" size="sm" onClick={() => { exportProfitLossCsv(monthlyData); toast.success("P&L exported!"); }}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
          {isLoading ? <StatSkeleton /> : (
            <div className="grid sm:grid-cols-4 gap-4">
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-display font-bold text-primary">{formatGHS(totalRevenue)}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Expenses</p><p className="text-2xl font-display font-bold text-destructive">{formatGHS(totalExpensesAmt)}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  {netProfit >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-destructive" />} Net Profit
                </p>
                <p className={`text-2xl font-display font-bold ${netProfit >= 0 ? "text-green-500" : "text-destructive"}`}>{formatGHS(netProfit)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Gross Margin</p><p className="text-2xl font-display font-bold">{grossMargin.toFixed(1)}%</p></CardContent></Card>
            </div>
          )}
          {isLoading ? <ChartSkeleton /> : monthlyData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Monthly Trends</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="month" stroke={axisColor} fontSize={12} />
                    <YAxis stroke={axisColor} fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} formatter={(v: number) => formatGHS(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(140,28%,16%)" strokeWidth={2} dot={{ r: 4 }} name="Revenue" />
                    <Line type="monotone" dataKey="expenses" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ r: 4 }} name="Expenses" />
                    <Line type="monotone" dataKey="profit" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={{ r: 4 }} name="Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Balance Sheet ── */}
        <TabsContent value="balance-sheet" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display">Balance Sheet</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {accounts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Set up your Chart of Accounts in Financials first.</p>
              ) : (
                <>
                  {[
                    { label: "ASSETS", color: "text-primary", rows: [...groupAccountsByType("asset"), ...groupAccountsByType("bank"), ...groupAccountsByType("receivable")], total: totalAssets, totalLabel: "Total Assets", totalColor: "text-primary" },
                    { label: "LIABILITIES", color: "text-destructive", rows: [...groupAccountsByType("liability"), ...groupAccountsByType("payable")], total: totalLiabilities, totalLabel: "Total Liabilities", totalColor: "text-destructive" },
                    { label: "EQUITY", color: "", rows: groupAccountsByType("equity"), total: totalEquity, totalLabel: "Total Equity", totalColor: "" },
                  ].map((section) => (
                    <div key={section.label}>
                      <h3 className={`font-semibold text-sm mb-2 ${section.color}`}>{section.label}</h3>
                      <div className="overflow-x-auto">
                      <Table>
                        <TableBody>
                          {section.rows.map((a: any) => (
                            <TableRow key={a.id}>
                              <TableCell className="text-xs text-muted-foreground w-20">{a.account_code}</TableCell>
                              <TableCell className="text-sm">{a.name}</TableCell>
                              <TableCell className="text-right font-medium">{formatGHS(Number(a.balance))}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-bold border-t-2">
                            <TableCell colSpan={2}>{section.totalLabel}</TableCell>
                            <TableCell className={`text-right ${section.totalColor}`}>{formatGHS(section.total)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      </div>
                    </div>
                  ))}
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

        {/* ── Trial Balance ── */}
        <TabsContent value="trial-balance" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display">Trial Balance</CardTitle></CardHeader>
            <CardContent>
              {trialBalanceData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No accounts found. Set up Chart of Accounts first.</p>
              ) : (
                <div className="overflow-x-auto">
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
                </div>
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

        {/* ── Cash Flow ── */}
        <TabsContent value="cash-flow" className="space-y-4">
          <DateFilter />
          <div className="grid sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Inflows</p><p className="text-2xl font-display font-bold text-green-500">{formatGHS(totalInflow)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Outflows</p><p className="text-2xl font-display font-bold text-destructive">{formatGHS(totalOutflow)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Net Cash Flow</p><p className={`text-2xl font-display font-bold ${totalInflow - totalOutflow >= 0 ? "text-green-500" : "text-destructive"}`}>{formatGHS(totalInflow - totalOutflow)}</p></CardContent></Card>
          </div>
          {cashFlowData.length > 0 ? (
            <Card>
              <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Monthly Cash Flow</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={cashFlowData}>
                    <defs>
                      <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="month" stroke={axisColor} fontSize={12} />
                    <YAxis stroke={axisColor} fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} formatter={(v: number) => formatGHS(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="inflow" stroke="hsl(142, 76%, 36%)" fill="url(#inflowGrad)" strokeWidth={2} name="Inflows" />
                    <Area type="monotone" dataKey="outflow" stroke="hsl(0, 72%, 51%)" fill="url(#outflowGrad)" strokeWidth={2} name="Outflows" />
                    <Line type="monotone" dataKey="net" stroke="hsl(140,28%,16%)" strokeWidth={2} dot={{ r: 4 }} name="Net" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No payment data in this period.</CardContent></Card>
          )}
        </TabsContent>

        {/* ── Aging ── */}
        <TabsContent value="aging" className="space-y-4">
          <DateFilter />
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
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="name" stroke={axisColor} fontSize={12} />
                  <YAxis stroke={axisColor} fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} formatter={(v: number) => formatGHS(v)} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Outstanding">
                    {agingData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Staff Performance ── */}
        <TabsContent value="staff-perf" className="space-y-4">
          <DateFilter />
          <div className="grid sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Staff Members</p><p className="text-2xl font-display font-bold">{staffMembers.length}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Avg Revenue / Staff</p>
              <p className="text-2xl font-display font-bold text-primary">{formatGHS(staffPerformance.filter((s) => s.revenue > 0).length > 0 ? totalRevenue / staffPerformance.filter((s) => s.revenue > 0).length : 0)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Top Performer</p><p className="text-lg font-display font-bold text-primary">{staffPerformance[0]?.name || "—"}</p></CardContent></Card>
          </div>
          {staffPerformance.filter((s) => s.revenue > 0).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Revenue by Staff Member</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={staffPerformance.filter((s) => s.revenue > 0).slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis type="number" stroke={axisColor} fontSize={11} tickFormatter={(v) => `₵${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={120} stroke={axisColor} fontSize={11} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} formatter={(v: number) => formatGHS(v)} />
                    <Bar dataKey="revenue" fill="hsl(140,28%,16%)" radius={[0, 6, 6, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Staff Leaderboard</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffPerformance.map((s, i) => (
                    <TableRow key={s.name}>
                      <TableCell>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                      </TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{s.role}</Badge></TableCell>
                      <TableCell className="text-right">{s.txCount}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatGHS(s.revenue)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatGHS(s.avgOrder)}</TableCell>
                    </TableRow>
                  ))}
                  {staffPerformance.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No staff data available</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sales ── */}
        <TabsContent value="sales" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <DateFilter />
            <Button variant="outline" size="sm" onClick={async () => {
              const { data } = await supabase.from("sales").select("*").eq("business_id", business!.id).gte("created_at", dateFrom).lte("created_at", dateTo + "T23:59:59").limit(5000);
              exportSalesCsv(data ?? []);
              toast.success("Sales exported!");
            }}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
          {isLoading ? <StatSkeleton /> : (
            <div className="grid sm:grid-cols-3 gap-4">
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-display font-bold text-primary">{formatGHS(totalRevenue)}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Avg. Order Value</p><p className="text-2xl font-display font-bold">{formatGHS(reportSummary?.avgSaleValue ?? 0)}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Transactions</p><p className="text-2xl font-display font-bold">{reportSummary?.saleCount ?? 0}</p></CardContent></Card>
            </div>
          )}
          {isLoading ? <ChartSkeleton /> : monthlyData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Sales vs Expenses</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="month" stroke={axisColor} />
                    <YAxis stroke={axisColor} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} formatter={(v: number) => formatGHS(v)} />
                    <Bar dataKey="revenue" fill="hsl(140,28%,16%)" radius={[6, 6, 0, 0]} name="Sales" />
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
                    <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} formatter={(v: number) => formatGHS(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Top Products ── */}
        <TabsContent value="top-products" className="space-y-4">
          <DateFilter />
          {itemsLoading ? <ChartSkeleton /> : (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> Top Selling Products</CardTitle></CardHeader>
                  <CardContent>
                    {topProducts.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No sales in this period</p>
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
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis type="number" stroke={axisColor} fontSize={11} tickFormatter={(v) => `₵${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="name" width={100} stroke={axisColor} fontSize={11} />
                          <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} formatter={(v: number) => formatGHS(v)} />
                          <Bar dataKey="revenue" fill="hsl(140,28%,16%)" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Margin per SKU */}
              {skuMargins.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><TrendingUp className="h-5 w-5 text-green-500" /> Margin Analysis (Sold SKUs)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Sell Price</TableHead>
                          <TableHead className="text-right">Margin %</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {skuMargins.slice(0, 10).map((p) => (
                          <TableRow key={p.name}>
                            <TableCell className="font-medium text-sm">{p.name}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{formatGHS(p.cost)}</TableCell>
                            <TableCell className="text-right">{formatGHS(p.sell)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className={`${p.marginPct >= 30 ? "text-green-500 border-green-500/40" : p.marginPct >= 15 ? "text-[#2d7a44] border-[#2d7a44]/40" : "text-destructive border-destructive/40"}`}>
                                {p.marginPct.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-primary">{formatGHS(p.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Bottom Sellers */}
                {bottomSellers.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><TrendingDown className="h-5 w-5 text-orange-500" /> Slowest Movers</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {bottomSellers.map((p) => (
                          <div key={p.name} className="flex items-center justify-between rounded-lg bg-orange-500/5 border border-orange-500/10 px-3 py-2">
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.qty} units sold</p>
                            </div>
                            <span className="text-sm font-bold text-orange-500">{formatGHS(p.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Dead Stock */}
                {deadStock.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><TrendingDown className="h-5 w-5 text-destructive" /> Dead Stock (no sales)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-[280px] overflow-y-auto">
                        {deadStock.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between rounded-lg bg-destructive/5 border border-destructive/10 px-3 py-2">
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.qty} units in stock</p>
                            </div>
                            <span className="text-sm font-bold text-destructive">{formatGHS(Number(p.selling_price) * p.qty)}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{deadStock.length} product{deadStock.length !== 1 ? "s" : ""} with no sales in selected period</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Inventory ── */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { exportInventoryCsv(products); toast.success("Inventory exported!"); }}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
          <div className="grid sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Products</p><p className="text-2xl font-display font-bold">{products.length}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Retail Value</p><p className="text-2xl font-display font-bold text-primary">{formatGHS(totalInventoryValue)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Cost Value</p><p className="text-2xl font-display font-bold">{formatGHS(totalCostValue)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Low Stock</p><p className="text-2xl font-display font-bold text-destructive">{products.filter((p: any) => p.qty <= p.reorder_level).length}</p></CardContent></Card>
          </div>
        </TabsContent>

        {/* ── Expenses ── */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <DateFilter />
            <Button variant="outline" size="sm" onClick={() => { exportExpensesCsv(expenses as any[]); toast.success("Expenses exported!"); }}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
          {expensesLoading ? <StatSkeleton /> : (
            <div className="grid sm:grid-cols-3 gap-4">
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Expenses</p><p className="text-2xl font-display font-bold text-destructive">{formatGHS(totalExpensesAmt)}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Net Profit</p><p className={`text-2xl font-display font-bold ${netProfit >= 0 ? "text-green-500" : "text-destructive"}`}>{formatGHS(netProfit)}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Expense Categories</p><p className="text-2xl font-display font-bold">{expenseCatData.length}</p></CardContent></Card>
            </div>
          )}
          {expenseCatData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Expenses by Category</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={expenseCatData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${formatGHS(value)}`}>
                      {expenseCatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} formatter={(v: number) => formatGHS(v)} />
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
