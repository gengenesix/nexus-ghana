import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatGHS } from "@/lib/ghana";
import {
  ShoppingCart, FileText, AlertTriangle, Users, Plus, TrendingUp, TrendingDown, ArrowRight,
  Briefcase, Receipt, Factory, CreditCard, Target, Percent, Clock, Package, Handshake,
  CalendarDays, DollarSign, Activity,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { useNavigate } from "react-router-dom";
import { format, subDays, differenceInDays } from "date-fns";
import { useMemo } from "react";

const COLORS = ["hsl(37, 90%, 55%)", "hsl(210, 92%, 45%)", "hsl(142, 76%, 36%)", "hsl(215, 15%, 55%)", "hsl(0, 72%, 51%)"];
const tooltipStyle = { background: "hsl(220, 35%, 12%)", border: "1px solid hsl(220, 20%, 20%)", borderRadius: 8, color: "hsl(210, 40%, 96%)" };

export default function Dashboard() {
  const navigate = useNavigate();
  const { business } = useBusiness();
  const { staff } = useStaffSession();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", business?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const [todaySales, yesterdaySales, unpaidInvoices, lowStockItems, totalCustomers, openLeads, openPOs, activeProduction, bankAccounts, monthExpenses, opportunities] = await Promise.all([
        supabase.from("sales").select("total").eq("business_id", business!.id).gte("created_at", today),
        supabase.from("sales").select("total").eq("business_id", business!.id).gte("created_at", yesterday).lt("created_at", today),
        supabase.from("invoices").select("total, status, due_date").eq("business_id", business!.id).in("status", ["sent", "overdue", "partial"]),
        supabase.from("products").select("id, name, qty, reorder_level, cost_price, selling_price").eq("business_id", business!.id),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", business!.id),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("business_id", business!.id).in("status", ["new", "contacted", "qualified"]),
        supabase.from("purchase_orders").select("total, status").eq("business_id", business!.id).in("status", ["draft", "sent", "confirmed"]),
        supabase.from("production_orders").select("id", { count: "exact", head: true }).eq("business_id", business!.id).in("status", ["planned", "in_progress"]),
        supabase.from("bank_accounts").select("balance, name").eq("business_id", business!.id).eq("is_active", true),
        supabase.from("expenses").select("amount").eq("business_id", business!.id).gte("date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]),
        supabase.from("opportunities").select("stage, value, status").eq("business_id", business!.id).eq("status", "open"),
      ]);
      const todayTotal = (todaySales.data || []).reduce((s, r) => s + Number(r.total), 0);
      const yesterdayTotal = (yesterdaySales.data || []).reduce((s, r) => s + Number(r.total), 0);
      const products = lowStockItems.data || [];
      const totalCost = products.reduce((s, p) => s + Number(p.cost_price) * p.qty, 0);
      const totalRetail = products.reduce((s, p) => s + Number(p.selling_price) * p.qty, 0);
      const monthExpTotal = (monthExpenses.data || []).reduce((s, e) => s + Number(e.amount), 0);

      // Invoice aging
      const unpaidList = unpaidInvoices.data || [];
      const overdue = unpaidList.filter(i => i.due_date < today);
      const overdueTotal = overdue.reduce((s, i) => s + Number(i.total), 0);

      // Opportunities pipeline
      const opps = opportunities.data || [];
      const pipelineValue = opps.reduce((s, o) => s + Number(o.value || 0), 0);
      const stageMap: Record<string, { count: number; value: number }> = {};
      opps.forEach((o: any) => {
        if (!stageMap[o.stage]) stageMap[o.stage] = { count: 0, value: 0 };
        stageMap[o.stage].count++;
        stageMap[o.stage].value += Number(o.value || 0);
      });

      return {
        todayTotal,
        todayCount: todaySales.data?.length ?? 0,
        yesterdayTotal,
        growthPct: yesterdayTotal > 0 ? ((todayTotal - yesterdayTotal) / yesterdayTotal * 100) : todayTotal > 0 ? 100 : 0,
        unpaidCount: unpaidList.length,
        unpaidTotal: unpaidList.reduce((s, i) => s + Number(i.total), 0),
        overdueCount: overdue.length,
        overdueTotal,
        lowStock: products.filter(p => p.qty <= p.reorder_level),
        outOfStock: products.filter(p => p.qty === 0).length,
        customerCount: totalCustomers.count ?? 0,
        openLeads: openLeads.count ?? 0,
        openPOsTotal: (openPOs.data || []).reduce((s, p) => s + Number(p.total), 0),
        openPOsCount: openPOs.data?.length ?? 0,
        activeProduction: activeProduction.count ?? 0,
        totalBankBalance: (bankAccounts.data || []).reduce((s, b) => s + Number(b.balance), 0),
        bankAccountCount: bankAccounts.data?.length ?? 0,
        inventoryCost: totalCost,
        inventoryRetail: totalRetail,
        profitMargin: totalRetail > 0 ? ((totalRetail - totalCost) / totalRetail * 100) : 0,
        monthExpenses: monthExpTotal,
        pipelineValue,
        pipelineCount: opps.length,
        pipelineStages: stageMap,
        totalProducts: products.length,
      };
    },
    enabled: !!business,
    staleTime: 30_000,
  });

  const { data: recentSales = [] } = useQuery({
    queryKey: ["recent-sales", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, total, payment_method, created_at, customers(name)")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
    staleTime: 30_000,
  });

  // Recent activity feed - combine recent invoices and expenses
  const { data: recentInvoices = [] } = useQuery({
    queryKey: ["recent-invoices-dash", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("id, invoice_number, customer_name, total, status, created_at").eq("business_id", business!.id).order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
    staleTime: 30_000,
  });

  const { data: weeklySales = [] } = useQuery({
    queryKey: ["weekly-sales", business?.id],
    queryFn: async () => {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      const { data, error } = await supabase.from("sales").select("total, created_at").eq("business_id", business!.id).gte("created_at", sevenDaysAgo.toISOString()).order("created_at");
      if (error) throw error;
      const buckets: Record<string, number> = {};
      const result = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        buckets[key] = 0;
        result.push({ day: days[d.getDay()], date: key, sales: 0 });
      }
      (data || []).forEach((s) => { const key = s.created_at.split("T")[0]; if (buckets[key] !== undefined) buckets[key] += Number(s.total); });
      return result.map((r) => ({ ...r, sales: buckets[r.date] ?? 0 }));
    },
    enabled: !!business,
    staleTime: 60_000,
  });

  // Payment method breakdown for pie chart
  const paymentMap: Record<string, number> = {};
  recentSales.forEach((s: any) => { paymentMap[s.payment_method] = (paymentMap[s.payment_method] || 0) + Number(s.total); });
  const paymentData = Object.entries(paymentMap).map(([name, value]) => ({ name, value }));

  // Pipeline stages for mini chart
  const pipelineData = useMemo(() => {
    if (!stats?.pipelineStages) return [];
    const stageOrder = ["prospecting", "qualification", "proposal", "negotiation", "closed_won"];
    return stageOrder.filter(s => stats.pipelineStages[s]).map(s => ({
      stage: s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()),
      value: stats.pipelineStages[s].value,
      count: stats.pipelineStages[s].count,
    }));
  }, [stats?.pipelineStages]);

  const growthPct = stats?.growthPct ?? 0;
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">
            {greeting}{staff ? `, ${staff.name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-muted-foreground text-sm">{business?.name} — {format(new Date(), "EEEE, d MMMM yyyy")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => navigate("/pos")} size="sm" className="gold-gradient text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> New Sale
          </Button>
          <Button onClick={() => navigate("/invoices")} size="sm" variant="secondary">
            <FileText className="h-4 w-4 mr-1" /> New Invoice
          </Button>
          <Button onClick={() => navigate("/expenses")} size="sm" variant="outline">
            <Receipt className="h-4 w-4 mr-1" /> Log Expense
          </Button>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={formatGHS(stats?.todayTotal ?? 0)}
          icon={ShoppingCart}
          trend={growthPct !== 0 ? `${growthPct > 0 ? "+" : ""}${growthPct.toFixed(0)}% vs yesterday` : `${stats?.todayCount ?? 0} transactions`}
          trendUp={growthPct >= 0}
        />
        <StatCard title="Unpaid Invoices" value={String(stats?.unpaidCount ?? 0)} icon={FileText} trend={`${formatGHS(stats?.unpaidTotal ?? 0)} outstanding`} />
        <StatCard title="Low Stock Items" value={String(stats?.lowStock?.length ?? 0)} icon={AlertTriangle} trend={stats?.outOfStock ? `${stats.outOfStock} out of stock` : "All stocked"} />
        <StatCard title="Total Customers" value={String(stats?.customerCount ?? 0)} icon={Users} trend="All time" trendUp={(stats?.customerCount ?? 0) > 0} />
      </div>

      {/* Financial snapshot row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Percent className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{(stats?.profitMargin ?? 0).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Inventory Margin</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Package className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{formatGHS(stats?.inventoryRetail ?? 0)}</p>
                <p className="text-xs text-muted-foreground">{stats?.totalProducts ?? 0} Products (Retail)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                {(stats?.monthExpenses ?? 0) > (stats?.todayTotal ?? 0) * 30
                  ? <TrendingDown className="h-5 w-5 text-destructive" />
                  : <TrendingUp className="h-5 w-5 text-green-500" />}
              </div>
              <div>
                <p className="text-2xl font-bold">{formatGHS(stats?.monthExpenses ?? 0)}</p>
                <p className="text-xs text-muted-foreground">This Month Expenses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/banking")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><CreditCard className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{formatGHS(stats?.totalBankBalance ?? 0)}</p>
                <p className="text-xs text-muted-foreground">{stats?.bankAccountCount ?? 0} Bank Accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/crm")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Briefcase className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.openLeads ?? 0}</p>
              <p className="text-xs text-muted-foreground">Open Leads</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/opportunities")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Handshake className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.pipelineCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Pipeline ({formatGHS(stats?.pipelineValue ?? 0)})</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/purchasing")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Receipt className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.openPOsCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Open POs ({formatGHS(stats?.openPOsTotal ?? 0)})</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/production")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Factory className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{stats?.activeProduction ?? 0}</p>
              <p className="text-xs text-muted-foreground">Active Production</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Weekly Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={weeklySales}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(37, 90%, 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(37, 90%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 20%)" />
                <XAxis dataKey="day" stroke="hsl(215, 15%, 55%)" fontSize={12} />
                <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatGHS(value), "Sales"]} />
                <Area type="monotone" dataKey="sales" stroke="hsl(37, 90%, 55%)" strokeWidth={2} fill="url(#salesGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(stats?.lowStock?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">All products well stocked ✅</p>
            ) : (
              <>
                {(stats?.lowStock ?? []).slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${p.qty === 0 ? "bg-destructive/20 text-destructive" : "bg-destructive/10 text-destructive"}`}>{p.qty}</span>
                      <span className="truncate max-w-[130px]">{p.name}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">min {p.reorder_level}</span>
                  </div>
                ))}
                {(stats?.lowStock?.length ?? 0) > 6 && (
                  <Button variant="ghost" size="sm" className="w-full text-primary" onClick={() => navigate("/inventory")}>
                    View all {stats?.lowStock?.length} items <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity & Pipeline Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/reports")} className="text-primary">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No transactions yet. Make your first sale!</p>
            ) : (
              <div className="space-y-2.5">
                {recentSales.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{tx.customers?.name || "Walk-in"}</p>
                      <p className="text-xs text-muted-foreground">{tx.payment_method} · {new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                    <span className="font-display font-semibold text-primary">{formatGHS(Number(tx.total))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Overdue Warning */}
          {(stats?.overdueCount ?? 0) > 0 && (
            <Card className="border-destructive/30 bg-destructive/5 cursor-pointer" onClick={() => navigate("/invoices")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10"><Clock className="h-5 w-5 text-destructive" /></div>
                  <div>
                    <p className="text-sm font-semibold text-destructive">{stats?.overdueCount} Overdue Invoices</p>
                    <p className="text-xs text-muted-foreground">{formatGHS(stats?.overdueTotal ?? 0)} outstanding</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent invoices */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Recent Invoices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No invoices yet</p>
              ) : recentInvoices.slice(0, 4).map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{inv.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{inv.invoice_number}</p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-medium">{formatGHS(Number(inv.total))}</p>
                    <Badge variant="outline" className="text-xs capitalize">{inv.status}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {paymentData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={5} dataKey="value">
                      {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatGHS(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {paymentData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="capitalize">{d.name}</span>
                      </div>
                      <span className="text-muted-foreground">{formatGHS(d.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Pipeline Summary */}
      {pipelineData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-base">Sales Pipeline</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/opportunities")} className="text-primary">
              View Pipeline <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {pipelineData.map((stage, i) => (
                <div key={stage.stage} className="flex-1 min-w-[120px] rounded-lg bg-secondary/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{stage.stage}</p>
                  <p className="text-lg font-bold">{stage.count}</p>
                  <p className="text-xs text-primary">{formatGHS(stage.value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Navigation */}
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {[
              { label: "POS", icon: ShoppingCart, path: "/pos" },
              { label: "Inventory", icon: Package, path: "/inventory" },
              { label: "Customers", icon: Users, path: "/customers" },
              { label: "Reports", icon: TrendingUp, path: "/reports" },
              { label: "Financials", icon: DollarSign, path: "/financials" },
              { label: "Settings", icon: CalendarDays, path: "/settings" },
            ].map(action => (
              <Button key={action.label} variant="outline" className="h-16 flex-col gap-1.5" onClick={() => navigate(action.path)}>
                <action.icon className="h-5 w-5" />
                <span className="text-xs">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
