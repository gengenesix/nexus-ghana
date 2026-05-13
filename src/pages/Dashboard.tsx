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
  CalendarDays, DollarSign, Activity, XCircle,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useChartColors } from "@/hooks/useChartColors";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const COLORS = ["hsl(140,28%,16%)", "hsl(86,68%,52%)", "hsl(142,60%,38%)", "hsl(210,70%,48%)", "hsl(0,72%,51%)"];

export default function Dashboard() {
  const navigate = useNavigate();
  const { business } = useBusiness();
  const { staff } = useStaffSession();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_business_id: business!.id,
      });
      if (error) throw error;
      const d = data as any;
      const todayTotal     = Number(d.today_total     ?? 0);
      const yesterdayTotal = Number(d.yesterday_total ?? 0);
      const invRetail      = Number(d.inv_retail      ?? 0);
      const invCost        = Number(d.inv_cost        ?? 0);
      return {
        todayTotal,
        todayCount:       Number(d.today_count       ?? 0),
        yesterdayTotal,
        growthPct: yesterdayTotal > 0
          ? ((todayTotal - yesterdayTotal) / yesterdayTotal * 100)
          : todayTotal > 0 ? 100 : 0,
        unpaidCount:      Number(d.unpaid_count      ?? 0),
        unpaidTotal:      Number(d.unpaid_total      ?? 0),
        overdueCount:     Number(d.overdue_count     ?? 0),
        overdueTotal:     Number(d.overdue_total     ?? 0),
        lowStock:         (d.low_stock               ?? []) as any[],
        outOfStock:       Number(d.out_of_stock      ?? 0),
        customerCount:    Number(d.customer_count    ?? 0),
        openLeads:        Number(d.open_leads        ?? 0),
        openPOsTotal:     Number(d.open_pos_total    ?? 0),
        openPOsCount:     Number(d.open_pos_count    ?? 0),
        activeProduction: Number(d.active_production ?? 0),
        totalBankBalance: Number(d.bank_balance      ?? 0),
        bankAccountCount: Number(d.bank_count        ?? 0),
        inventoryCost:    invCost,
        inventoryRetail:  invRetail,
        profitMargin: invRetail > 0 ? ((invRetail - invCost) / invRetail * 100) : 0,
        monthExpenses:    Number(d.month_expenses    ?? 0),
        pipelineValue:    Number(d.pipeline_value    ?? 0),
        pipelineCount:    Number(d.pipeline_count    ?? 0),
        pipelineStages:   (d.pipeline_stages         ?? {}) as Record<string, { count: number; value: number }>,
        totalProducts:    Number(d.total_products    ?? 0),
      };
    },
    enabled: !!business,
    staleTime: 30_000,
  });

  const queryClient = useQueryClient();

  const { data: recentSales = [] } = useQuery({
    queryKey: ["recent-sales", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, total, payment_method, created_at, voided, customers(name)")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
    staleTime: 30_000,
  });

  const voidSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase.rpc("void_sale", {
        p_sale_id: saleId,
        p_business_id: business!.id,
        p_staff_id: staff?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-sales", business?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats", business?.id] });
    },
    onError: (err: any) => {
      const msg = err?.message ?? "Failed to void sale";
      if (msg.includes("Insufficient permissions")) {
        toast.error("Only managers can void sales.");
      } else {
        toast.error(msg);
      }
    },
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

  // Live updates — invalidate when a new sale lands on any device
  useRealtimeInvalidate("sales", [
    ["dashboard-stats", business?.id],
    ["recent-sales", business?.id],
    ["weekly-sales", business?.id],
  ]);

  const growthPct = stats?.growthPct ?? 0;
  const { tooltipStyle, gridColor, axisColor } = useChartColors();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <div className="space-y-6">
      <motion.div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
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
      </motion.div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Today's Sales", value: formatGHS(stats?.todayTotal ?? 0), icon: ShoppingCart, trend: growthPct !== 0 ? `${growthPct > 0 ? "+" : ""}${growthPct.toFixed(0)}% vs yesterday` : `${stats?.todayCount ?? 0} transactions`, trendUp: growthPct >= 0 },
          { title: "Unpaid Invoices", value: String(stats?.unpaidCount ?? 0), icon: FileText, trend: `${formatGHS(stats?.unpaidTotal ?? 0)} outstanding` },
          { title: "Low Stock Items", value: String(stats?.lowStock?.length ?? 0), icon: AlertTriangle, trend: stats?.outOfStock ? `${stats.outOfStock} out of stock` : "All stocked" },
          { title: "Total Customers", value: String(stats?.customerCount ?? 0), icon: Users, trend: "All time", trendUp: (stats?.customerCount ?? 0) > 0 },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + i * 0.07 }}
          >
            <StatCard {...card} />
          </motion.div>
        ))}
      </div>

      {/* Financial snapshot row */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.42 }}
      >
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
      </motion.div>

      {/* Secondary KPIs */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.55 }}
      >
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
      </motion.div>

      {/* Charts Row */}
      <motion.div
        className="grid lg:grid-cols-3 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.65 }}
      >
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
                    <stop offset="5%" stopColor="hsl(140,28%,16%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(140,28%,16%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="day" stroke={axisColor} fontSize={12} />
                <YAxis stroke={axisColor} fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatGHS(value), "Sales"]} />
                <Area type="monotone" dataKey="sales" stroke="hsl(140,28%,16%)" strokeWidth={2} fill="url(#salesGradient)" />
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
      </motion.div>

      {/* Activity & Pipeline Row */}
      <motion.div
        className="grid lg:grid-cols-3 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.75 }}
      >
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
                  <div key={tx.id} className={`flex items-center justify-between rounded-lg px-4 py-3 ${tx.voided ? "bg-muted/30 opacity-60" : "bg-secondary/50"}`}>
                    <div>
                      <p className={`text-sm font-medium ${tx.voided ? "line-through text-muted-foreground" : ""}`}>{tx.customers?.name || "Walk-in"}</p>
                      <p className="text-xs text-muted-foreground">{tx.payment_method} · {new Date(tx.created_at).toLocaleString()}</p>
                      {tx.voided && <p className="text-xs text-destructive">Voided</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-display font-semibold ${tx.voided ? "line-through text-muted-foreground" : "text-primary"}`}>{formatGHS(Number(tx.total))}</span>
                      {!tx.voided && (
                        <button
                          title="Void sale"
                          onClick={() => voidSaleMutation.mutate(tx.id)}
                          disabled={voidSaleMutation.isPending}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
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
      </motion.div>

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
