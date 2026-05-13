-- ============================================================
-- MIGRATION: Single-function dashboard stats
--
-- Replaces 11 parallel Supabase queries with one RPC call.
-- Returns all KPIs as a single JSONB object.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today       date    := CURRENT_DATE;
  _yesterday   date    := CURRENT_DATE - 1;
  _month_start date    := date_trunc('month', CURRENT_DATE)::date;

  _today_total      numeric := 0;
  _today_count      integer := 0;
  _yesterday_total  numeric := 0;

  _unpaid_count  integer := 0;
  _unpaid_total  numeric := 0;
  _overdue_count integer := 0;
  _overdue_total numeric := 0;

  _low_stock      jsonb   := '[]';
  _out_of_stock   integer := 0;
  _total_products integer := 0;
  _inv_cost       numeric := 0;
  _inv_retail     numeric := 0;

  _customer_count    integer := 0;
  _open_leads        integer := 0;
  _open_pos_count    integer := 0;
  _open_pos_total    numeric := 0;
  _active_production integer := 0;
  _bank_balance      numeric := 0;
  _bank_count        integer := 0;
  _month_expenses    numeric := 0;

  _pipeline_value  numeric := 0;
  _pipeline_count  integer := 0;
  _pipeline_stages jsonb   := '{}';
BEGIN
  -- Security: caller must own this business
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = p_business_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- ── Today's sales ─────────────────────────────────────────
  SELECT
    COALESCE(SUM(total), 0),
    COUNT(*)
  INTO _today_total, _today_count
  FROM public.sales
  WHERE business_id  = p_business_id
    AND created_at::date = _today;

  -- ── Yesterday's sales ────────────────────────────────────
  SELECT COALESCE(SUM(total), 0)
  INTO _yesterday_total
  FROM public.sales
  WHERE business_id  = p_business_id
    AND created_at::date = _yesterday;

  -- ── Unpaid invoices (with overdue breakdown) ─────────────
  SELECT
    COUNT(*),
    COALESCE(SUM(total), 0),
    COUNT(*)     FILTER (WHERE due_date < _today::text),
    COALESCE(SUM(total) FILTER (WHERE due_date < _today::text), 0)
  INTO _unpaid_count, _unpaid_total, _overdue_count, _overdue_total
  FROM public.invoices
  WHERE business_id = p_business_id
    AND status IN ('sent', 'overdue', 'partial');

  -- ── Products — inventory value + low-stock list ──────────
  SELECT
    COUNT(*),
    COALESCE(SUM(qty * cost_price),     0),
    COALESCE(SUM(qty * selling_price),  0),
    COUNT(*) FILTER (WHERE qty = 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id',            id,
          'name',          name,
          'qty',           qty,
          'reorder_level', reorder_level,
          'cost_price',    cost_price,
          'selling_price', selling_price
        ) ORDER BY qty ASC
      ) FILTER (WHERE qty <= reorder_level),
      '[]'::jsonb
    )
  INTO _total_products, _inv_cost, _inv_retail, _out_of_stock, _low_stock
  FROM public.products
  WHERE business_id = p_business_id;

  -- ── Customers ────────────────────────────────────────────
  SELECT COUNT(*) INTO _customer_count
  FROM public.customers
  WHERE business_id = p_business_id;

  -- ── Open leads ───────────────────────────────────────────
  SELECT COUNT(*) INTO _open_leads
  FROM public.leads
  WHERE business_id = p_business_id
    AND status IN ('new', 'contacted', 'qualified');

  -- ── Open purchase orders ─────────────────────────────────
  SELECT COUNT(*), COALESCE(SUM(total), 0)
  INTO _open_pos_count, _open_pos_total
  FROM public.purchase_orders
  WHERE business_id = p_business_id
    AND status IN ('draft', 'sent', 'confirmed');

  -- ── Active production orders ──────────────────────────────
  SELECT COUNT(*) INTO _active_production
  FROM public.production_orders
  WHERE business_id = p_business_id
    AND status IN ('planned', 'in_progress');

  -- ── Bank accounts ─────────────────────────────────────────
  SELECT COUNT(*), COALESCE(SUM(balance), 0)
  INTO _bank_count, _bank_balance
  FROM public.bank_accounts
  WHERE business_id = p_business_id
    AND is_active = true;

  -- ── Month expenses ────────────────────────────────────────
  SELECT COALESCE(SUM(amount), 0) INTO _month_expenses
  FROM public.expenses
  WHERE business_id = p_business_id
    AND date >= _month_start;

  -- ── Opportunities pipeline ────────────────────────────────
  SELECT
    COALESCE(SUM(stage_count), 0),
    COALESCE(SUM(stage_value), 0),
    COALESCE(
      jsonb_object_agg(
        stage,
        jsonb_build_object('count', stage_count, 'value', stage_value)
      ),
      '{}'::jsonb
    )
  INTO _pipeline_count, _pipeline_value, _pipeline_stages
  FROM (
    SELECT
      stage,
      COUNT(*)              AS stage_count,
      COALESCE(SUM(value), 0) AS stage_value
    FROM public.opportunities
    WHERE business_id = p_business_id
      AND status = 'open'
    GROUP BY stage
  ) sub;

  -- ── Return single JSONB object ────────────────────────────
  RETURN jsonb_build_object(
    'today_total',       _today_total,
    'today_count',       _today_count,
    'yesterday_total',   _yesterday_total,
    'unpaid_count',      _unpaid_count,
    'unpaid_total',      _unpaid_total,
    'overdue_count',     _overdue_count,
    'overdue_total',     _overdue_total,
    'low_stock',         _low_stock,
    'out_of_stock',      _out_of_stock,
    'total_products',    _total_products,
    'inv_cost',          _inv_cost,
    'inv_retail',        _inv_retail,
    'customer_count',    _customer_count,
    'open_leads',        _open_leads,
    'open_pos_count',    _open_pos_count,
    'open_pos_total',    _open_pos_total,
    'active_production', _active_production,
    'bank_balance',      _bank_balance,
    'bank_count',        _bank_count,
    'month_expenses',    _month_expenses,
    'pipeline_count',    _pipeline_count,
    'pipeline_value',    _pipeline_value,
    'pipeline_stages',   _pipeline_stages
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;
