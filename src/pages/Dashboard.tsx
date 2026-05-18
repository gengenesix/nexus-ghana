import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { useIndustry } from "@/hooks/useIndustry";
import { useIndustryDashboard } from "@/hooks/useIndustryDashboard";
import { IndustryBanner } from "@/components/dashboard/IndustryBanner";
import { IndustryKpiGrid } from "@/components/dashboard/IndustryKpiGrid";
import { IndustryQuickActions } from "@/components/dashboard/IndustryQuickActions";
import { IndustryAlerts } from "@/components/dashboard/IndustryAlerts";
import { StaffDashboard } from "@/components/dashboard/StaffDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatGHS } from "@/lib/ghana";
import {
  TrendingUp, ArrowRight, Activity, XCircle, Clock,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useChartColors } from "@/hooks/useChartColors";
import { toast } from "sonner";

const PIE_COLORS = [
  "hsl(86,68%,52%)", "hsl(140,38%,36%)", "hsl(142,60%,50%)",
  "hsl(210,70%,55%)", "hsl(0,72%,55%)",
];

export default function Dashboard() {
  const navigate     = useNavigate();
  const { business } = useBusiness();
  const { staff, ownerBypass }    = useStaffSession();
  const { industry, slug } = useIndustry();
  const { stats, kpiCards, quickActions, isLoading } = useIndustryDashboard();
  const queryClient  = useQueryClient();
  const { tooltipStyle, gridColor, axisColor, primaryColor, gradientStart } = useChartColors();

  // ── Recent sales ───────────────────────────────────────────────────────────
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

  // ── Void sale ──────────────────────────────────────────────────────────────
  const voidSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase.rpc("void_sale", {
        p_sale_id:    saleId,
        p_business_id: business!.id,
        p_staff_id:   staff?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-sales",     business?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats",  business?.id] });
      queryClient.invalidateQueries({ queryKey: ["industry-kpis",    business?.id] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to void sale";
      if (msg.includes("Insufficient permissions")) {
        toast.error("Only managers can void sales.");
      } else {
        toast.error(msg);
      }
    },
  });

  // ── Recent invoices ────────────────────────────────────────────────────────
  const { data: recentInvoices = [] } = useQuery({
    queryKey: ["recent-invoices-dash", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, customer_name, total, status, created_at")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
    staleTime: 30_000,
  });

  // ── Weekly sales chart ─────────────────────────────────────────────────────
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

  // ── Payment method pie ─────────────────────────────────────────────────────
  const paymentData = useMemo(() => {
    const map: Record<string, number> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentSales.forEach((s: any) => {
      map[s.payment_method] = (map[s.payment_method] || 0) + Number(s.total);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [recentSales]);

  // ── Pipeline stages ────────────────────────────────────────────────────────
  const pipelineData = useMemo(() => {
    if (!stats?.pipelineStages) return [];
    const order = ["prospecting", "qualification", "proposal", "negotiation", "closed_won"];
    return order
      .filter((s) => stats.pipelineStages[s])
      .map((s) => ({
        stage: s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: stats.pipelineStages[s].value,
        count: stats.pipelineStages[s].count,
      }));
  }, [stats?.pipelineStages]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useRealtimeInvalidate("sales", [
    ["dashboard-stats",  business?.id],
    ["industry-kpis",    business?.id],
    ["recent-sales",     business?.id],
    ["weekly-sales",     business?.id],
  ]);

  // ── Staff simplified view ──────────────────────────────────────────────────
  const isStaffView = !!staff && !ownerBypass;
  if (isStaffView) {
    return (
      <StaffDashboard
        industry={industry ?? null}
        businessName={business?.name ?? ""}
        staffName={staff.name}
        quickActions={quickActions}
        stats={stats ?? null}
      />
    );
  }

  // ── Skeleton fallback (loading state) ─────────────────────────────────────
  if (isLoading && !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-14 rounded-2xl bg-muted/40" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Industry Banner ──────────────────────────────────────────────── */}
      <IndustryBanner
        industry={industry ?? null}
        businessName={business?.name ?? ""}
        staffName={staff?.name}
      />

      {/* ── Industry-specific Quick Actions ──────────────────────────────── */}
      <IndustryQuickActions actions={quickActions} industry={industry ?? null} />

      {/* ── Smart Alerts ─────────────────────────────────────────────────── */}
      {stats && <IndustryAlerts slug={slug} stats={stats} />}

      {/* ── Industry KPI Grid ─────────────────────────────────────────────── */}
      {stats && (
        <IndustryKpiGrid
          kpiCards={kpiCards}
          stats={stats}
          industry={industry ?? null}
        />
      )}

      {/* ── Charts Row ───────────────────────────────────────────────────── */}
      <motion.div
        className="grid lg:grid-cols-3 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        {/* Weekly Sales Area Chart */}
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
                    <stop offset="5%"  stopColor={gradientStart} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={gradientStart} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="day" stroke={axisColor} fontSize={12} />
                <YAxis stroke={axisColor} fontSize={12} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [formatGHS(v), "Sales"]}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke={primaryColor}
                  strokeWidth={2}
                  fill="url(#salesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Low Stock Alert Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(stats?.lowStock?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                All products well stocked
              </p>
            ) : (
              <>
                {(stats?.lowStock ?? []).slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                          p.qty === 0
                            ? "bg-destructive/20 text-destructive"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {p.qty}
                      </span>
                      <span className="truncate max-w-[130px]">{p.name}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">min {p.reorder_level}</span>
                  </div>
                ))}
                {(stats?.lowStock?.length ?? 0) > 6 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-primary"
                    onClick={() => navigate("/inventory")}
                  >
                    View all {stats?.lowStock?.length} items{" "}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Activity & Pipeline Row ───────────────────────────────────────── */}
      <motion.div
        className="grid lg:grid-cols-3 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.65 }}
      >
        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Recent Transactions</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/reports")}
              className="text-primary"
            >
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                No transactions yet. Make your first sale!
              </p>
            ) : (
              <div className="space-y-2.5">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {recentSales.map((tx: any) => (
                  <div
                    key={tx.id}
                    className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                      tx.voided ? "bg-muted/30 opacity-60" : "bg-secondary/50"
                    }`}
                  >
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          tx.voided ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {tx.customers?.name || "Walk-in"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.payment_method} · {new Date(tx.created_at).toLocaleString()}
                      </p>
                      {tx.voided && (
                        <p className="text-xs text-destructive">Voided</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-display font-semibold ${
                          tx.voided
                            ? "line-through text-muted-foreground"
                            : "text-primary"
                        }`}
                      >
                        {formatGHS(Number(tx.total))}
                      </span>
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

        {/* Right column: overdue + recent invoices + payment pie */}
        <div className="space-y-6">
          {(stats?.overdueCount ?? 0) > 0 && (
            <Card
              className="border-destructive/30 bg-destructive/5 cursor-pointer"
              onClick={() => navigate("/invoices")}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                    <Clock className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-destructive">
                      {stats?.overdueCount} Overdue Invoice{stats?.overdueCount !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatGHS(stats?.overdueTotal ?? 0)} outstanding
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Recent Invoices
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">
                  No invoices yet
                </p>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                recentInvoices.slice(0, 4).map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{inv.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{inv.invoice_number}</p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="font-medium">{formatGHS(Number(inv.total))}</p>
                      <Badge variant="outline" className="text-xs capitalize">
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
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
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => formatGHS(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {paymentData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
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

      {/* ── Pipeline Summary ─────────────────────────────────────────────── */}
      {pipelineData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.75 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-base">Sales Pipeline</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/opportunities")}
                className="text-primary"
              >
                View Pipeline <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {pipelineData.map((stage) => (
                  <div
                    key={stage.stage}
                    className="flex-1 min-w-[120px] rounded-lg bg-secondary/50 p-3 text-center"
                  >
                    <p className="text-xs text-muted-foreground mb-1">{stage.stage}</p>
                    <p className="text-lg font-bold">{stage.count}</p>
                    <p className="text-xs text-primary">{formatGHS(stage.value)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
