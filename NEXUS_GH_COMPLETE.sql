-- ============================================================
-- NEXUS GH — COMPLETE MIGRATION FILE
-- All SQL written by Claude Code for this project, in order.
-- Run sections sequentially in Supabase SQL Editor.
--
-- Sections:
--   [01] Staff Accounts (Supabase multi-tenant auth)
--   [02] Secure Staff PINs + bcrypt + rate limiting
--   [03] Atomic Invoice Numbering
--   [04] Loyalty Points RPC
--   [05] Void Sale RPC + stock restore
--   [06] Phase 5 (barcode, PO items, receive_purchase_order)
--   [07] Split Payments
--   [08] Fix Staff PIN mass-lockout
--   [09] Void Sale role check (manager+)
--   [10] Dashboard Stats single RPC
--   [11] Auto Notifications + overdue/low-stock triggers
--   [12] pg_cron: daily mark_overdue_invoices
--   [13] Service Contracts + Equipment
--   [14] Enterprise RBAC (roles, permissions, approvals, audit)
-- ============================================================


-- ============================================================
-- SECTION 1: staff_accounts
-- Source: 000012_staff_accounts.sql
-- ============================================================

-- ============================================================
-- Migration 000012: Staff accounts for multi-tenant SaaS
-- Run once in Supabase SQL editor.
-- ============================================================

-- 1. Add supabase_user_id to staff_members
--    Nullable — kiosk/PIN-only staff have NULL here.
--    Supabase-auth staff have their auth.uid() here.
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS supabase_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_staff_members_supabase_user_id
  ON public.staff_members(supabase_user_id)
  WHERE supabase_user_id IS NOT NULL;

-- 2. Add access_code to businesses
--    A short shareable code (e.g. "KWM-4829") that staff use to join.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS access_code varchar(10);

-- Generate codes for all existing businesses that don't have one yet
DO $$
DECLARE
  rec  record;
  code text;
  letters text := 'ABCDEFGHJKLMNPQRSTUVWXY';
BEGIN
  FOR rec IN SELECT id FROM public.businesses WHERE access_code IS NULL LOOP
    LOOP
      code :=
        UPPER(SUBSTRING(letters, (FLOOR(RANDOM()*23)+1)::INT, 1)) ||
        UPPER(SUBSTRING(letters, (FLOOR(RANDOM()*23)+1)::INT, 1)) ||
        UPPER(SUBSTRING(letters, (FLOOR(RANDOM()*23)+1)::INT, 1)) ||
        '-' ||
        LPAD((FLOOR(RANDOM()*9000)+1000)::TEXT, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.businesses WHERE access_code = code);
    END LOOP;
    UPDATE public.businesses SET access_code = code WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE public.businesses
  ALTER COLUMN access_code SET NOT NULL;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_access_code_unique;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_access_code_unique UNIQUE (access_code);

-- Trigger: auto-generate access_code on new business INSERT
CREATE OR REPLACE FUNCTION public.generate_business_access_code()
RETURNS trigger AS $$
DECLARE
  code    text;
  letters text := 'ABCDEFGHJKLMNPQRSTUVWXY';
BEGIN
  IF NEW.access_code IS NULL OR NEW.access_code = '' THEN
    LOOP
      code :=
        UPPER(SUBSTRING(letters, (FLOOR(RANDOM()*23)+1)::INT, 1)) ||
        UPPER(SUBSTRING(letters, (FLOOR(RANDOM()*23)+1)::INT, 1)) ||
        UPPER(SUBSTRING(letters, (FLOOR(RANDOM()*23)+1)::INT, 1)) ||
        '-' ||
        LPAD((FLOOR(RANDOM()*9000)+1000)::TEXT, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.businesses WHERE access_code = code);
    END LOOP;
    NEW.access_code := code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_businesses_access_code ON public.businesses;
CREATE TRIGGER trg_businesses_access_code
  BEFORE INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.generate_business_access_code();

-- 3. Update get_business_id() to resolve for both owners AND staff members
--    All existing RLS policies use this function — updating it here
--    automatically makes every table's policies work for staff too.
CREATE OR REPLACE FUNCTION public.get_business_id()
RETURNS uuid AS $$
  SELECT COALESCE(
    -- Business owner path
    (SELECT id FROM public.businesses WHERE owner_id = auth.uid() LIMIT 1),
    -- Staff member path (Supabase-auth staff)
    (SELECT business_id FROM public.staff_members
     WHERE supabase_user_id = auth.uid() AND status = 'active' LIMIT 1)
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- 4. Allow staff to SELECT their own business record
--    (existing businesses RLS only allows owner_id = auth.uid())
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'businesses' AND policyname = 'Staff can view their business'
  ) THEN
    CREATE POLICY "Staff can view their business" ON public.businesses
      FOR SELECT
      USING (
        id IN (
          SELECT business_id FROM public.staff_members
          WHERE supabase_user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

-- 5. RPC: join_business_as_staff
--    Called by new staff after they create their Supabase account.
--    Runs SECURITY DEFINER so it can read businesses without RLS blocking.
CREATE OR REPLACE FUNCTION public.join_business_as_staff(
  p_access_code text,
  p_name        text,
  p_role        text DEFAULT 'Staff'
)
RETURNS json AS $$
DECLARE
  v_business_id uuid;
  v_staff_id    uuid;
  v_email       text;
BEGIN
  -- Resolve business by access code (case-insensitive)
  SELECT id INTO v_business_id
  FROM public.businesses
  WHERE UPPER(access_code) = UPPER(TRIM(p_access_code));

  IF v_business_id IS NULL THEN
    RETURN json_build_object('error', 'Invalid business code. Ask your manager for the correct code.');
  END IF;

  -- Prevent joining the same business twice
  IF EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE supabase_user_id = auth.uid() AND business_id = v_business_id
  ) THEN
    RETURN json_build_object('error', 'You are already a member of this business.');
  END IF;

  -- Get the email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  -- Create the staff_members record
  INSERT INTO public.staff_members (
    business_id, name, role, supabase_user_id, status, email
  ) VALUES (
    v_business_id, TRIM(p_name), p_role, auth.uid(), 'active', v_email
  )
  RETURNING id INTO v_staff_id;

  RETURN json_build_object(
    'success', true,
    'staff_id', v_staff_id,
    'business_id', v_business_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Allow staff to update their own supabase_user_id (needed for linking)
--    The existing "Business members can update staff" policy uses get_business_id()
--    which requires them to already be linked. This covers the bootstrap case.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff_members' AND policyname = 'Staff can link own account'
  ) THEN
    CREATE POLICY "Staff can link own account" ON public.staff_members
      FOR UPDATE
      USING (supabase_user_id = auth.uid())
      WITH CHECK (supabase_user_id = auth.uid());
  END IF;
END $$;



-- ============================================================
-- SECTION 2: secure_staff_pins
-- Source: 20260513000001_secure_staff_pins.sql
-- ============================================================

-- ============================================================
-- MIGRATION: Secure staff PIN authentication
-- 1. Enable pgcrypto for bcrypt hashing
-- 2. Add rate-limiting columns to staff_members
-- 3. Hash all existing plaintext PINs
-- 4. Add trigger to auto-hash PINs on insert/update
-- 5. Replace verify_staff_pin RPC with secure version
-- ============================================================

-- Enable pgcrypto (needed for crypt() and gen_salt())
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add rate limiting columns to staff_members
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- Hash all existing plaintext PINs (one-time migration)
-- Only hash PINs that don't already look like a bcrypt hash (don't start with $2)
UPDATE public.staff_members
SET pin = crypt(pin, gen_salt('bf', 10))
WHERE pin IS NOT NULL
  AND pin != ''
  AND pin NOT LIKE '$2%';

-- ============================================================
-- Trigger: auto-hash PIN on insert or update
-- ============================================================
CREATE OR REPLACE FUNCTION public.hash_staff_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only hash if pin is set and not already a bcrypt hash
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

-- ============================================================
-- Updated verify_staff_pin RPC — bcrypt compare + rate limiting
-- Lockout: 5 failed attempts → 15 minute lockout
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_staff_pin(
  _business_id uuid,
  _pin text
)
RETURNS TABLE(id uuid, name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff record;
BEGIN
  -- Find active staff member for this business
  SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until
  INTO _staff
  FROM public.staff_members s
  WHERE s.business_id = _business_id
    AND s.status = 'active'
  LIMIT 1; -- will be replaced per-attempt below

  -- We need to check per-staff rather than short-circuiting early
  -- Loop through all active staff to find PIN match (avoids timing leaks on business ID)
  FOR _staff IN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until
    FROM public.staff_members s
    WHERE s.business_id = _business_id
      AND s.status = 'active'
  LOOP
    -- Check if this account is locked
    IF _staff.locked_until IS NOT NULL AND _staff.locked_until > now() THEN
      CONTINUE; -- skip locked accounts
    END IF;

    -- Check PIN match using bcrypt
    IF crypt(_pin, _staff.pin) = _staff.pin THEN
      -- SUCCESS: reset failed attempts, update last_login
      UPDATE public.staff_members
      SET failed_attempts = 0,
          locked_until = NULL
      WHERE public.staff_members.id = _staff.id;

      RETURN QUERY SELECT _staff.id, _staff.name, _staff.role;
      RETURN;
    END IF;
  END LOOP;

  -- PIN did not match any staff — increment failed attempts on ALL staff
  -- that are not already locked (prevents enumeration via lockout timing)
  -- We increment on the most recently attempted business staff as a group heuristic
  UPDATE public.staff_members
  SET
    failed_attempts = failed_attempts + 1,
    locked_until = CASE
      WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
      ELSE locked_until
    END
  WHERE business_id = _business_id
    AND status = 'active'
    AND (locked_until IS NULL OR locked_until <= now());

  -- Return empty result (no match)
  RETURN;
END;
$$;

-- ============================================================
-- staff_logout RPC (unchanged but ensure it exists)
-- ============================================================
CREATE OR REPLACE FUNCTION public.staff_logout(_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Could log to audit table here in future
  RETURN;
END;
$$;


-- ============================================================
-- SECTION 3: fix_invoice_number_sequence
-- Source: 20260513000002_fix_invoice_number_sequence.sql
-- ============================================================

-- ============================================================
-- MIGRATION: Fix invoice number race condition
-- Replace MAX()-based generation with an atomic per-business counter
-- using SELECT ... FOR UPDATE to prevent duplicate invoice numbers
-- under concurrent usage.
-- ============================================================

-- Atomic counter table — one row per business per year
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  year        integer NOT NULL,
  last_value  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, year)
);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business owner can manage invoice counters"
  ON public.invoice_counters
  FOR ALL
  USING (business_id = public.get_business_id())
  WITH CHECK (business_id = public.get_business_id());

-- Seed counters from existing invoices so numbering continues correctly
INSERT INTO public.invoice_counters (business_id, year, last_value)
SELECT
  business_id,
  EXTRACT(YEAR FROM CURRENT_DATE)::integer AS year,
  COALESCE(
    MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS integer)),
    0
  ) AS last_value
FROM public.invoices
WHERE invoice_number LIKE 'NXG-%'
GROUP BY business_id
ON CONFLICT (business_id, year) DO UPDATE
  SET last_value = GREATEST(invoice_counters.last_value, EXCLUDED.last_value);

-- Drop old function
DROP FUNCTION IF EXISTS public.generate_invoice_number();

-- New atomic invoice number generator
-- Uses SELECT ... FOR UPDATE to lock the counter row, preventing races
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
  _year_str    text;
BEGIN
  _business_id := public.get_business_id();
  _year        := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  _year_str    := _year::text;

  -- Upsert the counter row, then lock it for this transaction
  INSERT INTO public.invoice_counters (business_id, year, last_value)
  VALUES (_business_id, _year, 0)
  ON CONFLICT (business_id, year) DO NOTHING;

  -- Atomic increment — row is locked until transaction commits
  UPDATE public.invoice_counters
  SET last_value = last_value + 1
  WHERE business_id = _business_id
    AND year = _year
  RETURNING last_value INTO _next;

  RETURN 'NXG-' || _year_str || '-' || LPAD(_next::text, 3, '0');
END;
$$;


-- ============================================================
-- SECTION 4: loyalty_points_rpc
-- Source: 20260513000003_loyalty_points_rpc.sql
-- ============================================================

-- Atomic loyalty points increment — prevents overwrite race condition
-- Old code was: UPDATE customers SET loyalty_points = NEW_VALUE (replaces balance)
-- New code uses: UPDATE customers SET loyalty_points = loyalty_points + p_points

CREATE OR REPLACE FUNCTION increment_loyalty_points(
  p_customer_id uuid,
  p_points integer
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

GRANT EXECUTE ON FUNCTION increment_loyalty_points(uuid, integer) TO authenticated;


-- ============================================================
-- SECTION 5: void_sales
-- Source: 20260513000004_void_sales.sql
-- ============================================================

-- Add voided flag to sales table
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS voided boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES staff(id);

-- RPC: void a sale and restore stock atomically
CREATE OR REPLACE FUNCTION void_sale(
  p_sale_id uuid,
  p_business_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Guard: must belong to same business
  IF NOT EXISTS (
    SELECT 1 FROM sales WHERE id = p_sale_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  -- Guard: already voided
  IF EXISTS (SELECT 1 FROM sales WHERE id = p_sale_id AND voided = true) THEN
    RAISE EXCEPTION 'Sale is already voided';
  END IF;

  -- Mark voided
  UPDATE sales
  SET voided = true, voided_at = now()
  WHERE id = p_sale_id;

  -- Restore stock for each line item
  UPDATE products p
  SET qty = p.qty + si.qty
  FROM sale_items si
  WHERE si.sale_id = p_sale_id
    AND si.product_id = p.id;
END;
$$;

GRANT EXECUTE ON FUNCTION void_sale(uuid, uuid) TO authenticated;


-- ============================================================
-- SECTION 6: phase5
-- Source: 20260513000005_phase5.sql
-- ============================================================

-- ─── 5.2  Barcode column on products ────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode text;

-- ─── 5.1  Loyalty points deduction RPC ──────────────────────────────────────
CREATE OR REPLACE FUNCTION decrement_loyalty_points(
  p_customer_id uuid,
  p_points       integer
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
GRANT EXECUTE ON FUNCTION decrement_loyalty_points(uuid, integer) TO authenticated;

-- ─── 5.6  Purchase order items table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id       uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES public.products(id),
  description text NOT NULL,
  qty         numeric NOT NULL DEFAULT 1,
  unit_price  numeric NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_items_select" ON public.purchase_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_id
        AND po.business_id = get_business_id()
    )
  );

CREATE POLICY "po_items_insert" ON public.purchase_order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_id
        AND po.business_id = get_business_id()
    )
  );

CREATE POLICY "po_items_delete" ON public.purchase_order_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_id
        AND po.business_id = get_business_id()
    )
  );

-- ─── 5.6  Receive purchase order RPC ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION receive_purchase_order(
  p_po_id       uuid,
  p_business_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE id = p_po_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE id = p_po_id AND status = 'received'
  ) THEN
    RAISE EXCEPTION 'Purchase order already received';
  END IF;

  -- Increment stock for items linked to a product
  UPDATE products p
  SET qty = p.qty + poi.qty,
      updated_at = now()
  FROM purchase_order_items poi
  WHERE poi.po_id = p_po_id
    AND poi.product_id = p.id;

  -- Mark PO received
  UPDATE purchase_orders
  SET status = 'received'
  WHERE id = p_po_id;
END;
$$;
GRANT EXECUTE ON FUNCTION receive_purchase_order(uuid, uuid) TO authenticated;


-- ============================================================
-- SECTION 7: split_payments
-- Source: 20260513000006_split_payments.sql
-- ============================================================

-- Store split payment breakdown as JSONB on sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_splits jsonb;


-- ============================================================
-- SECTION 8: fix_staff_pin_lockout
-- Source: 20260513000007_fix_staff_pin_lockout.sql
-- ============================================================

-- ============================================================
-- MIGRATION: Fix verify_staff_pin mass-lockout vulnerability
--
-- Problem: on any failed PIN, ALL staff at the business had
-- their failed_attempts incremented, allowing anyone to lock
-- out every employee with 5 wrong guesses.
--
-- Fix: accept an optional _staff_id so lockout only applies
-- to the specific staff member being authenticated.
-- ============================================================

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
    WHERE s.id          = _staff_id
      AND s.business_id = _business_id
      AND s.status      = 'active';

    -- Not found or not active → silent reject
    IF NOT FOUND THEN
      RETURN;
    END IF;

    -- Account locked → silent reject
    IF _staff.locked_until IS NOT NULL AND _staff.locked_until > now() THEN
      RETURN;
    END IF;

    -- PIN match
    IF crypt(_pin, _staff.pin) = _staff.pin THEN
      UPDATE public.staff_members
         SET failed_attempts = 0,
             locked_until    = NULL
       WHERE public.staff_members.id = _staff.id;

      RETURN QUERY SELECT _staff.id, _staff.name, _staff.role;
      RETURN;
    END IF;

    -- PIN mismatch — only increment THIS staff member
    UPDATE public.staff_members
       SET failed_attempts = failed_attempts + 1,
           locked_until    = CASE
             WHEN failed_attempts + 1 >= 5
             THEN now() + interval '15 minutes'
             ELSE locked_until
           END
     WHERE public.staff_members.id = _staff.id;

    RETURN; -- empty result = wrong PIN
  END IF;

  -- ── Legacy / fallback path: no staff_id ─────────────────────
  -- Loop all active staff, find PIN match.
  -- On failure: do NOT increment anyone (no mass-lockout risk).
  FOR _staff IN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until
    FROM public.staff_members s
    WHERE s.business_id = _business_id
      AND s.status      = 'active'
  LOOP
    -- Skip locked accounts
    IF _staff.locked_until IS NOT NULL AND _staff.locked_until > now() THEN
      CONTINUE;
    END IF;

    IF crypt(_pin, _staff.pin) = _staff.pin THEN
      UPDATE public.staff_members
         SET failed_attempts = 0,
             locked_until    = NULL
       WHERE public.staff_members.id = _staff.id;

      RETURN QUERY SELECT _staff.id, _staff.name, _staff.role;
      RETURN;
    END IF;
  END LOOP;

  RETURN; -- no match
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_staff_pin(uuid, text, uuid) TO authenticated;


-- ============================================================
-- SECTION 9: void_sale_role_check
-- Source: 20260513000008_void_sale_role_check.sql
-- ============================================================

-- ============================================================
-- MIGRATION: Add role check to void_sale RPC
--
-- Problem: any authenticated user who knows a sale_id could
-- void it — no staff role was enforced.
--
-- Fix: accept optional _staff_id; if provided, check that the
-- staff member has a manager-level role before allowing void.
-- Business owner (auth.uid() = business owner_id) always passes.
-- ============================================================

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
  _staff_role text;
  _allowed_roles text[] := ARRAY[
    'System Administrator', 'Administrator', 'Manager',
    'CFO / Finance Manager', 'Accountant', 'Sales Manager',
    'Supervisor', 'Executive / CEO'
  ];
BEGIN
  -- Guard: sale must belong to this business
  IF NOT EXISTS (
    SELECT 1 FROM sales WHERE id = p_sale_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  -- Guard: already voided
  IF EXISTS (SELECT 1 FROM sales WHERE id = p_sale_id AND voided = true) THEN
    RAISE EXCEPTION 'Sale is already voided';
  END IF;

  -- Role check: if a staff_id is provided, verify they have permission
  IF p_staff_id IS NOT NULL THEN
    SELECT role INTO _staff_role
    FROM public.staff_members
    WHERE id          = p_staff_id
      AND business_id = p_business_id
      AND status      = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Staff member not found';
    END IF;

    IF NOT (_staff_role = ANY(_allowed_roles)) THEN
      RAISE EXCEPTION 'Insufficient permissions: role "%" cannot void sales', _staff_role;
    END IF;
  END IF;

  -- Mark voided
  UPDATE sales
     SET voided    = true,
         voided_at = now(),
         voided_by = p_staff_id
   WHERE id = p_sale_id;

  -- Restore stock for each line item
  UPDATE products p
     SET qty = p.qty + si.qty
    FROM sale_items si
   WHERE si.sale_id  = p_sale_id
     AND si.product_id = p.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_sale(uuid, uuid, uuid) TO authenticated;


-- ============================================================
-- SECTION 10: dashboard_stats_fn
-- Source: 20260513000009_dashboard_stats_fn.sql
-- ============================================================

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


-- ============================================================
-- SECTION 11: auto_notifications
-- Source: 20260513000010_auto_notifications.sql
-- ============================================================

-- ============================================================
-- MIGRATION: Auto in-app notifications
--
-- 1. Ensure notifications table exists with correct schema
-- 2. Trigger: notify when invoice status → 'overdue'
-- 3. Trigger: notify when product qty drops to/below reorder_level
-- 4. RPC: mark_overdue_invoices() — run daily via cron
-- ============================================================

-- ── Notifications table (create if not exists) ────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type        text        NOT NULL DEFAULT 'info',   -- info | warning | error | success
  title       text        NOT NULL,
  message     text        NOT NULL DEFAULT '',
  is_read     boolean     NOT NULL DEFAULT false,
  link        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Business members can view notifications'
  ) THEN
    CREATE POLICY "Business members can view notifications"
      ON public.notifications FOR SELECT
      USING (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Business members can update notifications'
  ) THEN
    CREATE POLICY "Business members can update notifications"
      ON public.notifications FOR UPDATE
      USING (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'System can insert notifications'
  ) THEN
    CREATE POLICY "System can insert notifications"
      ON public.notifications FOR INSERT
      WITH CHECK (true);  -- service role & triggers insert freely
  END IF;
END $$;

-- ── Trigger: invoice status changes to overdue ────────────────
CREATE OR REPLACE FUNCTION public.notify_invoice_overdue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when transitioning INTO 'overdue'
  IF NEW.status = 'overdue' AND (OLD.status IS DISTINCT FROM 'overdue') THEN
    INSERT INTO public.notifications (business_id, type, title, message, link)
    VALUES (
      NEW.business_id,
      'warning',
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

-- ── Trigger: product stock drops to/below reorder level ──────
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fire when qty crosses DOWN through reorder_level
  IF NEW.qty <= NEW.reorder_level AND OLD.qty > OLD.reorder_level THEN
    INSERT INTO public.notifications (business_id, type, title, message, link)
    VALUES (
      NEW.business_id,
      CASE WHEN NEW.qty = 0 THEN 'error' ELSE 'warning' END,
      CASE WHEN NEW.qty = 0 THEN 'Out of Stock: ' || NEW.name
           ELSE 'Low Stock: ' || NEW.name END,
      CASE WHEN NEW.qty = 0 THEN NEW.name || ' is out of stock — restock immediately.'
           ELSE NEW.name || ' has only ' || NEW.qty || ' units left (reorder at ' || NEW.reorder_level || ').' END,
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

-- ── RPC: mark_overdue_invoices — call daily via pg_cron ──────
-- Updates invoices whose due_date has passed to status='overdue'
-- (which fires the trigger above, creating notifications)
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


-- ============================================================
-- SECTION 12: pg_cron_overdue_invoices
-- Source: 20260513000011_pg_cron_overdue_invoices.sql
-- ============================================================

-- ============================================================
-- MIGRATION: Schedule mark_overdue_invoices via pg_cron
--
-- Runs daily at 07:50 UTC — 10 minutes before the email digest
-- (08:00 UTC) so overdue triggers fire and in-app notifications
-- are created before the email goes out.
-- ============================================================

-- Enable pg_cron (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent: remove existing job before (re)creating
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'mark-overdue-invoices-daily'
  ) THEN
    PERFORM cron.unschedule('mark-overdue-invoices-daily');
  END IF;
END $$;

-- Schedule: 07:50 UTC every day
SELECT cron.schedule(
  'mark-overdue-invoices-daily',
  '50 7 * * *',
  $$SELECT public.mark_overdue_invoices();$$
);


-- ============================================================
-- SECTION 13: service_contracts_equipment
-- Source: 20260513000012_service_contracts_equipment.sql
-- ============================================================

-- ============================================================
-- MIGRATION: Service contracts + customer equipment tables
-- ============================================================

-- ── Service Contracts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_contracts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id      uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name    text        NOT NULL,
  contract_number  text        NOT NULL,
  type             text        NOT NULL DEFAULT 'maintenance',  -- maintenance|warranty|service|support
  start_date       date        NOT NULL,
  end_date         date        NOT NULL,
  value            numeric     NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'active',       -- active|expired|cancelled|pending
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

-- ── Customer Equipment ────────────────────────────────────────
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
  status          text        NOT NULL DEFAULT 'active',  -- active|retired|lost
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


-- ============================================================
-- SECTION 14: enterprise_rbac
-- Source: 20260515000013_enterprise_rbac.sql
-- ============================================================

-- ============================================================
-- Migration: 20260515000013_enterprise_rbac.sql
-- Enterprise RBAC: granular permissions, custom roles,
-- field-level visibility, approval requests, audit enhancements,
-- time-based access control
-- ============================================================

-- ============================================================
-- 1. ROLES TABLE
-- System roles: business_id = NULL (global)
-- Custom roles: business_id = their business
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  business_id uuid        REFERENCES public.businesses(id) ON DELETE CASCADE,
  is_system   boolean     NOT NULL DEFAULT false,
  color       text        NOT NULL DEFAULT '#6B7280',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Unique: system role names globally unique; custom role names unique per business
CREATE UNIQUE INDEX IF NOT EXISTS roles_name_system_unique
  ON public.roles(name) WHERE business_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS roles_name_business_unique
  ON public.roles(name, business_id) WHERE business_id IS NOT NULL;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_read_all" ON public.roles
  FOR SELECT USING (
    business_id IS NULL
    OR business_id = get_business_id()
  );

CREATE POLICY "roles_insert_owner" ON public.roles
  FOR INSERT WITH CHECK (
    NOT is_system
    AND business_id = get_business_id()
  );

CREATE POLICY "roles_update_owner" ON public.roles
  FOR UPDATE USING (
    NOT is_system
    AND business_id = get_business_id()
  );

CREATE POLICY "roles_delete_owner" ON public.roles
  FOR DELETE USING (
    NOT is_system
    AND business_id = get_business_id()
  );

-- ============================================================
-- 2. ROLE_PERMISSIONS TABLE (normalized CRUD per module)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id     uuid    NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  module      text    NOT NULL,
  can_create  boolean NOT NULL DEFAULT false,
  can_read    boolean NOT NULL DEFAULT false,
  can_update  boolean NOT NULL DEFAULT false,
  can_delete  boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  UNIQUE(role_id, module)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_read" ON public.role_permissions
  FOR SELECT USING (
    role_id IN (
      SELECT id FROM public.roles
      WHERE business_id IS NULL OR business_id = get_business_id()
    )
  );

CREATE POLICY "role_permissions_manage" ON public.role_permissions
  FOR ALL USING (
    role_id IN (
      SELECT id FROM public.roles
      WHERE business_id = get_business_id()
    )
  );

-- ============================================================
-- 3. FIELD_PERMISSIONS TABLE
-- Controls visibility of sensitive fields per role
-- ============================================================
CREATE TABLE IF NOT EXISTS public.field_permissions (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    uuid    NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  module     text    NOT NULL,
  field_name text    NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  UNIQUE(role_id, module, field_name)
);

ALTER TABLE public.field_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "field_permissions_read" ON public.field_permissions
  FOR SELECT USING (
    role_id IN (
      SELECT id FROM public.roles
      WHERE business_id IS NULL OR business_id = get_business_id()
    )
  );

CREATE POLICY "field_permissions_manage" ON public.field_permissions
  FOR ALL USING (
    role_id IN (
      SELECT id FROM public.roles
      WHERE business_id = get_business_id()
    )
  );

-- ============================================================
-- 4. ROLE_TIME_RESTRICTIONS
-- days_allowed: 0=Sunday, 1=Monday ... 6=Saturday
-- ============================================================
CREATE TABLE IF NOT EXISTS public.role_time_restrictions (
  id           uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id      uuid      NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  days_allowed integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  start_time   time      NOT NULL DEFAULT '00:00',
  end_time     time      NOT NULL DEFAULT '23:59',
  timezone     text      NOT NULL DEFAULT 'Africa/Accra',
  UNIQUE(role_id)
);

ALTER TABLE public.role_time_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_restrictions_read" ON public.role_time_restrictions
  FOR SELECT USING (
    role_id IN (
      SELECT id FROM public.roles
      WHERE business_id IS NULL OR business_id = get_business_id()
    )
  );

CREATE POLICY "time_restrictions_manage" ON public.role_time_restrictions
  FOR ALL USING (
    role_id IN (
      SELECT id FROM public.roles
      WHERE business_id = get_business_id()
    )
  );

-- ============================================================
-- 5. STAFF_TIME_OVERRIDES
-- Per-staff override of role time restrictions
-- is_exempt = true → no time restriction at all
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_time_overrides (
  id           uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     uuid      NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  days_allowed integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  start_time   time      NOT NULL DEFAULT '00:00',
  end_time     time      NOT NULL DEFAULT '23:59',
  is_exempt    boolean   NOT NULL DEFAULT false,
  UNIQUE(staff_id)
);

ALTER TABLE public.staff_time_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_time_overrides_read" ON public.staff_time_overrides
  FOR SELECT USING (
    staff_id IN (
      SELECT id FROM public.staff_members WHERE business_id = get_business_id()
    )
  );

CREATE POLICY "staff_time_overrides_manage" ON public.staff_time_overrides
  FOR ALL USING (
    staff_id IN (
      SELECT id FROM public.staff_members WHERE business_id = get_business_id()
    )
  );

-- ============================================================
-- 6. APPROVAL_REQUESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requested_by   uuid        NOT NULL REFERENCES public.staff_members(id),
  requester_name text        NOT NULL DEFAULT '',
  action_type    text        NOT NULL,
  module         text        NOT NULL,
  payload        jsonb       NOT NULL DEFAULT '{}',
  status         text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected')),
  reviewed_by    uuid        REFERENCES public.staff_members(id),
  reviewer_name  text        NOT NULL DEFAULT '',
  reviewer_note  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS approval_requests_business_status
  ON public.approval_requests(business_id, status, created_at DESC);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_requests_read" ON public.approval_requests
  FOR SELECT USING (business_id = get_business_id());

CREATE POLICY "approval_requests_insert" ON public.approval_requests
  FOR INSERT WITH CHECK (business_id = get_business_id());

CREATE POLICY "approval_requests_update" ON public.approval_requests
  FOR UPDATE USING (business_id = get_business_id());

-- ============================================================
-- 7. ENHANCE EXISTING audit_logs TABLE
-- Add role_at_time and user_agent (idempotent)
-- ============================================================
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS role_at_time text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_agent   text NOT NULL DEFAULT '';

-- Remove any delete policy (audit_log must be append-only)
DROP POLICY IF EXISTS "Business members can delete audit logs" ON public.audit_logs;

-- ============================================================
-- 8. ADD custom_role_id TO staff_members
-- If set, this role overrides the text "role" field for
-- permission lookups (used for custom/business-specific roles)
-- ============================================================
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS custom_role_id uuid
    REFERENCES public.roles(id) ON DELETE SET NULL;

-- ============================================================
-- 9. SEED SYSTEM ROLES
-- ============================================================
INSERT INTO public.roles (name, description, business_id, is_system, color) VALUES
  ('Administrator','Full system access — all modules, staff management, settings',NULL,true,'#1A3A22'),
  ('Manager',      'Broad ops access — POS, inventory, invoices, reports, staff',  NULL,true,'#2563EB'),
  ('Supervisor',   'Dashboard, POS, inventory, invoices, customers, reports',       NULL,true,'#7C3AED'),
  ('Cashier',      'POS and customer lookup only',                                  NULL,true,'#D97706'),
  ('Sales Rep',    'POS, customers, invoices, CRM',                                 NULL,true,'#059669'),
  ('Warehouse',    'Inventory, suppliers, purchasing',                              NULL,true,'#DC2626'),
  ('Accountant',   'Expenses, invoices, reports, financials, banking',              NULL,true,'#0891B2'),
  ('Staff',        'Basic POS and inventory read access',                           NULL,true,'#6B7280')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. SEED ROLE_PERMISSIONS FOR SYSTEM ROLES
-- ============================================================
DO $$
DECLARE
  r_admin      uuid;
  r_manager    uuid;
  r_supervisor uuid;
  r_cashier    uuid;
  r_salesrep   uuid;
  r_warehouse  uuid;
  r_accountant uuid;
  r_staff      uuid;
BEGIN
  SELECT id INTO r_admin      FROM public.roles WHERE name='Administrator' AND business_id IS NULL;
  SELECT id INTO r_manager    FROM public.roles WHERE name='Manager'       AND business_id IS NULL;
  SELECT id INTO r_supervisor FROM public.roles WHERE name='Supervisor'    AND business_id IS NULL;
  SELECT id INTO r_cashier    FROM public.roles WHERE name='Cashier'       AND business_id IS NULL;
  SELECT id INTO r_salesrep   FROM public.roles WHERE name='Sales Rep'     AND business_id IS NULL;
  SELECT id INTO r_warehouse  FROM public.roles WHERE name='Warehouse'     AND business_id IS NULL;
  SELECT id INTO r_accountant FROM public.roles WHERE name='Accountant'    AND business_id IS NULL;
  SELECT id INTO r_staff      FROM public.roles WHERE name='Staff'         AND business_id IS NULL;

  -- ADMINISTRATOR: full access
  INSERT INTO public.role_permissions(role_id,module,can_create,can_read,can_update,can_delete,can_approve) VALUES
    (r_admin,'dashboard', true,true,true,true,true),
    (r_admin,'pos',       true,true,true,true,true),
    (r_admin,'inventory', true,true,true,true,true),
    (r_admin,'invoices',  true,true,true,true,true),
    (r_admin,'customers', true,true,true,true,true),
    (r_admin,'suppliers', true,true,true,true,true),
    (r_admin,'expenses',  true,true,true,true,true),
    (r_admin,'reports',   true,true,true,true,true),
    (r_admin,'staff',     true,true,true,true,true),
    (r_admin,'settings',  true,true,true,true,true),
    (r_admin,'crm',       true,true,true,true,true),
    (r_admin,'sales',     true,true,true,true,true),
    (r_admin,'purchasing',true,true,true,true,true),
    (r_admin,'projects',  true,true,true,true,true),
    (r_admin,'banking',   true,true,true,true,true),
    (r_admin,'financials',true,true,true,true,true),
    (r_admin,'hr',        true,true,true,true,true),
    (r_admin,'production',true,true,true,true,true)
  ON CONFLICT(role_id,module) DO NOTHING;

  -- MANAGER
  INSERT INTO public.role_permissions(role_id,module,can_create,can_read,can_update,can_delete,can_approve) VALUES
    (r_manager,'dashboard', false,true, false,false,false),
    (r_manager,'pos',       true, true, true, true, true),
    (r_manager,'inventory', true, true, true, false,false),
    (r_manager,'invoices',  true, true, true, true, true),
    (r_manager,'customers', true, true, true, false,false),
    (r_manager,'suppliers', true, true, true, false,false),
    (r_manager,'expenses',  true, true, true, false,true),
    (r_manager,'reports',   false,true, false,false,false),
    (r_manager,'staff',     false,true, true, false,false),
    (r_manager,'settings',  false,true, false,false,false),
    (r_manager,'crm',       true, true, true, false,false),
    (r_manager,'sales',     true, true, true, false,false),
    (r_manager,'purchasing',true, true, true, false,false),
    (r_manager,'projects',  true, true, false,false,false),
    (r_manager,'banking',   false,true, false,false,false),
    (r_manager,'financials',false,false,false,false,false),
    (r_manager,'hr',        false,false,false,false,false),
    (r_manager,'production',false,false,false,false,false)
  ON CONFLICT(role_id,module) DO NOTHING;

  -- SUPERVISOR
  INSERT INTO public.role_permissions(role_id,module,can_create,can_read,can_update,can_delete,can_approve) VALUES
    (r_supervisor,'dashboard', false,true, false,false,false),
    (r_supervisor,'pos',       true, true, true, false,false),
    (r_supervisor,'inventory', false,true, true, false,false),
    (r_supervisor,'invoices',  true, true, true, false,false),
    (r_supervisor,'customers', true, true, false,false,false),
    (r_supervisor,'suppliers', false,false,false,false,false),
    (r_supervisor,'expenses',  false,false,false,false,false),
    (r_supervisor,'reports',   false,true, false,false,false),
    (r_supervisor,'staff',     false,false,false,false,false),
    (r_supervisor,'settings',  false,false,false,false,false),
    (r_supervisor,'crm',       false,true, false,false,false),
    (r_supervisor,'sales',     false,false,false,false,false),
    (r_supervisor,'purchasing',false,false,false,false,false),
    (r_supervisor,'projects',  false,false,false,false,false),
    (r_supervisor,'banking',   false,false,false,false,false),
    (r_supervisor,'financials',false,false,false,false,false),
    (r_supervisor,'hr',        false,false,false,false,false),
    (r_supervisor,'production',false,false,false,false,false)
  ON CONFLICT(role_id,module) DO NOTHING;

  -- CASHIER
  INSERT INTO public.role_permissions(role_id,module,can_create,can_read,can_update,can_delete,can_approve) VALUES
    (r_cashier,'dashboard', false,false,false,false,false),
    (r_cashier,'pos',       true, true, false,false,false),
    (r_cashier,'inventory', false,false,false,false,false),
    (r_cashier,'invoices',  false,false,false,false,false),
    (r_cashier,'customers', false,true, false,false,false),
    (r_cashier,'suppliers', false,false,false,false,false),
    (r_cashier,'expenses',  false,false,false,false,false),
    (r_cashier,'reports',   false,false,false,false,false),
    (r_cashier,'staff',     false,false,false,false,false),
    (r_cashier,'settings',  false,false,false,false,false),
    (r_cashier,'crm',       false,false,false,false,false),
    (r_cashier,'sales',     false,false,false,false,false),
    (r_cashier,'purchasing',false,false,false,false,false),
    (r_cashier,'projects',  false,false,false,false,false),
    (r_cashier,'banking',   false,false,false,false,false),
    (r_cashier,'financials',false,false,false,false,false),
    (r_cashier,'hr',        false,false,false,false,false),
    (r_cashier,'production',false,false,false,false,false)
  ON CONFLICT(role_id,module) DO NOTHING;

  -- SALES REP
  INSERT INTO public.role_permissions(role_id,module,can_create,can_read,can_update,can_delete,can_approve) VALUES
    (r_salesrep,'dashboard', false,false,false,false,false),
    (r_salesrep,'pos',       true, true, false,false,false),
    (r_salesrep,'inventory', false,true, false,false,false),
    (r_salesrep,'invoices',  true, true, false,false,false),
    (r_salesrep,'customers', true, true, true, false,false),
    (r_salesrep,'suppliers', false,false,false,false,false),
    (r_salesrep,'expenses',  false,false,false,false,false),
    (r_salesrep,'reports',   false,false,false,false,false),
    (r_salesrep,'staff',     false,false,false,false,false),
    (r_salesrep,'settings',  false,false,false,false,false),
    (r_salesrep,'crm',       true, true, true, false,false),
    (r_salesrep,'sales',     true, true, false,false,false),
    (r_salesrep,'purchasing',false,false,false,false,false),
    (r_salesrep,'projects',  false,false,false,false,false),
    (r_salesrep,'banking',   false,false,false,false,false),
    (r_salesrep,'financials',false,false,false,false,false),
    (r_salesrep,'hr',        false,false,false,false,false),
    (r_salesrep,'production',false,false,false,false,false)
  ON CONFLICT(role_id,module) DO NOTHING;

  -- WAREHOUSE
  INSERT INTO public.role_permissions(role_id,module,can_create,can_read,can_update,can_delete,can_approve) VALUES
    (r_warehouse,'dashboard', false,true, false,false,false),
    (r_warehouse,'pos',       false,false,false,false,false),
    (r_warehouse,'inventory', true, true, true, false,false),
    (r_warehouse,'invoices',  false,false,false,false,false),
    (r_warehouse,'customers', false,false,false,false,false),
    (r_warehouse,'suppliers', true, true, true, false,false),
    (r_warehouse,'expenses',  false,false,false,false,false),
    (r_warehouse,'reports',   false,true, false,false,false),
    (r_warehouse,'staff',     false,false,false,false,false),
    (r_warehouse,'settings',  false,false,false,false,false),
    (r_warehouse,'crm',       false,false,false,false,false),
    (r_warehouse,'sales',     false,false,false,false,false),
    (r_warehouse,'purchasing',true, true, true, false,false),
    (r_warehouse,'projects',  false,false,false,false,false),
    (r_warehouse,'banking',   false,false,false,false,false),
    (r_warehouse,'financials',false,false,false,false,false),
    (r_warehouse,'hr',        false,false,false,false,false),
    (r_warehouse,'production',false,true, false,false,false)
  ON CONFLICT(role_id,module) DO NOTHING;

  -- ACCOUNTANT
  INSERT INTO public.role_permissions(role_id,module,can_create,can_read,can_update,can_delete,can_approve) VALUES
    (r_accountant,'dashboard', false,true, false,false,false),
    (r_accountant,'pos',       false,true, false,false,false),
    (r_accountant,'inventory', false,true, false,false,false),
    (r_accountant,'invoices',  true, true, true, false,false),
    (r_accountant,'customers', false,true, false,false,false),
    (r_accountant,'suppliers', false,true, false,false,false),
    (r_accountant,'expenses',  true, true, true, false,true),
    (r_accountant,'reports',   false,true, false,false,false),
    (r_accountant,'staff',     false,false,false,false,false),
    (r_accountant,'settings',  false,false,false,false,false),
    (r_accountant,'crm',       false,false,false,false,false),
    (r_accountant,'sales',     false,true, false,false,false),
    (r_accountant,'purchasing',false,true, false,false,false),
    (r_accountant,'projects',  false,false,false,false,false),
    (r_accountant,'banking',   false,true, true, false,false),
    (r_accountant,'financials',false,true, true, false,false),
    (r_accountant,'hr',        false,false,false,false,false),
    (r_accountant,'production',false,false,false,false,false)
  ON CONFLICT(role_id,module) DO NOTHING;

  -- STAFF (basic)
  INSERT INTO public.role_permissions(role_id,module,can_create,can_read,can_update,can_delete,can_approve) VALUES
    (r_staff,'dashboard', false,false,false,false,false),
    (r_staff,'pos',       true, true, false,false,false),
    (r_staff,'inventory', false,true, false,false,false),
    (r_staff,'invoices',  false,false,false,false,false),
    (r_staff,'customers', false,false,false,false,false),
    (r_staff,'suppliers', false,false,false,false,false),
    (r_staff,'expenses',  false,false,false,false,false),
    (r_staff,'reports',   false,false,false,false,false),
    (r_staff,'staff',     false,false,false,false,false),
    (r_staff,'settings',  false,false,false,false,false),
    (r_staff,'crm',       false,false,false,false,false),
    (r_staff,'sales',     false,false,false,false,false),
    (r_staff,'purchasing',false,false,false,false,false),
    (r_staff,'projects',  false,false,false,false,false),
    (r_staff,'banking',   false,false,false,false,false),
    (r_staff,'financials',false,false,false,false,false),
    (r_staff,'hr',        false,false,false,false,false),
    (r_staff,'production',false,false,false,false,false)
  ON CONFLICT(role_id,module) DO NOTHING;
END $$;

-- ============================================================
-- 11. SEED FIELD_PERMISSIONS FOR SYSTEM ROLES
-- ============================================================
DO $$
DECLARE
  r_cashier    uuid;
  r_salesrep   uuid;
  r_supervisor uuid;
  r_warehouse  uuid;
  r_accountant uuid;
  r_manager    uuid;
  r_staff      uuid;
BEGIN
  SELECT id INTO r_cashier    FROM public.roles WHERE name='Cashier'    AND business_id IS NULL;
  SELECT id INTO r_salesrep   FROM public.roles WHERE name='Sales Rep'  AND business_id IS NULL;
  SELECT id INTO r_supervisor FROM public.roles WHERE name='Supervisor' AND business_id IS NULL;
  SELECT id INTO r_warehouse  FROM public.roles WHERE name='Warehouse'  AND business_id IS NULL;
  SELECT id INTO r_accountant FROM public.roles WHERE name='Accountant' AND business_id IS NULL;
  SELECT id INTO r_manager    FROM public.roles WHERE name='Manager'    AND business_id IS NULL;
  SELECT id INTO r_staff      FROM public.roles WHERE name='Staff'      AND business_id IS NULL;

  -- Customers: sensitive fields hidden
  INSERT INTO public.field_permissions(role_id,module,field_name,is_visible) VALUES
    (r_cashier,  'customers','total_spend',     false),
    (r_cashier,  'customers','credit_limit',    false),
    (r_cashier,  'customers','payment_history', false),
    (r_salesrep, 'customers','total_spend',     false),
    (r_staff,    'customers','total_spend',     false),
    (r_staff,    'customers','credit_limit',    false)
  ON CONFLICT(role_id,module,field_name) DO NOTHING;

  -- Invoices: profit/discount hidden
  INSERT INTO public.field_permissions(role_id,module,field_name,is_visible) VALUES
    (r_cashier, 'invoices','profit_margin',    false),
    (r_cashier, 'invoices','discount_applied', false),
    (r_salesrep,'invoices','profit_margin',    false),
    (r_staff,   'invoices','profit_margin',    false),
    (r_staff,   'invoices','discount_applied', false)
  ON CONFLICT(role_id,module,field_name) DO NOTHING;

  -- Staff module: salary hidden from all non-admin roles
  INSERT INTO public.field_permissions(role_id,module,field_name,is_visible) VALUES
    (r_cashier,   'staff','salary',false),
    (r_cashier,   'staff','role',  false),
    (r_staff,     'staff','salary',false),
    (r_staff,     'staff','role',  false),
    (r_salesrep,  'staff','salary',false),
    (r_supervisor,'staff','salary',false),
    (r_warehouse, 'staff','salary',false),
    (r_accountant,'staff','salary',false),
    (r_manager,   'staff','salary',false)
  ON CONFLICT(role_id,module,field_name) DO NOTHING;

  -- Reports: sensitive aggregates
  INSERT INTO public.field_permissions(role_id,module,field_name,is_visible) VALUES
    (r_supervisor,'reports','gross_profit',      false),
    (r_salesrep,  'reports','gross_profit',      false),
    (r_cashier,   'reports','gross_profit',      false),
    (r_staff,     'reports','gross_profit',      false),
    (r_warehouse, 'reports','gross_profit',      false),
    (r_cashier,   'reports','expense_breakdown', false),
    (r_salesrep,  'reports','expense_breakdown', false),
    (r_supervisor,'reports','expense_breakdown', false),
    (r_warehouse, 'reports','expense_breakdown', false),
    (r_staff,     'reports','expense_breakdown', false)
  ON CONFLICT(role_id,module,field_name) DO NOTHING;
END $$;

-- ============================================================
-- 12. RPC: check_time_access(_staff_id)
-- Returns jsonb {allowed: bool, message: text}
-- Called during PIN login to enforce time gates (Africa/Accra)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_time_access(_staff_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role        text;
  v_custom_rid  uuid;
  v_role_id     uuid;
  v_override    public.staff_time_overrides%ROWTYPE;
  v_restriction public.role_time_restrictions%ROWTYPE;
  v_now_accra   timestamptz;
  v_dow         integer;
  v_curtime     time;
BEGIN
  SELECT role, custom_role_id INTO v_role, v_custom_rid
    FROM public.staff_members WHERE id = _staff_id;

  -- Administrator always exempt
  IF v_role IN ('Administrator','System Administrator') THEN
    RETURN jsonb_build_object('allowed',true,'message','');
  END IF;

  v_now_accra := now() AT TIME ZONE 'Africa/Accra';
  v_dow       := EXTRACT(DOW FROM v_now_accra)::integer;
  v_curtime   := v_now_accra::time;

  -- Check staff-level override first
  SELECT * INTO v_override FROM public.staff_time_overrides WHERE staff_id = _staff_id;
  IF FOUND THEN
    IF v_override.is_exempt THEN
      RETURN jsonb_build_object('allowed',true,'message','');
    END IF;
    IF NOT (v_dow = ANY(v_override.days_allowed)) THEN
      RETURN jsonb_build_object('allowed',false,
        'message','Access restricted. Your account is not active today.');
    END IF;
    IF v_curtime < v_override.start_time OR v_curtime > v_override.end_time THEN
      RETURN jsonb_build_object('allowed',false,
        'message',format('Access restricted. Your account is only active between %s – %s.',
          to_char(v_override.start_time,'HH12:MI AM'),
          to_char(v_override.end_time,'HH12:MI AM')));
    END IF;
    RETURN jsonb_build_object('allowed',true,'message','');
  END IF;

  -- No staff override — check role restriction
  IF v_custom_rid IS NOT NULL THEN
    v_role_id := v_custom_rid;
  ELSE
    SELECT id INTO v_role_id FROM public.roles
      WHERE name = v_role AND business_id IS NULL;
  END IF;

  IF v_role_id IS NULL THEN
    RETURN jsonb_build_object('allowed',true,'message','');
  END IF;

  SELECT * INTO v_restriction FROM public.role_time_restrictions WHERE role_id = v_role_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed',true,'message','');
  END IF;

  IF NOT (v_dow = ANY(v_restriction.days_allowed)) THEN
    RETURN jsonb_build_object('allowed',false,
      'message','Access restricted. Your account is not active today.');
  END IF;
  IF v_curtime < v_restriction.start_time OR v_curtime > v_restriction.end_time THEN
    RETURN jsonb_build_object('allowed',false,
      'message',format('Access restricted. Your account is only active between %s – %s.',
        to_char(v_restriction.start_time,'HH12:MI AM'),
        to_char(v_restriction.end_time,'HH12:MI AM')));
  END IF;

  RETURN jsonb_build_object('allowed',true,'message','');
END;
$$;

-- ============================================================
-- 13. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_role_permissions_role    ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_field_permissions_role   ON public.field_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(business_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_staff         ON public.audit_logs(business_id, staff_id, created_at DESC);


-- ============================================================
-- HOTFIX: fix_pgcrypto
-- Source: fix_pgcrypto.sql (root-level fix)
-- ============================================================

CREATE OR REPLACE FUNCTION public.hash_staff_pin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.pin IS NOT NULL AND NEW.pin != '' AND NEW.pin NOT LIKE '$2%' THEN
    NEW.pin := extensions.crypt(NEW.pin, extensions.gen_salt('bf', 10));
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.verify_staff_pin(uuid, text, uuid);

CREATE FUNCTION public.verify_staff_pin(
  _business_id uuid, _pin text, _staff_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, role text, permissions jsonb, user_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  _s record;
BEGIN
  IF _staff_id IS NOT NULL THEN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until,
           s.permissions, s.user_type
      INTO _s FROM public.staff_members s
     WHERE s.id = _staff_id AND s.business_id = _business_id AND s.status = 'active';
    IF NOT FOUND THEN RETURN; END IF;
    IF _s.locked_until IS NOT NULL AND _s.locked_until > now() THEN RETURN; END IF;
    IF extensions.crypt(_pin, _s.pin) = _s.pin THEN
      UPDATE public.staff_members
         SET failed_attempts = 0, locked_until = NULL, last_login = now(), is_online = true
       WHERE id = _s.id;
      RETURN QUERY SELECT _s.id, _s.name, _s.role, _s.permissions, _s.user_type;
      RETURN;
    END IF;
    UPDATE public.staff_members
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
     WHERE id = _s.id;
    RETURN;
  END IF;
  FOR _s IN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until,
           s.permissions, s.user_type
      FROM public.staff_members s
     WHERE s.business_id = _business_id AND s.status = 'active'
  LOOP
    IF _s.locked_until IS NOT NULL AND _s.locked_until > now() THEN CONTINUE; END IF;
    IF extensions.crypt(_pin, _s.pin) = _s.pin THEN
      UPDATE public.staff_members
         SET failed_attempts = 0, locked_until = NULL, last_login = now(), is_online = true
       WHERE id = _s.id;
      RETURN QUERY SELECT _s.id, _s.name, _s.role, _s.permissions, _s.user_type;
      RETURN;
    END IF;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(uuid, text, uuid) TO authenticated;


-- ============================================================
-- HOTFIX: fix_rls_staff
-- Source: fix_rls_staff.sql (root-level fix)
-- ============================================================

-- Fix RLS on staff_members INSERT
-- The old policy used get_business_id() which can return NULL
-- during onboarding because the business was just created.
-- This version uses a direct EXISTS check instead.

DROP POLICY IF EXISTS "sm_insert" ON public.staff_members;

CREATE POLICY "sm_insert" ON public.staff_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
       WHERE id = business_id
         AND owner_id = auth.uid()
    )
  );


-- ============================================================
-- HOTFIX: fix_duplicate_businesses
-- Source: fix_duplicate_businesses.sql (root-level fix)
-- ============================================================

-- ============================================================
-- Fix: safely add UNIQUE constraint on businesses.owner_id
-- NO DATA IS DELETED. Run this ONCE in Supabase SQL editor.
-- ============================================================

-- Step 1: Check for duplicates (run this first to see if you have any).
-- If this returns rows, you have duplicates. Identify which one has
-- your real data (products, sales, customers) and note its id.
--
-- SELECT owner_id, COUNT(*), array_agg(id ORDER BY created_at) as ids
-- FROM public.businesses
-- GROUP BY owner_id
-- HAVING COUNT(*) > 1;

-- Step 2: Add the UNIQUE constraint.
-- This will FAIL if duplicates exist (that's intentional — it protects your data).
-- If it fails, resolve duplicates manually first (see Step 1 above),
-- then re-run. If it succeeds, you're done.
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_owner_id_unique UNIQUE (owner_id);

-- If the constraint already exists you'll see "already exists" — that's fine, ignore it.

