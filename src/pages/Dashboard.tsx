import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatGHS } from "@/lib/ghana";
import {
  ShoppingCart, FileText, Package, Users, Plus, TrendingUp, AlertTriangle, ArrowRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const navigate = useNavigate();
  const { business } = useBusiness();

  const { data: products = [] } = useQuery({
    queryKey: ["products", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("business_id", business!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-count", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id").eq("business_id", business!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices-summary", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").eq("business_id", business!.id).in("status", ["sent", "overdue", "partial"]);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: recentSales = [] } = useQuery({
    queryKey: ["recent-sales", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, customers(name)")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: todaySales = [] } = useQuery({
    queryKey: ["today-sales", business?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("sales")
        .select("total")
        .eq("business_id", business!.id)
        .gte("created_at", today);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  // Weekly sales for chart
  const { data: weeklySales = [] } = useQuery({
    queryKey: ["weekly-sales", business?.id],
    queryFn: async () => {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const now = new Date();
      const result = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().split("T")[0];
        const nextDay = new Date(d);
        nextDay.setDate(nextDay.getDate() + 1);
        const { data } = await supabase
          .from("sales")
          .select("total")
          .eq("business_id", business!.id)
          .gte("created_at", dayStr)
          .lt("created_at", nextDay.toISOString().split("T")[0]);
        const totalSales = (data || []).reduce((s, r) => s + Number(r.total), 0);
        result.push({ day: days[d.getDay()], sales: totalSales });
      }
      return result;
    },
    enabled: !!business,
  });

  const todayTotal = todaySales.reduce((s, r) => s + Number(r.total), 0);
  const lowStock = products.filter(p => p.qty <= p.reorder_level);
  const unpaidTotal = invoices.reduce((s, i) => s + Number(i.total), 0);

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
        <StatCard title="Today's Sales" value={formatGHS(todayTotal)} icon={ShoppingCart} trend={`${todaySales.length} transactions`} trendUp={todayTotal > 0} />
        <StatCard title="Unpaid Invoices" value={String(invoices.length)} icon={FileText} trend={`${formatGHS(unpaidTotal)} outstanding`} />
        <StatCard title="Low Stock Items" value={String(lowStock.length)} icon={AlertTriangle} trend={lowStock.length > 0 ? "Needs reorder" : "All stocked"} />
        <StatCard title="Total Customers" value={String(customers.length)} icon={Users} trend="All time" trendUp={customers.length > 0} />
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
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">All products well stocked ✅</p>
            ) : (
              lowStock.slice(0, 5).map((p, i) => (
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
