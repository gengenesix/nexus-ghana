/**
 * useIndustryDashboard
 * ────────────────────
 * Fetches get_dashboard_stats + get_industry_kpis in parallel,
 * merges them into a single flat stats object, and resolves the
 * 6 industry-specific KPI cards.
 */
import { useQuery } from "@tanstack/react-query";
import { useBusiness } from "./useBusiness";
import { useIndustry } from "./useIndustry";
import { getIndustryKpis, getQuickActions } from "@/lib/kpiMapping";
import { supabase } from "@/integrations/supabase/client";

// ── Merged stats shape ────────────────────────────────────────────────────────
export interface DashboardStats {
  // from get_dashboard_stats
  todayTotal:       number;
  todayCount:       number;
  yesterdayTotal:   number;
  growthPct:        number;
  unpaidCount:      number;
  unpaidTotal:      number;
  overdueCount:     number;
  overdueTotal:     number;
  lowStock:         Array<{ id: string; name: string; qty: number; reorder_level: number }>;
  lowStockCount:    number;
  outOfStock:       number;
  customerCount:    number;
  openLeads:        number;
  openPOsCount:     number;
  openPOsTotal:     number;
  activeProduction: number;
  totalBankBalance: number;
  bankAccountCount: number;
  inventoryCost:    number;
  inventoryRetail:  number;
  profitMargin:     number;
  monthExpenses:    number;
  pipelineValue:    number;
  pipelineCount:    number;
  pipelineStages:   Record<string, { count: number; value: number }>;
  totalProducts:    number;
  // from get_industry_kpis
  monthly_total:          number;
  covers_today:           number;
  expiring_30_count:      number;
  expiring_90_count:      number;
  active_projects_count:  number;
  pending_approvals:      number;
  new_customers_month:    number;
  avg_basket_30d:         number;
  open_service_jobs:      number;
  pending_leave:          number;
  active_employees:       number;
  monthly_expenses:       number;
  open_purchase_orders:   number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useIndustryDashboard() {
  const { business } = useBusiness();
  const { slug } = useIndustry();

  const enabled = !!business;

  // Base stats
  const { data: baseStats, isLoading: loadingBase } = useQuery({
    queryKey: ["dashboard-stats", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_business_id: business!.id,
      });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      const todayTotal     = Number(d.today_total     ?? 0);
      const yesterdayTotal = Number(d.yesterday_total ?? 0);
      const invRetail      = Number(d.inv_retail      ?? 0);
      const invCost        = Number(d.inv_cost        ?? 0);
      const lowStock       = (d.low_stock ?? []) as DashboardStats["lowStock"];
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
        lowStock,
        lowStockCount:    lowStock.length,
        outOfStock:       Number(d.out_of_stock      ?? 0),
        customerCount:    Number(d.customer_count    ?? 0),
        openLeads:        Number(d.open_leads        ?? 0),
        openPOsCount:     Number(d.open_pos_count    ?? 0),
        openPOsTotal:     Number(d.open_pos_total    ?? 0),
        activeProduction: Number(d.active_production ?? 0),
        totalBankBalance: Number(d.bank_balance      ?? 0),
        bankAccountCount: Number(d.bank_count        ?? 0),
        inventoryCost:    invCost,
        inventoryRetail:  invRetail,
        profitMargin: invRetail > 0 ? ((invRetail - invCost) / invRetail * 100) : 0,
        monthExpenses:    Number(d.month_expenses    ?? 0),
        pipelineValue:    Number(d.pipeline_value    ?? 0),
        pipelineCount:    Number(d.pipeline_count    ?? 0),
        pipelineStages:   (d.pipeline_stages ?? {}) as DashboardStats["pipelineStages"],
        totalProducts:    Number(d.total_products    ?? 0),
      };
    },
    enabled,
    staleTime: 30_000,
  });

  // Industry extended KPIs
  const { data: industryStats, isLoading: loadingIndustry } = useQuery({
    queryKey: ["industry-kpis", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_industry_kpis", {
        p_business_id: business!.id,
      });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      return {
        monthly_total:         Number(d.monthly_total         ?? 0),
        covers_today:          Number(d.covers_today          ?? 0),
        expiring_30_count:     Number(d.expiring_30_count     ?? 0),
        expiring_90_count:     Number(d.expiring_90_count     ?? 0),
        active_projects_count: Number(d.active_projects_count ?? 0),
        pending_approvals:     Number(d.pending_approvals     ?? 0),
        new_customers_month:   Number(d.new_customers_month   ?? 0),
        avg_basket_30d:        Number(d.avg_basket_30d        ?? 0),
        open_service_jobs:     Number(d.open_service_jobs     ?? 0),
        pending_leave:         Number(d.pending_leave         ?? 0),
        active_employees:      Number(d.active_employees      ?? 0),
        monthly_expenses:      Number(d.monthly_expenses      ?? 0),
        open_purchase_orders:  Number(d.open_purchase_orders  ?? 0),
      };
    },
    enabled,
    staleTime: 30_000,
  });

  // Merge
  const stats: DashboardStats | null =
    baseStats && industryStats
      ? { ...baseStats, ...industryStats }
      : null;

  const kpiCards  = getIndustryKpis(slug);
  const quickActions = getQuickActions(slug);

  return {
    stats,
    kpiCards,
    quickActions,
    isLoading: loadingBase || loadingIndustry,
  };
}
