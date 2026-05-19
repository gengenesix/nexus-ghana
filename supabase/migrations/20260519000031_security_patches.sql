-- ============================================================
-- Migration 000031: Security patches
-- ============================================================
-- Fixes for audit findings:
--   H-1  submit_sale — reject negative or zero item quantities
--   H-4  Notifications INSERT policy — restrict to own business
--   M-2  generate_rx_number — collision-safe counter table
--   M-3  staff_logout — write to audit_logs instead of no-op
-- ============================================================


-- ─── H-1: submit_sale — reject qty ≤ 0 ──────────────────────────────────────
--
-- The old RPC only checked `v_prod_qty < v_item_qty`, which passes when qty is
-- negative (any stock satisfies the check). A negative qty causes the UPDATE
-- `qty = qty - v_item_qty` to ADD stock instead of subtracting it — exploitable
-- for fraudulent stock inflation.

CREATE OR REPLACE FUNCTION public.submit_sale(
  p_business_id     uuid,
  p_receipt_number  text,
  p_subtotal        numeric,
  p_discount_pct    numeric,
  p_discount_amount numeric,
  p_total           numeric,
  p_payment_method  text,
  p_payment_splits  jsonb,
  p_staff_id        uuid,
  p_customer_id     uuid,
  p_items           jsonb  -- [{product_id, product_name, qty, unit_price}]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id    uuid;
  v_item       jsonb;
  v_prod_id    uuid;
  v_prod_qty   numeric;
  v_prod_name  text;
  v_item_qty   numeric;
BEGIN
  -- ── Step 1: validate + lock each product row ────────────────────────────────
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_prod_id   := (v_item->>'product_id')::uuid;
    v_item_qty  := (v_item->>'qty')::numeric;
    v_prod_name := v_item->>'product_name';

    -- ★ Security fix H-1: reject zero or negative quantities
    IF v_item_qty IS NULL OR v_item_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be positive for "%". Got: %',
        COALESCE(v_prod_name, 'unknown'), v_item_qty;
    END IF;

    IF v_prod_id IS NULL THEN
      CONTINUE;  -- custom line item — skip stock check
    END IF;

    SELECT qty INTO v_prod_qty
    FROM public.products
    WHERE id = v_prod_id
      AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found or does not belong to this business: %', v_prod_name;
    END IF;

    IF v_prod_qty < v_item_qty THEN
      RAISE EXCEPTION 'Insufficient stock for "%". Available: %, Requested: %',
        v_prod_name, v_prod_qty, v_item_qty;
    END IF;
  END LOOP;

  -- ── Step 2: insert the sale record ─────────────────────────────────────────
  INSERT INTO public.sales (
    business_id, receipt_number, subtotal, discount_percent,
    discount_amount, total, payment_method, payment_splits,
    staff_id, customer_id
  ) VALUES (
    p_business_id, p_receipt_number, p_subtotal, p_discount_pct,
    p_discount_amount, p_total, p_payment_method, p_payment_splits,
    p_staff_id, p_customer_id
  )
  RETURNING id INTO v_sale_id;

  -- ── Step 3: insert items + decrement stock ──────────────────────────────────
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_prod_id  := (v_item->>'product_id')::uuid;
    v_item_qty := (v_item->>'qty')::numeric;

    INSERT INTO public.sale_items (
      sale_id, product_id, product_name, qty, unit_price
    ) VALUES (
      v_sale_id,
      v_prod_id,
      v_item->>'product_name',
      v_item_qty,
      (v_item->>'unit_price')::numeric
    );

    IF v_prod_id IS NOT NULL THEN
      UPDATE public.products
      SET qty = qty - v_item_qty
      WHERE id = v_prod_id
        AND business_id = p_business_id;
    END IF;
  END LOOP;

  RETURN v_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_sale(
  uuid, text, numeric, numeric, numeric, numeric,
  text, jsonb, uuid, uuid, jsonb
) TO authenticated;


-- ─── H-4: Notifications INSERT — restrict to own business ────────────────────
--
-- Old policy was WITH CHECK (true) — any authenticated user could insert a
-- notification for any business_id.
-- Triggers run as SECURITY DEFINER and bypass RLS entirely, so they are
-- unaffected by this restriction. Only direct client-side inserts are blocked.

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Business members can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (business_id = public.get_business_id());


-- ─── M-2: generate_rx_number — collision-safe counter ────────────────────────
--
-- The old version did COUNT(*) with no locking — two concurrent creates could
-- read the same count and produce duplicate Rx numbers.
-- Fix: dedicated counter table with SELECT FOR UPDATE (same pattern as
-- invoice_counters used for invoice numbering).

CREATE TABLE IF NOT EXISTS public.rx_counters (
  business_id uuid NOT NULL,
  year        text NOT NULL,
  last_value  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, year)
);

ALTER TABLE public.rx_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rx_counters_business_only"
  ON public.rx_counters FOR ALL
  USING (business_id = public.get_business_id())
  WITH CHECK (business_id = public.get_business_id());

CREATE OR REPLACE FUNCTION public.generate_rx_number(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year  text    := to_char(now(), 'YYYY');
  v_count integer;
BEGIN
  -- Upsert the counter row and atomically increment it.
  -- SELECT FOR UPDATE serialises concurrent calls for the same business+year.
  INSERT INTO public.rx_counters (business_id, year, last_value)
  VALUES (p_business_id, v_year, 1)
  ON CONFLICT (business_id, year)
  DO UPDATE SET last_value = rx_counters.last_value + 1
  RETURNING last_value INTO v_count;

  RETURN 'RX-' || v_year || '-' || LPAD(v_count::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_rx_number(uuid) TO authenticated;


-- ─── M-3: staff_logout — write audit entry instead of being a no-op ──────────
--
-- The old stub returned immediately without doing anything.
-- Now it appends a logout event to audit_logs for auditability.
-- Does NOT invalidate the Supabase JWT (that requires the auth admin API),
-- but the event is recorded for forensic purposes.

CREATE OR REPLACE FUNCTION public.staff_logout(_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
BEGIN
  SELECT business_id INTO v_business_id
  FROM public.staff_members
  WHERE id = _staff_id
  LIMIT 1;

  IF v_business_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      business_id, action, module, record_id, performed_by
    ) VALUES (
      v_business_id,
      'staff_logout',
      'staff',
      _staff_id::text,
      auth.uid()::text
    );
  END IF;
END;
$$;
