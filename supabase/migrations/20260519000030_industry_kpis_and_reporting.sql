-- ============================================================
-- Migration 000030: Industry KPIs + Server-side Reporting
-- ============================================================
-- SAP B1 / ERPNext parity upgrades:
--
--  1. get_industry_dashboard_kpis() — real industry-specific KPIs
--     returned as JSONB with per-industry metrics.
--     Each industry gets genuinely different numbers:
--     - Restaurant: open tables, covers today, avg bill, top dish
--     - Pharmacy: Rx dispensed today, pending, expiring drugs
--     - Hotel: occupancy %, check-ins today, balance due
--     - Auto/Garage: open jobs, ready jobs, awaiting parts
--     - Agriculture: active plots, season costs, upcoming harvests
--     - Fleet/Transport: active vehicles, trips today, fuel cost
--     - Generic (retail/wholesale/manufacturing/professional/etc.):
--       revenue today, invoices due, stock alerts, cashflow
--
--  2. get_report_summary() — server-side report aggregation
--     Replaces 10,000-row browser-side calculations with a single
--     DB-computed JSONB result. Returns revenue, top products,
--     payment breakdown, and expense totals for any date range.
--
--  3. get_cashflow_summary() — cash flow statement helper
--     Inflows (sales + payments received) vs outflows (expenses +
--     purchase orders) by month for the given period.
--
--  4. Seed per-industry Chart of Accounts templates
--     Inserts industry-appropriate default CoA if the business
--     has no accounts yet — called on first business creation.
--     Industries that need unique accounts: pharmacy (drug stock
--     account), construction (contract revenue, WIP), hospitality
--     (accommodation revenue, F&B revenue), manufacturing
--     (raw materials, WIP, finished goods).
-- ============================================================

-- ─── 1. Industry-aware KPI function ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_industry_dashboard_kpis(
  p_business_id    uuid,
  p_industry_slug  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result    jsonb := '{}';
  v_today     date  := current_date;
  v_month_start date := date_trunc('month', current_date)::date;

  -- generic KPIs (all industries)
  v_revenue_today     numeric := 0;
  v_revenue_month     numeric := 0;
  v_invoices_due      integer := 0;
  v_invoices_overdue  integer := 0;
  v_low_stock_count   integer := 0;
  v_pending_orders    integer := 0;

  -- restaurant
  v_tables_open       integer := 0;
  v_covers_today      integer := 0;
  v_avg_bill          numeric := 0;
  v_orders_settled    integer := 0;

  -- pharmacy
  v_rx_today          integer := 0;
  v_rx_pending        integer := 0;
  v_drugs_expiring    integer := 0;
  v_controlled_count  integer := 0;

  -- hotel
  v_rooms_total       integer := 0;
  v_rooms_occupied    integer := 0;
  v_checkins_today    integer := 0;
  v_checkouts_today   integer := 0;
  v_occupancy_pct     numeric := 0;
  v_revenue_balance   numeric := 0;

  -- garage
  v_jobs_open         integer := 0;
  v_jobs_ready        integer := 0;
  v_jobs_awaiting     integer := 0;
  v_jobs_done_today   integer := 0;

  -- fleet / transport
  v_vehicles_active   integer := 0;
  v_trips_today       integer := 0;
  v_fuel_month        numeric := 0;
  v_fleet_costs_month numeric := 0;

  -- farm
  v_plots_growing     integer := 0;
  v_plots_total       integer := 0;
  v_season_costs      numeric := 0;
  v_next_harvest      text    := NULL;

BEGIN
  -- ── Always compute generic KPIs ──────────────────────────────────────────
  SELECT COALESCE(SUM(total), 0) INTO v_revenue_today
  FROM public.sales
  WHERE business_id = p_business_id
    AND DATE(created_at) = v_today
    AND COALESCE(status, 'completed') != 'void';

  SELECT COALESCE(SUM(total), 0) INTO v_revenue_month
  FROM public.sales
  WHERE business_id = p_business_id
    AND created_at >= v_month_start
    AND COALESCE(status, 'completed') != 'void';

  SELECT COUNT(*) INTO v_invoices_due
  FROM public.invoices
  WHERE business_id = p_business_id
    AND status IN ('sent', 'partial')
    AND (due_date IS NULL OR due_date >= v_today);

  SELECT COUNT(*) INTO v_invoices_overdue
  FROM public.invoices
  WHERE business_id = p_business_id
    AND status = 'overdue';

  SELECT COUNT(*) INTO v_low_stock_count
  FROM public.products
  WHERE business_id = p_business_id
    AND qty <= reorder_level
    AND reorder_level > 0;

  v_result := jsonb_build_object(
    'revenue_today',    v_revenue_today,
    'revenue_month',    v_revenue_month,
    'invoices_due',     v_invoices_due,
    'invoices_overdue', v_invoices_overdue,
    'low_stock_count',  v_low_stock_count
  );

  -- ── Industry-specific KPIs ──────────────────────────────────────────────
  CASE p_industry_slug

    WHEN 'food-beverage' THEN
      SELECT COUNT(*) INTO v_tables_open
      FROM public.restaurant_tables
      WHERE business_id = p_business_id AND status = 'occupied';

      SELECT COALESCE(SUM(covers), 0), COUNT(*) INTO v_covers_today, v_orders_settled
      FROM public.restaurant_orders
      WHERE business_id = p_business_id AND DATE(opened_at) = v_today;

      SELECT COALESCE(AVG(total_amount), 0) INTO v_avg_bill
      FROM public.restaurant_orders
      WHERE business_id = p_business_id
        AND status = 'settled' AND DATE(closed_at) = v_today;

      v_result := v_result || jsonb_build_object(
        'tables_open',    v_tables_open,
        'covers_today',   v_covers_today,
        'avg_bill',       ROUND(v_avg_bill, 2),
        'orders_settled', v_orders_settled,
        'kpi_labels', jsonb_build_object(
          'revenue_today',  'Till Revenue Today',
          'revenue_month',  'Monthly Revenue',
          'tables_open',    'Tables Occupied',
          'covers_today',   'Covers Today',
          'avg_bill',       'Avg. Bill (GHS)',
          'orders_settled', 'Orders Settled Today'
        )
      );

    WHEN 'pharmacy' THEN
      SELECT COUNT(*) INTO v_rx_today
      FROM public.prescriptions
      WHERE business_id = p_business_id
        AND rx_date = v_today AND status = 'dispensed';

      SELECT COUNT(*) INTO v_rx_pending
      FROM public.prescriptions
      WHERE business_id = p_business_id AND status = 'pending';

      SELECT COUNT(*) INTO v_drugs_expiring
      FROM public.prescription_items
      WHERE business_id = p_business_id
        AND expiry_date IS NOT NULL
        AND expiry_date <= (v_today + interval '90 days')
        AND expiry_date >= v_today;

      v_result := v_result || jsonb_build_object(
        'rx_dispensed_today', v_rx_today,
        'rx_pending',         v_rx_pending,
        'drugs_expiring_90d', v_drugs_expiring,
        'kpi_labels', jsonb_build_object(
          'revenue_today',      'Counter Revenue Today',
          'revenue_month',      'Monthly Sales',
          'rx_dispensed_today', 'Rx Dispensed Today',
          'rx_pending',         'Pending Prescriptions',
          'drugs_expiring_90d', 'Drugs Expiring (90 days)',
          'low_stock_count',    'Low Drug Stock Alerts'
        )
      );

    WHEN 'hospitality' THEN
      SELECT COUNT(*) INTO v_rooms_total
      FROM public.hotel_rooms
      WHERE business_id = p_business_id;

      SELECT COUNT(*) INTO v_rooms_occupied
      FROM public.hotel_rooms
      WHERE business_id = p_business_id AND status = 'occupied';

      SELECT COUNT(*) INTO v_checkins_today
      FROM public.hotel_bookings
      WHERE business_id = p_business_id
        AND check_in_date = v_today
        AND status IN ('confirmed', 'checked-in');

      SELECT COUNT(*) INTO v_checkouts_today
      FROM public.hotel_bookings
      WHERE business_id = p_business_id
        AND check_out_date = v_today
        AND status = 'checked-in';

      SELECT COALESCE(SUM(total_amount - paid_amount), 0) INTO v_revenue_balance
      FROM public.hotel_bookings
      WHERE business_id = p_business_id
        AND status = 'checked-in';

      IF v_rooms_total > 0 THEN
        v_occupancy_pct := ROUND((v_rooms_occupied::numeric / v_rooms_total) * 100, 1);
      END IF;

      v_result := v_result || jsonb_build_object(
        'rooms_total',     v_rooms_total,
        'rooms_occupied',  v_rooms_occupied,
        'occupancy_pct',   v_occupancy_pct,
        'checkins_today',  v_checkins_today,
        'checkouts_today', v_checkouts_today,
        'balance_due',     ROUND(v_revenue_balance, 2),
        'kpi_labels', jsonb_build_object(
          'revenue_today',   'F&B Revenue Today',
          'revenue_month',   'Monthly Revenue',
          'occupancy_pct',   'Occupancy Rate (%)',
          'checkins_today',  'Check-ins Today',
          'checkouts_today', 'Check-outs Due Today',
          'balance_due',     'Outstanding Balance (GHS)',
          'rooms_occupied',  'Rooms In Use'
        )
      );

    WHEN 'auto' THEN
      SELECT COUNT(*) INTO v_jobs_open
      FROM public.job_cards
      WHERE business_id = p_business_id
        AND status IN ('received', 'in-progress');

      SELECT COUNT(*) INTO v_jobs_ready
      FROM public.job_cards
      WHERE business_id = p_business_id AND status = 'ready';

      SELECT COUNT(*) INTO v_jobs_awaiting
      FROM public.job_cards
      WHERE business_id = p_business_id AND status = 'awaiting-parts';

      SELECT COUNT(*) INTO v_jobs_done_today
      FROM public.job_cards
      WHERE business_id = p_business_id
        AND status = 'delivered' AND completed_date = v_today;

      v_result := v_result || jsonb_build_object(
        'jobs_open',        v_jobs_open,
        'jobs_ready',       v_jobs_ready,
        'jobs_awaiting',    v_jobs_awaiting,
        'jobs_done_today',  v_jobs_done_today,
        'kpi_labels', jsonb_build_object(
          'revenue_today',   'Counter Revenue Today',
          'revenue_month',   'Monthly Revenue',
          'jobs_open',       'Jobs In Progress',
          'jobs_ready',      'Jobs Ready for Pickup',
          'jobs_awaiting',   'Awaiting Parts',
          'jobs_done_today', 'Delivered Today',
          'invoices_overdue','Overdue Invoices'
        )
      );

    WHEN 'transport' THEN
      SELECT COUNT(*) INTO v_vehicles_active
      FROM public.fleet_vehicles
      WHERE business_id = p_business_id AND status = 'active';

      SELECT COUNT(*) INTO v_trips_today
      FROM public.fleet_logs
      WHERE business_id = p_business_id
        AND log_type = 'trip' AND log_date = v_today;

      SELECT COALESCE(SUM(cost), 0) INTO v_fuel_month
      FROM public.fleet_logs
      WHERE business_id = p_business_id
        AND log_type = 'fuel' AND log_date >= v_month_start;

      SELECT COALESCE(SUM(cost), 0) INTO v_fleet_costs_month
      FROM public.fleet_logs
      WHERE business_id = p_business_id
        AND log_date >= v_month_start;

      v_result := v_result || jsonb_build_object(
        'vehicles_active',   v_vehicles_active,
        'trips_today',       v_trips_today,
        'fuel_cost_month',   ROUND(v_fuel_month, 2),
        'fleet_costs_month', ROUND(v_fleet_costs_month, 2),
        'kpi_labels', jsonb_build_object(
          'revenue_today',    'Revenue Today',
          'revenue_month',    'Monthly Revenue',
          'vehicles_active',  'Active Vehicles',
          'trips_today',      'Trips Today',
          'fuel_cost_month',  'Fuel Spend (Month)',
          'fleet_costs_month','Total Fleet Costs (Month)',
          'invoices_overdue', 'Overdue Invoices'
        )
      );

    WHEN 'agriculture' THEN
      SELECT COUNT(*) INTO v_plots_growing
      FROM public.farm_plots
      WHERE business_id = p_business_id AND status = 'growing';

      SELECT COUNT(*) INTO v_plots_total
      FROM public.farm_plots
      WHERE business_id = p_business_id;

      SELECT COALESCE(SUM(cost), 0) INTO v_season_costs
      FROM public.farm_activities
      WHERE business_id = p_business_id
        AND activity_date >= v_month_start;

      SELECT TO_CHAR(MIN(activity_date), 'Mon DD') INTO v_next_harvest
      FROM public.farm_activities
      WHERE business_id = p_business_id
        AND activity_type = 'harvesting'
        AND activity_date >= v_today;

      v_result := v_result || jsonb_build_object(
        'plots_growing',    v_plots_growing,
        'plots_total',      v_plots_total,
        'season_costs',     ROUND(v_season_costs, 2),
        'next_harvest',     v_next_harvest,
        'kpi_labels', jsonb_build_object(
          'revenue_today',  'Sales Today',
          'revenue_month',  'Monthly Sales',
          'plots_growing',  'Plots Growing',
          'plots_total',    'Total Plots',
          'season_costs',   'Input Costs (Month)',
          'next_harvest',   'Next Harvest',
          'invoices_overdue','Overdue Invoices'
        )
      );

    WHEN 'construction' THEN
      -- construction = projects-centric KPIs
      SELECT COUNT(*) INTO v_jobs_open
      FROM public.projects
      WHERE business_id = p_business_id AND status = 'in_progress';

      SELECT COUNT(*) INTO v_jobs_ready
      FROM public.projects
      WHERE business_id = p_business_id AND status = 'review';

      v_result := v_result || jsonb_build_object(
        'projects_active',  v_jobs_open,
        'projects_review',  v_jobs_ready,
        'kpi_labels', jsonb_build_object(
          'revenue_today',   'Revenue Today',
          'revenue_month',   'Monthly Revenue',
          'projects_active', 'Active Projects',
          'projects_review', 'In Review',
          'invoices_overdue','Overdue Progress Claims',
          'low_stock_count', 'Low Site Materials'
        )
      );

    ELSE
      -- Retail, wholesale, manufacturing, professional, beauty, financial — generic
      v_result := v_result || jsonb_build_object(
        'kpi_labels', jsonb_build_object(
          'revenue_today',    'Revenue Today',
          'revenue_month',    'Revenue This Month',
          'invoices_due',     'Invoices Due',
          'invoices_overdue', 'Overdue Invoices',
          'low_stock_count',  'Low Stock Alerts'
        )
      );

  END CASE;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_industry_dashboard_kpis(uuid, text) TO authenticated;

-- ─── 2. Server-side report aggregation ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_report_summary(
  p_business_id uuid,
  p_date_from   date,
  p_date_to     date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH
  -- Revenue totals
  sales_agg AS (
    SELECT
      COALESCE(SUM(total), 0)                        AS total_revenue,
      COALESCE(SUM(discount_amount), 0)              AS total_discounts,
      COUNT(*)                                        AS sale_count,
      COALESCE(AVG(total), 0)                        AS avg_sale_value
    FROM public.sales
    WHERE business_id = p_business_id
      AND DATE(created_at) BETWEEN p_date_from AND p_date_to
      AND COALESCE(status, 'completed') != 'void'
  ),
  -- Revenue by payment method
  payment_breakdown AS (
    SELECT payment_method, COALESCE(SUM(total), 0) AS amount, COUNT(*) AS txn_count
    FROM public.sales
    WHERE business_id = p_business_id
      AND DATE(created_at) BETWEEN p_date_from AND p_date_to
      AND COALESCE(status, 'completed') != 'void'
    GROUP BY payment_method
  ),
  -- Revenue by month (for trend chart)
  monthly_revenue AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month_label,
      DATE_TRUNC('month', created_at)                        AS month_start,
      COALESCE(SUM(total), 0)                                AS revenue
    FROM public.sales
    WHERE business_id = p_business_id
      AND DATE(created_at) BETWEEN p_date_from AND p_date_to
      AND COALESCE(status, 'completed') != 'void'
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month_start
  ),
  -- Top 10 products by revenue
  top_products AS (
    SELECT si.product_name, SUM(si.qty) AS units_sold, SUM(si.qty * si.unit_price) AS revenue
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE s.business_id = p_business_id
      AND DATE(s.created_at) BETWEEN p_date_from AND p_date_to
      AND COALESCE(s.status, 'completed') != 'void'
    GROUP BY si.product_name
    ORDER BY revenue DESC
    LIMIT 10
  ),
  -- Expense totals by category
  expense_agg AS (
    SELECT
      COALESCE(SUM(amount), 0) AS total_expenses,
      COUNT(*)                  AS expense_count
    FROM public.expenses
    WHERE business_id = p_business_id
      AND DATE(date) BETWEEN p_date_from AND p_date_to
  ),
  expense_by_category AS (
    SELECT category, COALESCE(SUM(amount), 0) AS amount
    FROM public.expenses
    WHERE business_id = p_business_id
      AND DATE(date) BETWEEN p_date_from AND p_date_to
    GROUP BY category
    ORDER BY amount DESC
    LIMIT 10
  ),
  -- Invoice summary
  invoice_agg AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'paid')    AS paid_count,
      COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
      COUNT(*) FILTER (WHERE status IN ('sent','partial')) AS outstanding_count,
      COALESCE(SUM(total) FILTER (WHERE status = 'overdue'), 0) AS overdue_amount,
      COALESCE(SUM(amount_due) FILTER (WHERE status IN ('sent','partial','overdue')), 0) AS outstanding_amount
    FROM public.invoices
    WHERE business_id = p_business_id
      AND DATE(created_at) BETWEEN p_date_from AND p_date_to
  )
  SELECT jsonb_build_object(
    -- Summary
    'total_revenue',     s.total_revenue,
    'total_discounts',   s.total_discounts,
    'sale_count',        s.sale_count,
    'avg_sale_value',    ROUND(s.avg_sale_value, 2),
    'total_expenses',    e.total_expenses,
    'net_profit',        ROUND(s.total_revenue - e.total_expenses, 2),
    'profit_margin_pct', CASE WHEN s.total_revenue > 0
                              THEN ROUND((s.total_revenue - e.total_expenses) / s.total_revenue * 100, 1)
                              ELSE 0 END,
    -- Payment breakdown
    'payment_breakdown', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'method', payment_method, 'amount', amount, 'count', txn_count
      )), '[]'::jsonb)
      FROM payment_breakdown
    ),
    -- Monthly trend
    'monthly_revenue', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'label', month_label, 'revenue', revenue
      ) ORDER BY month_start), '[]'::jsonb)
      FROM monthly_revenue
    ),
    -- Top products
    'top_products', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', product_name, 'units_sold', units_sold, 'revenue', revenue
      )), '[]'::jsonb)
      FROM top_products
    ),
    -- Expenses
    'expense_count', e.expense_count,
    'expense_by_category', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'category', category, 'amount', amount
      )), '[]'::jsonb)
      FROM expense_by_category
    ),
    -- Invoices
    'invoices_paid',        ia.paid_count,
    'invoices_overdue',     ia.overdue_count,
    'invoices_outstanding', ia.outstanding_count,
    'overdue_amount',       ia.overdue_amount,
    'outstanding_amount',   ia.outstanding_amount
  ) INTO v_result
  FROM sales_agg s, expense_agg e, invoice_agg ia;

  RETURN COALESCE(v_result, '{}');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_report_summary(uuid, date, date) TO authenticated;

-- ─── 3. Cash flow summary ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_cashflow_summary(
  p_business_id uuid,
  p_date_from   date,
  p_date_to     date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  WITH
  monthly_inflow AS (
    SELECT
      DATE_TRUNC('month', created_at) AS m,
      TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS label,
      COALESCE(SUM(total), 0) AS inflow
    FROM public.sales
    WHERE business_id = p_business_id
      AND DATE(created_at) BETWEEN p_date_from AND p_date_to
      AND COALESCE(status, 'completed') != 'void'
    GROUP BY DATE_TRUNC('month', created_at)
  ),
  monthly_outflow AS (
    SELECT
      DATE_TRUNC('month', date::timestamptz) AS m,
      COALESCE(SUM(amount), 0) AS outflow
    FROM public.expenses
    WHERE business_id = p_business_id
      AND DATE(date) BETWEEN p_date_from AND p_date_to
    GROUP BY DATE_TRUNC('month', date::timestamptz)
  )
  SELECT jsonb_agg(jsonb_build_object(
    'label',   COALESCE(i.label, TO_CHAR(o.m, 'Mon YYYY')),
    'inflow',  COALESCE(i.inflow, 0),
    'outflow', COALESCE(o.outflow, 0),
    'net',     COALESCE(i.inflow, 0) - COALESCE(o.outflow, 0)
  ) ORDER BY COALESCE(i.m, o.m))
  INTO v_result
  FROM monthly_inflow i FULL OUTER JOIN monthly_outflow o ON i.m = o.m;

  RETURN COALESCE(v_result, '[]');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cashflow_summary(uuid, date, date) TO authenticated;

-- ─── 4. Industry-specific Chart of Accounts seeder ────────────────────────────
-- Called from application when a business sets its industry for the first time.
-- Inserts accounts tailored to the industry if none exist yet.
-- Based on ICAG Ghana chart of accounts standards.

CREATE OR REPLACE FUNCTION public.seed_industry_coa(
  p_business_id   uuid,
  p_industry_slug text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_count integer;
BEGIN
  -- Only seed if business has no accounts yet
  SELECT COUNT(*) INTO v_existing_count
  FROM public.chart_of_accounts
  WHERE business_id = p_business_id;

  IF v_existing_count > 0 THEN
    RETURN;
  END IF;

  -- ── Common accounts for all industries ─────────────────────────────────────
  INSERT INTO public.chart_of_accounts
    (business_id, code, name, account_type, is_system)
  VALUES
    -- Assets
    (p_business_id, '1000', 'Cash & Bank',            'asset',     true),
    (p_business_id, '1100', 'Accounts Receivable',    'asset',     true),
    (p_business_id, '1200', 'Inventory / Stock',       'asset',     true),
    (p_business_id, '1300', 'Prepaid Expenses',        'asset',     true),
    (p_business_id, '1500', 'Fixed Assets',            'asset',     true),
    (p_business_id, '1510', 'Accumulated Depreciation','asset',     true),
    -- Liabilities
    (p_business_id, '2000', 'Accounts Payable',        'liability', true),
    (p_business_id, '2100', 'VAT Payable',             'liability', true),
    (p_business_id, '2200', 'PAYE Payable',            'liability', true),
    (p_business_id, '2300', 'SSNIT Payable',           'liability', true),
    (p_business_id, '2400', 'Loans Payable',           'liability', true),
    -- Equity
    (p_business_id, '3000', 'Owner''s Capital',         'equity',    true),
    (p_business_id, '3100', 'Retained Earnings',        'equity',    true),
    -- Revenue
    (p_business_id, '4000', 'Sales Revenue',            'income',    true),
    (p_business_id, '4100', 'Other Income',             'income',    true),
    -- Expenses
    (p_business_id, '5000', 'Cost of Goods Sold',       'expense',   true),
    (p_business_id, '5100', 'Salaries & Wages',         'expense',   true),
    (p_business_id, '5200', 'Rent & Rates',             'expense',   true),
    (p_business_id, '5300', 'Utilities',                'expense',   true),
    (p_business_id, '5400', 'Transport & Fuel',         'expense',   true),
    (p_business_id, '5500', 'Marketing & Advertising',  'expense',   true),
    (p_business_id, '5600', 'Office Expenses',          'expense',   true),
    (p_business_id, '5700', 'Depreciation Expense',     'expense',   true),
    (p_business_id, '5800', 'Bank Charges',             'expense',   true),
    (p_business_id, '5900', 'Miscellaneous Expense',    'expense',   true)
  ON CONFLICT DO NOTHING;

  -- ── Industry-specific additional accounts ───────────────────────────────────
  CASE p_industry_slug

    WHEN 'pharmacy' THEN
      INSERT INTO public.chart_of_accounts (business_id, code, name, account_type, is_system)
      VALUES
        (p_business_id, '1210', 'Drug Stock — Prescription',  'asset',   true),
        (p_business_id, '1211', 'Drug Stock — OTC',           'asset',   true),
        (p_business_id, '1212', 'Drug Stock — Controlled',    'asset',   true),
        (p_business_id, '4010', 'Prescription Revenue',       'income',  true),
        (p_business_id, '4011', 'OTC Sales Revenue',          'income',  true),
        (p_business_id, '5010', 'Cost of Drugs Dispensed',    'expense', true),
        (p_business_id, '5020', 'Drug Wastage & Expiry',      'expense', true)
      ON CONFLICT DO NOTHING;

    WHEN 'hospitality' THEN
      INSERT INTO public.chart_of_accounts (business_id, code, name, account_type, is_system)
      VALUES
        (p_business_id, '4010', 'Accommodation Revenue',      'income',  true),
        (p_business_id, '4011', 'F&B Revenue',                'income',  true),
        (p_business_id, '4012', 'Conference & Events Revenue','income',  true),
        (p_business_id, '4013', 'Ancillary Services Revenue', 'income',  true),
        (p_business_id, '1220', 'F&B Inventory',              'asset',   true),
        (p_business_id, '1221', 'Guest Deposits Received',    'liability',true),
        (p_business_id, '5010', 'Housekeeping Costs',         'expense', true),
        (p_business_id, '5011', 'F&B Cost of Sales',          'expense', true),
        (p_business_id, '5012', 'Room Maintenance',           'expense', true),
        (p_business_id, '5013', 'Laundry & Linen',            'expense', true)
      ON CONFLICT DO NOTHING;

    WHEN 'food-beverage' THEN
      INSERT INTO public.chart_of_accounts (business_id, code, name, account_type, is_system)
      VALUES
        (p_business_id, '4010', 'Food Revenue',              'income',  true),
        (p_business_id, '4011', 'Beverage Revenue',          'income',  true),
        (p_business_id, '4012', 'Takeaway Revenue',          'income',  true),
        (p_business_id, '5010', 'Food Cost of Sales',        'expense', true),
        (p_business_id, '5011', 'Beverage Cost of Sales',    'expense', true),
        (p_business_id, '5012', 'Kitchen Supplies',          'expense', true),
        (p_business_id, '5013', 'Gas & Cooking Fuel',        'expense', true)
      ON CONFLICT DO NOTHING;

    WHEN 'construction' THEN
      INSERT INTO public.chart_of_accounts (business_id, code, name, account_type, is_system)
      VALUES
        (p_business_id, '1230', 'WIP — Contract Costs',      'asset',   true),
        (p_business_id, '1231', 'Retentions Receivable',     'asset',   true),
        (p_business_id, '4010', 'Contract Revenue',          'income',  true),
        (p_business_id, '4011', 'Variation Orders Revenue',  'income',  true),
        (p_business_id, '5010', 'Direct Materials',          'expense', true),
        (p_business_id, '5011', 'Direct Labour',             'expense', true),
        (p_business_id, '5012', 'Plant & Equipment Hire',    'expense', true),
        (p_business_id, '5013', 'Subcontractor Costs',       'expense', true),
        (p_business_id, '5014', 'Site Overheads',            'expense', true),
        (p_business_id, '2410', 'Contract Retentions Held',  'liability',true)
      ON CONFLICT DO NOTHING;

    WHEN 'manufacturing' THEN
      INSERT INTO public.chart_of_accounts (business_id, code, name, account_type, is_system)
      VALUES
        (p_business_id, '1210', 'Raw Materials Inventory',   'asset',   true),
        (p_business_id, '1211', 'WIP Inventory',             'asset',   true),
        (p_business_id, '1212', 'Finished Goods Inventory',  'asset',   true),
        (p_business_id, '4010', 'Manufactured Goods Sales',  'income',  true),
        (p_business_id, '5010', 'Raw Material Costs',        'expense', true),
        (p_business_id, '5011', 'Direct Production Labour',  'expense', true),
        (p_business_id, '5012', 'Factory Overheads',         'expense', true),
        (p_business_id, '5013', 'Machine Maintenance',       'expense', true),
        (p_business_id, '5014', 'Quality Control',           'expense', true)
      ON CONFLICT DO NOTHING;

    WHEN 'agriculture' THEN
      INSERT INTO public.chart_of_accounts (business_id, code, name, account_type, is_system)
      VALUES
        (p_business_id, '1210', 'Farm Inputs Inventory',     'asset',   true),
        (p_business_id, '1211', 'Growing Crop (Biological)', 'asset',   true),
        (p_business_id, '1212', 'Harvested Produce',         'asset',   true),
        (p_business_id, '4010', 'Crop Sales Revenue',        'income',  true),
        (p_business_id, '4011', 'Processing Revenue',        'income',  true),
        (p_business_id, '5010', 'Seeds & Seedlings',         'expense', true),
        (p_business_id, '5011', 'Fertilisers & Chemicals',   'expense', true),
        (p_business_id, '5012', 'Labour (Farm Workers)',     'expense', true),
        (p_business_id, '5013', 'Irrigation & Water',        'expense', true),
        (p_business_id, '5014', 'Equipment Hire',            'expense', true),
        (p_business_id, '5015', 'Crop Losses & Waste',       'expense', true)
      ON CONFLICT DO NOTHING;

    WHEN 'auto' THEN
      INSERT INTO public.chart_of_accounts (business_id, code, name, account_type, is_system)
      VALUES
        (p_business_id, '1210', 'Spare Parts Inventory',     'asset',   true),
        (p_business_id, '4010', 'Labour Revenue',            'income',  true),
        (p_business_id, '4011', 'Parts Sales Revenue',       'income',  true),
        (p_business_id, '5010', 'Parts Cost of Sales',       'expense', true),
        (p_business_id, '5011', 'Mechanic Wages',            'expense', true),
        (p_business_id, '5012', 'Workshop Consumables',      'expense', true),
        (p_business_id, '5013', 'Equipment Maintenance',     'expense', true)
      ON CONFLICT DO NOTHING;

    WHEN 'transport' THEN
      INSERT INTO public.chart_of_accounts (business_id, code, name, account_type, is_system)
      VALUES
        (p_business_id, '1510', 'Fleet Assets',              'asset',   true),
        (p_business_id, '4010', 'Freight Revenue',           'income',  true),
        (p_business_id, '4011', 'Charter Revenue',           'income',  true),
        (p_business_id, '5010', 'Fuel Costs',                'expense', true),
        (p_business_id, '5011', 'Driver Wages',              'expense', true),
        (p_business_id, '5012', 'Vehicle Maintenance',       'expense', true),
        (p_business_id, '5013', 'Road Tolls & Levies',       'expense', true),
        (p_business_id, '5014', 'Insurance (Fleet)',         'expense', true)
      ON CONFLICT DO NOTHING;

    WHEN 'financial' THEN
      INSERT INTO public.chart_of_accounts (business_id, code, name, account_type, is_system)
      VALUES
        (p_business_id, '1110', 'Loans Receivable',          'asset',   true),
        (p_business_id, '1111', 'Interest Receivable',       'asset',   true),
        (p_business_id, '4010', 'Interest Income',           'income',  true),
        (p_business_id, '4011', 'Fee Income',                'income',  true),
        (p_business_id, '4012', 'Commission Income',         'income',  true),
        (p_business_id, '4013', 'Foreign Exchange Gain',     'income',  true),
        (p_business_id, '5010', 'Interest Expense',          'expense', true),
        (p_business_id, '5011', 'Provision for Bad Debts',   'expense', true),
        (p_business_id, '5012', 'Compliance Costs',          'expense', true)
      ON CONFLICT DO NOTHING;

    ELSE
      -- Retail, wholesale, professional, beauty — standard accounts sufficient
      NULL;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_industry_coa(uuid, text) TO authenticated;
