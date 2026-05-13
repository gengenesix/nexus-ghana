-- ================================================================
-- NEXUS-GH COMPLETE DATABASE SETUP
-- ================================================================
--
-- This file contains ALL custom migrations for the Nexus-GH
-- Supabase project in a single runnable script.
--
-- HOW TO RUN:
--   Option A (Supabase CLI):
--     supabase db push                  ← runs each migration file
--
--   Option B (SQL Editor in Supabase Dashboard):
--     Paste this entire file into the SQL Editor and click Run.
--     Supabase Dashboard → SQL Editor → New query → Paste → Run
--
--   Option C (psql):
--     psql "$DATABASE_URL" -f NEXUS_GH_SETUP.sql
--
-- PREREQUISITES:
--   • The base schema (tables: businesses, staff_members, products,
--     sales, sale_items, invoices, customers, purchase_orders,
--     production_orders, bank_accounts, expenses, leads,
--     opportunities) must already exist.
--   • This script is IDEMPOTENT — safe to run multiple times.
--
-- MIGRATIONS INCLUDED:
--   000001  Secure staff PINs (bcrypt + rate limiting)
--   000002  Atomic invoice number sequencing
--   000003  Loyalty points increment RPC
--   000004  Void sale RPC (stock restore)
--   000005  Phase 5 (barcode, PO items, receive_purchase_order)
--   000006  Split payments JSONB column
--   000007  Fix staff PIN mass-lockout vulnerability
--   000008  Add role check to void_sale RPC
--   000009  Dashboard stats single-function RPC
--   000010  Auto in-app notifications (overdue + low-stock triggers)
--   000011  pg_cron schedule for mark_overdue_invoices
--
-- REQUIRED ENV VARS FOR EDGE FUNCTIONS (set in Supabase Dashboard
-- → Edge Functions → Secrets):
--   RESEND_API_KEY          send-notifications email digest
--   FROM_EMAIL              e.g. "Nexus-GH <noreply@nexusgh.com>"
--   HUBTEL_CLIENT_ID        momo-collect (Hubtel MoMo)
--   HUBTEL_CLIENT_SECRET    momo-collect (Hubtel MoMo)
-- ================================================================


-- ================================================================
-- 000001: SECURE STAFF PIN AUTHENTICATION
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

UPDATE public.staff_members
SET pin = crypt(pin, gen_salt('bf', 10))
WHERE pin IS NOT NULL
  AND pin != ''
  AND pin NOT LIKE '$2%';

CREATE OR REPLACE FUNCTION public.hash_staff_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pin IS NOT NULL AND NEW.pin != '' AND NEW.pin NOT LIKE '$2%' THEN
    NEW.pin := crypt(NEW.pin, gen_salt('bf', 10));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_staff_pin_change ON public.staff_members;
CREATE TRIGGER before_staff_pin_change
  BEFORE INSERT OR UPDATE OF pin ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.hash_staff_pin();

CREATE OR REPLACE FUNCTION public.staff_logout(_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN;
END;
$$;


-- ================================================================
-- 000002: ATOMIC INVOICE NUMBER SEQUENCING
-- ================================================================

CREATE TABLE IF NOT EXISTS public.invoice_counters (
  business_id uuid    NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  year        integer NOT NULL,
  last_value  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, year)
);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'invoice_counters'
      AND policyname = 'Business owner can manage invoice counters'
  ) THEN
    CREATE POLICY "Business owner can manage invoice counters"
      ON public.invoice_counters FOR ALL
      USING (business_id = public.get_business_id())
      WITH CHECK (business_id = public.get_business_id());
  END IF;
END $$;

INSERT INTO public.invoice_counters (business_id, year, last_value)
SELECT
  business_id,
  EXTRACT(YEAR FROM CURRENT_DATE)::integer AS year,
  COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS integer)), 0) AS last_value
FROM public.invoices
WHERE invoice_number LIKE 'NXG-%'
GROUP BY business_id
ON CONFLICT (business_id, year) DO UPDATE
  SET last_value = GREATEST(invoice_counters.last_value, EXCLUDED.last_value);

DROP FUNCTION IF EXISTS public.generate_invoice_number();

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _business_id uuid;
  _year        integer;
  _next        integer;
BEGIN
  _business_id := public.get_business_id();
  _year        := EXTRACT(YEAR FROM CURRENT_DATE)::integer;

  INSERT INTO public.invoice_counters (business_id, year, last_value)
  VALUES (_business_id, _year, 0)
  ON CONFLICT (business_id, year) DO NOTHING;

  UPDATE public.invoice_counters
     SET last_value = last_value + 1
   WHERE business_id = _business_id
     AND year = _year
  RETURNING last_value INTO _next;

  RETURN 'NXG-' || _year::text || '-' || LPAD(_next::text, 3, '0');
END;
$$;


-- ================================================================
-- 000003: LOYALTY POINTS RPC
-- ================================================================

CREATE OR REPLACE FUNCTION public.increment_loyalty_points(
  p_customer_id uuid,
  p_points      integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE customers
     SET loyalty_points = loyalty_points + p_points
   WHERE id = p_customer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_loyalty_points(uuid, integer) TO authenticated;


-- ================================================================
-- 000004: VOID SALE RPC (stock restore)
-- ================================================================

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS voided    boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid;

-- Initial void_sale without role check (superseded by 000008)
-- Kept here for reference — the role-checked version below replaces it.


-- ================================================================
-- 000005: PHASE 5 (barcode, PO items, receive_purchase_order)
-- ================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode text;

CREATE OR REPLACE FUNCTION public.decrement_loyalty_points(
  p_customer_id uuid,
  p_points      integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE customers
     SET loyalty_points = GREATEST(0, loyalty_points - p_points)
   WHERE id = p_customer_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.decrement_loyalty_points(uuid, integer) TO authenticated;

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id       uuid        NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id  uuid        REFERENCES public.products(id),
  description text        NOT NULL,
  qty         numeric     NOT NULL DEFAULT 1,
  unit_price  numeric     NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_items' AND policyname = 'po_items_select') THEN
    CREATE POLICY "po_items_select" ON public.purchase_order_items FOR SELECT
      USING (EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = po_id AND po.business_id = get_business_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_items' AND policyname = 'po_items_insert') THEN
    CREATE POLICY "po_items_insert" ON public.purchase_order_items FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = po_id AND po.business_id = get_business_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_items' AND policyname = 'po_items_delete') THEN
    CREATE POLICY "po_items_delete" ON public.purchase_order_items FOR DELETE
      USING (EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = po_id AND po.business_id = get_business_id()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_po_id       uuid,
  p_business_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM purchase_orders WHERE id = p_po_id AND business_id = p_business_id) THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;
  IF EXISTS (SELECT 1 FROM purchase_orders WHERE id = p_po_id AND status = 'received') THEN
    RAISE EXCEPTION 'Purchase order already received';
  END IF;

  UPDATE products p
     SET qty = p.qty + poi.qty, updated_at = now()
    FROM purchase_order_items poi
   WHERE poi.po_id = p_po_id AND poi.product_id = p.id;

  UPDATE purchase_orders SET status = 'received' WHERE id = p_po_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid, uuid) TO authenticated;


-- ================================================================
-- 000006: SPLIT PAYMENTS
-- ================================================================

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_splits jsonb;


-- ================================================================
-- 000007: FIX verify_staff_pin MASS-LOCKOUT VULNERABILITY
-- ================================================================

CREATE OR REPLACE FUNCTION public.verify_staff_pin(
  _business_id uuid,
  _pin         text,
  _staff_id    uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff record;
BEGIN
  -- ── Targeted path: staff_id known ──────────────────────────
  IF _staff_id IS NOT NULL THEN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until
      INTO _staff
      FROM public.staff_members s
     WHERE s.id = _staff_id AND s.business_id = _business_id AND s.status = 'active';

    IF NOT FOUND THEN RETURN; END IF;
    IF _staff.locked_until IS NOT NULL AND _staff.locked_until > now() THEN RETURN; END IF;

    IF crypt(_pin, _staff.pin) = _staff.pin THEN
      UPDATE public.staff_members SET failed_attempts = 0, locked_until = NULL WHERE id = _staff.id;
      RETURN QUERY SELECT _staff.id, _staff.name, _staff.role;
      RETURN;
    END IF;

    UPDATE public.staff_members
       SET failed_attempts = failed_attempts + 1,
           locked_until    = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
     WHERE id = _staff.id;

    RETURN;
  END IF;

  -- ── Legacy path: no staff_id — match by PIN only, no mass-lockout ──
  FOR _staff IN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until
      FROM public.staff_members s
     WHERE s.business_id = _business_id AND s.status = 'active'
  LOOP
    IF _staff.locked_until IS NOT NULL AND _staff.locked_until > now() THEN CONTINUE; END IF;
    IF crypt(_pin, _staff.pin) = _staff.pin THEN
      UPDATE public.staff_members SET failed_attempts = 0, locked_until = NULL WHERE id = _staff.id;
      RETURN QUERY SELECT _staff.id, _staff.name, _staff.role;
      RETURN;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_staff_pin(uuid, text, uuid) TO authenticated;


-- ================================================================
-- 000008: ADD ROLE CHECK TO void_sale
-- ================================================================

CREATE OR REPLACE FUNCTION public.void_sale(
  p_sale_id     uuid,
  p_business_id uuid,
  p_staff_id    uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff_role    text;
  _allowed_roles text[] := ARRAY[
    'System Administrator', 'Administrator', 'Manager',
    'CFO / Finance Manager', 'Accountant', 'Sales Manager',
    'Supervisor', 'Executive / CEO'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sales WHERE id = p_sale_id AND business_id = p_business_id) THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  IF EXISTS (SELECT 1 FROM sales WHERE id = p_sale_id AND voided = true) THEN
    RAISE EXCEPTION 'Sale is already voided';
  END IF;

  IF p_staff_id IS NOT NULL THEN
    SELECT role INTO _staff_role
      FROM public.staff_members
     WHERE id = p_staff_id AND business_id = p_business_id AND status = 'active';
    IF NOT FOUND THEN RAISE EXCEPTION 'Staff member not found'; END IF;
    IF NOT (_staff_role = ANY(_allowed_roles)) THEN
      RAISE EXCEPTION 'Insufficient permissions: role "%" cannot void sales', _staff_role;
    END IF;
  END IF;

  UPDATE sales SET voided = true, voided_at = now(), voided_by = p_staff_id WHERE id = p_sale_id;

  UPDATE products p
     SET qty = p.qty + si.qty
    FROM sale_items si
   WHERE si.sale_id = p_sale_id AND si.product_id = p.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_sale(uuid, uuid, uuid) TO authenticated;


-- ================================================================
-- 000009: DASHBOARD STATS SINGLE-FUNCTION RPC
-- Replaces 11 parallel client queries with one DB call.
-- ================================================================

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
  _unpaid_count     integer := 0;
  _unpaid_total     numeric := 0;
  _overdue_count    integer := 0;
  _overdue_total    numeric := 0;
  _low_stock        jsonb   := '[]';
  _out_of_stock     integer := 0;
  _total_products   integer := 0;
  _inv_cost         numeric := 0;
  _inv_retail       numeric := 0;
  _customer_count   integer := 0;
  _open_leads       integer := 0;
  _open_pos_count   integer := 0;
  _open_pos_total   numeric := 0;
  _active_production integer := 0;
  _bank_balance     numeric := 0;
  _bank_count       integer := 0;
  _month_expenses   numeric := 0;
  _pipeline_value   numeric := 0;
  _pipeline_count   integer := 0;
  _pipeline_stages  jsonb   := '{}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COALESCE(SUM(total), 0), COUNT(*)
    INTO _today_total, _today_count
    FROM public.sales
   WHERE business_id = p_business_id AND created_at::date = _today;

  SELECT COALESCE(SUM(total), 0)
    INTO _yesterday_total
    FROM public.sales
   WHERE business_id = p_business_id AND created_at::date = _yesterday;

  SELECT COUNT(*), COALESCE(SUM(total), 0),
         COUNT(*) FILTER (WHERE due_date < _today::text),
         COALESCE(SUM(total) FILTER (WHERE due_date < _today::text), 0)
    INTO _unpaid_count, _unpaid_total, _overdue_count, _overdue_total
    FROM public.invoices
   WHERE business_id = p_business_id AND status IN ('sent', 'overdue', 'partial');

  SELECT COUNT(*),
         COALESCE(SUM(qty * cost_price), 0),
         COALESCE(SUM(qty * selling_price), 0),
         COUNT(*) FILTER (WHERE qty = 0),
         COALESCE(jsonb_agg(
           jsonb_build_object('id', id, 'name', name, 'qty', qty,
                              'reorder_level', reorder_level,
                              'cost_price', cost_price, 'selling_price', selling_price)
           ORDER BY qty ASC
         ) FILTER (WHERE qty <= reorder_level), '[]'::jsonb)
    INTO _total_products, _inv_cost, _inv_retail, _out_of_stock, _low_stock
    FROM public.products
   WHERE business_id = p_business_id;

  SELECT COUNT(*) INTO _customer_count FROM public.customers WHERE business_id = p_business_id;
  SELECT COUNT(*) INTO _open_leads FROM public.leads
   WHERE business_id = p_business_id AND status IN ('new', 'contacted', 'qualified');

  SELECT COUNT(*), COALESCE(SUM(total), 0)
    INTO _open_pos_count, _open_pos_total
    FROM public.purchase_orders
   WHERE business_id = p_business_id AND status IN ('draft', 'sent', 'confirmed');

  SELECT COUNT(*) INTO _active_production FROM public.production_orders
   WHERE business_id = p_business_id AND status IN ('planned', 'in_progress');

  SELECT COUNT(*), COALESCE(SUM(balance), 0)
    INTO _bank_count, _bank_balance
    FROM public.bank_accounts
   WHERE business_id = p_business_id AND is_active = true;

  SELECT COALESCE(SUM(amount), 0) INTO _month_expenses
    FROM public.expenses
   WHERE business_id = p_business_id AND date >= _month_start;

  SELECT COALESCE(SUM(stage_count), 0), COALESCE(SUM(stage_value), 0),
         COALESCE(jsonb_object_agg(stage, jsonb_build_object('count', stage_count, 'value', stage_value)), '{}')
    INTO _pipeline_count, _pipeline_value, _pipeline_stages
    FROM (
      SELECT stage, COUNT(*) AS stage_count, COALESCE(SUM(value), 0) AS stage_value
        FROM public.opportunities
       WHERE business_id = p_business_id AND status = 'open'
       GROUP BY stage
    ) sub;

  RETURN jsonb_build_object(
    'today_total', _today_total, 'today_count', _today_count,
    'yesterday_total', _yesterday_total,
    'unpaid_count', _unpaid_count, 'unpaid_total', _unpaid_total,
    'overdue_count', _overdue_count, 'overdue_total', _overdue_total,
    'low_stock', _low_stock, 'out_of_stock', _out_of_stock,
    'total_products', _total_products, 'inv_cost', _inv_cost, 'inv_retail', _inv_retail,
    'customer_count', _customer_count,
    'open_leads', _open_leads,
    'open_pos_count', _open_pos_count, 'open_pos_total', _open_pos_total,
    'active_production', _active_production,
    'bank_balance', _bank_balance, 'bank_count', _bank_count,
    'month_expenses', _month_expenses,
    'pipeline_count', _pipeline_count, 'pipeline_value', _pipeline_value,
    'pipeline_stages', _pipeline_stages
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;


-- ================================================================
-- 000010: AUTO IN-APP NOTIFICATIONS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type        text        NOT NULL DEFAULT 'info',
  title       text        NOT NULL,
  message     text        NOT NULL DEFAULT '',
  is_read     boolean     NOT NULL DEFAULT false,
  link        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Business members can view notifications') THEN
    CREATE POLICY "Business members can view notifications" ON public.notifications FOR SELECT
      USING (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Business members can update notifications') THEN
    CREATE POLICY "Business members can update notifications" ON public.notifications FOR UPDATE
      USING (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'System can insert notifications') THEN
    CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.notify_invoice_overdue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'overdue' AND (OLD.status IS DISTINCT FROM 'overdue') THEN
    INSERT INTO public.notifications (business_id, type, title, message, link)
    VALUES (
      NEW.business_id, 'warning',
      'Invoice Overdue: ' || NEW.invoice_number,
      NEW.customer_name || ' — GHS ' || to_char(NEW.total, 'FM999,999,990.00') || ' overdue since ' || NEW.due_date,
      '/invoices'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_overdue ON public.invoices;
CREATE TRIGGER trg_invoice_overdue
  AFTER INSERT OR UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.notify_invoice_overdue();

CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.qty <= NEW.reorder_level AND OLD.qty > OLD.reorder_level THEN
    INSERT INTO public.notifications (business_id, type, title, message, link)
    VALUES (
      NEW.business_id,
      CASE WHEN NEW.qty = 0 THEN 'error' ELSE 'warning' END,
      CASE WHEN NEW.qty = 0 THEN 'Out of Stock: ' || NEW.name ELSE 'Low Stock: ' || NEW.name END,
      CASE WHEN NEW.qty = 0
           THEN NEW.name || ' is out of stock — restock immediately.'
           ELSE NEW.name || ' has only ' || NEW.qty || ' units left (reorder at ' || NEW.reorder_level || ').'
      END,
      '/inventory'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_low_stock ON public.products;
CREATE TRIGGER trg_low_stock
  AFTER UPDATE OF qty ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();

CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated integer;
BEGIN
  UPDATE public.invoices
     SET status = 'overdue'
   WHERE status IN ('sent', 'partial')
     AND due_date < CURRENT_DATE::text;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_overdue_invoices() TO service_role;


-- ================================================================
-- 000011: pg_cron — DAILY OVERDUE INVOICE MARKING
-- Runs at 07:50 UTC every day, 10 min before the email digest.
-- Requires pg_cron extension (enabled by default on Supabase Pro).
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mark-overdue-invoices-daily') THEN
    PERFORM cron.unschedule('mark-overdue-invoices-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'mark-overdue-invoices-daily',
  '50 7 * * *',
  $$SELECT public.mark_overdue_invoices();$$
);


-- ================================================================
-- 000012: SERVICE CONTRACTS + CUSTOMER EQUIPMENT TABLES
-- ================================================================

CREATE TABLE IF NOT EXISTS public.service_contracts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id      uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name    text        NOT NULL,
  contract_number  text        NOT NULL,
  type             text        NOT NULL DEFAULT 'maintenance',
  start_date       date        NOT NULL,
  end_date         date        NOT NULL,
  value            numeric     NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'active',
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_contracts' AND policyname = 'sc_select') THEN
    CREATE POLICY "sc_select" ON public.service_contracts FOR SELECT USING (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_contracts' AND policyname = 'sc_insert') THEN
    CREATE POLICY "sc_insert" ON public.service_contracts FOR INSERT WITH CHECK (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_contracts' AND policyname = 'sc_update') THEN
    CREATE POLICY "sc_update" ON public.service_contracts FOR UPDATE USING (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_contracts' AND policyname = 'sc_delete') THEN
    CREATE POLICY "sc_delete" ON public.service_contracts FOR DELETE USING (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.customer_equipment (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id     uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name   text        NOT NULL,
  product_id      uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  serial_number   text,
  model           text,
  brand           text,
  purchase_date   date,
  warranty_end    date,
  status          text        NOT NULL DEFAULT 'active',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_equipment ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_equipment' AND policyname = 'ce_select') THEN
    CREATE POLICY "ce_select" ON public.customer_equipment FOR SELECT USING (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_equipment' AND policyname = 'ce_insert') THEN
    CREATE POLICY "ce_insert" ON public.customer_equipment FOR INSERT WITH CHECK (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_equipment' AND policyname = 'ce_update') THEN
    CREATE POLICY "ce_update" ON public.customer_equipment FOR UPDATE USING (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_equipment' AND policyname = 'ce_delete') THEN
    CREATE POLICY "ce_delete" ON public.customer_equipment FOR DELETE USING (business_id = public.get_business_id());
  END IF;
END $$;


-- ================================================================
-- DONE ✓
-- All 12 migrations applied. Deploy Edge Functions with:
--   supabase functions deploy send-notifications
--   supabase functions deploy momo-collect
-- ================================================================
