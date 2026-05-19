/**
 * useIndustryDashboard
 * ────────────────────
 * Fetches get_dashboard_stats + get_industry_dashboard_kpis in parallel,
 * merges them into a single flat stats object, and resolves the
 * industry-specific KPI cards.
 *
 * Migration 000030 upgrade: get_industry_dashboard_kpis() returns genuinely
 * different KPIs per industry (occupancy % for hotels, Rx pending for pharmacy,
 * job cards for garages, etc.) computed fully server-side.
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
  // from get_industry_dashboard_kpis (migration 000030)
  revenue_today:       number;
  revenue_month:       number;
  invoices_due:        number;
  invoices_overdue:    number;
  low_stock_count:     number;
  // Industry-specific fields (populated depending on slug)
  tables_open?:        number;
  covers_today?:       number;
  avg_bill?:           number;
  orders_settled?:     number;
  rx_dispensed_today?: number;
  rx_pending?:         number;
  drugs_expiring_90d?: number;
  rooms_total?:        number;
  rooms_occupied?:     number;
  occupancy_pct?:      number;
  checkins_today?:     number;
  checkouts_today?:    number;
  balance_due?:        number;
  jobs_open?:          number;
  jobs_ready?:         number;
  jobs_awaiting?:      number;
  jobs_done_today?:    number;
  vehicles_active?:    number;
  trips_today?:        number;
  fuel_cost_month?:    number;
  fleet_costs_month?:  number;
  plots_growing?:      number;
  plots_total?:        number;
  season_costs?:       number;
  next_harvest?:       string | null;
  projects_active?:    number;
  projects_review?:    number;
  kpi_labels:          Record<string, string>;
  // Legacy compat (get_industry_kpis fields)
  monthly_total:          number;
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

  // Base stats (generic ERP aggregates)
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

  // Industry-specific KPIs — migration 000030 server-side computation
  const { data: industryKpis, isLoading: loadingIndustry } = useQuery({
    queryKey: ["industry-dashboard-kpis", business?.id, slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_industry_dashboard_kpis", {
        p_business_id:   business!.id,
        p_industry_slug: slug ?? null,
      });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any ?? {};
      return {
        revenue_today:       Number(d.revenue_today       ?? 0),
        revenue_month:       Number(d.revenue_month       ?? 0),
        invoices_due:        Number(d.invoices_due        ?? 0),
        invoices_overdue:    Number(d.invoices_overdue    ?? 0),
        low_stock_count:     Number(d.low_stock_count     ?? 0),
        // Optional industry-specific
        tables_open:         d.tables_open        != null ? Number(d.tables_open)        : undefined,
        covers_today:        d.covers_today       != null ? Number(d.covers_today)       : undefined,
        avg_bill:            d.avg_bill           != null ? Number(d.avg_bill)           : undefined,
        orders_settled:      d.orders_settled     != null ? Number(d.orders_settled)     : undefined,
        rx_dispensed_today:  d.rx_dispensed_today != null ? Number(d.rx_dispensed_today) : undefined,
        rx_pending:          d.rx_pending         != null ? Number(d.rx_pending)         : undefined,
        drugs_expiring_90d:  d.drugs_expiring_90d != null ? Number(d.drugs_expiring_90d) : undefined,
        rooms_total:         d.rooms_total        != null ? Number(d.rooms_total)        : undefined,
        rooms_occupied:      d.rooms_occupied     != null ? Number(d.rooms_occupied)     : undefined,
        occupancy_pct:       d.occupancy_pct      != null ? Number(d.occupancy_pct)      : undefined,
        checkins_today:      d.checkins_today     != null ? Number(d.checkins_today)     : undefined,
        checkouts_today:     d.checkouts_today    != null ? Number(d.checkouts_today)    : undefined,
        balance_due:         d.balance_due        != null ? Number(d.balance_due)        : undefined,
        jobs_open:           d.jobs_open          != null ? Number(d.jobs_open)          : undefined,
        jobs_ready:          d.jobs_ready         != null ? Number(d.jobs_ready)         : undefined,
        jobs_awaiting:       d.jobs_awaiting      != null ? Number(d.jobs_awaiting)      : undefined,
        jobs_done_today:     d.jobs_done_today    != null ? Number(d.jobs_done_today)    : undefined,
        vehicles_active:     d.vehicles_active    != null ? Number(d.vehicles_active)    : undefined,
        trips_today:         d.trips_today        != null ? Number(d.trips_today)        : undefined,
        fuel_cost_month:     d.fuel_cost_month    != null ? Number(d.fuel_cost_month)    : undefined,
        fleet_costs_month:   d.fleet_costs_month  != null ? Number(d.fleet_costs_month)  : undefined,
        plots_growing:       d.plots_growing      != null ? Number(d.plots_growing)      : undefined,
        plots_total:         d.plots_total        != null ? Number(d.plots_total)        : undefined,
        season_costs:        d.season_costs       != null ? Number(d.season_costs)       : undefined,
        next_harvest:        d.next_harvest       ?? null,
        projects_active:     d.projects_active    != null ? Number(d.projects_active)    : undefined,
        projects_review:     d.projects_review    != null ? Number(d.projects_review)    : undefined,
        kpi_labels:          (d.kpi_labels ?? {}) as Record<string, string>,
        // Legacy compat fields (fallback to zero)
        monthly_total:         Number(d.revenue_month     ?? 0),
        expiring_30_count:     Number(d.drugs_expiring_90d ?? 0),
        expiring_90_count:     Number(d.drugs_expiring_90d ?? 0),
        active_projects_count: Number(d.projects_active   ?? 0),
        pending_approvals:     0,
        new_customers_month:   0,
        avg_basket_30d:        0,
        open_service_jobs:     Number(d.jobs_open ?? 0),
        pending_leave:         0,
        active_employees:      0,
        monthly_expenses:      0,
        open_purchase_orders:  0,
      };
    },
    enabled,
    staleTime: 30_000,
  });

  // Merge
  const stats: DashboardStats | null =
    baseStats && industryKpis
      ? { ...baseStats, ...industryKpis }
      : null;

  const kpiCards     = getIndustryKpis(slug);
  const quickActions = getQuickActions(slug);

  return {
    stats,
    kpiCards,
    quickActions,
    isLoading: loadingBase || loadingIndustry,
  };
}
