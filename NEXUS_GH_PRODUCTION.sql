-- ================================================================
-- NEXUS-GH  —  PRODUCTION DATABASE SETUP  (v2.0)
-- Single-file idempotent script for a FRESH Supabase project.
-- ================================================================
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run
--
-- SAFE TO RE-RUN: all DDL uses IF NOT EXISTS / OR REPLACE
--
-- EDGE FUNCTION SECRETS (Dashboard → Edge Functions → Secrets):
--   RESEND_API_KEY          send-notifications email digest
--   FROM_EMAIL              e.g. "Nexus <noreply@nexusgh.com>"
--   HUBTEL_CLIENT_ID        momo-collect (Hubtel MoMo)
--   HUBTEL_CLIENT_SECRET    momo-collect (Hubtel MoMo)
--
-- NOTE ON pg_cron (Part 28):
--   Requires Supabase Pro/Team plan. On Free plan, skip Part 28 and
--   call mark_overdue_invoices() via a scheduled Edge Function instead.
-- ================================================================


-- ================================================================
-- PART 1 — EXTENSIONS
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm   SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ================================================================
-- PART 2 — SCHEMA SECURITY BASELINE
-- Remove public access; only authenticated users touch data.
-- ================================================================

-- Revoke dangerous defaults
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL    ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL    ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL    ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- authenticated users need schema access
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


-- ================================================================
-- PART 3 — ENUMS
-- ================================================================

DO $$ BEGIN
  CREATE TYPE public.license_tier AS ENUM (
    'professional','limited_financial','limited_logistics',
    'limited_sales_crm','starter'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.permission_level AS ENUM ('full','read_only','none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.user_type AS ENUM ('superuser','standard','support_auditor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ================================================================
-- PART 4 — CORE TABLES: PROFILES & BUSINESSES
-- ================================================================

-- ── Profiles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text        NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_select_own') THEN
    CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT  USING (auth.uid() = id);
    CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT  WITH CHECK (auth.uid() = id);
    CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE  USING (auth.uid() = id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Businesses ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.businesses (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                 uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                     text          NOT NULL,
  phone                    text          NOT NULL DEFAULT '',
  email                    text          NOT NULL DEFAULT '',
  region                   text          NOT NULL DEFAULT '',
  address                  text          NOT NULL DEFAULT '',
  logo_url                 text,
  tin                      text          DEFAULT '',          -- Ghana Tax Identification Number
  momo_merchant_mtn        text          NOT NULL DEFAULT '',
  momo_merchant_telecel    text          NOT NULL DEFAULT '',
  momo_merchant_airteltigo text          NOT NULL DEFAULT '',
  tax_vat                  boolean       NOT NULL DEFAULT true,
  tax_nhil                 boolean       NOT NULL DEFAULT true,
  tax_getfl                boolean       NOT NULL DEFAULT true,
  receipt_header           text          NOT NULL DEFAULT '',
  receipt_footer           text          NOT NULL DEFAULT '',
  receipt_show_logo        boolean       NOT NULL DEFAULT true,
  currency                 text          NOT NULL DEFAULT 'GHS',
  fiscal_year_start        integer       NOT NULL DEFAULT 1
                           CHECK (fiscal_year_start BETWEEN 1 AND 12),
  timezone                 text          NOT NULL DEFAULT 'Africa/Accra',
  industry                 text          NOT NULL DEFAULT '',
  license_tier             public.license_tier DEFAULT 'professional',
  max_staff                integer       NOT NULL DEFAULT 20,
  created_at               timestamptz   NOT NULL DEFAULT now(),
  updated_at               timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='businesses' AND policyname='businesses_select') THEN
    CREATE POLICY "businesses_select" ON public.businesses FOR SELECT  USING (auth.uid() = owner_id);
    CREATE POLICY "businesses_insert" ON public.businesses FOR INSERT  WITH CHECK (auth.uid() = owner_id);
    CREATE POLICY "businesses_update" ON public.businesses FOR UPDATE  USING (auth.uid() = owner_id);
    CREATE POLICY "businesses_delete" ON public.businesses FOR DELETE  USING (auth.uid() = owner_id);
  END IF;
END $$;
-- Performance: FILLFACTOR 80 — updated on each settings save
ALTER TABLE public.businesses SET (fillfactor = 80);


-- ================================================================
-- PART 5 — HELPER FUNCTIONS
-- ================================================================

-- get_business_id(): resolves the calling user's business UUID.
-- LEAKPROOF + STABLE lets the planner cache this per query.
CREATE OR REPLACE FUNCTION public.get_business_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT id FROM public.businesses WHERE owner_id = auth.uid() LIMIT 1;
$$;

-- Convenience: check business ownership inline (avoids subquery fan-out in RLS)
CREATE OR REPLACE FUNCTION public.is_business_owner(_business_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses WHERE id = _business_id AND owner_id = auth.uid()
  );
$$;


-- ================================================================
-- PART 6 — CATEGORIES & PRODUCTS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='cat_select') THEN
    CREATE POLICY "cat_select" ON public.categories FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "cat_insert" ON public.categories FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "cat_update" ON public.categories FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "cat_delete" ON public.categories FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.products (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name          text          NOT NULL,
  sku           text          NOT NULL DEFAULT '',
  barcode       text,
  category_id   uuid          REFERENCES public.categories(id) ON DELETE SET NULL,
  qty           integer       NOT NULL DEFAULT 0 CHECK (qty >= 0),
  reorder_level integer       NOT NULL DEFAULT 10 CHECK (reorder_level >= 0),
  cost_price    numeric(14,4) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  selling_price numeric(14,4) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  image_url     text,
  unit          text          NOT NULL DEFAULT 'pcs',
  is_active     boolean       NOT NULL DEFAULT true,
  track_serial  boolean       NOT NULL DEFAULT false,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
-- FILLFACTOR 70: qty/updated_at updated on every sale
ALTER TABLE public.products SET (fillfactor = 70);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='prod_select') THEN
    CREATE POLICY "prod_select" ON public.products FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "prod_insert" ON public.products FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "prod_update" ON public.products FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "prod_delete" ON public.products FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.serial_numbers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id    uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  serial_number text        NOT NULL,
  batch_number  text        DEFAULT '',
  status        text        NOT NULL DEFAULT 'available'
                CHECK (status IN ('available','sold','returned','damaged')),
  received_date date        DEFAULT CURRENT_DATE,
  sold_date     date,
  warranty_end  date,
  notes         text        DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, serial_number)
);
ALTER TABLE public.serial_numbers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='serial_numbers' AND policyname='sn_select') THEN
    CREATE POLICY "sn_select" ON public.serial_numbers FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "sn_insert" ON public.serial_numbers FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "sn_update" ON public.serial_numbers FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "sn_delete" ON public.serial_numbers FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 7 — CUSTOMERS & SUPPLIERS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name                text          NOT NULL,
  phone               text          NOT NULL DEFAULT '',
  email               text          NOT NULL DEFAULT '',
  region              text          NOT NULL DEFAULT '',
  notes               text          NOT NULL DEFAULT '',
  loyalty_points      integer       NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  credit_limit        numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  outstanding_balance numeric(14,2) NOT NULL DEFAULT 0,
  tin                 text          DEFAULT '',
  created_at          timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers SET (fillfactor = 80);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='cust_select') THEN
    CREATE POLICY "cust_select" ON public.customers FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "cust_insert" ON public.customers FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "cust_update" ON public.customers FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "cust_delete" ON public.customers FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.suppliers (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  contact_person    text        NOT NULL DEFAULT '',
  phone             text        NOT NULL DEFAULT '',
  email             text        NOT NULL DEFAULT '',
  location          text        NOT NULL DEFAULT '',
  products_supplied text        NOT NULL DEFAULT '',
  tin               text        DEFAULT '',
  credit_terms_days integer     NOT NULL DEFAULT 30 CHECK (credit_terms_days >= 0),
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='suppliers' AND policyname='supp_select') THEN
    CREATE POLICY "supp_select" ON public.suppliers FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "supp_insert" ON public.suppliers FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "supp_update" ON public.suppliers FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "supp_delete" ON public.suppliers FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 8 — STAFF / RBAC
-- ================================================================

CREATE TABLE IF NOT EXISTS public.role_templates (
  id           uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid              NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name         text              NOT NULL,
  description  text              NOT NULL DEFAULT '',
  is_system    boolean           NOT NULL DEFAULT false,
  permissions  jsonb             NOT NULL DEFAULT '{}',
  license_tier public.license_tier NOT NULL DEFAULT 'professional',
  created_at   timestamptz       NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='role_templates' AND policyname='rt_select') THEN
    CREATE POLICY "rt_select" ON public.role_templates FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "rt_insert" ON public.role_templates FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "rt_update" ON public.role_templates FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "rt_delete" ON public.role_templates FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  group_type  text        NOT NULL DEFAULT 'authorization',
  permissions jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_groups' AND policyname='ug_select') THEN
    CREATE POLICY "ug_select" ON public.user_groups FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "ug_insert" ON public.user_groups FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "ug_update" ON public.user_groups FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "ug_delete" ON public.user_groups FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.staff_members (
  id               uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid              NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name             text              NOT NULL,
  role             text              NOT NULL DEFAULT 'Staff',
  phone            text              NOT NULL DEFAULT '',
  email            text              NOT NULL DEFAULT '',
  pin              text              NOT NULL DEFAULT '',    -- bcrypt hash
  status           text              NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','inactive','suspended')),
  staff_id         text,
  last_login       timestamptz,
  is_online        boolean           NOT NULL DEFAULT false,
  failed_attempts  integer           NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until     timestamptz,
  license_tier     public.license_tier DEFAULT 'professional',
  user_type        public.user_type    DEFAULT 'standard',
  permissions      jsonb             NOT NULL DEFAULT '{}',
  role_template_id uuid              REFERENCES public.role_templates(id) ON DELETE SET NULL,
  department       text              NOT NULL DEFAULT '',
  created_at       timestamptz       NOT NULL DEFAULT now(),
  UNIQUE (business_id, staff_id) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_members' AND policyname='sm_select') THEN
    CREATE POLICY "sm_select" ON public.staff_members FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "sm_insert" ON public.staff_members FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "sm_update" ON public.staff_members FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "sm_delete" ON public.staff_members FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

-- Stock adjustments ledger — defined here so staff_id FK is valid
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id      uuid          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  adjustment_type text          NOT NULL DEFAULT 'manual'
                  CHECK (adjustment_type IN ('manual','damage','theft','return','expiry','opening')),
  qty_before      integer       NOT NULL,
  qty_change      integer       NOT NULL,
  qty_after       integer       NOT NULL,
  reason          text          NOT NULL DEFAULT '',
  reference       text          NOT NULL DEFAULT '',
  staff_id        uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_adjustments' AND policyname='sadj_select') THEN
    CREATE POLICY "sadj_select" ON public.stock_adjustments FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "sadj_insert" ON public.stock_adjustments FOR INSERT  WITH CHECK (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.staff_group_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   uuid        NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  group_id   uuid        NOT NULL REFERENCES public.user_groups(id)   ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, group_id)
);
ALTER TABLE public.staff_group_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_group_members' AND policyname='sgm_select') THEN
    CREATE POLICY "sgm_select" ON public.staff_group_members FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.staff_members sm WHERE sm.id = staff_group_members.staff_id AND sm.business_id = public.get_business_id())
    );
    CREATE POLICY "sgm_insert" ON public.staff_group_members FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.staff_members sm WHERE sm.id = staff_group_members.staff_id AND sm.business_id = public.get_business_id())
    );
    CREATE POLICY "sgm_delete" ON public.staff_group_members FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.staff_members sm WHERE sm.id = staff_group_members.staff_id AND sm.business_id = public.get_business_id())
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id    uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  staff_name  text        NOT NULL DEFAULT '',
  action      text        NOT NULL,
  module      text        NOT NULL DEFAULT '',
  record_type text        NOT NULL DEFAULT '',
  record_id   text        DEFAULT '',
  details     jsonb       NOT NULL DEFAULT '{}',
  old_values  jsonb       NOT NULL DEFAULT '{}',
  new_values  jsonb       NOT NULL DEFAULT '{}',
  ip_address  text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- Audit logs: only INSERT & SELECT. Never UPDATE/DELETE (immutability).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='al_select') THEN
    CREATE POLICY "al_select" ON public.audit_logs FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "al_insert" ON public.audit_logs FOR INSERT  WITH CHECK (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  document_type text        NOT NULL,
  conditions    jsonb       NOT NULL DEFAULT '{}',
  steps         jsonb       NOT NULL DEFAULT '[]',
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='approval_workflows' AND policyname='aw_select') THEN
    CREATE POLICY "aw_select" ON public.approval_workflows FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "aw_insert" ON public.approval_workflows FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "aw_update" ON public.approval_workflows FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "aw_delete" ON public.approval_workflows FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.number_series (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  document_type text        NOT NULL,
  prefix        text        NOT NULL DEFAULT '',
  next_number   integer     NOT NULL DEFAULT 1 CHECK (next_number > 0),
  suffix        text        DEFAULT '',
  pad_length    integer     NOT NULL DEFAULT 4 CHECK (pad_length BETWEEN 1 AND 10),
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, document_type)
);
ALTER TABLE public.number_series ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='number_series' AND policyname='ns_select') THEN
    CREATE POLICY "ns_select" ON public.number_series FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "ns_insert" ON public.number_series FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "ns_update" ON public.number_series FOR UPDATE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

-- ── Notifications ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id    uuid        REFERENCES public.staff_members(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  message     text        NOT NULL DEFAULT '',
  type        text        NOT NULL DEFAULT 'info'
              CHECK (type IN ('info','success','warning','error')),
  module      text        NOT NULL DEFAULT '',
  is_read     boolean     NOT NULL DEFAULT false,
  link        text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='notif_select') THEN
    CREATE POLICY "notif_select" ON public.notifications FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "notif_insert" ON public.notifications FOR INSERT  WITH CHECK (true);  -- triggers insert
    CREATE POLICY "notif_update" ON public.notifications FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "notif_delete" ON public.notifications FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 9 — SALES & POS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.sales (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id      uuid          REFERENCES public.customers(id) ON DELETE SET NULL,
  staff_id         uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  subtotal         numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_percent numeric(5,2)  NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  discount_amount  numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount       numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total            numeric(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  payment_method   text          NOT NULL DEFAULT 'cash',
  payment_splits   jsonb,
  receipt_number   text,
  loyalty_points_earned   integer NOT NULL DEFAULT 0,
  loyalty_points_redeemed integer NOT NULL DEFAULT 0,
  voided           boolean       NOT NULL DEFAULT false,
  voided_at        timestamptz,
  voided_by        uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  notes            text          NOT NULL DEFAULT '',
  created_at       timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales' AND policyname='sales_select') THEN
    CREATE POLICY "sales_select" ON public.sales FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "sales_insert" ON public.sales FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "sales_update" ON public.sales FOR UPDATE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sale_items (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      uuid          NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id   uuid          REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text          NOT NULL,
  qty          integer       NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price   numeric(14,4) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount     numeric(14,2) NOT NULL DEFAULT 0,
  cost_price   numeric(14,4) NOT NULL DEFAULT 0     -- snapshot for margin calc
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sale_items' AND policyname='si_select') THEN
    CREATE POLICY "si_select" ON public.sale_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.business_id = public.get_business_id())
    );
    CREATE POLICY "si_insert" ON public.sale_items FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id AND s.business_id = public.get_business_id())
    );
  END IF;
END $$;

-- Stock deduction on sale
CREATE OR REPLACE FUNCTION public.handle_sale_item_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products
     SET qty = qty - NEW.qty, updated_at = now()
   WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sale_item_stock ON public.sale_items;
CREATE TRIGGER trg_sale_item_stock
  AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_stock();


-- ================================================================
-- PART 10 — INVOICING
-- ================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  invoice_number  text          NOT NULL,
  customer_id     uuid          REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name   text          NOT NULL DEFAULT '',
  status          text          NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','paid','partial','overdue','cancelled','void')),
  date            date          NOT NULL DEFAULT CURRENT_DATE,
  due_date        date          NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
  subtotal        numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  vat_amount      numeric(14,2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  nhil_amount     numeric(14,2) NOT NULL DEFAULT 0 CHECK (nhil_amount >= 0),
  getfl_amount    numeric(14,2) NOT NULL DEFAULT 0 CHECK (getfl_amount >= 0),
  total           numeric(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  amount_paid     numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  notes           text          NOT NULL DEFAULT '',
  terms           text          NOT NULL DEFAULT '',
  apply_vat       boolean       NOT NULL DEFAULT true,
  apply_nhil      boolean       NOT NULL DEFAULT true,
  apply_getfl     boolean       NOT NULL DEFAULT true,
  staff_id        uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (business_id, invoice_number)
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='inv_select') THEN
    CREATE POLICY "inv_select" ON public.invoices FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "inv_insert" ON public.invoices FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "inv_update" ON public.invoices FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "inv_delete" ON public.invoices FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid          NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id  uuid          REFERENCES public.products(id) ON DELETE SET NULL,
  description text          NOT NULL DEFAULT '',
  qty         numeric(12,4) NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price  numeric(14,4) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  tax_rate    numeric(5,2)  NOT NULL DEFAULT 0
);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_items' AND policyname='ii_select') THEN
    CREATE POLICY "ii_select" ON public.invoice_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND i.business_id = public.get_business_id())
    );
    CREATE POLICY "ii_insert" ON public.invoice_items FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND i.business_id = public.get_business_id())
    );
    CREATE POLICY "ii_update" ON public.invoice_items FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND i.business_id = public.get_business_id())
    );
    CREATE POLICY "ii_delete" ON public.invoice_items FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND i.business_id = public.get_business_id())
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.recurring_invoices (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id    uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name  text        NOT NULL DEFAULT '',
  frequency      text        NOT NULL DEFAULT 'monthly'
                 CHECK (frequency IN ('weekly','monthly','quarterly','annually')),
  next_date      date        NOT NULL DEFAULT CURRENT_DATE,
  end_date       date,
  subtotal       numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  apply_vat      boolean     NOT NULL DEFAULT true,
  apply_nhil     boolean     NOT NULL DEFAULT true,
  apply_getfl    boolean     NOT NULL DEFAULT true,
  notes          text        NOT NULL DEFAULT '',
  is_active      boolean     NOT NULL DEFAULT true,
  last_generated date,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recurring_invoices' AND policyname='ri_select') THEN
    CREATE POLICY "ri_select" ON public.recurring_invoices FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "ri_insert" ON public.recurring_invoices FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "ri_update" ON public.recurring_invoices FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "ri_delete" ON public.recurring_invoices FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 11 — EXPENSES
-- ================================================================

CREATE TABLE IF NOT EXISTS public.expenses (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  date        date          NOT NULL DEFAULT CURRENT_DATE,
  category    text          NOT NULL,
  amount      numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  description text          NOT NULL DEFAULT '',
  paid_by     text          NOT NULL DEFAULT 'Cash',
  receipt_url text,
  supplier_id uuid          REFERENCES public.suppliers(id) ON DELETE SET NULL,
  staff_id    uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  is_recurring boolean      NOT NULL DEFAULT false,
  created_at  timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='expenses' AND policyname='exp_select') THEN
    CREATE POLICY "exp_select" ON public.expenses FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "exp_insert" ON public.expenses FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "exp_update" ON public.expenses FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "exp_delete" ON public.expenses FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 12 — CRM
-- ================================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  company     text        NOT NULL DEFAULT '',
  email       text        NOT NULL DEFAULT '',
  phone       text        NOT NULL DEFAULT '',
  source      text        NOT NULL DEFAULT '',
  status      text        NOT NULL DEFAULT 'new'
              CHECK (status IN ('new','contacted','qualified','unqualified','converted')),
  assigned_to uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  notes       text        NOT NULL DEFAULT '',
  value       numeric(14,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leads' AND policyname='leads_select') THEN
    CREATE POLICY "leads_select" ON public.leads FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "leads_insert" ON public.leads FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "leads_update" ON public.leads FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "leads_delete" ON public.leads FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.opportunities (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name           text          NOT NULL,
  customer_id    uuid          REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id        uuid          REFERENCES public.leads(id) ON DELETE SET NULL,
  stage          text          NOT NULL DEFAULT 'prospecting'
                 CHECK (stage IN ('prospecting','qualification','proposal','negotiation','closed_won','closed_lost')),
  probability    integer       NOT NULL DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
  value          numeric(14,2) NOT NULL DEFAULT 0,
  expected_close date,
  assigned_to    uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  notes          text          NOT NULL DEFAULT '',
  status         text          NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','won','lost','abandoned')),
  won_reason     text          NOT NULL DEFAULT '',
  lost_reason    text          NOT NULL DEFAULT '',
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='opportunities' AND policyname='opp_select') THEN
    CREATE POLICY "opp_select" ON public.opportunities FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "opp_insert" ON public.opportunities FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "opp_update" ON public.opportunities FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "opp_delete" ON public.opportunities FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.activities (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type           text        NOT NULL DEFAULT 'note'
                 CHECK (type IN ('note','call','email','meeting','task','demo')),
  subject        text        NOT NULL,
  description    text        NOT NULL DEFAULT '',
  contact_id     uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  opportunity_id uuid        REFERENCES public.opportunities(id) ON DELETE SET NULL,
  lead_id        uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  staff_id       uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  due_date       timestamptz,
  completed      boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activities' AND policyname='act_select') THEN
    CREATE POLICY "act_select" ON public.activities FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "act_insert" ON public.activities FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "act_update" ON public.activities FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "act_delete" ON public.activities FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 13 — SALES ORDERS & QUOTATIONS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.sales_quotations (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  quotation_number text          NOT NULL,
  customer_id      uuid          REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name    text          NOT NULL DEFAULT '',
  opportunity_id   uuid          REFERENCES public.opportunities(id) ON DELETE SET NULL,
  date             date          NOT NULL DEFAULT CURRENT_DATE,
  valid_until      date          NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  subtotal         numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount       numeric(14,2) NOT NULL DEFAULT 0,
  total            numeric(14,2) NOT NULL DEFAULT 0,
  status           text          NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  notes            text          NOT NULL DEFAULT '',
  terms            text          NOT NULL DEFAULT '',
  staff_id         uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (business_id, quotation_number)
);
ALTER TABLE public.sales_quotations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_quotations' AND policyname='sq_select') THEN
    CREATE POLICY "sq_select" ON public.sales_quotations FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "sq_insert" ON public.sales_quotations FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "sq_update" ON public.sales_quotations FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "sq_delete" ON public.sales_quotations FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_number     text          NOT NULL,
  customer_id      uuid          REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name    text          NOT NULL DEFAULT '',
  quotation_id     uuid          REFERENCES public.sales_quotations(id) ON DELETE SET NULL,
  date             date          NOT NULL DEFAULT CURRENT_DATE,
  delivery_date    date,
  subtotal         numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount       numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount  numeric(14,2) NOT NULL DEFAULT 0,
  total            numeric(14,2) NOT NULL DEFAULT 0,
  status           text          NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','confirmed','in_progress','delivered','cancelled','invoiced')),
  notes            text          NOT NULL DEFAULT '',
  staff_id         uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (business_id, order_number)
);
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_orders' AND policyname='so_select') THEN
    CREATE POLICY "so_select" ON public.sales_orders FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "so_insert" ON public.sales_orders FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "so_update" ON public.sales_orders FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "so_delete" ON public.sales_orders FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  delivery_number  text        NOT NULL,
  sales_order_id   uuid        REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  customer_name    text        NOT NULL DEFAULT '',
  customer_id      uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  date             date        NOT NULL DEFAULT CURRENT_DATE,
  shipping_address text        NOT NULL DEFAULT '',
  carrier          text        NOT NULL DEFAULT '',
  tracking_number  text        NOT NULL DEFAULT '',
  status           text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','dispatched','delivered','returned')),
  notes            text        NOT NULL DEFAULT '',
  staff_id         uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, delivery_number)
);
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='delivery_notes' AND policyname='dn_select') THEN
    CREATE POLICY "dn_select" ON public.delivery_notes FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "dn_insert" ON public.delivery_notes FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "dn_update" ON public.delivery_notes FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "dn_delete" ON public.delivery_notes FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.credit_notes (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  credit_number  text          NOT NULL,
  invoice_id     uuid          REFERENCES public.invoices(id) ON DELETE SET NULL,
  customer_name  text          NOT NULL DEFAULT '',
  customer_id    uuid          REFERENCES public.customers(id) ON DELETE SET NULL,
  date           date          NOT NULL DEFAULT CURRENT_DATE,
  reason         text          NOT NULL DEFAULT '',
  subtotal       numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount     numeric(14,2) NOT NULL DEFAULT 0,
  total          numeric(14,2) NOT NULL DEFAULT 0,
  status         text          NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','issued','applied','cancelled')),
  notes          text          NOT NULL DEFAULT '',
  staff_id       uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (business_id, credit_number)
);
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='credit_notes' AND policyname='cn_select') THEN
    CREATE POLICY "cn_select" ON public.credit_notes FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "cn_insert" ON public.credit_notes FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "cn_update" ON public.credit_notes FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "cn_delete" ON public.credit_notes FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 14 — PURCHASING
-- ================================================================

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  po_number      text          NOT NULL,
  supplier_id    uuid          REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name  text          NOT NULL DEFAULT '',
  date           date          NOT NULL DEFAULT CURRENT_DATE,
  expected_date  date,
  received_date  date,
  subtotal       numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount     numeric(14,2) NOT NULL DEFAULT 0,
  total          numeric(14,2) NOT NULL DEFAULT 0,
  status         text          NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','sent','confirmed','partially_received','received','cancelled')),
  notes          text          NOT NULL DEFAULT '',
  staff_id       uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (business_id, po_number)
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_orders' AND policyname='po_select') THEN
    CREATE POLICY "po_select" ON public.purchase_orders FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "po_insert" ON public.purchase_orders FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "po_update" ON public.purchase_orders FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "po_delete" ON public.purchase_orders FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id          uuid          NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id     uuid          REFERENCES public.products(id) ON DELETE SET NULL,
  description    text          NOT NULL DEFAULT '',
  qty            numeric(12,4) NOT NULL DEFAULT 1 CHECK (qty > 0),
  qty_received   numeric(12,4) NOT NULL DEFAULT 0 CHECK (qty_received >= 0),
  unit_price     numeric(14,4) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  created_at     timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_order_items' AND policyname='poi_select') THEN
    CREATE POLICY "poi_select" ON public.purchase_order_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND po.business_id = public.get_business_id())
    );
    CREATE POLICY "poi_insert" ON public.purchase_order_items FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND po.business_id = public.get_business_id())
    );
    CREATE POLICY "poi_update" ON public.purchase_order_items FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND po.business_id = public.get_business_id())
    );
    CREATE POLICY "poi_delete" ON public.purchase_order_items FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND po.business_id = public.get_business_id())
    );
  END IF;
END $$;


-- ================================================================
-- PART 15 — FINANCIALS (CoA, GL, BANKING)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  account_code text        NOT NULL,
  name         text        NOT NULL,
  account_type text        NOT NULL
               CHECK (account_type IN ('asset','liability','equity','revenue','expense','cost_of_sales')),
  parent_id    uuid        REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  balance      numeric(16,4) NOT NULL DEFAULT 0,
  is_active    boolean     NOT NULL DEFAULT true,
  description  text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, account_code)
);
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts SET (fillfactor = 80);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chart_of_accounts' AND policyname='coa_select') THEN
    CREATE POLICY "coa_select" ON public.chart_of_accounts FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "coa_insert" ON public.chart_of_accounts FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "coa_update" ON public.chart_of_accounts FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "coa_delete" ON public.chart_of_accounts FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  entry_number  text          NOT NULL,
  date          date          NOT NULL DEFAULT CURRENT_DATE,
  description   text          NOT NULL DEFAULT '',
  reference     text          NOT NULL DEFAULT '',
  status        text          NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','posted','reversed')),
  total_debit   numeric(16,4) NOT NULL DEFAULT 0,
  total_credit  numeric(16,4) NOT NULL DEFAULT 0,
  staff_id      uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (business_id, entry_number)
);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='journal_entries' AND policyname='je_select') THEN
    CREATE POLICY "je_select" ON public.journal_entries FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "je_insert" ON public.journal_entries FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "je_update" ON public.journal_entries FOR UPDATE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid          NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id       uuid          NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  debit            numeric(16,4) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit           numeric(16,4) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description      text          NOT NULL DEFAULT '',
  cost_center      text          NOT NULL DEFAULT '',
  CONSTRAINT chk_jel_debit_or_credit CHECK (debit = 0 OR credit = 0)
);
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='journal_entry_lines' AND policyname='jel_select') THEN
    CREATE POLICY "jel_select" ON public.journal_entry_lines FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_entry_lines.journal_entry_id AND je.business_id = public.get_business_id())
    );
    CREATE POLICY "jel_insert" ON public.journal_entry_lines FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_entry_lines.journal_entry_id AND je.business_id = public.get_business_id())
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name             text          NOT NULL,
  bank_name        text          NOT NULL DEFAULT '',
  account_number   text          NOT NULL DEFAULT '',
  account_type     text          NOT NULL DEFAULT 'checking'
                   CHECK (account_type IN ('checking','savings','mobile_money','cash','credit')),
  currency         text          NOT NULL DEFAULT 'GHS',
  balance          numeric(16,4) NOT NULL DEFAULT 0,
  is_active        boolean       NOT NULL DEFAULT true,
  chart_account_id uuid          REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  created_at       timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts SET (fillfactor = 80);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bank_accounts' AND policyname='ba_select') THEN
    CREATE POLICY "ba_select" ON public.bank_accounts FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "ba_insert" ON public.bank_accounts FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "ba_update" ON public.bank_accounts FOR UPDATE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  payment_number  text          NOT NULL,
  type            text          NOT NULL DEFAULT 'incoming'
                  CHECK (type IN ('incoming','outgoing')),
  date            date          NOT NULL DEFAULT CURRENT_DATE,
  amount          numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount > 0),
  currency        text          NOT NULL DEFAULT 'GHS',
  payment_method  text          NOT NULL DEFAULT 'cash',
  bank_account_id uuid          REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  customer_id     uuid          REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id     uuid          REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_id      uuid          REFERENCES public.invoices(id) ON DELETE SET NULL,
  reference       text          NOT NULL DEFAULT '',
  notes           text          NOT NULL DEFAULT '',
  status          text          NOT NULL DEFAULT 'completed'
                  CHECK (status IN ('pending','completed','failed','reversed')),
  staff_id        uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (business_id, payment_number)
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='pay_select') THEN
    CREATE POLICY "pay_select" ON public.payments FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "pay_insert" ON public.payments FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "pay_update" ON public.payments FOR UPDATE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  bank_account_id   uuid          NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  statement_date    date          NOT NULL DEFAULT CURRENT_DATE,
  statement_balance numeric(14,2) NOT NULL DEFAULT 0,
  system_balance    numeric(14,2) NOT NULL DEFAULT 0,
  difference        numeric(14,2) NOT NULL DEFAULT 0,
  status            text          NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','reconciled')),
  notes             text          NOT NULL DEFAULT '',
  created_at        timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bank_reconciliations' AND policyname='br_select') THEN
    CREATE POLICY "br_select" ON public.bank_reconciliations FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "br_insert" ON public.bank_reconciliations FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "br_update" ON public.bank_reconciliations FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "br_delete" ON public.bank_reconciliations FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.reconciliation_items (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid          NOT NULL REFERENCES public.bank_reconciliations(id) ON DELETE CASCADE,
  date              date          NOT NULL DEFAULT CURRENT_DATE,
  description       text          NOT NULL DEFAULT '',
  reference         text          NOT NULL DEFAULT '',
  amount            numeric(14,2) NOT NULL DEFAULT 0,
  type              text          NOT NULL DEFAULT 'debit'
                    CHECK (type IN ('debit','credit')),
  matched           boolean       NOT NULL DEFAULT false,
  payment_id        uuid          REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at        timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.reconciliation_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reconciliation_items' AND policyname='rci_select') THEN
    CREATE POLICY "rci_select" ON public.reconciliation_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.bank_reconciliations br WHERE br.id = reconciliation_items.reconciliation_id AND br.business_id = public.get_business_id())
    );
    CREATE POLICY "rci_insert" ON public.reconciliation_items FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.bank_reconciliations br WHERE br.id = reconciliation_items.reconciliation_id AND br.business_id = public.get_business_id())
    );
    CREATE POLICY "rci_update" ON public.reconciliation_items FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.bank_reconciliations br WHERE br.id = reconciliation_items.reconciliation_id AND br.business_id = public.get_business_id())
    );
  END IF;
END $$;

-- Price lists
CREATE TABLE IF NOT EXISTS public.price_lists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  currency    text        NOT NULL DEFAULT 'GHS',
  is_default  boolean     NOT NULL DEFAULT false,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='price_lists' AND policyname='pl_select') THEN
    CREATE POLICY "pl_select" ON public.price_lists FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "pl_insert" ON public.price_lists FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "pl_update" ON public.price_lists FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "pl_delete" ON public.price_lists FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.price_list_items (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id    uuid          NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  product_id       uuid          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price            numeric(14,4) NOT NULL DEFAULT 0 CHECK (price >= 0),
  min_quantity     integer       NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  discount_percent numeric(5,2)  NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  UNIQUE (price_list_id, product_id, min_quantity)
);
ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='price_list_items' AND policyname='pli_select') THEN
    CREATE POLICY "pli_select" ON public.price_list_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.price_lists pl WHERE pl.id = price_list_items.price_list_id AND pl.business_id = public.get_business_id())
    );
    CREATE POLICY "pli_insert" ON public.price_list_items FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.price_lists pl WHERE pl.id = price_list_items.price_list_id AND pl.business_id = public.get_business_id())
    );
    CREATE POLICY "pli_update" ON public.price_list_items FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.price_lists pl WHERE pl.id = price_list_items.price_list_id AND pl.business_id = public.get_business_id())
    );
    CREATE POLICY "pli_delete" ON public.price_list_items FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.price_lists pl WHERE pl.id = price_list_items.price_list_id AND pl.business_id = public.get_business_id())
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.commissions (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id    uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  invoice_id  uuid          REFERENCES public.invoices(id) ON DELETE SET NULL,
  sale_id     uuid          REFERENCES public.sales(id) ON DELETE SET NULL,
  amount      numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  rate        numeric(5,2)  NOT NULL DEFAULT 0 CHECK (rate >= 0),
  base_amount numeric(14,2) NOT NULL DEFAULT 0,
  status      text          NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','paid','cancelled')),
  created_at  timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='commissions' AND policyname='comm_select') THEN
    CREATE POLICY "comm_select" ON public.commissions FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "comm_insert" ON public.commissions FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "comm_update" ON public.commissions FOR UPDATE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  from_currency  text          NOT NULL DEFAULT 'USD',
  to_currency    text          NOT NULL DEFAULT 'GHS',
  rate           numeric(14,6) NOT NULL DEFAULT 1 CHECK (rate > 0),
  effective_date date          NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='exchange_rates' AND policyname='er_select') THEN
    CREATE POLICY "er_select" ON public.exchange_rates FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "er_insert" ON public.exchange_rates FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "er_update" ON public.exchange_rates FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "er_delete" ON public.exchange_rates FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 16 — HR (EMPLOYEES, PAYROLL, LEAVE)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.employees (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id          uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  first_name        text        NOT NULL,
  last_name         text        NOT NULL DEFAULT '',
  position          text        NOT NULL DEFAULT '',
  department        text        NOT NULL DEFAULT '',
  date_of_birth     date,
  hire_date         date        DEFAULT CURRENT_DATE,
  salary            numeric(14,2) NOT NULL DEFAULT 0 CHECK (salary >= 0),
  salary_frequency  text        NOT NULL DEFAULT 'monthly'
                    CHECK (salary_frequency IN ('daily','weekly','bi_weekly','monthly')),
  bank_name         text        NOT NULL DEFAULT '',
  bank_account      text        NOT NULL DEFAULT '',
  ssnit_number      text        NOT NULL DEFAULT '',   -- Ghana SSNIT
  tin               text        NOT NULL DEFAULT '',   -- Ghana TIN
  emergency_contact text        NOT NULL DEFAULT '',
  emergency_phone   text        NOT NULL DEFAULT '',
  address           text        NOT NULL DEFAULT '',
  status            text        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','terminated','on_leave')),
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='emp_select') THEN
    CREATE POLICY "emp_select" ON public.employees FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "emp_insert" ON public.employees FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "emp_update" ON public.employees FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "emp_delete" ON public.employees FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

-- Leave balances (annual allotment tracking)
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid    NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id uuid    NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year        integer NOT NULL,
  leave_type  text    NOT NULL DEFAULT 'annual',
  days_total  integer NOT NULL DEFAULT 21 CHECK (days_total >= 0),
  days_taken  integer NOT NULL DEFAULT 0  CHECK (days_taken >= 0),
  days_pending integer NOT NULL DEFAULT 0 CHECK (days_pending >= 0),
  UNIQUE (employee_id, year, leave_type)
);
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leave_balances' AND policyname='lb_select') THEN
    CREATE POLICY "lb_select" ON public.leave_balances FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "lb_insert" ON public.leave_balances FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "lb_update" ON public.leave_balances FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "lb_delete" ON public.leave_balances FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type  text        NOT NULL DEFAULT 'annual'
              CHECK (leave_type IN ('annual','sick','maternity','paternity','study','emergency','unpaid')),
  start_date  date        NOT NULL DEFAULT CURRENT_DATE,
  end_date    date        NOT NULL DEFAULT CURRENT_DATE,
  days        integer     NOT NULL DEFAULT 1 CHECK (days > 0),
  reason      text        NOT NULL DEFAULT '',
  status      text        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leave_requests' AND policyname='lr_select') THEN
    CREATE POLICY "lr_select" ON public.leave_requests FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "lr_insert" ON public.leave_requests FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "lr_update" ON public.leave_requests FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "lr_delete" ON public.leave_requests FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

-- Payroll runs (monthly batch)
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  run_number     text          NOT NULL,
  period_start   date          NOT NULL,
  period_end     date          NOT NULL,
  pay_date       date          NOT NULL,
  gross_total    numeric(16,2) NOT NULL DEFAULT 0,
  deductions_total numeric(16,2) NOT NULL DEFAULT 0,
  net_total      numeric(16,2) NOT NULL DEFAULT 0,
  employee_count integer       NOT NULL DEFAULT 0,
  status         text          NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','processing','approved','paid','cancelled')),
  notes          text          NOT NULL DEFAULT '',
  approved_by    uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  approved_at    timestamptz,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (business_id, run_number)
);
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payroll_runs' AND policyname='pr_select') THEN
    CREATE POLICY "pr_select" ON public.payroll_runs FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "pr_insert" ON public.payroll_runs FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "pr_update" ON public.payroll_runs FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "pr_delete" ON public.payroll_runs FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

-- Per-employee payslip within a run
-- Ghana deductions: SSNIT 5.5% employee / 13% employer, PAYE income tax
CREATE TABLE IF NOT EXISTS public.payroll_items (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id       uuid          NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id          uuid          NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  basic_salary         numeric(14,2) NOT NULL DEFAULT 0,
  allowances           numeric(14,2) NOT NULL DEFAULT 0,
  overtime_amount      numeric(14,2) NOT NULL DEFAULT 0,
  gross_salary         numeric(14,2) NOT NULL DEFAULT 0,
  ssnit_employee       numeric(14,2) NOT NULL DEFAULT 0,   -- 5.5%
  ssnit_employer       numeric(14,2) NOT NULL DEFAULT 0,   -- 13%
  paye_tax             numeric(14,2) NOT NULL DEFAULT 0,   -- PAYE Ghana bands
  other_deductions     numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions     numeric(14,2) NOT NULL DEFAULT 0,
  net_salary           numeric(14,2) NOT NULL DEFAULT 0,
  bank_account         text          NOT NULL DEFAULT '',
  payment_status       text          NOT NULL DEFAULT 'pending'
                       CHECK (payment_status IN ('pending','paid','failed')),
  notes                text          NOT NULL DEFAULT '',
  UNIQUE (payroll_run_id, employee_id)
);
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payroll_items' AND policyname='pitem_select') THEN
    CREATE POLICY "pitem_select" ON public.payroll_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.payroll_runs pr WHERE pr.id = payroll_items.payroll_run_id AND pr.business_id = public.get_business_id())
    );
    CREATE POLICY "pitem_insert" ON public.payroll_items FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.payroll_runs pr WHERE pr.id = payroll_items.payroll_run_id AND pr.business_id = public.get_business_id())
    );
    CREATE POLICY "pitem_update" ON public.payroll_items FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.payroll_runs pr WHERE pr.id = payroll_items.payroll_run_id AND pr.business_id = public.get_business_id())
    );
  END IF;
END $$;


-- ================================================================
-- PART 17 — PROJECTS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text          NOT NULL,
  description text          NOT NULL DEFAULT '',
  customer_id uuid          REFERENCES public.customers(id) ON DELETE SET NULL,
  manager_id  uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  start_date  date          DEFAULT CURRENT_DATE,
  end_date    date,
  budget      numeric(14,2) NOT NULL DEFAULT 0 CHECK (budget >= 0),
  actual_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (actual_cost >= 0),
  status      text          NOT NULL DEFAULT 'planning'
              CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  priority    text          NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low','medium','high','critical')),
  created_at  timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='proj_select') THEN
    CREATE POLICY "proj_select" ON public.projects FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "proj_insert" ON public.projects FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "proj_update" ON public.projects FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "proj_delete" ON public.projects FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid          NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title           text          NOT NULL,
  description     text          NOT NULL DEFAULT '',
  assigned_to     uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  start_date      date,
  due_date        date,
  priority        text          NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','critical')),
  status          text          NOT NULL DEFAULT 'todo'
                  CHECK (status IN ('todo','in_progress','review','done','cancelled')),
  hours_estimated numeric(8,2)  NOT NULL DEFAULT 0,
  hours_actual    numeric(8,2)  NOT NULL DEFAULT 0,
  created_at      timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_tasks' AND policyname='ptask_select') THEN
    CREATE POLICY "ptask_select" ON public.project_tasks FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_tasks.project_id AND p.business_id = public.get_business_id())
    );
    CREATE POLICY "ptask_insert" ON public.project_tasks FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_tasks.project_id AND p.business_id = public.get_business_id())
    );
    CREATE POLICY "ptask_update" ON public.project_tasks FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_tasks.project_id AND p.business_id = public.get_business_id())
    );
    CREATE POLICY "ptask_delete" ON public.project_tasks FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_tasks.project_id AND p.business_id = public.get_business_id())
    );
  END IF;
END $$;


-- ================================================================
-- PART 18 — SERVICE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.service_calls (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  call_number   text        NOT NULL,
  customer_id   uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text        NOT NULL DEFAULT '',
  subject       text        NOT NULL,
  description   text        NOT NULL DEFAULT '',
  priority      text        NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low','medium','high','critical')),
  status        text        NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','pending_parts','resolved','closed','cancelled')),
  assigned_to   uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  resolution    text        NOT NULL DEFAULT '',
  opened_at     timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, call_number)
);
ALTER TABLE public.service_calls ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_calls' AND policyname='sc2_select') THEN
    CREATE POLICY "sc2_select" ON public.service_calls FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "sc2_insert" ON public.service_calls FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "sc2_update" ON public.service_calls FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "sc2_delete" ON public.service_calls FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.service_contracts (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id     uuid          REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name   text          NOT NULL,
  contract_number text          NOT NULL,
  type            text          NOT NULL DEFAULT 'maintenance'
                  CHECK (type IN ('maintenance','support','warranty','subscription')),
  start_date      date          NOT NULL,
  end_date        date          NOT NULL,
  value           numeric(14,2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  status          text          NOT NULL DEFAULT 'active'
                  CHECK (status IN ('draft','active','expired','cancelled')),
  notes           text          NOT NULL DEFAULT '',
  created_at      timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (business_id, contract_number)
);
ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_contracts' AND policyname='sco_select') THEN
    CREATE POLICY "sco_select" ON public.service_contracts FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "sco_insert" ON public.service_contracts FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "sco_update" ON public.service_contracts FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "sco_delete" ON public.service_contracts FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.customer_equipment (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id   uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text        NOT NULL DEFAULT '',
  product_id    uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  serial_number text,
  model         text        NOT NULL DEFAULT '',
  brand         text        NOT NULL DEFAULT '',
  purchase_date date,
  warranty_end  date,
  status        text        NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','under_repair','retired','disposed')),
  notes         text        NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_equipment ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_equipment' AND policyname='ceq_select') THEN
    CREATE POLICY "ceq_select" ON public.customer_equipment FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "ceq_insert" ON public.customer_equipment FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "ceq_update" ON public.customer_equipment FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "ceq_delete" ON public.customer_equipment FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 19 — PRODUCTION & MRP
-- ================================================================

CREATE TABLE IF NOT EXISTS public.bill_of_materials (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id          uuid          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name                text          NOT NULL,
  quantity_to_produce numeric(12,4) NOT NULL DEFAULT 1 CHECK (quantity_to_produce > 0),
  status              text          NOT NULL DEFAULT 'active'
                      CHECK (status IN ('draft','active','archived')),
  notes               text          NOT NULL DEFAULT '',
  created_at          timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bill_of_materials' AND policyname='bom_select') THEN
    CREATE POLICY "bom_select" ON public.bill_of_materials FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "bom_insert" ON public.bill_of_materials FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "bom_update" ON public.bill_of_materials FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "bom_delete" ON public.bill_of_materials FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bom_components (
  id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id     uuid          NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE CASCADE,
  product_id uuid          NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity   numeric(12,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost  numeric(14,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  UNIQUE (bom_id, product_id)
);
ALTER TABLE public.bom_components ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bom_components' AND policyname='bc_select') THEN
    CREATE POLICY "bc_select" ON public.bom_components FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.bill_of_materials b WHERE b.id = bom_components.bom_id AND b.business_id = public.get_business_id())
    );
    CREATE POLICY "bc_insert" ON public.bom_components FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.bill_of_materials b WHERE b.id = bom_components.bom_id AND b.business_id = public.get_business_id())
    );
    CREATE POLICY "bc_update" ON public.bom_components FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.bill_of_materials b WHERE b.id = bom_components.bom_id AND b.business_id = public.get_business_id())
    );
    CREATE POLICY "bc_delete" ON public.bom_components FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.bill_of_materials b WHERE b.id = bom_components.bom_id AND b.business_id = public.get_business_id())
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.production_orders (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_number    text          NOT NULL,
  bom_id          uuid          REFERENCES public.bill_of_materials(id) ON DELETE SET NULL,
  product_id      uuid          REFERENCES public.products(id) ON DELETE SET NULL,
  quantity        numeric(12,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  qty_produced    numeric(12,4) NOT NULL DEFAULT 0 CHECK (qty_produced >= 0),
  planned_date    date          DEFAULT CURRENT_DATE,
  completion_date date,
  status          text          NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned','in_progress','paused','completed','cancelled')),
  notes           text          NOT NULL DEFAULT '',
  staff_id        uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (business_id, order_number)
);
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='production_orders' AND policyname='po2_select') THEN
    CREATE POLICY "po2_select" ON public.production_orders FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "po2_insert" ON public.production_orders FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "po2_update" ON public.production_orders FOR UPDATE  USING     (business_id = public.get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 20 — WAREHOUSES & STOCK TRANSFERS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.warehouses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  code        text        NOT NULL DEFAULT '',
  address     text        NOT NULL DEFAULT '',
  is_default  boolean     NOT NULL DEFAULT false,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, code)
);
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouses' AND policyname='wh_select') THEN
    CREATE POLICY "wh_select" ON public.warehouses FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "wh_insert" ON public.warehouses FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "wh_update" ON public.warehouses FOR UPDATE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  transfer_number   text          NOT NULL,
  from_warehouse_id uuid          REFERENCES public.warehouses(id) ON DELETE SET NULL,
  to_warehouse_id   uuid          REFERENCES public.warehouses(id) ON DELETE SET NULL,
  product_id        uuid          REFERENCES public.products(id) ON DELETE SET NULL,
  quantity          numeric(12,4) NOT NULL DEFAULT 0 CHECK (quantity > 0),
  date              date          NOT NULL DEFAULT CURRENT_DATE,
  status            text          NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('draft','in_transit','completed','cancelled')),
  notes             text          NOT NULL DEFAULT '',
  staff_id          uuid          REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (business_id, transfer_number)
);
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_transfers' AND policyname='st_select') THEN
    CREATE POLICY "st_select" ON public.stock_transfers FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "st_insert" ON public.stock_transfers FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "st_update" ON public.stock_transfers FOR UPDATE  USING     (business_id = public.get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 21 — ATTACHMENTS & STORAGE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.attachments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  record_type text        NOT NULL DEFAULT '',
  record_id   uuid        NOT NULL,
  file_name   text        NOT NULL,
  file_url    text        NOT NULL,
  file_size   integer     NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  mime_type   text        NOT NULL DEFAULT '',
  uploaded_by text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='attachments' AND policyname='att_select') THEN
    CREATE POLICY "att_select" ON public.attachments FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "att_insert" ON public.attachments FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "att_delete" ON public.attachments FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments','attachments',true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('logos','logos',true) ON CONFLICT DO NOTHING;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='attach_upload') THEN
    CREATE POLICY "attach_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('attachments','logos'));
    CREATE POLICY "attach_read"   ON storage.objects FOR SELECT  USING (bucket_id IN ('attachments','logos'));
    CREATE POLICY "attach_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('attachments','logos'));
  END IF;
END $$;


-- ================================================================
-- PART 22 — PERFORMANCE INDEXES
-- ================================================================

-- businesses
CREATE INDEX IF NOT EXISTS idx_biz_owner          ON public.businesses(owner_id);

-- products
CREATE INDEX IF NOT EXISTS idx_prod_biz           ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_prod_biz_active    ON public.products(business_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_prod_cat           ON public.products(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prod_sku           ON public.products(business_id, sku) WHERE sku != '';
CREATE INDEX IF NOT EXISTS idx_prod_barcode       ON public.products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prod_name_trgm     ON public.products USING gin(name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_prod_low_stock     ON public.products(business_id) WHERE qty <= reorder_level;

-- customers
CREATE INDEX IF NOT EXISTS idx_cust_biz           ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_cust_phone         ON public.customers(business_id, phone) WHERE phone != '';
CREATE INDEX IF NOT EXISTS idx_cust_name_trgm     ON public.customers USING gin(name extensions.gin_trgm_ops);

-- suppliers
CREATE INDEX IF NOT EXISTS idx_supp_biz           ON public.suppliers(business_id);

-- staff
CREATE INDEX IF NOT EXISTS idx_staff_biz          ON public.staff_members(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_biz_status   ON public.staff_members(business_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_staffid      ON public.staff_members(business_id, staff_id) WHERE staff_id IS NOT NULL;

-- sales (high-volume — include BRIN for range scans)
CREATE INDEX IF NOT EXISTS idx_sales_biz_date     ON public.sales(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer     ON public.sales(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_biz_pm       ON public.sales(business_id, payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_voided       ON public.sales(business_id) WHERE voided = false;
CREATE INDEX IF NOT EXISTS idx_sale_items_sale    ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_prod    ON public.sale_items(product_id) WHERE product_id IS NOT NULL;

-- invoices
CREATE INDEX IF NOT EXISTS idx_inv_biz_date       ON public.invoices(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_biz_status     ON public.invoices(business_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_customer       ON public.invoices(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_number         ON public.invoices(business_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_inv_due            ON public.invoices(business_id, due_date) WHERE status IN ('sent','partial','overdue');
CREATE INDEX IF NOT EXISTS idx_inv_items_inv      ON public.invoice_items(invoice_id);

-- expenses
CREATE INDEX IF NOT EXISTS idx_exp_biz_date       ON public.expenses(business_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_exp_biz_cat        ON public.expenses(business_id, category);

-- purchase orders
CREATE INDEX IF NOT EXISTS idx_po_biz_status      ON public.purchase_orders(business_id, status);
CREATE INDEX IF NOT EXISTS idx_poi_po             ON public.purchase_order_items(po_id);

-- leads / opportunities
CREATE INDEX IF NOT EXISTS idx_leads_biz_status   ON public.leads(business_id, status);
CREATE INDEX IF NOT EXISTS idx_opp_biz_status     ON public.opportunities(business_id, status);
CREATE INDEX IF NOT EXISTS idx_opp_biz_stage      ON public.opportunities(business_id, stage) WHERE status = 'open';

-- notifications
CREATE INDEX IF NOT EXISTS idx_notif_biz_unread   ON public.notifications(business_id, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notif_biz_staff    ON public.notifications(business_id, staff_id);

-- audit logs
CREATE INDEX IF NOT EXISTS idx_al_biz_date        ON public.audit_logs(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_al_module          ON public.audit_logs(business_id, module, created_at DESC);

-- payments
CREATE INDEX IF NOT EXISTS idx_pay_biz_date       ON public.payments(business_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_pay_invoice        ON public.payments(invoice_id) WHERE invoice_id IS NOT NULL;

-- payroll
CREATE INDEX IF NOT EXISTS idx_payroll_biz        ON public.payroll_runs(business_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_payitem_run        ON public.payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payitem_emp        ON public.payroll_items(employee_id);

-- stock adjustments
CREATE INDEX IF NOT EXISTS idx_sadj_biz_prod      ON public.stock_adjustments(business_id, product_id);
CREATE INDEX IF NOT EXISTS idx_sadj_biz_date      ON public.stock_adjustments(business_id, created_at DESC);

-- projects
CREATE INDEX IF NOT EXISTS idx_proj_biz_status    ON public.projects(business_id, status);
CREATE INDEX IF NOT EXISTS idx_ptask_proj         ON public.project_tasks(project_id);

-- employees / leave
CREATE INDEX IF NOT EXISTS idx_emp_biz            ON public.employees(business_id);
CREATE INDEX IF NOT EXISTS idx_lr_emp             ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_lb_emp             ON public.leave_balances(employee_id);

-- serial numbers
CREATE INDEX IF NOT EXISTS idx_sn_biz_prod        ON public.serial_numbers(business_id, product_id);

-- journal entries
CREATE INDEX IF NOT EXISTS idx_je_biz_date        ON public.journal_entries(business_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_jel_je             ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jel_account        ON public.journal_entry_lines(account_id);


-- ================================================================
-- PART 23 — SECURE STAFF PIN AUTHENTICATION
-- ================================================================

-- Hash any plain-text PINs on existing rows
UPDATE public.staff_members
   SET pin = crypt(pin, gen_salt('bf', 10))
 WHERE pin IS NOT NULL AND pin != '' AND pin NOT LIKE '$2%';

-- Auto-hash trigger: INSERT or PIN UPDATE
CREATE OR REPLACE FUNCTION public.hash_staff_pin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.pin IS NOT NULL AND NEW.pin != '' AND NEW.pin NOT LIKE '$2%' THEN
    NEW.pin := crypt(NEW.pin, gen_salt('bf', 10));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_hash_staff_pin ON public.staff_members;
CREATE TRIGGER trg_hash_staff_pin
  BEFORE INSERT OR UPDATE OF pin ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.hash_staff_pin();

-- verify_staff_pin: targeted (by staff_id) OR scan mode.
-- Targeted lockout: only the failing staff row is locked — no mass-lockout.
-- 5 failed attempts → 15 minute lockout.
CREATE OR REPLACE FUNCTION public.verify_staff_pin(
  _business_id uuid,
  _pin         text,
  _staff_id    uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, role text, permissions jsonb, user_type public.user_type)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _s record;
BEGIN
  -- ── Targeted path (login by staff_id) ──────────────────────────
  IF _staff_id IS NOT NULL THEN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until,
           s.permissions, s.user_type
      INTO _s
      FROM public.staff_members s
     WHERE s.id = _staff_id
       AND s.business_id = _business_id
       AND s.status = 'active';

    IF NOT FOUND THEN RETURN; END IF;

    -- Lockout check
    IF _s.locked_until IS NOT NULL AND _s.locked_until > now() THEN
      RETURN;  -- silently deny; frontend should show time remaining
    END IF;

    -- Verify
    IF crypt(_pin, _s.pin) = _s.pin THEN
      UPDATE public.staff_members
         SET failed_attempts = 0, locked_until = NULL,
             last_login = now(), is_online = true
       WHERE id = _s.id;
      RETURN QUERY SELECT _s.id, _s.name, _s.role, _s.permissions, _s.user_type;
      RETURN;
    END IF;

    -- Failed
    UPDATE public.staff_members
       SET failed_attempts = failed_attempts + 1,
           locked_until    = CASE
             WHEN failed_attempts + 1 >= 5
             THEN now() + interval '15 minutes'
             ELSE locked_until
           END
     WHERE id = _s.id;
    RETURN;
  END IF;

  -- ── Scan path (legacy: no staff_id given) ──────────────────────
  -- Still targeted lockout: only the matched row's counter increments.
  FOR _s IN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until,
           s.permissions, s.user_type
      FROM public.staff_members s
     WHERE s.business_id = _business_id AND s.status = 'active'
  LOOP
    IF _s.locked_until IS NOT NULL AND _s.locked_until > now() THEN CONTINUE; END IF;

    IF crypt(_pin, _s.pin) = _s.pin THEN
      UPDATE public.staff_members
         SET failed_attempts = 0, locked_until = NULL,
             last_login = now(), is_online = true
       WHERE id = _s.id;
      RETURN QUERY SELECT _s.id, _s.name, _s.role, _s.permissions, _s.user_type;
      RETURN;
    END IF;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(uuid, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_logout(_staff_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.staff_members SET is_online = false WHERE id = _staff_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_logout(uuid) TO authenticated;


-- ================================================================
-- PART 24 — ATOMIC DOCUMENT NUMBER SEQUENCES
-- ================================================================

CREATE TABLE IF NOT EXISTS public.invoice_counters (
  business_id uuid    NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  year        integer NOT NULL,
  last_value  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, year)
);
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_counters' AND policyname='ic_all') THEN
    CREATE POLICY "ic_all" ON public.invoice_counters FOR ALL
      USING (business_id = public.get_business_id())
      WITH CHECK (business_id = public.get_business_id());
  END IF;
END $$;

-- Generates NXG-YYYY-NNN atomically (SELECT FOR UPDATE row-lock)
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _bid  uuid    := public.get_business_id();
  _year integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  _next integer;
BEGIN
  INSERT INTO public.invoice_counters (business_id, year, last_value)
  VALUES (_bid, _year, 0)
  ON CONFLICT (business_id, year) DO NOTHING;

  UPDATE public.invoice_counters
     SET last_value = last_value + 1
   WHERE business_id = _bid AND year = _year
  RETURNING last_value INTO _next;

  RETURN 'NXG-' || _year::text || '-' || LPAD(_next::text, 3, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated;


-- ================================================================
-- PART 25 — BUSINESS LOGIC RPCs
-- ================================================================

-- ── Loyalty points ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_loyalty_points(
  p_customer_id uuid,
  p_points      integer
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_points <= 0 THEN RETURN; END IF;
  UPDATE public.customers
     SET loyalty_points = loyalty_points + p_points
   WHERE id = p_customer_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_loyalty_points(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.decrement_loyalty_points(
  p_customer_id uuid,
  p_points      integer
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_points <= 0 THEN RETURN; END IF;
  UPDATE public.customers
     SET loyalty_points = GREATEST(0, loyalty_points - p_points)
   WHERE id = p_customer_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.decrement_loyalty_points(uuid, integer) TO authenticated;

-- ── Void sale (manager-and-above only) ──────────────────────────
CREATE OR REPLACE FUNCTION public.void_sale(
  p_sale_id     uuid,
  p_business_id uuid,
  p_staff_id    uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _allowed_roles text[] := ARRAY[
    'System Administrator','Administrator','Manager',
    'CFO / Finance Manager','Accountant','Sales Manager',
    'Supervisor','Executive / CEO'
  ];
  _role text;
BEGIN
  -- Ownership check
  IF NOT EXISTS (
    SELECT 1 FROM public.sales
     WHERE id = p_sale_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sales WHERE id = p_sale_id AND voided = true
  ) THEN
    RAISE EXCEPTION 'Sale is already voided';
  END IF;

  -- Role check
  IF p_staff_id IS NOT NULL THEN
    SELECT role INTO _role
      FROM public.staff_members
     WHERE id = p_staff_id AND business_id = p_business_id AND status = 'active';
    IF NOT FOUND THEN RAISE EXCEPTION 'Staff not found'; END IF;
    IF NOT (_role = ANY(_allowed_roles)) THEN
      RAISE EXCEPTION 'Insufficient role: "%" cannot void sales', _role;
    END IF;
  END IF;

  -- Void and restore stock atomically
  UPDATE public.sales
     SET voided = true, voided_at = now(), voided_by = p_staff_id
   WHERE id = p_sale_id;

  UPDATE public.products p
     SET qty = p.qty + si.qty, updated_at = now()
    FROM public.sale_items si
   WHERE si.sale_id = p_sale_id AND si.product_id = p.id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid, uuid, uuid) TO authenticated;

-- ── Receive purchase order ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_po_id       uuid,
  p_business_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_orders
     WHERE id = p_po_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.purchase_orders WHERE id = p_po_id AND status = 'received'
  ) THEN
    RAISE EXCEPTION 'Purchase order already received';
  END IF;

  -- Add received qty to product stock
  UPDATE public.products p
     SET qty = p.qty + poi.qty, updated_at = now()
    FROM public.purchase_order_items poi
   WHERE poi.po_id = p_po_id AND poi.product_id = p.id;

  UPDATE public.purchase_orders
     SET status = 'received', received_date = CURRENT_DATE
   WHERE id = p_po_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid, uuid) TO authenticated;

-- ── Adjust stock (manual correction with audit trail) ────────────
CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_business_id   uuid,
  p_product_id    uuid,
  p_qty_change    integer,
  p_type          text,
  p_reason        text DEFAULT '',
  p_staff_id      uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _qty_before integer;
BEGIN
  SELECT qty INTO _qty_before FROM public.products
   WHERE id = p_product_id AND business_id = p_business_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;

  IF _qty_before + p_qty_change < 0 THEN
    RAISE EXCEPTION 'Adjustment would result in negative stock';
  END IF;

  UPDATE public.products
     SET qty = qty + p_qty_change, updated_at = now()
   WHERE id = p_product_id;

  INSERT INTO public.stock_adjustments
    (business_id, product_id, adjustment_type, qty_before, qty_change, qty_after, reason, staff_id)
  VALUES
    (p_business_id, p_product_id, p_type, _qty_before, p_qty_change, _qty_before + p_qty_change, p_reason, p_staff_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, uuid, integer, text, text, uuid) TO authenticated;

-- ── Ghana PAYE tax calculation ───────────────────────────────────
-- 2024 Ghana PAYE bands (annual GHS):
--   0        – 4,380     → 0%
--   4,381    – 5,580     → 5%
--   5,581    – 6,780     → 10%
--   6,781    – 42,000    → 17.5%
--   42,001   – 144,000   → 25%
--   144,001+ (next 96k)  → 30%
--   Above 240,001        → 35%
CREATE OR REPLACE FUNCTION public.calculate_ghana_paye(p_annual_gross numeric)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  _tax numeric := 0;
  _rem numeric := p_annual_gross;
BEGIN
  IF _rem > 4380  THEN _tax := _tax + LEAST(_rem - 4380, 1200)   * 0.05;  END IF;
  IF _rem > 5580  THEN _tax := _tax + LEAST(_rem - 5580, 1200)   * 0.10;  END IF;
  IF _rem > 6780  THEN _tax := _tax + LEAST(_rem - 6780, 35220)  * 0.175; END IF;
  IF _rem > 42000 THEN _tax := _tax + LEAST(_rem - 42000, 102000)* 0.25;  END IF;
  IF _rem > 144000 THEN _tax := _tax + LEAST(_rem - 144000, 96000)* 0.30; END IF;
  IF _rem > 240000 THEN _tax := _tax + (_rem - 240000)           * 0.35;  END IF;
  RETURN ROUND(_tax / 12, 2);  -- return monthly PAYE
END;
$$;


-- ================================================================
-- PART 26 — DASHBOARD STATS RPC
-- Replaces ~12 parallel client queries with a single DB round-trip.
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_business_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _today        date    := CURRENT_DATE;
  _yesterday    date    := CURRENT_DATE - 1;
  _month_start  date    := date_trunc('month', CURRENT_DATE)::date;

  _today_total       numeric := 0;  _today_count      integer := 0;
  _yesterday_total   numeric := 0;
  _mtd_total         numeric := 0;
  _unpaid_count      integer := 0;  _unpaid_total     numeric := 0;
  _overdue_count     integer := 0;  _overdue_total    numeric := 0;
  _low_stock         jsonb   := '[]';
  _out_of_stock      integer := 0;  _total_products   integer := 0;
  _inv_cost          numeric := 0;  _inv_retail       numeric := 0;
  _customer_count    integer := 0;  _open_leads       integer := 0;
  _open_pos_count    integer := 0;  _open_pos_total   numeric := 0;
  _active_production integer := 0;
  _bank_balance      numeric := 0;  _bank_count       integer := 0;
  _month_expenses    numeric := 0;
  _pipeline_value    numeric := 0;  _pipeline_count   integer := 0;
  _pipeline_stages   jsonb   := '{}';
  _open_service      integer := 0;
BEGIN
  -- Ownership guard
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Today's sales
  SELECT COALESCE(SUM(total), 0), COUNT(*)
    INTO _today_total, _today_count
    FROM public.sales
   WHERE business_id = p_business_id
     AND created_at::date = _today
     AND voided = false;

  -- Yesterday's sales
  SELECT COALESCE(SUM(total), 0)
    INTO _yesterday_total
    FROM public.sales
   WHERE business_id = p_business_id
     AND created_at::date = _yesterday
     AND voided = false;

  -- Month-to-date sales
  SELECT COALESCE(SUM(total), 0)
    INTO _mtd_total
    FROM public.sales
   WHERE business_id = p_business_id
     AND created_at::date >= _month_start
     AND voided = false;

  -- Unpaid / overdue invoices
  SELECT
    COUNT(*),
    COALESCE(SUM(total - amount_paid), 0),
    COUNT(*)     FILTER (WHERE due_date < _today),
    COALESCE(SUM(total - amount_paid) FILTER (WHERE due_date < _today), 0)
  INTO _unpaid_count, _unpaid_total, _overdue_count, _overdue_total
  FROM public.invoices
  WHERE business_id = p_business_id
    AND status IN ('sent','overdue','partial');

  -- Inventory summary + low-stock list (cap at 20 items)
  SELECT
    COUNT(*),
    COALESCE(SUM(qty * cost_price), 0),
    COALESCE(SUM(qty * selling_price), 0),
    COUNT(*) FILTER (WHERE qty = 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id, 'name', name,
          'qty', qty, 'reorder_level', reorder_level,
          'selling_price', selling_price
        ) ORDER BY qty ASC
      ) FILTER (WHERE qty <= reorder_level),
      '[]'::jsonb
    )
  INTO _total_products, _inv_cost, _inv_retail, _out_of_stock, _low_stock
  FROM (
    SELECT id, name, qty, reorder_level, cost_price, selling_price
      FROM public.products
     WHERE business_id = p_business_id AND is_active = true
     LIMIT 500      -- safety: don't scan millions of rows
  ) sub;

  SELECT COUNT(*) INTO _customer_count FROM public.customers WHERE business_id = p_business_id;

  SELECT COUNT(*) INTO _open_leads
    FROM public.leads
   WHERE business_id = p_business_id AND status IN ('new','contacted','qualified');

  SELECT COUNT(*), COALESCE(SUM(total), 0)
    INTO _open_pos_count, _open_pos_total
    FROM public.purchase_orders
   WHERE business_id = p_business_id AND status IN ('draft','sent','confirmed');

  SELECT COUNT(*) INTO _active_production
    FROM public.production_orders
   WHERE business_id = p_business_id AND status IN ('planned','in_progress');

  SELECT COUNT(*), COALESCE(SUM(balance), 0)
    INTO _bank_count, _bank_balance
    FROM public.bank_accounts
   WHERE business_id = p_business_id AND is_active = true;

  SELECT COALESCE(SUM(amount), 0) INTO _month_expenses
    FROM public.expenses
   WHERE business_id = p_business_id AND date >= _month_start;

  SELECT COUNT(*) INTO _open_service
    FROM public.service_calls
   WHERE business_id = p_business_id AND status IN ('open','in_progress','pending_parts');

  -- Pipeline summary
  SELECT
    COALESCE(SUM(cnt), 0),
    COALESCE(SUM(val), 0),
    COALESCE(jsonb_object_agg(stage, jsonb_build_object('count', cnt, 'value', val)), '{}')
  INTO _pipeline_count, _pipeline_value, _pipeline_stages
  FROM (
    SELECT stage, COUNT(*) AS cnt, COALESCE(SUM(value), 0) AS val
      FROM public.opportunities
     WHERE business_id = p_business_id AND status = 'open'
     GROUP BY stage
  ) sub;

  RETURN jsonb_build_object(
    'today_total',        _today_total,
    'today_count',        _today_count,
    'yesterday_total',    _yesterday_total,
    'mtd_total',          _mtd_total,
    'unpaid_count',       _unpaid_count,
    'unpaid_total',       _unpaid_total,
    'overdue_count',      _overdue_count,
    'overdue_total',      _overdue_total,
    'low_stock',          _low_stock,
    'out_of_stock',       _out_of_stock,
    'total_products',     _total_products,
    'inv_cost',           _inv_cost,
    'inv_retail',         _inv_retail,
    'customer_count',     _customer_count,
    'open_leads',         _open_leads,
    'open_pos_count',     _open_pos_count,
    'open_pos_total',     _open_pos_total,
    'active_production',  _active_production,
    'bank_balance',       _bank_balance,
    'bank_count',         _bank_count,
    'month_expenses',     _month_expenses,
    'open_service',       _open_service,
    'pipeline_count',     _pipeline_count,
    'pipeline_value',     _pipeline_value,
    'pipeline_stages',    _pipeline_stages
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;


-- ================================================================
-- PART 27 — AUTO IN-APP NOTIFICATIONS (TRIGGERS)
-- ================================================================

-- Invoice overdue → notification
CREATE OR REPLACE FUNCTION public.notify_invoice_overdue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'overdue' AND (OLD.status IS DISTINCT FROM 'overdue') THEN
    INSERT INTO public.notifications (business_id, type, title, message, link, module)
    VALUES (
      NEW.business_id,
      'warning',
      'Invoice Overdue: ' || NEW.invoice_number,
      NEW.customer_name || ' — GHS ' || to_char(NEW.total - NEW.amount_paid, 'FM999,999,990.00') ||
        ' overdue since ' || NEW.due_date::text,
      '/invoices',
      'invoices'
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_invoice_overdue ON public.invoices;
CREATE TRIGGER trg_invoice_overdue
  AFTER INSERT OR UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.notify_invoice_overdue();

-- Low stock / out of stock → notification (fires only on downward crossing)
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only fire when qty crosses threshold downward (not on every update)
  IF NEW.qty <= NEW.reorder_level AND OLD.qty > OLD.reorder_level THEN
    INSERT INTO public.notifications (business_id, type, title, message, link, module)
    VALUES (
      NEW.business_id,
      CASE WHEN NEW.qty = 0 THEN 'error' ELSE 'warning' END,
      CASE WHEN NEW.qty = 0 THEN 'Out of Stock: ' || NEW.name
                             ELSE 'Low Stock: '   || NEW.name END,
      CASE WHEN NEW.qty = 0
           THEN NEW.name || ' is out of stock — restock immediately.'
           ELSE NEW.name || ' has ' || NEW.qty || ' units left (reorder at ' || NEW.reorder_level || ').'
      END,
      '/inventory',
      'inventory'
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_low_stock ON public.products;
CREATE TRIGGER trg_low_stock
  AFTER UPDATE OF qty ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();

-- Service contract expiry → notification (fires 30 days before end_date)
CREATE OR REPLACE FUNCTION public.notify_contract_expiring()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 THEN
    INSERT INTO public.notifications (business_id, type, title, message, link, module)
    VALUES (
      NEW.business_id,
      'warning',
      'Contract Expiring: ' || NEW.contract_number,
      NEW.customer_name || ' contract expires on ' || NEW.end_date::text,
      '/service',
      'service'
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_contract_expiry ON public.service_contracts;
CREATE TRIGGER trg_contract_expiry
  AFTER INSERT OR UPDATE OF end_date, status ON public.service_contracts
  FOR EACH ROW EXECUTE FUNCTION public.notify_contract_expiring();

-- Mark overdue invoices in bulk (called by pg_cron or Edge Function)
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _updated integer;
BEGIN
  UPDATE public.invoices
     SET status = 'overdue'
   WHERE status IN ('sent','partial')
     AND due_date < CURRENT_DATE;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_overdue_invoices() TO service_role;

-- updated_at auto-maintenance
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_upd_businesses ON public.businesses;
CREATE TRIGGER trg_upd_businesses BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_upd_products ON public.products;
CREATE TRIGGER trg_upd_products BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_upd_leads ON public.leads;
CREATE TRIGGER trg_upd_leads BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_upd_opportunities ON public.opportunities;
CREATE TRIGGER trg_upd_opportunities BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ================================================================
-- PART 28 — pg_cron SCHEDULE
-- Requires pg_cron extension (Supabase Pro / Team plans only).
-- On the Free plan: skip this block and instead schedule
-- mark_overdue_invoices() via Supabase Edge Function cron:
--   config.toml → [functions.mark-overdue] schedule = "50 7 * * *"
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nexus-mark-overdue-invoices') THEN
    PERFORM cron.unschedule('nexus-mark-overdue-invoices');
  END IF;
EXCEPTION WHEN others THEN NULL; END $outer$;

DO $outer$
BEGIN
  PERFORM cron.schedule(
    'nexus-mark-overdue-invoices',
    '50 7 * * *',
    'SELECT public.mark_overdue_invoices();'
  );
EXCEPTION WHEN others THEN
  RAISE NOTICE 'pg_cron not available (Free plan). Use Edge Function schedule instead.';
END $outer$;


-- ================================================================
-- PART 29 — GRANT PERMISSIONS TO AUTHENTICATED ROLE
-- ================================================================

DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'profiles','businesses','categories','products','stock_adjustments','serial_numbers',
    'customers','suppliers','role_templates','user_groups','staff_members','staff_group_members',
    'audit_logs','approval_workflows','number_series','notifications',
    'sales','sale_items','invoices','invoice_items','recurring_invoices',
    'expenses','leads','opportunities','activities',
    'sales_quotations','sales_orders','delivery_notes','credit_notes',
    'purchase_orders','purchase_order_items',
    'chart_of_accounts','journal_entries','journal_entry_lines','bank_accounts','payments',
    'bank_reconciliations','reconciliation_items','price_lists','price_list_items',
    'commissions','exchange_rates',
    'employees','leave_balances','leave_requests','payroll_runs','payroll_items',
    'projects','project_tasks',
    'service_calls','service_contracts','customer_equipment',
    'bill_of_materials','bom_components','production_orders',
    'warehouses','stock_transfers','attachments','invoice_counters'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
  END LOOP;
END $$;


-- ================================================================
-- DONE
-- ================================================================
-- After running this SQL, regenerate your TypeScript types:
--   supabase gen types typescript --project-id YOUR_ID > src/integrations/supabase/types.ts
--
-- Deploy Edge Functions:
--   supabase functions deploy send-notifications
--   supabase functions deploy momo-collect
--
-- Set secrets (Dashboard → Edge Functions → Secrets):
--   RESEND_API_KEY, FROM_EMAIL, HUBTEL_CLIENT_ID, HUBTEL_CLIENT_SECRET
--
-- NEW TABLES (not in original schema — regenerate types after running):
--   stock_adjustments, leave_balances, payroll_runs, payroll_items
-- ================================================================
