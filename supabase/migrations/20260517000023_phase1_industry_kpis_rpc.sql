-- ============================================================
-- Phase 1: Industry KPIs RPC
-- get_industry_kpis(p_business_id) → jsonb
-- Returns extended KPI fields needed by industry dashboards.
-- Called alongside get_dashboard_stats() on the dashboard.
-- ============================================================

CREATE OR REPLACE FUNCTION get_industry_kpis(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_monthly_total       numeric  := 0;
  v_covers_today        integer  := 0;
  v_expiring_30         integer  := 0;
  v_expiring_90         integer  := 0;
  v_active_projects     integer  := 0;
  v_pending_approvals   integer  := 0;
  v_new_customers_month integer  := 0;
  v_avg_basket          numeric  := 0;
  v_open_service_jobs   integer  := 0;
  v_pending_leave       integer  := 0;
  v_active_employees    integer  := 0;
  v_monthly_expenses    numeric  := 0;
  v_open_purchase_orders integer := 0;
BEGIN
  -- ── Security: caller must own this business ──────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM businesses
    WHERE id = p_business_id
      AND (owner_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM staff_members
             WHERE business_id = p_business_id
               AND supabase_user_id = auth.uid()
               AND status = 'active'
           ))
  ) THEN
    RETURN v_result;
  END IF;

  -- ── Monthly sales total (current calendar month) ─────────────────────────
  BEGIN
    SELECT COALESCE(SUM(total), 0)
    INTO v_monthly_total
    FROM sales
    WHERE business_id = p_business_id
      AND voided = false
      AND created_at >= date_trunc('month', now());
  EXCEPTION WHEN OTHERS THEN v_monthly_total := 0; END;

  -- ── Covers today (F&B: table covers served today) ─────────────────────────
  BEGIN
    SELECT COALESCE(SUM(covers), 0)
    INTO v_covers_today
    FROM sales
    WHERE business_id = p_business_id
      AND voided = false
      AND covers IS NOT NULL
      AND created_at >= current_date;
  EXCEPTION WHEN OTHERS THEN v_covers_today := 0; END;

  -- ── Expiring stock: products with expiry_date ─────────────────────────────
  BEGIN
    SELECT COUNT(*)
    INTO v_expiring_30
    FROM products
    WHERE business_id = p_business_id
      AND expiry_date IS NOT NULL
      AND expiry_date <= (current_date + INTERVAL '30 days')
      AND expiry_date >= current_date
      AND quantity > 0;
  EXCEPTION WHEN OTHERS THEN v_expiring_30 := 0; END;

  BEGIN
    SELECT COUNT(*)
    INTO v_expiring_90
    FROM products
    WHERE business_id = p_business_id
      AND expiry_date IS NOT NULL
      AND expiry_date <= (current_date + INTERVAL '90 days')
      AND expiry_date >= current_date
      AND quantity > 0;
  EXCEPTION WHEN OTHERS THEN v_expiring_90 := 0; END;

  -- ── Active projects ───────────────────────────────────────────────────────
  BEGIN
    SELECT COUNT(*)
    INTO v_active_projects
    FROM projects
    WHERE business_id = p_business_id
      AND status NOT IN ('completed', 'cancelled');
  EXCEPTION WHEN OTHERS THEN v_active_projects := 0; END;

  -- ── Pending approvals ─────────────────────────────────────────────────────
  BEGIN
    SELECT COUNT(*)
    INTO v_pending_approvals
    FROM approval_requests
    WHERE business_id = p_business_id
      AND status = 'pending';
  EXCEPTION WHEN OTHERS THEN v_pending_approvals := 0; END;

  -- ── New customers this month ──────────────────────────────────────────────
  BEGIN
    SELECT COUNT(*)
    INTO v_new_customers_month
    FROM customers
    WHERE business_id = p_business_id
      AND created_at >= date_trunc('month', now());
  EXCEPTION WHEN OTHERS THEN v_new_customers_month := 0; END;

  -- ── Average basket / transaction value (last 30 days) ────────────────────
  BEGIN
    SELECT COALESCE(AVG(total), 0)
    INTO v_avg_basket
    FROM sales
    WHERE business_id = p_business_id
      AND voided = false
      AND created_at >= (now() - INTERVAL '30 days');
  EXCEPTION WHEN OTHERS THEN v_avg_basket := 0; END;

  -- ── Open service jobs ─────────────────────────────────────────────────────
  BEGIN
    SELECT COUNT(*)
    INTO v_open_service_jobs
    FROM service_tickets
    WHERE business_id = p_business_id
      AND status NOT IN ('completed', 'cancelled');
  EXCEPTION WHEN OTHERS THEN v_open_service_jobs := 0; END;

  -- ── Pending leave requests ────────────────────────────────────────────────
  BEGIN
    SELECT COUNT(*)
    INTO v_pending_leave
    FROM leave_requests
    WHERE business_id = p_business_id
      AND status = 'pending';
  EXCEPTION WHEN OTHERS THEN v_pending_leave := 0; END;

  -- ── Active employees ──────────────────────────────────────────────────────
  BEGIN
    SELECT COUNT(*)
    INTO v_active_employees
    FROM employees
    WHERE business_id = p_business_id
      AND status = 'active';
  EXCEPTION WHEN OTHERS THEN v_active_employees := 0; END;

  -- ── Monthly expenses ──────────────────────────────────────────────────────
  BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO v_monthly_expenses
    FROM expenses
    WHERE business_id = p_business_id
      AND created_at >= date_trunc('month', now());
  EXCEPTION WHEN OTHERS THEN v_monthly_expenses := 0; END;

  -- ── Open purchase orders ──────────────────────────────────────────────────
  BEGIN
    SELECT COUNT(*)
    INTO v_open_purchase_orders
    FROM purchase_orders
    WHERE business_id = p_business_id
      AND status NOT IN ('received', 'cancelled');
  EXCEPTION WHEN OTHERS THEN v_open_purchase_orders := 0; END;

  -- ── Build result ─────────────────────────────────────────────────────────
  v_result := jsonb_build_object(
    'monthly_total',         v_monthly_total,
    'covers_today',          v_covers_today,
    'expiring_30_count',     v_expiring_30,
    'expiring_90_count',     v_expiring_90,
    'active_projects_count', v_active_projects,
    'pending_approvals',     v_pending_approvals,
    'new_customers_month',   v_new_customers_month,
    'avg_basket_30d',        ROUND(v_avg_basket, 2),
    'open_service_jobs',     v_open_service_jobs,
    'pending_leave',         v_pending_leave,
    'active_employees',      v_active_employees,
    'monthly_expenses',      v_monthly_expenses,
    'open_purchase_orders',  v_open_purchase_orders
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_industry_kpis(uuid) TO authenticated;

COMMENT ON FUNCTION get_industry_kpis(uuid) IS
  'Phase 1 – Returns extended industry KPI fields merged with get_dashboard_stats on the dashboard.';
