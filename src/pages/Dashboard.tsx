import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatGHS } from "@/lib/ghana";
import {
  ShoppingCart, FileText, AlertTriangle, Users, Plus, TrendingUp, ArrowRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const { business } = useBusiness();

  // Single efficient query for stats — counts only, no full row fetches
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", business?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const [todaySales, unpaidInvoices, lowStockItems, totalCustomers] = await Promise.all([
        supabase.from("sales").select("total").eq("business_id", business!.id).gte("created_at", today),
        supabase.from("invoices").select("total, status").eq("business_id", business!.id).in("status", ["sent", "overdue", "partial"]),
        supabase.from("products").select("id, name, qty, reorder_level").eq("business_id", business!.id),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", business!.id),
      ]);
      return {
        todayTotal: (todaySales.data || []).reduce((s, r) => s + Number(r.total), 0),
        todayCount: todaySales.data?.length ?? 0,
        unpaidCount: unpaidInvoices.data?.length ?? 0,
        unpaidTotal: (unpaidInvoices.data || []).reduce((s, i) => s + Number(i.total), 0),
        lowStock: (lowStockItems.data || []).filter(p => p.qty <= p.reorder_level),
        customerCount: totalCustomers.count ?? 0,
      };
    },
    enabled: !!business,
    staleTime: 30_000,
  });

  // Recent sales — limited to 10
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

  // Weekly chart — single RPC call aggregated in DB
  const { data: weeklySales = [] } = useQuery({
    queryKey: ["weekly-sales", business?.id],
    queryFn: async () => {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("sales")
        .select("total, created_at")
        .eq("business_id", business!.id)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at");

      if (error) throw error;

      // Aggregate client-side from a single query
      const buckets: Record<string, number> = {};
      const result = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        buckets[key] = 0;
        result.push({ day: days[d.getDay()], date: key, sales: 0 });
      }
      (data || []).forEach((s) => {
        const key = s.created_at.split("T")[0];
        if (buckets[key] !== undefined) buckets[key] += Number(s.total);
      });
      return result.map((r) => ({ ...r, sales: buckets[r.date] ?? 0 }));
    },
    enabled: !!business,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of your business performance</p>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Sales" value={formatGHS(stats?.todayTotal ?? 0)} icon={ShoppingCart} trend={`${stats?.todayCount ?? 0} transactions`} trendUp={(stats?.todayTotal ?? 0) > 0} />
        <StatCard title="Unpaid Invoices" value={String(stats?.unpaidCount ?? 0)} icon={FileText} trend={`${formatGHS(stats?.unpaidTotal ?? 0)} outstanding`} />
        <StatCard title="Low Stock Items" value={String(stats?.lowStock?.length ?? 0)} icon={AlertTriangle} trend={(stats?.lowStock?.length ?? 0) > 0 ? "Needs reorder" : "All stocked"} />
        <StatCard title="Total Customers" value={String(stats?.customerCount ?? 0)} icon={Users} trend="All time" trendUp={(stats?.customerCount ?? 0) > 0} />
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
                <Tooltip
                  contentStyle={{ background: "hsl(220, 35%, 12%)", border: "1px solid hsl(220, 20%, 20%)", borderRadius: 8, color: "hsl(210, 40%, 96%)" }}
                  formatter={(value: number) => [formatGHS(value), "Sales"]}
                />
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

      <Card>
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
    </div>
  );
}
