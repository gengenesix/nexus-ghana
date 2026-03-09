import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatGHS } from "@/lib/ghana";
import {
  ShoppingCart, FileText, AlertTriangle, Users, Plus, TrendingUp, ArrowRight,
  Briefcase, Receipt, Factory, CreditCard,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { useNavigate } from "react-router-dom";

const COLORS = ["hsl(37, 90%, 55%)", "hsl(210, 92%, 45%)", "hsl(142, 76%, 36%)", "hsl(215, 15%, 55%)", "hsl(0, 72%, 51%)"];
const tooltipStyle = { background: "hsl(220, 35%, 12%)", border: "1px solid hsl(220, 20%, 20%)", borderRadius: 8, color: "hsl(210, 40%, 96%)" };

export default function Dashboard() {
  const navigate = useNavigate();
  const { business } = useBusiness();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", business?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const [todaySales, unpaidInvoices, lowStockItems, totalCustomers, openLeads, openPOs, activeProduction, bankAccounts] = await Promise.all([
        supabase.from("sales").select("total").eq("business_id", business!.id).gte("created_at", today),
        supabase.from("invoices").select("total, status").eq("business_id", business!.id).in("status", ["sent", "overdue", "partial"]),
        supabase.from("products").select("id, name, qty, reorder_level").eq("business_id", business!.id),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", business!.id),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("business_id", business!.id).in("status", ["new", "contacted", "qualified"]),
        supabase.from("purchase_orders").select("total, status").eq("business_id", business!.id).in("status", ["draft", "sent", "confirmed"]),
        supabase.from("production_orders").select("id", { count: "exact", head: true }).eq("business_id", business!.id).in("status", ["planned", "in_progress"]),
        supabase.from("bank_accounts").select("balance, name").eq("business_id", business!.id).eq("is_active", true),
      ]);
      return {
        todayTotal: (todaySales.data || []).reduce((s, r) => s + Number(r.total), 0),
        todayCount: todaySales.data?.length ?? 0,
        unpaidCount: unpaidInvoices.data?.length ?? 0,
        unpaidTotal: (unpaidInvoices.data || []).reduce((s, i) => s + Number(i.total), 0),
        lowStock: (lowStockItems.data || []).filter(p => p.qty <= p.reorder_level),
        customerCount: totalCustomers.count ?? 0,
        openLeads: openLeads.count ?? 0,
        openPOsTotal: (openPOs.data || []).reduce((s, p) => s + Number(p.total), 0),
        openPOsCount: openPOs.data?.length ?? 0,
        activeProduction: activeProduction.count ?? 0,
        totalBankBalance: (bankAccounts.data || []).reduce((s, b) => s + Number(b.balance), 0),
        bankAccountCount: bankAccounts.data?.length ?? 0,
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
        .limit(10);
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Enterprise overview — {business?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/pos")} size="sm" className="gold-gradient text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> New Sale
          </Button>
          <Button onClick={() => navigate("/invoices")} size="sm" variant="secondary">
            <FileText className="h-4 w-4 mr-1" /> New Invoice
          </Button>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Sales" value={formatGHS(stats?.todayTotal ?? 0)} icon={ShoppingCart} trend={`${stats?.todayCount ?? 0} transactions`} trendUp={(stats?.todayTotal ?? 0) > 0} />
        <StatCard title="Unpaid Invoices" value={String(stats?.unpaidCount ?? 0)} icon={FileText} trend={`${formatGHS(stats?.unpaidTotal ?? 0)} outstanding`} />
        <StatCard title="Low Stock Items" value={String(stats?.lowStock?.length ?? 0)} icon={AlertTriangle} trend={(stats?.lowStock?.length ?? 0) > 0 ? "Needs reorder" : "All stocked"} />
        <StatCard title="Total Customers" value={String(stats?.customerCount ?? 0)} icon={Users} trend="All time" trendUp={(stats?.customerCount ?? 0) > 0} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/modules/crm")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.openLeads ?? 0}</p>
              <p className="text-xs text-muted-foreground">Open Leads</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/modules/purchasing")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.openPOsCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Open POs ({formatGHS(stats?.openPOsTotal ?? 0)})</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/modules/production")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Factory className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.activeProduction ?? 0}</p>
              <p className="text-xs text-muted-foreground">Active Production</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/modules/banking")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatGHS(stats?.totalBankBalance ?? 0)}</p>
              <p className="text-xs text-muted-foreground">{stats?.bankAccountCount ?? 0} Bank Accounts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Weekly Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weeklySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 20%)" />
                <XAxis dataKey="day" stroke="hsl(215, 15%, 55%)" fontSize={12} />
                <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatGHS(value), "Sales"]} />
                <Bar dataKey="sales" fill="hsl(37, 90%, 55%)" radius={[6, 6, 0, 0]} />
              </BarChart>
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
              (stats?.lowStock ?? []).slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-destructive/10 text-xs font-bold text-destructive">{p.qty}</span>
                    <span className="truncate max-w-[130px]">{p.name}</span>
                  </div>
                  <span className="text-muted-foreground">/ {p.reorder_level}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

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
              <div className="space-y-3">
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

        {paymentData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value">
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
  );
}
