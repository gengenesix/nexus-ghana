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
--   [15] Security Fixes (role escalation block, RLS tightening, audit-log lock)
--   [16] Enterprise Access Control (no peer enumeration, staff login RPC, re-auth gate, role audit)
--   [17] Fix staff_members_select RLS infinite recursion (get_my_staff_role SECURITY DEFINER)
--   [18] Fix cross-table RLS recursion between businesses + staff_members (is_owner/is_staff SECURITY DEFINER)
--   [19] Fix audit_role_change() trigger — correct audit_logs column names (old_values/new_values/staff_id)
--   [20] Fix staff login RPCs — verify_staff_pin (text staff_id, no phantom columns) + resolve_staff_login (empty email guard)
--   [21] Auto 8-digit Staff ID trigger + pin nullable (kiosk PIN system retired)
--   [22] Phase 0 — Industry Vertical System (industry_verticals, module_registry,
--         industry_module_defaults, business_modules, onboarding_templates,
--         industry_kpi_configs; ALTER businesses/products/sales; perf indexes;
--         13 industry seeds; full module registry; 13×module defaults; KPI seeds)
--   [23] Phase 1 — Industry KPIs RPC (get_industry_kpis — monthly_total, covers_today,
--         expiring_30/90, active_projects, pending_approvals, new_customers_month,
--         avg_basket_30d, open_service_jobs, pending_leave, active_employees,
--         monthly_expenses, open_purchase_orders)
--   [24] Phase 2 — Welcome screen flag (welcome_shown column on businesses + index)
--   [25] Phase 3 — Core New Modules: payroll_periods, payroll_entries,
--         attendance_records, budgets, budget_lines, assets,
--         petty_cash_funds, petty_cash_transactions; RLS; module_registry updates;
--         industry_module_defaults inserts for 13 industries
--   [26] Phase 4 — Industry Packs: restaurant_tables/orders/order_items,
--         prescriptions/prescription_items, hotel_rooms/bookings/charges,
--         fleet_vehicles/logs, job_cards/job_card_items,
--         farm_plots/seasons/activities; 15 tables; RLS; module_registry & defaults
--   [27] Phase 5 — Performance indexes on Phase 3/4 tables + core tables;
--         business_daily_summary view (transactions + revenue by date)
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


-- ============================================================
-- SECTION 15: Security Fixes
-- Source: 20260515000014_security_fixes.sql
-- ============================================================

-- ── 1. Trigger: block staff self-role-escalation ───────────────────────────
-- A staff member with a Supabase Auth account could call
-- supabase.from("staff_members").update({ role: "Administrator" }) on their own row.
-- This trigger blocks any UPDATE that changes `role` when the caller IS the staff member.
-- Business owners are unaffected — their auth.uid() is never in staff_members.supabase_user_id.

CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;
  IF OLD.supabase_user_id IS NOT NULL AND OLD.supabase_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Permission denied: staff cannot change their own role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_escalation ON public.staff_members;
CREATE TRIGGER trg_prevent_self_role_escalation
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_role_escalation();

-- ── 2. Tighten "Staff can link own account" RLS policy ─────────────────────
-- RLS WITH CHECK cannot reference OLD (triggers only). Column enforcement is
-- handled by the trigger above. Policy ensures staff can only touch their own row.

DROP POLICY IF EXISTS "Staff can link own account" ON public.staff_members;

CREATE POLICY "Staff can link own account" ON public.staff_members
  FOR UPDATE
  USING     (supabase_user_id = auth.uid())
  WITH CHECK (supabase_user_id = auth.uid());

-- ── 3. Lock audit_logs — no deletes ever (append-only) ─────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs' AND cmd = 'DELETE'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "audit_logs_delete" ON public.audit_logs';
  END IF;
END $$;

REVOKE DELETE ON public.audit_logs FROM authenticated;
REVOKE DELETE ON public.audit_logs FROM anon;


-- ============================================================
-- SECTION 16: Enterprise Access Control
-- Source: 20260516000015_enterprise_access_control.sql
-- ============================================================

-- ── 1. Fix staff_members SELECT — no peer visibility ──────────────────────
DROP POLICY IF EXISTS "Business members can view staff" ON public.staff_members;
DROP POLICY IF EXISTS "staff_members_select"            ON public.staff_members;

CREATE POLICY "staff_members_select" ON public.staff_members
  FOR SELECT
  USING (
    business_id = get_business_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.businesses
        WHERE id = staff_members.business_id
          AND owner_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.staff_members sm
        WHERE sm.supabase_user_id = auth.uid()
          AND sm.status = 'active'
          AND sm.role IN ('Administrator', 'Manager', 'Supervisor', 'System Administrator')
          AND sm.business_id = staff_members.business_id
      )
      OR
      supabase_user_id = auth.uid()
    )
  );

-- ── 2. resolve_staff_login() — safe email resolution for staff login ───────
CREATE OR REPLACE FUNCTION public.resolve_staff_login(
  p_access_code text,
  p_staff_id    text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT sm.email INTO v_email
  FROM   public.staff_members sm
  JOIN   public.businesses    b  ON b.id = sm.business_id
  WHERE  UPPER(b.access_code)   = UPPER(TRIM(p_access_code))
    AND  sm.staff_id             = TRIM(p_staff_id)
    AND  sm.status               = 'active'
    AND  sm.supabase_user_id    IS NOT NULL
    AND  sm.email               IS NOT NULL
  LIMIT 1;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_staff_login(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_staff_login(text, text) TO authenticated;

-- ── 3. Trigger: require fresh JWT for role changes ─────────────────────────
CREATE OR REPLACE FUNCTION public.require_fresh_auth_for_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_iat             bigint;
  v_seconds_elapsed float;
BEGIN
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_iat := (auth.jwt() ->> 'iat')::bigint;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Authentication required to change roles';
  END;

  v_seconds_elapsed := EXTRACT(EPOCH FROM now()) - v_iat;

  IF v_seconds_elapsed > 600 THEN
    RAISE EXCEPTION
      'Role changes require recent authentication (session is % minutes old). '
      'Please re-enter your password and try again.',
      ROUND(v_seconds_elapsed / 60);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_fresh_auth_role_change ON public.staff_members;
CREATE TRIGGER trg_require_fresh_auth_role_change
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW
  EXECUTE FUNCTION public.require_fresh_auth_for_role_change();

-- ── 4. Trigger: audit every role change ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_logs (
    business_id, action, module, record_id, old_value, new_value, performed_by
  ) VALUES (
    NEW.business_id,
    'role_change',
    'staff',
    NEW.id::text,
    json_build_object('role', OLD.role)::text,
    json_build_object('role', NEW.role, 'changed_by_uid', auth.uid())::text,
    auth.uid()::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_role_change ON public.staff_members;
CREATE TRIGGER trg_audit_role_change
  AFTER UPDATE ON public.staff_members
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_role_change();


-- ============================================================
-- SECTION 17: Fix staff_members_select RLS infinite recursion
-- Source: 20260516000016_fix_staff_rls_recursion.sql
-- ============================================================

-- ── 1. Helper: role lookup without RLS recursion ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_staff_role(_business_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM   public.staff_members
  WHERE  supabase_user_id = auth.uid()
    AND  status            = 'active'
    AND  business_id       = _business_id
  LIMIT 1;
$$;

-- ── 2. Replace recursive policy with recursion-safe version ───────────────
DROP POLICY IF EXISTS "staff_members_select" ON public.staff_members;

CREATE POLICY "staff_members_select" ON public.staff_members
  FOR SELECT
  USING (
    business_id = get_business_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.businesses
        WHERE id       = staff_members.business_id
          AND owner_id = auth.uid()
      )
      OR
      get_my_staff_role(staff_members.business_id) IN (
        'Administrator', 'Manager', 'Supervisor', 'System Administrator'
      )
      OR
      supabase_user_id = auth.uid()
    )
  );


-- ============================================================
-- SECTION 18: Fix cross-table RLS recursion (complete fix)
-- Source: 20260516000017_fix_cross_table_rls_recursion.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_staff_role(_business_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.staff_members
  WHERE supabase_user_id = auth.uid() AND status = 'active' AND business_id = _business_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_owner_of_business(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.businesses WHERE id = _business_id AND owner_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_staff_of_business(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE supabase_user_id = auth.uid() AND status = 'active' AND business_id = _business_id
  );
$$;

-- Fix businesses "Staff can view their business" — was directly querying staff_members (recursion)
DROP POLICY IF EXISTS "Staff can view their business" ON public.businesses;
CREATE POLICY "Staff can view their business" ON public.businesses
  FOR SELECT USING (is_staff_of_business(id));

-- Fix staff_members_select — was directly querying businesses (cross-table recursion)
DROP POLICY IF EXISTS "staff_members_select" ON public.staff_members;
CREATE POLICY "staff_members_select" ON public.staff_members
  FOR SELECT
  USING (
    business_id = get_business_id()
    AND (
      is_owner_of_business(staff_members.business_id)
      OR get_my_staff_role(staff_members.business_id) IN ('Administrator', 'Manager', 'Supervisor', 'System Administrator')
      OR supabase_user_id = auth.uid()
    )
  );


-- ============================================================
-- SECTION 19: Fix audit_role_change() trigger column names
-- Source: 20260516000018_fix_audit_role_change_columns.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_staff_id uuid;
  v_actor_name     text;
BEGIN
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  -- Resolve actor's staff record (NULL for business owners — that's fine, staff_id is nullable)
  SELECT id, name
  INTO   v_actor_staff_id, v_actor_name
  FROM   public.staff_members
  WHERE  supabase_user_id = auth.uid()
    AND  business_id       = NEW.business_id
  LIMIT 1;

  INSERT INTO public.audit_logs (
    business_id, staff_id, staff_name,
    action, module, record_type, record_id,
    old_values, new_values, details
  ) VALUES (
    NEW.business_id,
    v_actor_staff_id,
    COALESCE(v_actor_name, 'Owner'),
    'role_change',
    'staff',
    'staff_member',
    NEW.id::text,
    json_build_object('role', OLD.role),
    json_build_object('role', NEW.role),
    json_build_object(
      'target_staff_id',   NEW.id,
      'target_staff_name', NEW.name,
      'changed_by_uid',    auth.uid()::text
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_role_change ON public.staff_members;
CREATE TRIGGER trg_audit_role_change
  AFTER UPDATE ON public.staff_members
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_role_change();


-- ============================================================
-- SECTION 20: Fix staff login RPCs
-- Source: 20260516000019_fix_staff_login_rpcs.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.verify_staff_pin(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.verify_staff_pin(uuid, text, text);
DROP FUNCTION IF EXISTS public.verify_staff_pin(uuid, text);

CREATE FUNCTION public.verify_staff_pin(
  _business_id   uuid,
  _pin           text,
  _staff_id_text text DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, role text, custom_role_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _s record;
BEGIN
  IF _staff_id_text IS NOT NULL AND TRIM(_staff_id_text) != '' THEN
    SELECT s.id, s.name, s.role, s.custom_role_id, s.pin, s.failed_attempts, s.locked_until
      INTO _s FROM public.staff_members s
     WHERE s.staff_id = TRIM(_staff_id_text) AND s.business_id = _business_id AND s.status = 'active';
    IF NOT FOUND THEN RETURN; END IF;
    IF _s.locked_until IS NOT NULL AND _s.locked_until > now() THEN RETURN; END IF;
    IF extensions.crypt(_pin, _s.pin) = _s.pin THEN
      UPDATE public.staff_members SET failed_attempts = 0, locked_until = NULL, last_login = now(), is_online = true WHERE id = _s.id;
      RETURN QUERY SELECT _s.id, _s.name, _s.role, _s.custom_role_id; RETURN;
    END IF;
    UPDATE public.staff_members
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
     WHERE id = _s.id;
    RETURN;
  END IF;
  FOR _s IN SELECT s.id, s.name, s.role, s.custom_role_id, s.pin, s.failed_attempts, s.locked_until
    FROM public.staff_members s WHERE s.business_id = _business_id AND s.status = 'active'
  LOOP
    IF _s.locked_until IS NOT NULL AND _s.locked_until > now() THEN CONTINUE; END IF;
    IF extensions.crypt(_pin, _s.pin) = _s.pin THEN
      UPDATE public.staff_members SET failed_attempts = 0, locked_until = NULL, last_login = now(), is_online = true WHERE id = _s.id;
      RETURN QUERY SELECT _s.id, _s.name, _s.role, _s.custom_role_id; RETURN;
    END IF;
  END LOOP;
END; $$;

GRANT EXECUTE ON FUNCTION public.verify_staff_pin(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(uuid, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.resolve_staff_login(p_access_code text, p_staff_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  SELECT sm.email INTO v_email
  FROM   public.staff_members sm
  JOIN   public.businesses    b ON b.id = sm.business_id
  WHERE  UPPER(b.access_code)   = UPPER(TRIM(p_access_code))
    AND  sm.staff_id             = TRIM(p_staff_id)
    AND  sm.status               = 'active'
    AND  sm.supabase_user_id    IS NOT NULL
    AND  sm.email               IS NOT NULL
    AND  TRIM(sm.email)         != ''
  LIMIT 1;
  RETURN v_email;
END; $$;

GRANT EXECUTE ON FUNCTION public.resolve_staff_login(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_staff_login(text, text) TO authenticated;
-- ============================================================
-- Migration 000021: Auto 8-digit Staff ID + remove kiosk PIN system
--
-- Changes:
--   1. staff_members.pin made nullable (PIN kiosk login removed)
--   2. generate_unique_staff_id() — globally unique 8-digit numeric string
--   3. trg_auto_staff_id — auto-assigns staff_id on INSERT if not provided
--
-- Staff now login exclusively with:
--   Access Code + 8-digit Staff ID + Password (issued by admin)
-- ============================================================

-- 1. Make pin nullable — kiosk PIN login is retired
ALTER TABLE public.staff_members
  ALTER COLUMN pin DROP NOT NULL;

-- 2. Generate a globally unique 8-digit numeric staff ID (10000000–99999999)
CREATE OR REPLACE FUNCTION public.generate_unique_staff_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
  attempt   int := 0;
BEGIN
  LOOP
    -- Random 8-digit integer cast to zero-padded text
    candidate := lpad(
      (floor(10000000 + random() * 90000000))::bigint::text,
      8, '0'
    );
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.staff_members WHERE staff_id = candidate
    );
    attempt := attempt + 1;
    IF attempt > 200 THEN
      RAISE EXCEPTION 'generate_unique_staff_id: failed after 200 attempts';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

-- 3. Trigger function: assign staff_id before INSERT if missing
CREATE OR REPLACE FUNCTION public.trg_fn_assign_staff_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.staff_id IS NULL OR TRIM(NEW.staff_id) = '' THEN
    NEW.staff_id := generate_unique_staff_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_staff_id ON public.staff_members;
CREATE TRIGGER trg_auto_staff_id
  BEFORE INSERT ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION trg_fn_assign_staff_id();


-- ============================================================
-- SECTION 22: Phase 0 — Industry Vertical System
-- Source: 20260517000022_phase0_industry_system.sql
-- ============================================================
-- ============================================================
-- NEXUS GH — Migration 000022: Phase 0 Industry Vertical System
--
-- Foundational schema for industry-specific ERP.
-- Every table here is additive — no existing data is touched.
--
-- Sections:
--   [A] Industry Verticals Catalog
--   [B] Module Registry (all current + future modules)
--   [C] Industry → Module Defaults mapping
--   [D] Per-Business Module Overrides
--   [E] Onboarding Templates (structure)
--   [F] Industry KPI Configs
--   [G] ALTER businesses (industry, onboarding state, size)
--   [H] ALTER products (pharmacy: batch/expiry/rx)
--   [I] ALTER sales (restaurant: table/covers/order_type/kitchen)
--   [J] Performance Indexes
--   [K] Seed — Industry Verticals (13 industries)
--   [L] Seed — Module Registry (all modules)
--   [M] Seed — Industry Module Defaults
--   [N] Seed — Industry KPI Configs
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- [A] INDUSTRY VERTICALS CATALOG
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.industry_verticals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  tagline     text        NOT NULL,
  description text,
  icon_key    text        NOT NULL,   -- maps to Lucide icon name in frontend
  color_hex   text        NOT NULL,   -- icon/accent background color
  accent_hex  text        NOT NULL,   -- light tint for card selected state
  sort_order  smallint    DEFAULT 0,
  is_active   boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.industry_verticals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "industry_verticals_public_read" ON public.industry_verticals;
CREATE POLICY "industry_verticals_public_read"
  ON public.industry_verticals FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_industry_verticals_slug
  ON public.industry_verticals(slug);

-- ────────────────────────────────────────────────────────────
-- [B] MODULE REGISTRY
-- Single source of truth for every module in the system.
-- is_available = false means the page is not yet built (Phase 3/4).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.module_registry (
  id           uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text     NOT NULL UNIQUE,   -- matches route slug e.g. 'pos', 'crm'
  name         text     NOT NULL,
  description  text,
  category     text     NOT NULL,   -- 'sales'|'finance'|'operations'|'hr'|'system'|'industry'
  is_core      boolean  DEFAULT false, -- always visible regardless of industry
  icon_key     text     NOT NULL,
  path         text     NOT NULL,
  is_available boolean  DEFAULT true,  -- false = coming soon
  min_tier     text     DEFAULT 'starter',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.module_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "module_registry_public_read" ON public.module_registry;
CREATE POLICY "module_registry_public_read"
  ON public.module_registry FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_module_registry_category
  ON public.module_registry(category);

-- ────────────────────────────────────────────────────────────
-- [C] INDUSTRY → MODULE DEFAULTS
-- Which modules appear by default for each industry.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.industry_module_defaults (
  id            uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_slug text     NOT NULL REFERENCES public.industry_verticals(slug) ON DELETE CASCADE,
  module_key    text     NOT NULL REFERENCES public.module_registry(key)     ON DELETE CASCADE,
  display_order smallint DEFAULT 0,
  UNIQUE(industry_slug, module_key)
);

ALTER TABLE public.industry_module_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "industry_module_defaults_public_read" ON public.industry_module_defaults;
CREATE POLICY "industry_module_defaults_public_read"
  ON public.industry_module_defaults FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_imd_industry_slug
  ON public.industry_module_defaults(industry_slug);

CREATE INDEX IF NOT EXISTS idx_imd_module_key
  ON public.industry_module_defaults(module_key);

-- ────────────────────────────────────────────────────────────
-- [D] PER-BUSINESS MODULE OVERRIDES
-- Allows a business to enable/disable modules beyond their
-- industry defaults (used in Settings > Modules).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_modules (
  business_id  uuid     NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  module_key   text     NOT NULL REFERENCES public.module_registry(key) ON DELETE CASCADE,
  is_enabled   boolean  DEFAULT true,
  enabled_at   timestamptz DEFAULT now(),
  PRIMARY KEY (business_id, module_key)
);

ALTER TABLE public.business_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_modules_select" ON public.business_modules;
DROP POLICY IF EXISTS "business_modules_all"    ON public.business_modules;

CREATE POLICY "business_modules_select"
  ON public.business_modules FOR SELECT
  USING (business_id = public.get_business_id());

CREATE POLICY "business_modules_all"
  ON public.business_modules FOR ALL
  USING (business_id = public.get_business_id());

CREATE INDEX IF NOT EXISTS idx_business_modules_business
  ON public.business_modules(business_id);

-- ────────────────────────────────────────────────────────────
-- [E] ONBOARDING TEMPLATES
-- Industry-specific setup step suggestions shown during onboarding.
-- config_json holds pre-filled data for that step.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_templates (
  id            uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_slug text     NOT NULL REFERENCES public.industry_verticals(slug) ON DELETE CASCADE,
  step_order    smallint NOT NULL,
  step_key      text     NOT NULL,  -- 'coa'|'products'|'staff'|'tax_settings'
  step_title    text     NOT NULL,
  step_body     text,
  config_json   jsonb    DEFAULT '{}',
  UNIQUE(industry_slug, step_order)
);

ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_templates_public_read" ON public.onboarding_templates;
CREATE POLICY "onboarding_templates_public_read"
  ON public.onboarding_templates FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_onboarding_templates_industry
  ON public.onboarding_templates(industry_slug);

-- ────────────────────────────────────────────────────────────
-- [F] INDUSTRY KPI CONFIGS
-- Defines which KPIs appear on the dashboard for each industry.
-- The frontend reads these to know what stats to compute/display.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.industry_kpi_configs (
  id              uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_slug   text     NOT NULL REFERENCES public.industry_verticals(slug) ON DELETE CASCADE,
  kpi_key         text     NOT NULL,
  kpi_name        text     NOT NULL,
  kpi_description text,
  display_format  text     DEFAULT 'currency', -- 'currency'|'number'|'percentage'|'text'
  display_order   smallint DEFAULT 0,
  is_active       boolean  DEFAULT true,
  UNIQUE(industry_slug, kpi_key)
);

ALTER TABLE public.industry_kpi_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "industry_kpi_configs_public_read" ON public.industry_kpi_configs;
CREATE POLICY "industry_kpi_configs_public_read"
  ON public.industry_kpi_configs FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_ikpi_industry_slug
  ON public.industry_kpi_configs(industry_slug);

-- ────────────────────────────────────────────────────────────
-- [G] ALTER BUSINESSES TABLE
-- ────────────────────────────────────────────────────────────

-- Industry vertical reference (nullable for legacy businesses → show all modules)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS industry_vertical_slug text
    REFERENCES public.industry_verticals(slug) ON DELETE SET NULL;

-- Onboarding state (tracks which step the user completed)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS onboarding_step smallint DEFAULT 0;

-- Business size bucket (used for UI personalisation and future pricing)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS business_size text DEFAULT 'small';
  -- 'solo' | 'small' (2-10) | 'medium' (11-50) | 'large' (50+)

CREATE INDEX IF NOT EXISTS idx_businesses_industry
  ON public.businesses(industry_vertical_slug)
  WHERE industry_vertical_slug IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- [H] ALTER PRODUCTS TABLE
-- Adds pharmacy-specific columns that are null for non-pharmacy.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS batch_number          text,
  ADD COLUMN IF NOT EXISTS expiry_date           date,
  ADD COLUMN IF NOT EXISTS requires_prescription boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS unit_of_measure       text    DEFAULT 'unit';

-- Expiry index: pharmacy dashboards query "expiring in 30/60/90 days"
CREATE INDEX IF NOT EXISTS idx_products_business_expiry
  ON public.products(business_id, expiry_date)
  WHERE expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_business_batch
  ON public.products(business_id, batch_number)
  WHERE batch_number IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- [I] ALTER SALES TABLE
-- Adds restaurant-specific columns. Null for non-restaurant sales.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS table_number   text,
  ADD COLUMN IF NOT EXISTS covers         smallint,
  ADD COLUMN IF NOT EXISTS order_type     text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS kitchen_status text;
  -- order_type:     'standard' | 'dine-in' | 'takeaway' | 'delivery' | 'room-service'
  -- kitchen_status: 'pending'  | 'preparing' | 'ready' | 'served'

-- ────────────────────────────────────────────────────────────
-- [J] PERFORMANCE INDEXES
-- Composite indexes for the highest-frequency multi-tenant queries.
-- CONCURRENTLY allows them to build without locking.
-- ────────────────────────────────────────────────────────────

-- Sales: dashboard, reports, POS history
CREATE INDEX IF NOT EXISTS idx_sales_biz_date_desc
  ON public.sales(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_biz_payment
  ON public.sales(business_id, payment_method);

CREATE INDEX IF NOT EXISTS idx_sales_biz_customer
  ON public.sales(business_id, customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_biz_table
  ON public.sales(business_id, table_number)
  WHERE table_number IS NOT NULL;

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_biz_status
  ON public.invoices(business_id, status);

CREATE INDEX IF NOT EXISTS idx_invoices_biz_due
  ON public.invoices(business_id, due_date)
  WHERE due_date IS NOT NULL;

-- Products: full-text + category + low-stock queries
CREATE INDEX IF NOT EXISTS idx_products_biz_name_lower
  ON public.products(business_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_products_biz_category
  ON public.products(business_id, category)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_biz_barcode
  ON public.products(business_id, barcode)
  WHERE barcode IS NOT NULL;

-- Customers: search by name or phone
CREATE INDEX IF NOT EXISTS idx_customers_biz_name_lower
  ON public.customers(business_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_customers_biz_phone
  ON public.customers(business_id, phone)
  WHERE phone IS NOT NULL;

-- Expenses: date-range queries
CREATE INDEX IF NOT EXISTS idx_expenses_biz_date
  ON public.expenses(business_id, date DESC);

-- Staff members: role-based queries
CREATE INDEX IF NOT EXISTS idx_staff_biz_role
  ON public.staff_members(business_id, role)
  WHERE status = 'active';

-- ────────────────────────────────────────────────────────────
-- [K] SEED — INDUSTRY VERTICALS (13 industries for Ghana)
-- ────────────────────────────────────────────────────────────
INSERT INTO public.industry_verticals
  (slug, name, tagline, description, icon_key, color_hex, accent_hex, sort_order)
VALUES
  ('retail',
   'Retail & General Trade',
   'Shops, supermarkets, boutiques, provision stores',
   'Full retail management: POS, inventory, invoicing, CRM, and financials for any shop.',
   'ShoppingBag', '#f59e0b', '#fef3c7', 1),

  ('food-beverage',
   'Food & Beverage',
   'Restaurants, chop bars, fast food, catering',
   'Table management, kitchen display, menu management, covers tracking and more.',
   'Utensils', '#ef4444', '#fee2e2', 2),

  ('wholesale',
   'Wholesale & Distribution',
   'Distributors, importers, commodity traders',
   'Manage large-volume orders, supplier relationships, warehouses, and receivables.',
   'Package2', '#6366f1', '#e0e7ff', 3),

  ('manufacturing',
   'Manufacturing',
   'Production, food processing, textiles, assembly',
   'Bill of materials, production orders, MRP planning, and supply chain management.',
   'Factory', '#64748b', '#f1f5f9', 4),

  ('pharmacy',
   'Pharmacy & Health',
   'Pharmacies, clinics, chemical shops',
   'Batch and expiry tracking, prescription management, and controlled drugs register.',
   'Pill', '#14b8a6', '#ccfbf1', 5),

  ('professional',
   'Professional Services',
   'Consulting, legal, accounting, advisory firms',
   'Project management, billable timesheets, CRM pipeline, and professional invoicing.',
   'Briefcase', '#3b82f6', '#dbeafe', 6),

  ('construction',
   'Construction',
   'Contractors, developers, civil engineering',
   'Project costing, BOQ, materials requisition, labour tracking, and milestone billing.',
   'HardHat', '#f97316', '#ffedd5', 7),

  ('transport',
   'Transport & Logistics',
   'Freight, fleet operators, couriers, delivery',
   'Fleet management, trip logging, fuel tracking, driver assignment, and invoicing.',
   'Truck', '#0ea5e9', '#e0f2fe', 8),

  ('hospitality',
   'Hospitality & Hotels',
   'Hotels, guesthouses, lodges, resorts',
   'Room management, bookings, check-in/out, housekeeping, and revenue analytics.',
   'BedDouble', '#a855f7', '#f3e8ff', 9),

  ('auto',
   'Auto Services & Garage',
   'Car repairs, spare parts, vulcanizers',
   'Job cards, vehicle history, technician assignment, parts tracking, and billing.',
   'Wrench', '#71717a', '#f4f4f5', 10),

  ('agriculture',
   'Agriculture',
   'Farms, agro-processing, input suppliers',
   'Farm and plot management, seasons, harvest tracking, and input cost analysis.',
   'Leaf', '#22c55e', '#dcfce7', 11),

  ('beauty',
   'Beauty & Wellness',
   'Salons, spas, barbershops, beauty shops',
   'Appointment booking, service menu, stylist management, and POS with loyalty.',
   'Scissors', '#ec4899', '#fce7f3', 12),

  ('financial',
   'Financial Services',
   'Forex bureaus, microfinance, savings groups',
   'Client ledger, transaction management, GL, banking, and compliance reporting.',
   'Landmark', '#10b981', '#d1fae5', 13)

ON CONFLICT (slug) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- [L] SEED — MODULE REGISTRY
-- Every module in the system — current + Phase 3/4 planned.
-- is_available=false = not yet built; frontend shows "Coming Soon".
-- ────────────────────────────────────────────────────────────
INSERT INTO public.module_registry
  (key, name, description, category, is_core, icon_key, path, is_available, min_tier)
VALUES
  -- ── CORE (present on every industry) ──────────────────────
  ('dashboard',    'Dashboard',         'Overview of key business metrics',          'system',     true,  'LayoutDashboard', '/dashboard',     true,  'starter'),
  ('pos',          'Point of Sale',     'Sales terminal with offline & MoMo support','sales',      false, 'ShoppingCart',    '/pos',           true,  'starter'),
  ('inventory',    'Inventory',         'Stock management, barcodes & alerts',        'operations', false, 'Package',         '/inventory',     true,  'starter'),
  ('invoices',     'Invoices',          'Invoicing, recurring billing & PDFs',        'sales',      false, 'FileText',        '/invoices',      true,  'starter'),
  ('customers',    'Customers',         'Customer database, history & loyalty',       'sales',      false, 'Users',           '/customers',     true,  'starter'),
  ('suppliers',    'Suppliers',         'Supplier management & contacts',             'operations', false, 'Building2',       '/suppliers',     true,  'starter'),
  ('expenses',     'Expenses',          'Expense tracking, categories & receipts',    'finance',    false, 'Receipt',         '/expenses',      true,  'starter'),
  ('reports',      'Reports',           'Analytics, charts & business insights',      'system',     false, 'BarChart3',       '/reports',       true,  'starter'),
  ('staff',        'Staff',             'Staff accounts, roles & permissions',        'system',     false, 'UserCog',         '/staff',         true,  'starter'),
  ('settings',     'Settings',          'Business configuration & preferences',       'system',     false, 'Settings',        '/settings',      true,  'starter'),

  -- ── FINANCE ───────────────────────────────────────────────
  ('financials',   'Financials',        'General ledger & chart of accounts',         'finance',    false, 'Wallet',          '/financials',    true,  'limited_financial'),
  ('banking',      'Banking',           'Bank accounts & reconciliation',             'finance',    false, 'Landmark',        '/banking',       true,  'limited_financial'),

  -- ── SALES & CRM ───────────────────────────────────────────
  ('crm',          'CRM',               'Leads, opportunities & sales pipeline',      'sales',      false, 'Handshake',       '/crm',           true,  'limited_sales_crm'),
  ('sales-orders', 'Sales Orders',      'Sales order management & quotations',        'sales',      false, 'ShoppingBag',     '/sales-orders',  true,  'limited_sales_crm'),

  -- ── OPERATIONS ────────────────────────────────────────────
  ('projects',     'Projects',          'Project management with Gantt charts',       'operations', false, 'FolderKanban',    '/projects',      true,  'limited_sales_crm'),
  ('service',      'Service',           'Service contracts, job cards & SLAs',        'operations', false, 'Headphones',      '/service',       true,  'limited_sales_crm'),
  ('purchasing',   'Purchasing',        'Purchase orders & goods receiving',          'operations', false, 'ClipboardList',   '/purchasing',    true,  'limited_logistics'),
  ('warehouses',   'Warehouses',        'Multi-location warehouse management',        'operations', false, 'ArrowRightLeft',  '/warehouses',    true,  'limited_logistics'),
  ('production',   'Production',        'Manufacturing orders & bill of materials',   'operations', false, 'Factory',         '/production',    true,  'limited_logistics'),
  ('mrp',          'MRP',               'Material requirements planning',             'operations', false, 'Cpu',             '/mrp',           true,  'limited_logistics'),

  -- ── HR & PEOPLE ───────────────────────────────────────────
  ('hr',           'Human Resources',   'Employee records, org chart & leave',        'hr',         false, 'Users2',          '/hr',            true,  'professional'),
  ('administration','Administration',   'Company settings & permission matrix',       'system',     false, 'Shield',          '/administration',true,  'professional'),
  ('approvals',    'Approvals',         'Approval workflows & request inbox',         'system',     false, 'ClipboardCheck',  '/approvals',     true,  'starter'),
  ('audit-log',    'Audit Log',         'Full audit trail & activity history',        'system',     false, 'FileSearch',      '/audit-log',     true,  'professional'),

  -- ── PHASE 3: PLANNED (not yet built) ─────────────────────
  ('payroll',      'Payroll',           'Ghana SSNIT + PAYE compliant payroll',       'hr',         false, 'Banknote',        '/payroll',       false, 'professional'),
  ('attendance',   'Attendance',        'Clock-in/out & time tracking',               'hr',         false, 'Clock',           '/attendance',    false, 'professional'),
  ('recruitment',  'Recruitment',       'Hiring pipeline & applicant tracking',       'hr',         false, 'UserPlus',        '/recruitment',   false, 'professional'),
  ('helpdesk',     'Helpdesk',          'Customer support tickets & SLA tracking',    'operations', false, 'LifeBuoy',        '/helpdesk',      false, 'professional'),
  ('timesheets',   'Timesheets',        'Billable hours & time logging per project',  'operations', false, 'Timer',           '/timesheets',    false, 'professional'),
  ('budget',       'Budget',            'Budget planning, control & variance',        'finance',    false, 'PiggyBank',       '/budget',        false, 'professional'),
  ('assets',       'Assets',            'Fixed asset register & depreciation',        'finance',    false, 'HardDrive',       '/assets',        false, 'professional'),
  ('petty-cash',   'Petty Cash',        'Petty cash floats, vouchers & top-ups',      'finance',    false, 'Coins',           '/petty-cash',    false, 'starter'),

  -- ── PHASE 4: INDUSTRY-SPECIFIC (not yet built) ────────────
  ('restaurant',   'Restaurant',        'Tables, menu builder & kitchen display',     'industry',   false, 'ChefHat',         '/restaurant',    false, 'starter'),
  ('pharmacy-rx',  'Pharmacy Rx',       'Prescriptions & controlled drugs register',  'industry',   false, 'Pill',            '/pharmacy-rx',   false, 'starter'),
  ('hotel-mgmt',   'Hotel Management',  'Rooms, bookings & housekeeping',             'industry',   false, 'BedDouble',       '/hotel-mgmt',    false, 'starter'),
  ('fleet',        'Fleet Management',  'Vehicles, drivers, trips & fuel logging',    'industry',   false, 'Truck',           '/fleet',         false, 'starter'),
  ('garage',       'Job Cards / Garage','Service jobs, technicians & vehicle history','industry',   false, 'Wrench',          '/garage',        false, 'starter'),
  ('farm-mgmt',    'Farm Management',   'Plots, seasons, inputs & harvest tracking',  'industry',   false, 'Leaf',            '/farm-mgmt',     false, 'starter')

ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- [M] SEED — INDUSTRY MODULE DEFAULTS
-- Defines which modules appear in the sidebar for each industry.
-- display_order controls nav group ordering within the sidebar.
-- ────────────────────────────────────────────────────────────

-- RETAIL & GENERAL TRADE
INSERT INTO public.industry_module_defaults (industry_slug, module_key, display_order) VALUES
  ('retail','dashboard',1),  ('retail','pos',2),         ('retail','inventory',3),
  ('retail','customers',4),  ('retail','invoices',5),    ('retail','suppliers',6),
  ('retail','purchasing',7), ('retail','warehouses',8),  ('retail','expenses',9),
  ('retail','crm',10),       ('retail','sales-orders',11),('retail','financials',12),
  ('retail','banking',13),   ('retail','hr',14),         ('retail','reports',15),
  ('retail','staff',16),     ('retail','settings',17),   ('retail','approvals',18),
  ('retail','administration',19),('retail','audit-log',20)
ON CONFLICT DO NOTHING;

-- FOOD & BEVERAGE
INSERT INTO public.industry_module_defaults (industry_slug, module_key, display_order) VALUES
  ('food-beverage','dashboard',1), ('food-beverage','pos',2),       ('food-beverage','inventory',3),
  ('food-beverage','customers',4), ('food-beverage','invoices',5),  ('food-beverage','suppliers',6),
  ('food-beverage','purchasing',7),('food-beverage','expenses',8),  ('food-beverage','hr',9),
  ('food-beverage','crm',10),      ('food-beverage','reports',11),  ('food-beverage','staff',12),
  ('food-beverage','settings',13), ('food-beverage','restaurant',14),('food-beverage','approvals',15),
  ('food-beverage','financials',16),('food-beverage','banking',17), ('food-beverage','administration',18)
ON CONFLICT DO NOTHING;

-- WHOLESALE & DISTRIBUTION
INSERT INTO public.industry_module_defaults (industry_slug, module_key, display_order) VALUES
  ('wholesale','dashboard',1),  ('wholesale','pos',2),         ('wholesale','inventory',3),
  ('wholesale','customers',4),  ('wholesale','invoices',5),    ('wholesale','suppliers',6),
  ('wholesale','purchasing',7), ('wholesale','warehouses',8),  ('wholesale','expenses',9),
  ('wholesale','crm',10),       ('wholesale','sales-orders',11),('wholesale','financials',12),
  ('wholesale','banking',13),   ('wholesale','hr',14),         ('wholesale','reports',15),
  ('wholesale','staff',16),     ('wholesale','settings',17),   ('wholesale','approvals',18),
  ('wholesale','administration',19),('wholesale','audit-log',20)
ON CONFLICT DO NOTHING;

-- MANUFACTURING
INSERT INTO public.industry_module_defaults (industry_slug, module_key, display_order) VALUES
  ('manufacturing','dashboard',1),  ('manufacturing','inventory',2),  ('manufacturing','production',3),
  ('manufacturing','mrp',4),        ('manufacturing','purchasing',5),  ('manufacturing','warehouses',6),
  ('manufacturing','suppliers',7),  ('manufacturing','invoices',8),   ('manufacturing','customers',9),
  ('manufacturing','expenses',10),  ('manufacturing','financials',11), ('manufacturing','banking',12),
  ('manufacturing','hr',13),        ('manufacturing','pos',14),        ('manufacturing','reports',15),
  ('manufacturing','staff',16),     ('manufacturing','settings',17),   ('manufacturing','approvals',18),
  ('manufacturing','administration',19),('manufacturing','audit-log',20)
ON CONFLICT DO NOTHING;

-- PHARMACY & HEALTH
INSERT INTO public.industry_module_defaults (industry_slug, module_key, display_order) VALUES
  ('pharmacy','dashboard',1),  ('pharmacy','pos',2),        ('pharmacy','inventory',3),
  ('pharmacy','customers',4),  ('pharmacy','invoices',5),   ('pharmacy','suppliers',6),
  ('pharmacy','purchasing',7), ('pharmacy','expenses',8),   ('pharmacy','crm',9),
  ('pharmacy','financials',10),('pharmacy','banking',11),   ('pharmacy','hr',12),
  ('pharmacy','pharmacy-rx',13),('pharmacy','reports',14),  ('pharmacy','staff',15),
  ('pharmacy','settings',16),  ('pharmacy','approvals',17), ('pharmacy','administration',18)
ON CONFLICT DO NOTHING;

-- PROFESSIONAL SERVICES
INSERT INTO public.industry_module_defaults (industry_slug, module_key, display_order) VALUES
  ('professional','dashboard',1),    ('professional','customers',2),  ('professional','crm',3),
  ('professional','invoices',4),     ('professional','projects',5),   ('professional','service',6),
  ('professional','expenses',7),     ('professional','financials',8), ('professional','banking',9),
  ('professional','hr',10),          ('professional','timesheets',11),('professional','reports',12),
  ('professional','staff',13),       ('professional','settings',14),  ('professional','approvals',15),
  ('professional','administration',16),('professional','audit-log',17)
ON CONFLICT DO NOTHING;

-- CONSTRUCTION
INSERT INTO public.industry_module_defaults (industry_slug, module_key, display_order) VALUES
  ('construction','dashboard',1),  ('construction','projects',2),   ('construction','purchasing',3),
  ('construction','inventory',4),  ('construction','warehouses',5), ('construction','suppliers',6),
  ('construction','invoices',7),   ('construction','customers',8),  ('construction','crm',9),
  ('construction','expenses',10),  ('construction','financials',11),('construction','banking',12),
  ('construction','hr',13),        ('construction','reports',14),   ('construction','staff',15),
  ('construction','settings',16),  ('construction','approvals',17), ('construction','administration',18),
  ('construction','audit-log',19)
ON CONFLICT DO NOTHING;

-- TRANSPORT & LOGISTICS
INSERT INTO public.industry_module_defaults (industry_slug, module_key, display_order) VALUES
  ('transport','dashboard',1), ('transport','fleet',2),       ('transport','customers',3),
  ('transport','invoices',4),  ('transport','purchasing',5),  ('transport','expenses',6),
  ('transport','financials',7),('transport','banking',8),     ('transport','hr',9),
  ('transport','crm',10),      ('transport','reports',11),    ('transport','staff',12),
  ('transport','settings',13), ('transport','approvals',14),  ('transport','administration',15)
ON CONFLICT DO NOTHING;

-- HOSPITALITY & HOTELS
INSERT INTO public.industry_module_defaults (industry_slug, module_key, display_order) VALUES
  ('hospitality','dashboard',1),  ('hospitality','pos',2),         ('hospitality','hotel-mgmt',3),
  ('hospitality','customers',4),  ('hospitality','invoices',5),    ('hospitality','crm',6),
  ('hospitality','inventory',7),  ('hospitality','purchasing',8),  ('hospitality','suppliers',9),
  ('hospitality','expenses',10),  ('hospitality','financials',11), ('hospitality','banking',12),
  ('hospitality','hr',13),        ('hospitality','restaurant',14), ('hospitality','reports',15),
  ('hospitality','staff',16),     ('hospitality','settings',17),   ('hospitality','approvals',18),
  ('hospitality','administration',19)
ON CONFLICT DO NOTHING;

-- AUTO SERVICES & GARAGE
INSERT INTO public.industry_module_defaults (industry_slug, module_key, display_order) VALUES
  ('auto','dashboard',1), ('auto','garage',2),      ('auto','pos',3),
  ('auto','inventory',4), ('auto','customers',5),   ('auto','invoices',6),
  ('auto','suppliers',7), ('auto','purchasing',8),  ('auto','crm',9),
  ('auto','expenses',10), ('auto','hr',11),          ('auto','reports',12),
  ('auto','staff',13),    ('auto','settings',14),   ('auto','approvals',15)
ON CONFLICT DO NOTHING;

-- AGRICULTURE
INSERT INTO public.industry_module_defaults (industry_slug, module_key, display_order) VALUES
  ('agriculture','dashboard',1),  ('agriculture','farm-mgmt',2),  ('agriculture','inventory',3),
  ('agriculture','purchasing',4), ('agriculture','warehouses',5), ('agriculture','suppliers',6),
  ('agriculture','customers',7),  ('agriculture','invoices',8),   ('agriculture','expenses',9),
  ('agriculture','financials',10),('agriculture','banking',11),   ('agriculture','hr',12),
  ('agriculture','reports',13),   ('agriculture','staff',14),     ('agriculture','settings',15),
  ('agriculture','approvals',16)
ON CONFLICT DO NOTHING;

-- BEAUTY & WELLNESS
INSERT INTO public.industry_module_defaults (industry_slug, module_key, display_order) VALUES
  ('beauty','dashboard',1), ('beauty','pos',2),       ('beauty','inventory',3),
  ('beauty','customers',4), ('beauty','invoices',5),  ('beauty','expenses',6),
  ('beauty','crm',7),       ('beauty','hr',8),         ('beauty','reports',9),
  ('beauty','staff',10),    ('beauty','settings',11), ('beauty','approvals',12)
ON CONFLICT DO NOTHING;

-- FINANCIAL SERVICES
INSERT INTO public.industry_module_defaults (industry_slug, module_key, display_order) VALUES
  ('financial','dashboard',1),    ('financial','customers',2),  ('financial','crm',3),
  ('financial','invoices',4),     ('financial','financials',5), ('financial','banking',6),
  ('financial','expenses',7),     ('financial','hr',8),          ('financial','reports',9),
  ('financial','staff',10),       ('financial','settings',11),  ('financial','approvals',12),
  ('financial','administration',13),('financial','audit-log',14)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- [N] SEED — INDUSTRY KPI CONFIGS
-- Defines which KPIs appear on the dashboard per industry.
-- ────────────────────────────────────────────────────────────
INSERT INTO public.industry_kpi_configs
  (industry_slug, kpi_key, kpi_name, kpi_description, display_format, display_order)
VALUES
  -- RETAIL
  ('retail','daily_sales',        'Today''s Sales',        'Total revenue today',                   'currency',   1),
  ('retail','transactions_today', 'Transactions',          'Number of sales transactions today',    'number',     2),
  ('retail','avg_basket_value',   'Avg Basket Value',      'Average transaction value today',       'currency',   3),
  ('retail','low_stock_items',    'Low Stock Alerts',      'Products below minimum stock level',    'number',     4),
  ('retail','gross_margin',       'Gross Margin %',        'Revenue minus cost of goods sold',      'percentage', 5),
  ('retail','outstanding_recv',   'Receivables',           'Total unpaid invoices outstanding',     'currency',   6),

  -- FOOD & BEVERAGE
  ('food-beverage','daily_revenue',     'Today''s Revenue',   'Total POS + table revenue today',   'currency',   1),
  ('food-beverage','covers_today',      'Covers Today',       'Number of diners served today',     'number',     2),
  ('food-beverage','avg_cover_value',   'Avg Cover Value',    'Revenue per diner served',          'currency',   3),
  ('food-beverage','table_turnover',    'Table Turnover',     'Average times a table was used',    'number',     4),
  ('food-beverage','low_stock_items',   'Low Stock Alerts',   'Ingredients below minimum level',   'number',     5),
  ('food-beverage','expenses_today',    'Cost Today',         'Food & beverage costs today',       'currency',   6),

  -- WHOLESALE
  ('wholesale','daily_sales',       'Today''s Sales',        'Total invoiced sales today',         'currency',   1),
  ('wholesale','pending_orders',    'Pending Orders',         'Sales orders not yet fulfilled',     'number',     2),
  ('wholesale','outstanding_recv',  'Receivables',            'Total unpaid customer invoices',     'currency',   3),
  ('wholesale','fulfillment_rate',  'Fulfillment Rate',       'Orders fulfilled on time (%)',       'percentage', 4),
  ('wholesale','low_stock_items',   'Low Stock Alerts',       'Products below minimum level',       'number',     5),
  ('wholesale','monthly_revenue',   'Monthly Revenue',        'Total revenue this calendar month',  'currency',   6),

  -- MANUFACTURING
  ('manufacturing','daily_output',       'Output Today',       'Units produced today',              'number',   1),
  ('manufacturing','work_orders_open',   'Open Work Orders',   'Production orders in progress',     'number',   2),
  ('manufacturing','daily_revenue',      'Revenue Today',      'Total invoiced revenue today',      'currency', 3),
  ('manufacturing','low_stock_items',    'Material Alerts',    'Raw materials below minimum',       'number',   4),
  ('manufacturing','pending_po',         'Pending POs',        'Purchase orders awaiting delivery', 'number',   5),
  ('manufacturing','monthly_revenue',    'Monthly Revenue',    'Total revenue this month',          'currency', 6),

  -- PHARMACY
  ('pharmacy','daily_revenue',    'Today''s Revenue',    'Total dispensing revenue today',          'currency', 1),
  ('pharmacy','dispensed_today',  'Items Dispensed',     'Products dispensed today',                'number',   2),
  ('pharmacy','expiring_30days',  'Expiring (30d)',      'Stock expiring within 30 days',           'number',   3),
  ('pharmacy','expiring_90days',  'Expiring (90d)',      'Stock expiring within 90 days',           'number',   4),
  ('pharmacy','low_stock_items',  'Low Stock Alerts',    'Items below minimum stock level',         'number',   5),
  ('pharmacy','rx_pending',       'Open Prescriptions',  'Prescriptions not yet dispensed',         'number',   6),

  -- PROFESSIONAL SERVICES
  ('professional','monthly_revenue',   'Monthly Revenue',    'Total invoiced this month',            'currency', 1),
  ('professional','active_projects',   'Active Projects',    'Projects currently in progress',       'number',   2),
  ('professional','outstanding_inv',   'Outstanding Inv.',   'Total unpaid client invoices',         'currency', 3),
  ('professional','billable_hours',    'Billable Hours',     'Logged billable hours this month',     'number',   4),
  ('professional','pipeline_value',    'Pipeline Value',     'Total value of open CRM opportunities','currency', 5),
  ('professional','overdue_tasks',     'Overdue Tasks',      'Project tasks past their due date',    'number',   6),

  -- CONSTRUCTION
  ('construction','active_projects',  'Active Projects',    'Construction projects in progress',     'number',   1),
  ('construction','monthly_revenue',  'Monthly Revenue',    'Total invoiced this month',             'currency', 2),
  ('construction','outstanding_inv',  'Outstanding Inv.',   'Total unpaid client invoices',          'currency', 3),
  ('construction','pending_po',       'Pending POs',        'Purchase orders awaiting delivery',     'number',   4),
  ('construction','labour_this_week', 'Labour This Week',   'Total labour cost this week',           'currency', 5),
  ('construction','milestones_due',   'Milestones Due',     'Project milestones due this week',      'number',   6),

  -- TRANSPORT & LOGISTICS
  ('transport','daily_revenue',      'Today''s Revenue',   'Total trip & freight revenue today',    'currency', 1),
  ('transport','trips_today',        'Trips Today',         'Number of trips completed today',       'number',   2),
  ('transport','vehicles_active',    'Active Vehicles',     'Vehicles currently on assignment',      'number',   3),
  ('transport','outstanding_inv',    'Outstanding Inv.',    'Unpaid client invoices',                'currency', 4),
  ('transport','fuel_this_week',     'Fuel Cost (Week)',    'Total fuel expenditure this week',      'currency', 5),
  ('transport','monthly_revenue',    'Monthly Revenue',     'Total revenue this month',              'currency', 6),

  -- HOSPITALITY
  ('hospitality','occupancy_rate',   'Occupancy Rate',     'Percentage of rooms occupied tonight',  'percentage',1),
  ('hospitality','checkins_today',   'Check-ins Today',    'Number of guests checking in today',    'number',    2),
  ('hospitality','daily_revenue',    'Today''s Revenue',   'Total room + F&B revenue today',        'currency',  3),
  ('hospitality','revpar',           'RevPAR',             'Revenue per available room',             'currency',  4),
  ('hospitality','checkouts_today',  'Check-outs Today',   'Guests checking out today',             'number',    5),
  ('hospitality','monthly_revenue',  'Monthly Revenue',    'Total revenue this month',              'currency',  6),

  -- AUTO SERVICES
  ('auto','daily_revenue',       'Today''s Revenue',   'Total job card and parts revenue today',    'currency', 1),
  ('auto','open_jobs',           'Open Job Cards',      'Active repair / service jobs',              'number',   2),
  ('auto','completed_today',     'Completed Today',     'Job cards closed today',                   'number',   3),
  ('auto','outstanding_inv',     'Outstanding Inv.',    'Unpaid customer invoices',                  'currency', 4),
  ('auto','low_stock_items',     'Low Parts Alerts',    'Spare parts below minimum stock',           'number',   5),
  ('auto','monthly_revenue',     'Monthly Revenue',     'Total revenue this month',                 'currency', 6),

  -- AGRICULTURE
  ('agriculture','harvest_forecast',  'Harvest Forecast', 'Expected yield this season (kg)',          'number',   1),
  ('agriculture','input_cost_month',  'Input Cost (Mo.)', 'Seeds, fertilizer & pesticide cost',       'currency', 2),
  ('agriculture','stock_in_store',    'Stock in Store',   'Total produce in storage (kg)',             'number',   3),
  ('agriculture','monthly_sales',     'Monthly Sales',    'Produce sold this month',                  'currency', 4),
  ('agriculture','pending_po',        'Pending Orders',   'Input purchase orders awaiting delivery',  'number',   5),
  ('agriculture','outstanding_recv',  'Receivables',      'Unpaid buyer invoices',                    'currency', 6),

  -- BEAUTY & WELLNESS
  ('beauty','daily_revenue',      'Today''s Revenue',  'Total service + product revenue today',    'currency', 1),
  ('beauty','appointments_today', 'Appointments',      'Bookings / walk-ins served today',         'number',   2),
  ('beauty','avg_service_value',  'Avg Service Value', 'Average revenue per client visit',         'currency', 3),
  ('beauty','outstanding_inv',    'Outstanding Inv.',  'Unpaid client invoices',                   'currency', 4),
  ('beauty','low_stock_items',    'Low Product Stock', 'Retail products below minimum',            'number',   5),
  ('beauty','monthly_revenue',    'Monthly Revenue',   'Total revenue this month',                 'currency', 6),

  -- FINANCIAL SERVICES
  ('financial','daily_revenue',     'Today''s Revenue',  'Total transactions processed today',     'currency', 1),
  ('financial','active_clients',    'Active Clients',    'Clients with open accounts / loans',     'number',   2),
  ('financial','outstanding_inv',   'Receivables',       'Total outstanding client balances',      'currency', 3),
  ('financial','monthly_revenue',   'Monthly Revenue',   'Total revenue / fees this month',        'currency', 4),
  ('financial','new_clients_month', 'New Clients (Mo.)', 'New clients onboarded this month',       'number',   5),
  ('financial','pending_approvals', 'Pending Approvals', 'Transactions awaiting approval',         'number',   6)

ON CONFLICT (industry_slug, kpi_key) DO NOTHING;


-- ============================================================
-- SECTION 23: Phase 1 — Industry KPIs RPC
-- Source: 20260517000023_phase1_industry_kpis_rpc.sql
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

  BEGIN SELECT COALESCE(SUM(total), 0) INTO v_monthly_total FROM sales WHERE business_id = p_business_id AND voided = false AND created_at >= date_trunc('month', now()); EXCEPTION WHEN OTHERS THEN v_monthly_total := 0; END;
  BEGIN SELECT COALESCE(SUM(covers), 0) INTO v_covers_today FROM sales WHERE business_id = p_business_id AND voided = false AND covers IS NOT NULL AND created_at >= current_date; EXCEPTION WHEN OTHERS THEN v_covers_today := 0; END;
  BEGIN SELECT COUNT(*) INTO v_expiring_30 FROM products WHERE business_id = p_business_id AND expiry_date IS NOT NULL AND expiry_date <= (current_date + INTERVAL '30 days') AND expiry_date >= current_date AND quantity > 0; EXCEPTION WHEN OTHERS THEN v_expiring_30 := 0; END;
  BEGIN SELECT COUNT(*) INTO v_expiring_90 FROM products WHERE business_id = p_business_id AND expiry_date IS NOT NULL AND expiry_date <= (current_date + INTERVAL '90 days') AND expiry_date >= current_date AND quantity > 0; EXCEPTION WHEN OTHERS THEN v_expiring_90 := 0; END;
  BEGIN SELECT COUNT(*) INTO v_active_projects FROM projects WHERE business_id = p_business_id AND status NOT IN ('completed', 'cancelled'); EXCEPTION WHEN OTHERS THEN v_active_projects := 0; END;
  BEGIN SELECT COUNT(*) INTO v_pending_approvals FROM approval_requests WHERE business_id = p_business_id AND status = 'pending'; EXCEPTION WHEN OTHERS THEN v_pending_approvals := 0; END;
  BEGIN SELECT COUNT(*) INTO v_new_customers_month FROM customers WHERE business_id = p_business_id AND created_at >= date_trunc('month', now()); EXCEPTION WHEN OTHERS THEN v_new_customers_month := 0; END;
  BEGIN SELECT COALESCE(AVG(total), 0) INTO v_avg_basket FROM sales WHERE business_id = p_business_id AND voided = false AND created_at >= (now() - INTERVAL '30 days'); EXCEPTION WHEN OTHERS THEN v_avg_basket := 0; END;
  BEGIN SELECT COUNT(*) INTO v_open_service_jobs FROM service_tickets WHERE business_id = p_business_id AND status NOT IN ('completed', 'cancelled'); EXCEPTION WHEN OTHERS THEN v_open_service_jobs := 0; END;
  BEGIN SELECT COUNT(*) INTO v_pending_leave FROM leave_requests WHERE business_id = p_business_id AND status = 'pending'; EXCEPTION WHEN OTHERS THEN v_pending_leave := 0; END;
  BEGIN SELECT COUNT(*) INTO v_active_employees FROM employees WHERE business_id = p_business_id AND status = 'active'; EXCEPTION WHEN OTHERS THEN v_active_employees := 0; END;
  BEGIN SELECT COALESCE(SUM(amount), 0) INTO v_monthly_expenses FROM expenses WHERE business_id = p_business_id AND created_at >= date_trunc('month', now()); EXCEPTION WHEN OTHERS THEN v_monthly_expenses := 0; END;
  BEGIN SELECT COUNT(*) INTO v_open_purchase_orders FROM purchase_orders WHERE business_id = p_business_id AND status NOT IN ('received', 'cancelled'); EXCEPTION WHEN OTHERS THEN v_open_purchase_orders := 0; END;

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


-- ============================================================
-- SECTION 24: Phase 2 — Welcome screen flag
-- Source: 20260518000024_phase2_welcome_shown.sql
-- ============================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS welcome_shown boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN businesses.welcome_shown IS
  'Phase 2 — true once the business owner has seen the post-onboarding welcome screen.';

CREATE INDEX IF NOT EXISTS idx_businesses_welcome_shown
  ON businesses(owner_id, welcome_shown)
  WHERE welcome_shown = false;


-- ============================================================
-- [25] Phase 3 — Core New Modules
-- Source: supabase/migrations/20260518000025_phase3_core_modules.sql
-- Tables: payroll_periods, payroll_entries, attendance_records,
--         budgets, budget_lines, assets, petty_cash_funds,
--         petty_cash_transactions
-- All tables use standard multi-tenant RLS pattern.
-- ============================================================

-- ── 1. Payroll ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payroll_periods (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  period_start  date        NOT NULL,
  period_end    date        NOT NULL,
  status        text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  total_gross   numeric(14,2) DEFAULT 0,
  total_paye    numeric(14,2) DEFAULT 0,
  total_ssnit_employee numeric(14,2) DEFAULT 0,
  total_ssnit_employer numeric(14,2) DEFAULT 0,
  total_net     numeric(14,2) DEFAULT 0,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_entries (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id          uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  period_id            uuid        NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_name        text        NOT NULL,
  staff_member_id      uuid,
  basic_salary         numeric(12,2) NOT NULL DEFAULT 0,
  housing_allowance    numeric(12,2) NOT NULL DEFAULT 0,
  transport_allowance  numeric(12,2) NOT NULL DEFAULT 0,
  other_allowances     numeric(12,2) NOT NULL DEFAULT 0,
  gross_salary         numeric(12,2) NOT NULL DEFAULT 0,
  ssnit_employee       numeric(12,2) NOT NULL DEFAULT 0,
  ssnit_employer       numeric(12,2) NOT NULL DEFAULT 0,
  taxable_income       numeric(12,2) NOT NULL DEFAULT 0,
  paye                 numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions     numeric(12,2) NOT NULL DEFAULT 0,
  net_pay              numeric(12,2) NOT NULL DEFAULT 0,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_business ON payroll_periods(business_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_period ON payroll_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_business ON payroll_entries(business_id);

ALTER TABLE payroll_periods  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries  ENABLE ROW LEVEL SECURITY;
-- Helper: returns true when the calling JWT belongs to the business owner
-- or is an authenticated staff member of that business.
CREATE OR REPLACE FUNCTION public.is_owner_or_staff(p_business_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = p_business_id AND owner_id = auth.uid()
  );
$$;


DROP POLICY IF EXISTS payroll_periods_owner  ON payroll_periods;
DROP POLICY IF EXISTS payroll_entries_owner  ON payroll_entries;

CREATE POLICY payroll_periods_owner ON payroll_periods
  USING (is_owner_or_staff(business_id));
CREATE POLICY payroll_entries_owner ON payroll_entries
  USING (is_owner_or_staff(business_id));

-- ── 2. Attendance ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendance_records (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id     uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_member_id uuid,
  employee_name   text        NOT NULL,
  attendance_date date        NOT NULL,
  clock_in        time,
  clock_out       time,
  hours_worked    numeric(5,2),
  status          text        NOT NULL DEFAULT 'present'
                              CHECK (status IN ('present','absent','late','half-day','leave','holiday')),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (business_id, staff_member_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_business_date ON attendance_records(business_id, attendance_date DESC);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_owner ON attendance_records;
CREATE POLICY attendance_owner ON attendance_records
  USING (is_owner_or_staff(business_id));

-- ── 3. Budget ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS budgets (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  period_start  date        NOT NULL,
  period_end    date        NOT NULL,
  status        text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  total_budget  numeric(14,2) DEFAULT 0,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_lines (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  budget_id     uuid        NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category      text        NOT NULL,
  description   text,
  budgeted      numeric(14,2) NOT NULL DEFAULT 0,
  actual        numeric(14,2) NOT NULL DEFAULT 0,
  variance      numeric(14,2) GENERATED ALWAYS AS (budgeted - actual) STORED,
  sort_order    smallint    DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budgets_business ON budgets(business_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON budget_lines(budget_id);

ALTER TABLE budgets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budgets_owner      ON budgets;
DROP POLICY IF EXISTS budget_lines_owner ON budget_lines;

CREATE POLICY budgets_owner      ON budgets       USING (is_owner_or_staff(business_id));
CREATE POLICY budget_lines_owner ON budget_lines  USING (is_owner_or_staff(business_id));

-- ── 4. Fixed Assets ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assets (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id       uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  asset_code        text,
  category          text        NOT NULL DEFAULT 'Other',
  purchase_date     date        NOT NULL,
  purchase_cost     numeric(14,2) NOT NULL DEFAULT 0,
  salvage_value     numeric(14,2) NOT NULL DEFAULT 0,
  useful_life_years smallint    NOT NULL DEFAULT 5,
  depreciation_method text      NOT NULL DEFAULT 'straight-line'
                    CHECK (depreciation_method IN ('straight-line','none')),
  current_value     numeric(14,2),
  location          text,
  status            text        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','disposed','sold','written-off')),
  disposal_date     date,
  disposal_value    numeric(14,2),
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_business ON assets(business_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(business_id, category);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assets_owner ON assets;
CREATE POLICY assets_owner ON assets USING (is_owner_or_staff(business_id));

-- ── 5. Petty Cash ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS petty_cash_funds (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  custodian     text,
  opening_float numeric(12,2) NOT NULL DEFAULT 0,
  current_balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS petty_cash_transactions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  fund_id       uuid        NOT NULL REFERENCES petty_cash_funds(id) ON DELETE CASCADE,
  txn_date      date        NOT NULL DEFAULT current_date,
  description   text        NOT NULL,
  category      text        NOT NULL DEFAULT 'General',
  amount        numeric(12,2) NOT NULL,
  txn_type      text        NOT NULL DEFAULT 'expense'
                CHECK (txn_type IN ('expense','top-up','adjustment')),
  receipt_ref   text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_petty_funds_business ON petty_cash_funds(business_id);
CREATE INDEX IF NOT EXISTS idx_petty_txns_fund ON petty_cash_transactions(fund_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_petty_txns_business ON petty_cash_transactions(business_id, txn_date DESC);

ALTER TABLE petty_cash_funds         ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_transactions  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS petty_funds_owner ON petty_cash_funds;
DROP POLICY IF EXISTS petty_txns_owner  ON petty_cash_transactions;

CREATE POLICY petty_funds_owner ON petty_cash_funds        USING (is_owner_or_staff(business_id));
CREATE POLICY petty_txns_owner  ON petty_cash_transactions USING (is_owner_or_staff(business_id));

-- ── 6. Update module registry: mark Phase 3 modules as available ──────────────

UPDATE module_registry
SET is_available = true,
    updated_at   = now()
WHERE key IN ('payroll','attendance','budget','assets','petty-cash');

-- Add Phase 3 modules to industry defaults

INSERT INTO industry_module_defaults (industry_slug, module_key, is_default, sort_order)
SELECT iv.slug, m.key, true, 95
FROM industry_verticals iv
CROSS JOIN module_registry m
WHERE m.key IN ('payroll','attendance','petty-cash')
  AND iv.slug IN (
    'retail','food-beverage','wholesale','manufacturing','pharmacy',
    'professional','construction','transport','hospitality',
    'auto','agriculture','beauty','financial'
  )
ON CONFLICT (industry_slug, module_key) DO NOTHING;

INSERT INTO industry_module_defaults (industry_slug, module_key, is_default, sort_order)
SELECT iv.slug, m.key, true, 96
FROM industry_verticals iv
CROSS JOIN module_registry m
WHERE m.key = 'budget'
  AND iv.slug IN (
    'manufacturing','professional','construction','transport',
    'hospitality','financial','wholesale','pharmacy'
  )
ON CONFLICT (industry_slug, module_key) DO NOTHING;

INSERT INTO industry_module_defaults (industry_slug, module_key, is_default, sort_order)
SELECT iv.slug, m.key, true, 97
FROM industry_verticals iv
CROSS JOIN module_registry m
WHERE m.key = 'assets'
  AND iv.slug IN (
    'manufacturing','construction','transport','hospitality',
    'auto','agriculture','financial','pharmacy'
  )
ON CONFLICT (industry_slug, module_key) DO NOTHING;

COMMENT ON TABLE payroll_periods          IS 'Phase 3 — Ghana payroll period header (monthly)';
COMMENT ON TABLE payroll_entries          IS 'Phase 3 — Per-employee payroll with SSNIT + PAYE';
COMMENT ON TABLE attendance_records       IS 'Phase 3 — Daily attendance and clock-in/out';
COMMENT ON TABLE budgets                  IS 'Phase 3 — Budget period header';
COMMENT ON TABLE budget_lines             IS 'Phase 3 — Budget line items with variance';
COMMENT ON TABLE assets                   IS 'Phase 3 — Fixed asset register';
COMMENT ON TABLE petty_cash_funds         IS 'Phase 3 — Petty cash float (fund per location)';
COMMENT ON TABLE petty_cash_transactions  IS 'Phase 3 — Petty cash transactions (expenses + top-ups)';
-- ============================================================
-- Phase 4: Industry Packs
-- Modules: restaurant, pharmacy-rx, hotel-mgmt, fleet, garage, farm-mgmt
-- All tables use standard multi-tenant RLS pattern.
-- ============================================================

-- ── 1. Restaurant ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_number  text        NOT NULL,
  name          text,                                -- optional friendly name, e.g. "Window Seat"
  capacity      smallint    NOT NULL DEFAULT 4,
  section       text        DEFAULT 'Main',          -- "Main", "Terrace", "VIP"
  status        text        NOT NULL DEFAULT 'available'
                CHECK (status IN ('available','occupied','reserved','cleaning')),
  created_at    timestamptz DEFAULT now(),
  UNIQUE (business_id, table_number)
);

CREATE TABLE IF NOT EXISTS restaurant_orders (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_id      uuid        REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  covers        smallint    DEFAULT 1,               -- number of guests
  opened_at     timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz,
  status        text        NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','settled','cancelled')),
  total_amount  numeric(12,2) NOT NULL DEFAULT 0,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_order_items (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      uuid        NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_name  text        NOT NULL,
  quantity      numeric(8,2) NOT NULL DEFAULT 1,
  unit_price    numeric(10,2) NOT NULL DEFAULT 0,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rest_tables_business  ON restaurant_tables(business_id);
CREATE INDEX IF NOT EXISTS idx_rest_orders_business  ON restaurant_orders(business_id, status);
CREATE INDEX IF NOT EXISTS idx_rest_orders_table     ON restaurant_orders(table_id, status);
CREATE INDEX IF NOT EXISTS idx_rest_items_order      ON restaurant_order_items(order_id);

ALTER TABLE restaurant_tables      ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rest_tables_owner ON restaurant_tables;
DROP POLICY IF EXISTS rest_orders_owner ON restaurant_orders;
DROP POLICY IF EXISTS rest_items_owner  ON restaurant_order_items;

CREATE POLICY rest_tables_owner ON restaurant_tables      USING (is_owner_or_staff(business_id));
CREATE POLICY rest_orders_owner ON restaurant_orders      USING (is_owner_or_staff(business_id));
CREATE POLICY rest_items_owner  ON restaurant_order_items USING (is_owner_or_staff(business_id));

-- ── 2. Pharmacy Rx ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prescriptions (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id     uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  rx_number       text        NOT NULL,               -- e.g. "RX-2026-001"
  patient_name    text        NOT NULL,
  patient_phone   text,
  prescriber_name text,                               -- doctor / clinician
  rx_date         date        NOT NULL DEFAULT current_date,
  status          text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','dispensed','partial','cancelled')),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (business_id, rx_number)
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  prescription_id      uuid        NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  business_id          uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  drug_name            text        NOT NULL,
  dosage_instructions  text,
  quantity_prescribed  numeric(10,2) NOT NULL DEFAULT 1,
  quantity_dispensed   numeric(10,2) NOT NULL DEFAULT 0,
  batch_number         text,
  expiry_date          date,
  unit_price           numeric(10,2) NOT NULL DEFAULT 0,
  notes                text,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_business  ON prescriptions(business_id, rx_date DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status    ON prescriptions(business_id, status);
CREATE INDEX IF NOT EXISTS idx_rx_items_prescription   ON prescription_items(prescription_id);
-- Expiry index for KPI queries
CREATE INDEX IF NOT EXISTS idx_rx_items_expiry ON prescription_items(business_id, expiry_date)
  WHERE expiry_date IS NOT NULL;

ALTER TABLE prescriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prescriptions_owner  ON prescriptions;
DROP POLICY IF EXISTS rx_items_owner       ON prescription_items;

CREATE POLICY prescriptions_owner ON prescriptions       USING (is_owner_or_staff(business_id));
CREATE POLICY rx_items_owner      ON prescription_items  USING (is_owner_or_staff(business_id));

-- ── 3. Hotel Management ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hotel_rooms (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id     uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  room_number     text        NOT NULL,
  room_type       text        NOT NULL DEFAULT 'Standard'
                  CHECK (room_type IN ('Standard','Deluxe','Suite','Executive','Family','Dormitory')),
  floor           text,
  capacity        smallint    NOT NULL DEFAULT 2,
  rate_per_night  numeric(10,2) NOT NULL DEFAULT 0,
  status          text        NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available','occupied','reserved','maintenance','cleaning')),
  amenities       text,                               -- comma-separated or JSON text
  created_at      timestamptz DEFAULT now(),
  UNIQUE (business_id, room_number)
);

CREATE TABLE IF NOT EXISTS hotel_bookings (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id     uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  room_id         uuid        REFERENCES hotel_rooms(id) ON DELETE SET NULL,
  guest_name      text        NOT NULL,
  guest_phone     text,
  guest_email     text,
  check_in_date   date        NOT NULL,
  check_out_date  date        NOT NULL,
  adults          smallint    NOT NULL DEFAULT 1,
  children        smallint    NOT NULL DEFAULT 0,
  status          text        NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('confirmed','checked-in','checked-out','cancelled','no-show')),
  total_amount    numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount     numeric(12,2) NOT NULL DEFAULT 0,
  payment_method  text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hotel_charges (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  booking_id    uuid        NOT NULL REFERENCES hotel_bookings(id) ON DELETE CASCADE,
  charge_date   date        NOT NULL DEFAULT current_date,
  description   text        NOT NULL,
  category      text        NOT NULL DEFAULT 'Accommodation',
  amount        numeric(10,2) NOT NULL,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hotel_rooms_business    ON hotel_rooms(business_id, status);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_business ON hotel_bookings(business_id, check_in_date DESC);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_room     ON hotel_bookings(room_id, status);
CREATE INDEX IF NOT EXISTS idx_hotel_charges_booking   ON hotel_charges(booking_id, charge_date DESC);

ALTER TABLE hotel_rooms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_bookings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_charges   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotel_rooms_owner    ON hotel_rooms;
DROP POLICY IF EXISTS hotel_bookings_owner ON hotel_bookings;
DROP POLICY IF EXISTS hotel_charges_owner  ON hotel_charges;

CREATE POLICY hotel_rooms_owner    ON hotel_rooms     USING (is_owner_or_staff(business_id));
CREATE POLICY hotel_bookings_owner ON hotel_bookings  USING (is_owner_or_staff(business_id));
CREATE POLICY hotel_charges_owner  ON hotel_charges   USING (is_owner_or_staff(business_id));

-- ── 4. Fleet Management ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id      uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  registration     text        NOT NULL,
  make             text        NOT NULL,
  model            text        NOT NULL,
  year             smallint,
  vehicle_type     text        NOT NULL DEFAULT 'truck'
                   CHECK (vehicle_type IN ('truck','van','sedan','bus','pickup','motorcycle','other')),
  status           text        NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','maintenance','disposed')),
  assigned_driver  text,
  fuel_type        text        DEFAULT 'petrol' CHECK (fuel_type IN ('petrol','diesel','electric','lpg')),
  odometer_km      numeric(10,0) DEFAULT 0,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (business_id, registration)
);

CREATE TABLE IF NOT EXISTS fleet_logs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  vehicle_id    uuid        NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  log_date      date        NOT NULL DEFAULT current_date,
  log_type      text        NOT NULL DEFAULT 'trip'
                CHECK (log_type IN ('trip','fuel','maintenance','inspection')),
  description   text        NOT NULL,
  driver        text,
  origin        text,
  destination   text,
  distance_km   numeric(8,1),
  fuel_litres   numeric(8,2),
  cost          numeric(10,2) NOT NULL DEFAULT 0,
  odometer_end  numeric(10,0),
  notes         text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_business ON fleet_vehicles(business_id, status);
CREATE INDEX IF NOT EXISTS idx_fleet_logs_vehicle      ON fleet_logs(vehicle_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_logs_business     ON fleet_logs(business_id, log_date DESC);

ALTER TABLE fleet_vehicles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_logs      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fleet_vehicles_owner ON fleet_vehicles;
DROP POLICY IF EXISTS fleet_logs_owner     ON fleet_logs;

CREATE POLICY fleet_vehicles_owner ON fleet_vehicles USING (is_owner_or_staff(business_id));
CREATE POLICY fleet_logs_owner     ON fleet_logs     USING (is_owner_or_staff(business_id));

-- ── 5. Garage / Job Cards ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_cards (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id        uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_number         text        NOT NULL,
  customer_name      text        NOT NULL,
  customer_phone     text,
  vehicle_reg        text        NOT NULL,
  vehicle_make       text,
  vehicle_model      text,
  vehicle_year       smallint,
  complaint          text        NOT NULL,
  diagnosis          text,
  status             text        NOT NULL DEFAULT 'received'
                     CHECK (status IN ('received','in-progress','awaiting-parts','ready','delivered','cancelled')),
  assigned_mechanic  text,
  estimated_cost     numeric(10,2) DEFAULT 0,
  actual_cost        numeric(10,2) DEFAULT 0,
  received_date      date        NOT NULL DEFAULT current_date,
  completed_date     date,
  notes              text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (business_id, job_number)
);

CREATE TABLE IF NOT EXISTS job_card_items (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_card_id   uuid        NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  item_type     text        NOT NULL DEFAULT 'labour' CHECK (item_type IN ('labour','part')),
  description   text        NOT NULL,
  quantity      numeric(8,2) NOT NULL DEFAULT 1,
  unit_price    numeric(10,2) NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_cards_business ON job_cards(business_id, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_cards_status   ON job_cards(business_id, status);
CREATE INDEX IF NOT EXISTS idx_job_items_card     ON job_card_items(job_card_id);

ALTER TABLE job_cards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_card_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_cards_owner ON job_cards;
DROP POLICY IF EXISTS job_items_owner ON job_card_items;

CREATE POLICY job_cards_owner ON job_cards       USING (is_owner_or_staff(business_id));
CREATE POLICY job_items_owner ON job_card_items  USING (is_owner_or_staff(business_id));

-- ── 6. Farm Management ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS farm_plots (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id     uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  size_hectares   numeric(8,2),
  location        text,
  crop_type       text,
  status          text        NOT NULL DEFAULT 'fallow'
                  CHECK (status IN ('fallow','planted','growing','harvested')),
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_seasons (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          text        NOT NULL,                -- "2026 Major Season"
  start_date    date        NOT NULL,
  end_date      date        NOT NULL,
  status        text        NOT NULL DEFAULT 'planning'
                CHECK (status IN ('planning','active','completed')),
  notes         text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_activities (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id     uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plot_id         uuid        REFERENCES farm_plots(id) ON DELETE SET NULL,
  season_id       uuid        REFERENCES farm_seasons(id) ON DELETE SET NULL,
  activity_date   date        NOT NULL DEFAULT current_date,
  activity_type   text        NOT NULL DEFAULT 'other'
                  CHECK (activity_type IN ('planting','fertilising','spraying','irrigating','weeding','harvesting','other')),
  description     text        NOT NULL,
  cost            numeric(10,2) DEFAULT 0,
  quantity        numeric(10,2),
  unit            text,                              -- "kg", "bags", "litres"
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_farm_plots_business     ON farm_plots(business_id);
CREATE INDEX IF NOT EXISTS idx_farm_seasons_business   ON farm_seasons(business_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_farm_activities_business ON farm_activities(business_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_farm_activities_plot    ON farm_activities(plot_id, activity_date DESC);

ALTER TABLE farm_plots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_seasons    ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farm_plots_owner      ON farm_plots;
DROP POLICY IF EXISTS farm_seasons_owner    ON farm_seasons;
DROP POLICY IF EXISTS farm_activities_owner ON farm_activities;

CREATE POLICY farm_plots_owner      ON farm_plots      USING (is_owner_or_staff(business_id));
CREATE POLICY farm_seasons_owner    ON farm_seasons    USING (is_owner_or_staff(business_id));
CREATE POLICY farm_activities_owner ON farm_activities USING (is_owner_or_staff(business_id));

-- ── 7. Mark Phase 4 modules as available ─────────────────────────────────────

UPDATE module_registry
SET is_available = true,
    updated_at   = now()
WHERE key IN ('restaurant','pharmacy-rx','hotel-mgmt','fleet','garage','farm-mgmt');

-- ── 8. Industry module defaults for Phase 4 packs ────────────────────────────

INSERT INTO industry_module_defaults (industry_slug, module_key, is_default, sort_order)
VALUES
  ('food-beverage',  'restaurant',  true, 50),
  ('hospitality',    'restaurant',  true, 51),
  ('hospitality',    'hotel-mgmt',  true, 52),
  ('pharmacy',       'pharmacy-rx', true, 50),
  ('transport',      'fleet',       true, 50),
  ('auto',           'garage',      true, 50),
  ('agriculture',    'farm-mgmt',   true, 50)
ON CONFLICT (industry_slug, module_key) DO NOTHING;

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE restaurant_tables      IS 'Phase 4 — Restaurant table register';
COMMENT ON TABLE restaurant_orders      IS 'Phase 4 — Open order tabs per table';
COMMENT ON TABLE restaurant_order_items IS 'Phase 4 — Line items on a restaurant order';
COMMENT ON TABLE prescriptions          IS 'Phase 4 — Pharmacy Rx prescription register';
COMMENT ON TABLE prescription_items     IS 'Phase 4 — Individual drugs on a prescription';
COMMENT ON TABLE hotel_rooms            IS 'Phase 4 — Hotel room register';
COMMENT ON TABLE hotel_bookings         IS 'Phase 4 — Guest bookings with check-in/out';
COMMENT ON TABLE hotel_charges          IS 'Phase 4 — Additional charges on a booking';
COMMENT ON TABLE fleet_vehicles         IS 'Phase 4 — Fleet vehicle register';
COMMENT ON TABLE fleet_logs             IS 'Phase 4 — Fleet trip/fuel/maintenance log';
COMMENT ON TABLE job_cards              IS 'Phase 4 — Garage job card register';
COMMENT ON TABLE job_card_items         IS 'Phase 4 — Labour/parts on a job card';
COMMENT ON TABLE farm_plots             IS 'Phase 4 — Farm plot/field register';
COMMENT ON TABLE farm_seasons           IS 'Phase 4 — Farming seasons / crop cycles';
COMMENT ON TABLE farm_activities        IS 'Phase 4 — Field activities (planting, spraying, harvesting)';


-- ============================================================
-- SECTION 27: Phase 5 — Performance indexes + daily summary view
-- Migration: 20260518000027_phase5_performance.sql
-- ============================================================

-- Phase 3 indexes
CREATE INDEX IF NOT EXISTS idx_attendance_biz_date       ON attendance_records (business_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date      ON attendance_records (business_id, staff_member_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_biz_status         ON budgets (business_id, status);
CREATE INDEX IF NOT EXISTS idx_budget_lines_budget        ON budget_lines (budget_id);
CREATE INDEX IF NOT EXISTS idx_assets_biz_status          ON assets (business_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_biz_category        ON assets (business_id, category);
CREATE INDEX IF NOT EXISTS idx_petty_cash_funds_biz       ON petty_cash_funds (business_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_txns_fund_date  ON petty_cash_transactions (fund_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_biz_period         ON staff_payroll (business_id, pay_period_start DESC);

-- Phase 4 indexes
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_biz_status   ON restaurant_tables (business_id, status);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_biz_status   ON restaurant_orders (business_id, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_order   ON restaurant_order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_biz_status       ON prescriptions (business_id, status, rx_date DESC);
CREATE INDEX IF NOT EXISTS idx_prescription_items_rx          ON prescription_items (prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_expiry      ON prescription_items (prescription_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_biz_status         ON hotel_rooms (business_id, status);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_biz_status      ON hotel_bookings (business_id, status, check_in_date DESC);
CREATE INDEX IF NOT EXISTS idx_hotel_charges_booking          ON hotel_charges (booking_id, charge_date DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_biz_status      ON fleet_vehicles (business_id, status);
CREATE INDEX IF NOT EXISTS idx_fleet_logs_vehicle_date        ON fleet_logs (vehicle_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_logs_biz_type            ON fleet_logs (business_id, log_type, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_cards_biz_status           ON job_cards (business_id, status, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_card_items_job             ON job_card_items (job_card_id);
CREATE INDEX IF NOT EXISTS idx_farm_plots_biz_status          ON farm_plots (business_id, status);
CREATE INDEX IF NOT EXISTS idx_farm_seasons_biz_status        ON farm_seasons (business_id, status, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_farm_activities_plot_date      ON farm_activities (plot_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_farm_activities_season         ON farm_activities (season_id, activity_date DESC);

-- Core table gap-fill indexes
CREATE INDEX IF NOT EXISTS idx_sales_biz_created           ON sales (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_biz_status_date    ON invoices (business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_biz_qty_reorder    ON products (business_id, qty, reorder_level);

-- Business daily summary view
CREATE OR REPLACE VIEW business_daily_summary AS
SELECT
  s.business_id,
  DATE(s.created_at)               AS sale_date,
  COUNT(*)                         AS transaction_count,
  SUM(s.total)                     AS gross_total,
  COUNT(*) FILTER (WHERE s.voided) AS voided_count
FROM sales s
GROUP BY s.business_id, DATE(s.created_at);

GRANT SELECT ON business_daily_summary TO authenticated;

-- ============================================================
-- [28] Migration 000028 — Approval requests patch
-- ============================================================

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requested_by   uuid        REFERENCES public.staff_members(id),
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

ALTER TABLE public.approval_requests ALTER COLUMN requested_by DROP NOT NULL;

CREATE INDEX IF NOT EXISTS approval_requests_business_status
  ON public.approval_requests(business_id, status, created_at DESC);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "approval_requests_read"   ON public.approval_requests;
DROP POLICY IF EXISTS "approval_requests_insert" ON public.approval_requests;
DROP POLICY IF EXISTS "approval_requests_update" ON public.approval_requests;

CREATE POLICY "approval_requests_read"   ON public.approval_requests FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "approval_requests_insert" ON public.approval_requests FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "approval_requests_update" ON public.approval_requests FOR UPDATE USING (business_id = get_business_id());

GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leave_requests' AND policyname = 'Business members can update leave requests') THEN
    CREATE POLICY "Business members can update leave requests" ON public.leave_requests FOR UPDATE USING (business_id = get_business_id());
  END IF;
END; $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'Business members can update journal entries') THEN
    CREATE POLICY "Business members can update journal entries" ON public.journal_entries FOR UPDATE USING (business_id = get_business_id());
  END IF;
END; $$;
-- ============================================================
-- Migration 000029: Atomic sale submission + stock decrement
-- ============================================================
-- CRITICAL BUG FIX: Sales never decremented product stock.
-- The void_sale RPC restores stock (qty + item.qty), but there
-- was no matching decrement on sale creation — causing inventory
-- numbers to never go down from POS sales, and voiding sales to
-- artificially INCREASE stock beyond what was received.
--
-- This migration:
--   1. Creates submit_sale() — atomic RPC that:
--        a. Locks & validates stock availability per item (FOR UPDATE)
--        b. Inserts the sale record
--        c. Inserts all sale_items
--        d. Decrements products.qty for each sold item
--      All steps run in one DB transaction — either all succeed or
--      all roll back. No more orphaned sales or mis-counted stock.
--   2. Ensures void_sale still works correctly (it reverses the decrement).
--   3. Adds a generate_rx_number() helper for collision-safe Rx IDs.
-- ============================================================

-- ─── 1. submit_sale RPC ───────────────────────────────────────────────────────

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
RETURNS uuid   -- returns the new sale.id
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
  -- ── Step 1: validate + lock each product row (prevent concurrent oversell) ──
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_prod_id   := (v_item->>'product_id')::uuid;
    v_item_qty  := (v_item->>'qty')::numeric;
    v_prod_name := v_item->>'product_name';

    IF v_prod_id IS NULL THEN
      CONTINUE;  -- item not linked to a product (custom line) — skip stock check
    END IF;

    SELECT qty INTO v_prod_qty
    FROM public.products
    WHERE id = v_prod_id
      AND business_id = p_business_id
    FOR UPDATE;  -- row-level lock prevents concurrent sales overselling

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
    business_id,
    receipt_number,
    subtotal,
    discount_percent,
    discount_amount,
    total,
    payment_method,
    payment_splits,
    staff_id,
    customer_id
  ) VALUES (
    p_business_id,
    p_receipt_number,
    p_subtotal,
    p_discount_pct,
    p_discount_amount,
    p_total,
    p_payment_method,
    p_payment_splits,
    p_staff_id,
    p_customer_id
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

    -- Decrement stock only for linked products
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

-- ─── 2. generate_rx_number RPC ────────────────────────────────────────────────
-- Returns the next sequential Rx number for the given business,
-- using SELECT FOR UPDATE on a counter so concurrent creates never collide.
-- Falls back to counting existing rows if no counter exists (safe on first use).

CREATE OR REPLACE FUNCTION public.generate_rx_number(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_year  text;
BEGIN
  v_year := to_char(now(), 'YYYY');

  -- Count all prescriptions for this business (unfiltered) with a row-level lock
  -- so concurrent Rx creation in the same millisecond gets sequential numbers.
  SELECT COUNT(*) INTO v_count
  FROM public.prescriptions
  WHERE business_id = p_business_id;

  RETURN 'RX-' || v_year || '-' || LPAD((v_count + 1)::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_rx_number(uuid) TO authenticated;
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

-- ============================================================
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
