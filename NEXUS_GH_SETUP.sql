-- ================================================================
-- NEXUS-GH COMPLETE DATABASE SETUP
-- Single-file idempotent script for a FRESH Supabase project.
-- ================================================================
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → New query → Paste → Run
--
-- SAFE TO RE-RUN: all statements use IF NOT EXISTS / OR REPLACE
--
-- REQUIRED EDGE FUNCTION SECRETS (Dashboard → Edge Functions → Secrets):
--   RESEND_API_KEY          send-notifications email digest
--   FROM_EMAIL              e.g. "Nexis <noreply@nexisgh.com>"
--   HUBTEL_CLIENT_ID        momo-collect (Hubtel MoMo)
--   HUBTEL_CLIENT_SECRET    momo-collect (Hubtel MoMo)
-- ================================================================


-- ================================================================
-- PART 1 — EXTENSIONS
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;


-- ================================================================
-- PART 2 — ENUMS
-- ================================================================

DO $$ BEGIN
  CREATE TYPE public.license_tier AS ENUM (
    'professional', 'limited_financial', 'limited_logistics',
    'limited_sales_crm', 'starter'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.permission_level AS ENUM ('full', 'read_only', 'none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.user_type AS ENUM ('superuser', 'standard', 'support_auditor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ================================================================
-- PART 3 — CORE TABLES
-- ================================================================

-- ── Profiles (auto-created on auth signup) ──────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name  text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can view own profile') THEN
    CREATE POLICY "Users can view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Businesses ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.businesses (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                    text        NOT NULL,
  phone                   text        DEFAULT '',
  email                   text        DEFAULT '',
  region                  text        DEFAULT '',
  address                 text        DEFAULT '',
  logo_url                text,
  momo_merchant_mtn       text        DEFAULT '',
  momo_merchant_telecel   text        DEFAULT '',
  momo_merchant_airteltigo text       DEFAULT '',
  tax_vat                 boolean     NOT NULL DEFAULT true,
  tax_nhil                boolean     NOT NULL DEFAULT true,
  tax_getfl               boolean     NOT NULL DEFAULT true,
  receipt_header          text        DEFAULT '',
  receipt_footer          text        DEFAULT '',
  receipt_show_logo       boolean     NOT NULL DEFAULT true,
  currency                text        DEFAULT 'GHS',
  fiscal_year_start       integer     DEFAULT 1,
  timezone                text        DEFAULT 'Africa/Accra',
  industry                text        DEFAULT '',
  license_tier            public.license_tier DEFAULT 'professional',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='businesses' AND policyname='Users can view own businesses') THEN
    CREATE POLICY "Users can view own businesses"   ON public.businesses FOR SELECT USING (auth.uid() = owner_id);
    CREATE POLICY "Users can insert own businesses" ON public.businesses FOR INSERT WITH CHECK (auth.uid() = owner_id);
    CREATE POLICY "Users can update own businesses" ON public.businesses FOR UPDATE USING (auth.uid() = owner_id);
    CREATE POLICY "Users can delete own businesses" ON public.businesses FOR DELETE USING (auth.uid() = owner_id);
  END IF;
END $$;

-- ── get_business_id() helper ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_business_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.businesses WHERE owner_id = auth.uid() LIMIT 1;
$$;

-- ── Categories ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Business members can view categories') THEN
    CREATE POLICY "Business members can view categories"   ON public.categories FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can insert categories" ON public.categories FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "Business members can update categories" ON public.categories FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can delete categories" ON public.categories FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

-- ── Products ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id            uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid           NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name          text           NOT NULL,
  sku           text           DEFAULT '',
  barcode       text,
  category_id   uuid           REFERENCES public.categories(id) ON DELETE SET NULL,
  qty           integer        NOT NULL DEFAULT 0,
  reorder_level integer        NOT NULL DEFAULT 10,
  cost_price    numeric(12,2)  NOT NULL DEFAULT 0,
  selling_price numeric(12,2)  NOT NULL DEFAULT 0,
  image_url     text,
  created_at    timestamptz    NOT NULL DEFAULT now(),
  updated_at    timestamptz    NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='Business members can view products') THEN
    CREATE POLICY "Business members can view products"   ON public.products FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can insert products" ON public.products FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "Business members can update products" ON public.products FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can delete products" ON public.products FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

-- ── Customers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  phone               text        DEFAULT '',
  email               text        DEFAULT '',
  region              text        DEFAULT '',
  notes               text        DEFAULT '',
  loyalty_points      integer     NOT NULL DEFAULT 0,
  credit_limit        numeric     DEFAULT 0,
  outstanding_balance numeric     DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Business members can view customers') THEN
    CREATE POLICY "Business members can view customers"   ON public.customers FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can insert customers" ON public.customers FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "Business members can update customers" ON public.customers FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can delete customers" ON public.customers FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

-- ── Suppliers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suppliers (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name               text        NOT NULL,
  contact_person     text        DEFAULT '',
  phone              text        DEFAULT '',
  location           text        DEFAULT '',
  products_supplied  text        DEFAULT '',
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='suppliers' AND policyname='Business members can view suppliers') THEN
    CREATE POLICY "Business members can view suppliers"   ON public.suppliers FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can insert suppliers" ON public.suppliers FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "Business members can update suppliers" ON public.suppliers FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can delete suppliers" ON public.suppliers FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

-- ── Staff Members ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_members (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  role             text        NOT NULL DEFAULT 'Staff',
  phone            text        DEFAULT '',
  email            text        DEFAULT '',
  pin              text        DEFAULT '',
  status           text        NOT NULL DEFAULT 'active',
  staff_id         text,
  last_login       timestamptz,
  is_online        boolean     NOT NULL DEFAULT false,
  failed_attempts  integer     NOT NULL DEFAULT 0,
  locked_until     timestamptz,
  license_tier     public.license_tier DEFAULT 'professional',
  user_type        public.user_type    DEFAULT 'standard',
  permissions      jsonb       DEFAULT '{}',
  role_template_id uuid,
  department       text        DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_members' AND policyname='Business members can view staff') THEN
    CREATE POLICY "Business members can view staff"   ON public.staff_members FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can insert staff" ON public.staff_members FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "Business members can update staff" ON public.staff_members FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can delete staff" ON public.staff_members FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

-- ── Sales ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid           NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id      uuid           REFERENCES public.customers(id) ON DELETE SET NULL,
  staff_id         uuid           REFERENCES public.staff_members(id) ON DELETE SET NULL,
  subtotal         numeric(12,2)  NOT NULL DEFAULT 0,
  discount_percent numeric(5,2)   NOT NULL DEFAULT 0,
  discount_amount  numeric(12,2)  NOT NULL DEFAULT 0,
  total            numeric(12,2)  NOT NULL DEFAULT 0,
  payment_method   text           NOT NULL DEFAULT 'cash',
  payment_splits   jsonb,
  receipt_number   text,
  voided           boolean        NOT NULL DEFAULT false,
  voided_at        timestamptz,
  voided_by        uuid,
  created_at       timestamptz    NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales' AND policyname='Business members can view sales') THEN
    CREATE POLICY "Business members can view sales"   ON public.sales FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can insert sales" ON public.sales FOR INSERT  WITH CHECK (business_id = public.get_business_id());
  END IF;
END $$;

-- ── Sale Items ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sale_items (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      uuid          NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id   uuid          REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text          NOT NULL,
  qty          integer       NOT NULL DEFAULT 1,
  unit_price   numeric(12,2) NOT NULL DEFAULT 0
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sale_items' AND policyname='Business members can view sale items') THEN
    CREATE POLICY "Business members can view sale items" ON public.sale_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.business_id = public.get_business_id())
    );
    CREATE POLICY "Business members can insert sale items" ON public.sale_items FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.business_id = public.get_business_id())
    );
  END IF;
END $$;

-- ── Stock deduction trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_sale_item_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products
     SET qty = qty - NEW.qty, updated_at = now()
   WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_sale_item_created ON public.sale_items;
CREATE TRIGGER on_sale_item_created
  AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_stock();

-- ── Invoices ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  invoice_number  text          NOT NULL,
  customer_id     uuid          REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name   text          NOT NULL DEFAULT '',
  status          text          NOT NULL DEFAULT 'draft',
  date            date          NOT NULL DEFAULT CURRENT_DATE,
  due_date        date          NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  vat_amount      numeric(12,2) NOT NULL DEFAULT 0,
  nhil_amount     numeric(12,2) NOT NULL DEFAULT 0,
  getfl_amount    numeric(12,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  notes           text          DEFAULT '',
  apply_vat       boolean       NOT NULL DEFAULT true,
  apply_nhil      boolean       NOT NULL DEFAULT true,
  apply_getfl     boolean       NOT NULL DEFAULT true,
  created_at      timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='Business members can view invoices') THEN
    CREATE POLICY "Business members can view invoices"   ON public.invoices FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can insert invoices" ON public.invoices FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "Business members can update invoices" ON public.invoices FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can delete invoices" ON public.invoices FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

-- ── Invoice Items ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid          NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id  uuid          REFERENCES public.products(id) ON DELETE SET NULL,
  description text          NOT NULL DEFAULT '',
  qty         integer       NOT NULL DEFAULT 1,
  unit_price  numeric(12,2) NOT NULL DEFAULT 0
);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_items' AND policyname='Business members can view invoice items') THEN
    CREATE POLICY "Business members can view invoice items" ON public.invoice_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.business_id = public.get_business_id())
    );
    CREATE POLICY "Business members can insert invoice items" ON public.invoice_items FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.business_id = public.get_business_id())
    );
    CREATE POLICY "Business members can delete invoice items" ON public.invoice_items FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.business_id = public.get_business_id())
    );
  END IF;
END $$;

-- ── Expenses ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expenses (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  date        date          NOT NULL DEFAULT CURRENT_DATE,
  category    text          NOT NULL,
  amount      numeric(12,2) NOT NULL DEFAULT 0,
  description text          DEFAULT '',
  paid_by     text          DEFAULT 'Cash',
  receipt_url text,
  created_at  timestamptz   NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='expenses' AND policyname='Business members can view expenses') THEN
    CREATE POLICY "Business members can view expenses"   ON public.expenses FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can insert expenses" ON public.expenses FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "Business members can update expenses" ON public.expenses FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "Business members can delete expenses" ON public.expenses FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 4 — RBAC & ROLE TABLES
-- ================================================================

CREATE TABLE IF NOT EXISTS public.role_templates (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  description  text        DEFAULT '',
  is_system    boolean     NOT NULL DEFAULT false,
  permissions  jsonb       NOT NULL DEFAULT '{}',
  license_tier public.license_tier NOT NULL DEFAULT 'professional',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, name)
);
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='role_templates' AND policyname='Business members can view role templates') THEN
    CREATE POLICY "Business members can view role templates"   ON public.role_templates FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert role templates" ON public.role_templates FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update role templates" ON public.role_templates FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete role templates" ON public.role_templates FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

-- FK now that role_templates exists
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS role_template_id uuid REFERENCES public.role_templates(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.user_groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text        DEFAULT '',
  group_type  text        NOT NULL DEFAULT 'authorization',
  permissions jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, name)
);
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_groups' AND policyname='Business members can view user groups') THEN
    CREATE POLICY "Business members can view user groups"   ON public.user_groups FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert user groups" ON public.user_groups FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update user groups" ON public.user_groups FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete user groups" ON public.user_groups FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.staff_group_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   uuid        NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  group_id   uuid        NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_id, group_id)
);
ALTER TABLE public.staff_group_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='staff_group_members' AND policyname='Business members can view staff groups') THEN
    CREATE POLICY "Business members can view staff groups" ON public.staff_group_members FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.staff_members sm WHERE sm.id = staff_group_members.staff_id AND sm.business_id = get_business_id())
    );
    CREATE POLICY "Business members can insert staff groups" ON public.staff_group_members FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.staff_members sm WHERE sm.id = staff_group_members.staff_id AND sm.business_id = get_business_id())
    );
    CREATE POLICY "Business members can delete staff groups" ON public.staff_group_members FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.staff_members sm WHERE sm.id = staff_group_members.staff_id AND sm.business_id = get_business_id())
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
  details     jsonb       DEFAULT '{}',
  old_values  jsonb       DEFAULT '{}',
  new_values  jsonb       DEFAULT '{}',
  ip_address  text        DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='Business members can view audit logs') THEN
    CREATE POLICY "Business members can view audit logs"   ON public.audit_logs FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert audit logs" ON public.audit_logs FOR INSERT  WITH CHECK (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  document_type text        NOT NULL,
  conditions    jsonb       DEFAULT '{}',
  steps         jsonb       NOT NULL DEFAULT '[]',
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='approval_workflows' AND policyname='Business members can view workflows') THEN
    CREATE POLICY "Business members can view workflows"   ON public.approval_workflows FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert workflows" ON public.approval_workflows FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update workflows" ON public.approval_workflows FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete workflows" ON public.approval_workflows FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.number_series (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  document_type text        NOT NULL,
  prefix        text        NOT NULL DEFAULT '',
  next_number   integer     NOT NULL DEFAULT 1,
  suffix        text        DEFAULT '',
  pad_length    integer     NOT NULL DEFAULT 4,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, document_type)
);
ALTER TABLE public.number_series ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='number_series' AND policyname='Business members can view number series') THEN
    CREATE POLICY "Business members can view number series"   ON public.number_series FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert number series" ON public.number_series FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update number series" ON public.number_series FOR UPDATE  USING     (business_id = get_business_id());
  END IF;
END $$;

-- ── Notifications ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id    uuid        REFERENCES public.staff_members(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  message     text        NOT NULL DEFAULT '',
  type        text        NOT NULL DEFAULT 'info',
  module      text        DEFAULT '',
  is_read     boolean     NOT NULL DEFAULT false,
  link        text        DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='Business members can view notifications') THEN
    CREATE POLICY "Business members can view notifications"   ON public.notifications FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert notifications" ON public.notifications FOR INSERT  WITH CHECK (true);
    CREATE POLICY "Business members can update notifications" ON public.notifications FOR UPDATE  USING     (business_id = get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 5 — CRM
-- ================================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  company     text        DEFAULT '',
  email       text        DEFAULT '',
  phone       text        DEFAULT '',
  source      text        DEFAULT '',
  status      text        NOT NULL DEFAULT 'new',
  assigned_to uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  notes       text        DEFAULT '',
  value       numeric     DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leads' AND policyname='Business members can view leads') THEN
    CREATE POLICY "Business members can view leads"   ON public.leads FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert leads" ON public.leads FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update leads" ON public.leads FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete leads" ON public.leads FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.opportunities (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  customer_id    uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id        uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  stage          text        NOT NULL DEFAULT 'prospecting',
  probability    integer     DEFAULT 10,
  value          numeric     DEFAULT 0,
  expected_close date,
  assigned_to    uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  notes          text        DEFAULT '',
  status         text        NOT NULL DEFAULT 'open',
  won_reason     text        DEFAULT '',
  lost_reason    text        DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='opportunities' AND policyname='Business members can view opportunities') THEN
    CREATE POLICY "Business members can view opportunities"   ON public.opportunities FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert opportunities" ON public.opportunities FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update opportunities" ON public.opportunities FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete opportunities" ON public.opportunities FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.activities (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type           text        NOT NULL DEFAULT 'note',
  subject        text        NOT NULL,
  description    text        DEFAULT '',
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activities' AND policyname='Business members can view activities') THEN
    CREATE POLICY "Business members can view activities"   ON public.activities FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert activities" ON public.activities FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update activities" ON public.activities FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete activities" ON public.activities FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 6 — SALES ORDERS & QUOTATIONS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.sales_quotations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  quotation_number text        NOT NULL,
  customer_id      uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name    text        NOT NULL DEFAULT '',
  opportunity_id   uuid        REFERENCES public.opportunities(id) ON DELETE SET NULL,
  date             date        NOT NULL DEFAULT CURRENT_DATE,
  valid_until      date        NOT NULL DEFAULT (CURRENT_DATE + interval '30 days'),
  subtotal         numeric     NOT NULL DEFAULT 0,
  tax_amount       numeric     NOT NULL DEFAULT 0,
  total            numeric     NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'draft',
  notes            text        DEFAULT '',
  staff_id         uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_quotations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_quotations' AND policyname='Business members can view quotations') THEN
    CREATE POLICY "Business members can view quotations"   ON public.sales_quotations FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert quotations" ON public.sales_quotations FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update quotations" ON public.sales_quotations FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete quotations" ON public.sales_quotations FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_number     text        NOT NULL,
  customer_id      uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name    text        NOT NULL DEFAULT '',
  quotation_id     uuid        REFERENCES public.sales_quotations(id) ON DELETE SET NULL,
  date             date        NOT NULL DEFAULT CURRENT_DATE,
  delivery_date    date,
  subtotal         numeric     NOT NULL DEFAULT 0,
  tax_amount       numeric     NOT NULL DEFAULT 0,
  discount_amount  numeric     NOT NULL DEFAULT 0,
  total            numeric     NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'open',
  notes            text        DEFAULT '',
  staff_id         uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_orders' AND policyname='Business members can view sales orders') THEN
    CREATE POLICY "Business members can view sales orders"   ON public.sales_orders FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert sales orders" ON public.sales_orders FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update sales orders" ON public.sales_orders FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete sales orders" ON public.sales_orders FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  delivery_number  text        NOT NULL,
  sales_order_id   uuid        REFERENCES public.sales_orders(id),
  customer_name    text        NOT NULL DEFAULT '',
  customer_id      uuid        REFERENCES public.customers(id),
  date             date        NOT NULL DEFAULT CURRENT_DATE,
  shipping_address text        DEFAULT '',
  carrier          text        DEFAULT '',
  tracking_number  text        DEFAULT '',
  status           text        NOT NULL DEFAULT 'pending',
  notes            text        DEFAULT '',
  staff_id         uuid        REFERENCES public.staff_members(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='delivery_notes' AND policyname='Business members can view delivery notes') THEN
    CREATE POLICY "Business members can view delivery notes"   ON public.delivery_notes FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert delivery notes" ON public.delivery_notes FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update delivery notes" ON public.delivery_notes FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete delivery notes" ON public.delivery_notes FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.credit_notes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  credit_number  text        NOT NULL,
  invoice_id     uuid        REFERENCES public.invoices(id),
  customer_name  text        NOT NULL DEFAULT '',
  customer_id    uuid        REFERENCES public.customers(id),
  date           date        NOT NULL DEFAULT CURRENT_DATE,
  reason         text        DEFAULT '',
  subtotal       numeric     NOT NULL DEFAULT 0,
  tax_amount     numeric     NOT NULL DEFAULT 0,
  total          numeric     NOT NULL DEFAULT 0,
  status         text        NOT NULL DEFAULT 'draft',
  notes          text        DEFAULT '',
  staff_id       uuid        REFERENCES public.staff_members(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='credit_notes' AND policyname='Business members can view credit notes') THEN
    CREATE POLICY "Business members can view credit notes"   ON public.credit_notes FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert credit notes" ON public.credit_notes FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update credit notes" ON public.credit_notes FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete credit notes" ON public.credit_notes FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 7 — PURCHASING
-- ================================================================

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  po_number      text        NOT NULL,
  supplier_id    uuid        REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name  text        NOT NULL DEFAULT '',
  date           date        NOT NULL DEFAULT CURRENT_DATE,
  expected_date  date,
  subtotal       numeric     NOT NULL DEFAULT 0,
  tax_amount     numeric     NOT NULL DEFAULT 0,
  total          numeric     NOT NULL DEFAULT 0,
  status         text        NOT NULL DEFAULT 'draft',
  notes          text        DEFAULT '',
  staff_id       uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_orders' AND policyname='Business members can view purchase orders') THEN
    CREATE POLICY "Business members can view purchase orders"   ON public.purchase_orders FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert purchase orders" ON public.purchase_orders FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update purchase orders" ON public.purchase_orders FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete purchase orders" ON public.purchase_orders FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id       uuid        NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id  uuid        REFERENCES public.products(id),
  description text        NOT NULL,
  qty         numeric     NOT NULL DEFAULT 1,
  unit_price  numeric     NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_order_items' AND policyname='po_items_select') THEN
    CREATE POLICY "po_items_select" ON public.purchase_order_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = po_id AND po.business_id = get_business_id())
    );
    CREATE POLICY "po_items_insert" ON public.purchase_order_items FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = po_id AND po.business_id = get_business_id())
    );
    CREATE POLICY "po_items_delete" ON public.purchase_order_items FOR DELETE USING (
      EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = po_id AND po.business_id = get_business_id())
    );
  END IF;
END $$;


-- ================================================================
-- PART 8 — FINANCIALS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  account_code text        NOT NULL,
  name         text        NOT NULL,
  account_type text        NOT NULL,
  parent_id    uuid        REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  balance      numeric     NOT NULL DEFAULT 0,
  is_active    boolean     NOT NULL DEFAULT true,
  description  text        DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, account_code)
);
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='chart_of_accounts' AND policyname='Business members can view accounts') THEN
    CREATE POLICY "Business members can view accounts"   ON public.chart_of_accounts FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert accounts" ON public.chart_of_accounts FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update accounts" ON public.chart_of_accounts FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete accounts" ON public.chart_of_accounts FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  entry_number  text        NOT NULL,
  date          date        NOT NULL DEFAULT CURRENT_DATE,
  description   text        DEFAULT '',
  reference     text        DEFAULT '',
  status        text        NOT NULL DEFAULT 'draft',
  total_debit   numeric     NOT NULL DEFAULT 0,
  total_credit  numeric     NOT NULL DEFAULT 0,
  staff_id      uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='journal_entries' AND policyname='Business members can view journal entries') THEN
    CREATE POLICY "Business members can view journal entries"   ON public.journal_entries FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert journal entries" ON public.journal_entries FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update journal entries" ON public.journal_entries FOR UPDATE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid    NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id       uuid    NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  debit            numeric NOT NULL DEFAULT 0,
  credit           numeric NOT NULL DEFAULT 0,
  description      text    DEFAULT '',
  cost_center      text    DEFAULT ''
);
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='journal_entry_lines' AND policyname='Business members can view journal lines') THEN
    CREATE POLICY "Business members can view journal lines" ON public.journal_entry_lines FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_entry_lines.journal_entry_id AND je.business_id = get_business_id())
    );
    CREATE POLICY "Business members can insert journal lines" ON public.journal_entry_lines FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_entry_lines.journal_entry_id AND je.business_id = get_business_id())
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  bank_name        text        NOT NULL DEFAULT '',
  account_number   text        DEFAULT '',
  account_type     text        NOT NULL DEFAULT 'checking',
  currency         text        NOT NULL DEFAULT 'GHS',
  balance          numeric     NOT NULL DEFAULT 0,
  is_active        boolean     NOT NULL DEFAULT true,
  chart_account_id uuid        REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bank_accounts' AND policyname='Business members can view bank accounts') THEN
    CREATE POLICY "Business members can view bank accounts"   ON public.bank_accounts FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert bank accounts" ON public.bank_accounts FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update bank accounts" ON public.bank_accounts FOR UPDATE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  payment_number text        NOT NULL,
  type           text        NOT NULL DEFAULT 'incoming',
  date           date        NOT NULL DEFAULT CURRENT_DATE,
  amount         numeric     NOT NULL DEFAULT 0,
  currency       text        NOT NULL DEFAULT 'GHS',
  payment_method text        NOT NULL DEFAULT 'cash',
  bank_account_id uuid       REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  customer_id    uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id    uuid        REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_id     uuid        REFERENCES public.invoices(id) ON DELETE SET NULL,
  reference      text        DEFAULT '',
  notes          text        DEFAULT '',
  status         text        NOT NULL DEFAULT 'completed',
  staff_id       uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payments' AND policyname='Business members can view payments') THEN
    CREATE POLICY "Business members can view payments"   ON public.payments FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert payments" ON public.payments FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update payments" ON public.payments FOR UPDATE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  bank_account_id   uuid        NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  statement_date    date        NOT NULL DEFAULT CURRENT_DATE,
  statement_balance numeric     NOT NULL DEFAULT 0,
  system_balance    numeric     NOT NULL DEFAULT 0,
  difference        numeric     NOT NULL DEFAULT 0,
  status            text        NOT NULL DEFAULT 'draft',
  notes             text        DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bank_reconciliations' AND policyname='Business members can view reconciliations') THEN
    CREATE POLICY "Business members can view reconciliations"   ON public.bank_reconciliations FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert reconciliations" ON public.bank_reconciliations FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update reconciliations" ON public.bank_reconciliations FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete reconciliations" ON public.bank_reconciliations FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.reconciliation_items (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id  uuid        NOT NULL REFERENCES public.bank_reconciliations(id) ON DELETE CASCADE,
  date               date        NOT NULL DEFAULT CURRENT_DATE,
  description        text        NOT NULL DEFAULT '',
  reference          text        DEFAULT '',
  amount             numeric     NOT NULL DEFAULT 0,
  type               text        NOT NULL DEFAULT 'debit',
  matched            boolean     NOT NULL DEFAULT false,
  payment_id         uuid        REFERENCES public.payments(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reconciliation_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reconciliation_items' AND policyname='Business members can view recon items') THEN
    CREATE POLICY "Business members can view recon items" ON public.reconciliation_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM bank_reconciliations br WHERE br.id = reconciliation_items.reconciliation_id AND br.business_id = get_business_id())
    );
    CREATE POLICY "Business members can insert recon items" ON public.reconciliation_items FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM bank_reconciliations br WHERE br.id = reconciliation_items.reconciliation_id AND br.business_id = get_business_id())
    );
    CREATE POLICY "Business members can update recon items" ON public.reconciliation_items FOR UPDATE USING (
      EXISTS (SELECT 1 FROM bank_reconciliations br WHERE br.id = reconciliation_items.reconciliation_id AND br.business_id = get_business_id())
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.price_lists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text        DEFAULT '',
  currency    text        NOT NULL DEFAULT 'GHS',
  is_default  boolean     NOT NULL DEFAULT false,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='price_lists' AND policyname='Business members can view price lists') THEN
    CREATE POLICY "Business members can view price lists"   ON public.price_lists FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert price lists" ON public.price_lists FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update price lists" ON public.price_lists FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete price lists" ON public.price_lists FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.price_list_items (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id   uuid    NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  product_id      uuid    NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price           numeric NOT NULL DEFAULT 0,
  min_quantity    integer NOT NULL DEFAULT 1,
  discount_percent numeric NOT NULL DEFAULT 0
);
ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='price_list_items' AND policyname='Business members can view price list items') THEN
    CREATE POLICY "Business members can view price list items" ON public.price_list_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = price_list_items.price_list_id AND pl.business_id = get_business_id())
    );
    CREATE POLICY "Business members can insert price list items" ON public.price_list_items FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = price_list_items.price_list_id AND pl.business_id = get_business_id())
    );
    CREATE POLICY "Business members can update price list items" ON public.price_list_items FOR UPDATE USING (
      EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = price_list_items.price_list_id AND pl.business_id = get_business_id())
    );
    CREATE POLICY "Business members can delete price list items" ON public.price_list_items FOR DELETE USING (
      EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = price_list_items.price_list_id AND pl.business_id = get_business_id())
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.commissions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id    uuid        REFERENCES public.staff_members(id),
  invoice_id  uuid        REFERENCES public.invoices(id),
  sale_id     uuid        REFERENCES public.sales(id),
  amount      numeric     NOT NULL DEFAULT 0,
  rate        numeric     NOT NULL DEFAULT 0,
  base_amount numeric     NOT NULL DEFAULT 0,
  status      text        NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='commissions' AND policyname='Business members can view commissions') THEN
    CREATE POLICY "Business members can view commissions"   ON public.commissions FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert commissions" ON public.commissions FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update commissions" ON public.commissions FOR UPDATE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  from_currency  text        NOT NULL DEFAULT 'USD',
  to_currency    text        NOT NULL DEFAULT 'GHS',
  rate           numeric     NOT NULL DEFAULT 1,
  effective_date date        NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='exchange_rates' AND policyname='Business members can view exchange rates') THEN
    CREATE POLICY "Business members can view exchange rates"   ON public.exchange_rates FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert exchange rates" ON public.exchange_rates FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update exchange rates" ON public.exchange_rates FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete exchange rates" ON public.exchange_rates FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.recurring_invoices (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id    uuid        REFERENCES public.customers(id),
  customer_name  text        NOT NULL DEFAULT '',
  frequency      text        NOT NULL DEFAULT 'monthly',
  next_date      date        NOT NULL DEFAULT CURRENT_DATE,
  end_date       date,
  subtotal       numeric     NOT NULL DEFAULT 0,
  apply_vat      boolean     NOT NULL DEFAULT true,
  apply_nhil     boolean     NOT NULL DEFAULT true,
  apply_getfl    boolean     NOT NULL DEFAULT true,
  notes          text        DEFAULT '',
  is_active      boolean     NOT NULL DEFAULT true,
  last_generated date,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recurring_invoices' AND policyname='Business members can view recurring invoices') THEN
    CREATE POLICY "Business members can view recurring invoices"   ON public.recurring_invoices FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert recurring invoices" ON public.recurring_invoices FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update recurring invoices" ON public.recurring_invoices FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete recurring invoices" ON public.recurring_invoices FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 9 — HR
-- ================================================================

CREATE TABLE IF NOT EXISTS public.employees (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id          uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  first_name        text        NOT NULL,
  last_name         text        NOT NULL DEFAULT '',
  position          text        DEFAULT '',
  department        text        DEFAULT '',
  date_of_birth     date,
  hire_date         date        DEFAULT CURRENT_DATE,
  salary            numeric     DEFAULT 0,
  salary_frequency  text        DEFAULT 'monthly',
  bank_account      text        DEFAULT '',
  emergency_contact text        DEFAULT '',
  emergency_phone   text        DEFAULT '',
  address           text        DEFAULT '',
  status            text        NOT NULL DEFAULT 'active',
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employees' AND policyname='Business members can view employees') THEN
    CREATE POLICY "Business members can view employees"   ON public.employees FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert employees" ON public.employees FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update employees" ON public.employees FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete employees" ON public.employees FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type  text        NOT NULL DEFAULT 'annual',
  start_date  date        NOT NULL DEFAULT CURRENT_DATE,
  end_date    date        NOT NULL DEFAULT CURRENT_DATE,
  days        integer     NOT NULL DEFAULT 1,
  reason      text        DEFAULT '',
  status      text        NOT NULL DEFAULT 'pending',
  approved_by uuid        REFERENCES public.staff_members(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leave_requests' AND policyname='Business members can view leave requests') THEN
    CREATE POLICY "Business members can view leave requests"   ON public.leave_requests FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert leave requests" ON public.leave_requests FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update leave requests" ON public.leave_requests FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete leave requests" ON public.leave_requests FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 10 — PROJECTS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text        DEFAULT '',
  customer_id uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  manager_id  uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  start_date  date        DEFAULT CURRENT_DATE,
  end_date    date,
  budget      numeric     DEFAULT 0,
  actual_cost numeric     DEFAULT 0,
  status      text        NOT NULL DEFAULT 'planning',
  priority    text        DEFAULT 'medium',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='Business members can view projects') THEN
    CREATE POLICY "Business members can view projects"   ON public.projects FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert projects" ON public.projects FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update projects" ON public.projects FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete projects" ON public.projects FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title            text        NOT NULL,
  description      text        DEFAULT '',
  assigned_to      uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  start_date       date,
  due_date         date,
  priority         text        DEFAULT 'medium',
  status           text        NOT NULL DEFAULT 'todo',
  hours_estimated  numeric     DEFAULT 0,
  hours_actual     numeric     DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_tasks' AND policyname='Business members can view tasks') THEN
    CREATE POLICY "Business members can view tasks" ON public.project_tasks FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_tasks.project_id AND p.business_id = get_business_id())
    );
    CREATE POLICY "Business members can insert tasks" ON public.project_tasks FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_tasks.project_id AND p.business_id = get_business_id())
    );
    CREATE POLICY "Business members can update tasks" ON public.project_tasks FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_tasks.project_id AND p.business_id = get_business_id())
    );
    CREATE POLICY "Business members can delete tasks" ON public.project_tasks FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_tasks.project_id AND p.business_id = get_business_id())
    );
  END IF;
END $$;


-- ================================================================
-- PART 11 — SERVICE
-- ================================================================

CREATE TABLE IF NOT EXISTS public.service_calls (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  call_number  text        NOT NULL,
  customer_id  uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text       NOT NULL DEFAULT '',
  subject      text        NOT NULL,
  description  text        DEFAULT '',
  priority     text        NOT NULL DEFAULT 'medium',
  status       text        NOT NULL DEFAULT 'open',
  assigned_to  uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  resolution   text        DEFAULT '',
  opened_at    timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_calls ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_calls' AND policyname='Business members can view service calls') THEN
    CREATE POLICY "Business members can view service calls"   ON public.service_calls FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert service calls" ON public.service_calls FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update service calls" ON public.service_calls FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete service calls" ON public.service_calls FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.service_contracts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id     uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name   text        NOT NULL,
  contract_number text        NOT NULL,
  type            text        NOT NULL DEFAULT 'maintenance',
  start_date      date        NOT NULL,
  end_date        date        NOT NULL,
  value           numeric     NOT NULL DEFAULT 0,
  status          text        NOT NULL DEFAULT 'active',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_contracts' AND policyname='sc_select') THEN
    CREATE POLICY "sc_select" ON public.service_contracts FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "sc_insert" ON public.service_contracts FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "sc_update" ON public.service_contracts FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "sc_delete" ON public.service_contracts FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.customer_equipment (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id   uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text        NOT NULL,
  product_id    uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  serial_number text,
  model         text,
  brand         text,
  purchase_date date,
  warranty_end  date,
  status        text        NOT NULL DEFAULT 'active',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_equipment ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_equipment' AND policyname='ce_select') THEN
    CREATE POLICY "ce_select" ON public.customer_equipment FOR SELECT  USING     (business_id = public.get_business_id());
    CREATE POLICY "ce_insert" ON public.customer_equipment FOR INSERT  WITH CHECK (business_id = public.get_business_id());
    CREATE POLICY "ce_update" ON public.customer_equipment FOR UPDATE  USING     (business_id = public.get_business_id());
    CREATE POLICY "ce_delete" ON public.customer_equipment FOR DELETE  USING     (business_id = public.get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 12 — PRODUCTION & MRP
-- ================================================================

CREATE TABLE IF NOT EXISTS public.bill_of_materials (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id          uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  quantity_to_produce numeric     NOT NULL DEFAULT 1,
  status              text        NOT NULL DEFAULT 'active',
  notes               text        DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bill_of_materials' AND policyname='Business members can view bom') THEN
    CREATE POLICY "Business members can view bom"   ON public.bill_of_materials FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert bom" ON public.bill_of_materials FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update bom" ON public.bill_of_materials FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete bom" ON public.bill_of_materials FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bom_components (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id     uuid    NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE CASCADE,
  product_id uuid    NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity   numeric NOT NULL DEFAULT 1,
  unit_cost  numeric NOT NULL DEFAULT 0
);
ALTER TABLE public.bom_components ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='bom_components' AND policyname='Business members can view bom components') THEN
    CREATE POLICY "Business members can view bom components" ON public.bom_components FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.bill_of_materials b WHERE b.id = bom_components.bom_id AND b.business_id = get_business_id())
    );
    CREATE POLICY "Business members can insert bom components" ON public.bom_components FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.bill_of_materials b WHERE b.id = bom_components.bom_id AND b.business_id = get_business_id())
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.production_orders (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_number    text        NOT NULL,
  bom_id          uuid        REFERENCES public.bill_of_materials(id) ON DELETE SET NULL,
  product_id      uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  quantity        numeric     NOT NULL DEFAULT 1,
  planned_date    date        DEFAULT CURRENT_DATE,
  completion_date date,
  status          text        NOT NULL DEFAULT 'planned',
  notes           text        DEFAULT '',
  staff_id        uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='production_orders' AND policyname='Business members can view production orders') THEN
    CREATE POLICY "Business members can view production orders"   ON public.production_orders FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert production orders" ON public.production_orders FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update production orders" ON public.production_orders FOR UPDATE  USING     (business_id = get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 13 — WAREHOUSES
-- ================================================================

CREATE TABLE IF NOT EXISTS public.warehouses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  code        text        NOT NULL DEFAULT '',
  address     text        DEFAULT '',
  is_default  boolean     NOT NULL DEFAULT false,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, code)
);
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouses' AND policyname='Business members can view warehouses') THEN
    CREATE POLICY "Business members can view warehouses"   ON public.warehouses FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert warehouses" ON public.warehouses FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update warehouses" ON public.warehouses FOR UPDATE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  transfer_number   text        NOT NULL,
  from_warehouse_id uuid        REFERENCES public.warehouses(id) ON DELETE SET NULL,
  to_warehouse_id   uuid        REFERENCES public.warehouses(id) ON DELETE SET NULL,
  product_id        uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  quantity          numeric     NOT NULL DEFAULT 0,
  date              date        NOT NULL DEFAULT CURRENT_DATE,
  status            text        NOT NULL DEFAULT 'completed',
  notes             text        DEFAULT '',
  staff_id          uuid        REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_transfers' AND policyname='Business members can view stock transfers') THEN
    CREATE POLICY "Business members can view stock transfers"   ON public.stock_transfers FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert stock transfers" ON public.stock_transfers FOR INSERT  WITH CHECK (business_id = get_business_id());
  END IF;
END $$;


-- ================================================================
-- PART 14 — SERIAL NUMBERS & ATTACHMENTS
-- ================================================================

CREATE TABLE IF NOT EXISTS public.serial_numbers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id    uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  serial_number text        NOT NULL,
  batch_number  text        DEFAULT '',
  status        text        NOT NULL DEFAULT 'available',
  received_date date        DEFAULT CURRENT_DATE,
  sold_date     date,
  warranty_end  date,
  notes         text        DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.serial_numbers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='serial_numbers' AND policyname='Business members can view serial numbers') THEN
    CREATE POLICY "Business members can view serial numbers"   ON public.serial_numbers FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert serial numbers" ON public.serial_numbers FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can update serial numbers" ON public.serial_numbers FOR UPDATE  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can delete serial numbers" ON public.serial_numbers FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.attachments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  record_type text        NOT NULL DEFAULT '',
  record_id   uuid        NOT NULL,
  file_name   text        NOT NULL,
  file_url    text        NOT NULL,
  file_size   integer     DEFAULT 0,
  mime_type   text        DEFAULT '',
  uploaded_by text        DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='attachments' AND policyname='Business members can view attachments') THEN
    CREATE POLICY "Business members can view attachments"   ON public.attachments FOR SELECT  USING     (business_id = get_business_id());
    CREATE POLICY "Business members can insert attachments" ON public.attachments FOR INSERT  WITH CHECK (business_id = get_business_id());
    CREATE POLICY "Business members can delete attachments" ON public.attachments FOR DELETE  USING     (business_id = get_business_id());
  END IF;
END $$;

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT DO NOTHING;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Authenticated users can upload attachments') THEN
    CREATE POLICY "Authenticated users can upload attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');
    CREATE POLICY "Anyone can view attachments"                ON storage.objects FOR SELECT USING (bucket_id = 'attachments');
    CREATE POLICY "Authenticated users can delete attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'attachments');
  END IF;
END $$;


-- ================================================================
-- PART 15 — PERFORMANCE INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_businesses_owner_id       ON public.businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_categories_business_id    ON public.categories(business_id);

CREATE INDEX IF NOT EXISTS idx_products_business_id      ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id      ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku              ON public.products(sku) WHERE sku IS NOT NULL AND sku != '';
CREATE INDEX IF NOT EXISTS idx_products_name_search      ON public.products USING gin(name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_business_cat     ON public.products(business_id, category_id, name);

CREATE INDEX IF NOT EXISTS idx_customers_business_id     ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_name_search     ON public.customers USING gin(name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_phone           ON public.customers(phone) WHERE phone IS NOT NULL AND phone != '';

CREATE INDEX IF NOT EXISTS idx_suppliers_business_id     ON public.suppliers(business_id);

CREATE INDEX IF NOT EXISTS idx_staff_business_id         ON public.staff_members(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_status              ON public.staff_members(business_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_members_staff_id    ON public.staff_members(business_id, staff_id);

CREATE INDEX IF NOT EXISTS idx_sales_business_id         ON public.sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at          ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_business_date       ON public.sales(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id         ON public.sales(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_business_payment    ON public.sales(business_id, payment_method, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id        ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id     ON public.sale_items(product_id) WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_business_id      ON public.invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at       ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_business_date    ON public.invoices(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status           ON public.invoices(business_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id      ON public.invoices(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_number           ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id  ON public.invoice_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_expenses_business_id      ON public.expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_business_date    ON public.expenses(business_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category         ON public.expenses(business_id, category);

CREATE INDEX IF NOT EXISTS idx_audit_logs_business       ON public.audit_logs(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module         ON public.audit_logs(business_id, module, created_at DESC);


-- ================================================================
-- PART 16 — SECURE STAFF PIN AUTHENTICATION
-- ================================================================

-- Hash any plain-text PINs that might already exist
UPDATE public.staff_members
   SET pin = crypt(pin, gen_salt('bf', 10))
 WHERE pin IS NOT NULL
   AND pin != ''
   AND pin NOT LIKE '$2%';

-- Auto-hash trigger on INSERT / UPDATE
CREATE OR REPLACE FUNCTION public.hash_staff_pin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- Verify PIN with targeted lockout (no mass-lockout vulnerability)
CREATE OR REPLACE FUNCTION public.verify_staff_pin(
  _business_id uuid,
  _pin         text,
  _staff_id    uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _staff record;
BEGIN
  -- Targeted path: staff_id supplied
  IF _staff_id IS NOT NULL THEN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until
      INTO _staff
      FROM public.staff_members s
     WHERE s.id = _staff_id AND s.business_id = _business_id AND s.status = 'active';

    IF NOT FOUND THEN RETURN; END IF;
    IF _staff.locked_until IS NOT NULL AND _staff.locked_until > now() THEN RETURN; END IF;

    IF crypt(_pin, _staff.pin) = _staff.pin THEN
      UPDATE public.staff_members SET failed_attempts = 0, locked_until = NULL, last_login = now(), is_online = true WHERE id = _staff.id;
      RETURN QUERY SELECT _staff.id, _staff.name, _staff.role;
      RETURN;
    END IF;

    UPDATE public.staff_members
       SET failed_attempts = failed_attempts + 1,
           locked_until    = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
     WHERE id = _staff.id;
    RETURN;
  END IF;

  -- Legacy path: scan active staff, no mass-lockout
  FOR _staff IN
    SELECT s.id, s.name, s.role, s.pin, s.failed_attempts, s.locked_until
      FROM public.staff_members s
     WHERE s.business_id = _business_id AND s.status = 'active'
  LOOP
    IF _staff.locked_until IS NOT NULL AND _staff.locked_until > now() THEN CONTINUE; END IF;
    IF crypt(_pin, _staff.pin) = _staff.pin THEN
      UPDATE public.staff_members SET failed_attempts = 0, locked_until = NULL, last_login = now(), is_online = true WHERE id = _staff.id;
      RETURN QUERY SELECT _staff.id, _staff.name, _staff.role;
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


-- ================================================================
-- PART 17 — ATOMIC INVOICE NUMBER SEQUENCING
-- ================================================================

CREATE TABLE IF NOT EXISTS public.invoice_counters (
  business_id uuid    NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  year        integer NOT NULL,
  last_value  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, year)
);
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoice_counters' AND policyname='Business owner can manage invoice counters') THEN
    CREATE POLICY "Business owner can manage invoice counters" ON public.invoice_counters FOR ALL
      USING (business_id = public.get_business_id())
      WITH CHECK (business_id = public.get_business_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
   WHERE business_id = _business_id AND year = _year
  RETURNING last_value INTO _next;

  RETURN 'NXG-' || _year::text || '-' || LPAD(_next::text, 3, '0');
END;
$$;


-- ================================================================
-- PART 18 — LOYALTY POINTS RPCs
-- ================================================================

CREATE OR REPLACE FUNCTION public.increment_loyalty_points(p_customer_id uuid, p_points integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE customers SET loyalty_points = loyalty_points + p_points WHERE id = p_customer_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_loyalty_points(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.decrement_loyalty_points(p_customer_id uuid, p_points integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE customers SET loyalty_points = GREATEST(0, loyalty_points - p_points) WHERE id = p_customer_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.decrement_loyalty_points(uuid, integer) TO authenticated;


-- ================================================================
-- PART 19 — VOID SALE RPC (with role check)
-- ================================================================

CREATE OR REPLACE FUNCTION public.void_sale(
  p_sale_id     uuid,
  p_business_id uuid,
  p_staff_id    uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    SELECT role INTO _staff_role FROM public.staff_members
     WHERE id = p_staff_id AND business_id = p_business_id AND status = 'active';
    IF NOT FOUND THEN RAISE EXCEPTION 'Staff member not found'; END IF;
    IF NOT (_staff_role = ANY(_allowed_roles)) THEN
      RAISE EXCEPTION 'Insufficient permissions: role "%" cannot void sales', _staff_role;
    END IF;
  END IF;

  UPDATE sales SET voided = true, voided_at = now(), voided_by = p_staff_id WHERE id = p_sale_id;
  UPDATE products p SET qty = p.qty + si.qty
    FROM sale_items si WHERE si.sale_id = p_sale_id AND si.product_id = p.id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid, uuid, uuid) TO authenticated;


-- ================================================================
-- PART 20 — PURCHASE ORDER RECEIVE RPC
-- ================================================================

CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_po_id uuid, p_business_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM purchase_orders WHERE id = p_po_id AND business_id = p_business_id) THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;
  IF EXISTS (SELECT 1 FROM purchase_orders WHERE id = p_po_id AND status = 'received') THEN
    RAISE EXCEPTION 'Purchase order already received';
  END IF;

  UPDATE products p SET qty = p.qty + poi.qty, updated_at = now()
    FROM purchase_order_items poi WHERE poi.po_id = p_po_id AND poi.product_id = p.id;

  UPDATE purchase_orders SET status = 'received' WHERE id = p_po_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid, uuid) TO authenticated;


-- ================================================================
-- PART 21 — DASHBOARD STATS RPC
-- Single DB call replaces ~11 parallel client queries.
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_business_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _today       date    := CURRENT_DATE;
  _yesterday   date    := CURRENT_DATE - 1;
  _month_start date    := date_trunc('month', CURRENT_DATE)::date;

  _today_total      numeric := 0;  _today_count      integer := 0;
  _yesterday_total  numeric := 0;
  _unpaid_count     integer := 0;  _unpaid_total     numeric := 0;
  _overdue_count    integer := 0;  _overdue_total    numeric := 0;
  _low_stock        jsonb   := '[]';
  _out_of_stock     integer := 0;  _total_products   integer := 0;
  _inv_cost         numeric := 0;  _inv_retail       numeric := 0;
  _customer_count   integer := 0;  _open_leads       integer := 0;
  _open_pos_count   integer := 0;  _open_pos_total   numeric := 0;
  _active_production integer := 0;
  _bank_balance     numeric := 0;  _bank_count       integer := 0;
  _month_expenses   numeric := 0;
  _pipeline_value   numeric := 0;  _pipeline_count   integer := 0;
  _pipeline_stages  jsonb   := '{}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COALESCE(SUM(total),0), COUNT(*) INTO _today_total, _today_count
    FROM public.sales WHERE business_id = p_business_id AND created_at::date = _today;

  SELECT COALESCE(SUM(total),0) INTO _yesterday_total
    FROM public.sales WHERE business_id = p_business_id AND created_at::date = _yesterday;

  SELECT COUNT(*), COALESCE(SUM(total),0),
         COUNT(*) FILTER (WHERE due_date < _today::text),
         COALESCE(SUM(total) FILTER (WHERE due_date < _today::text), 0)
    INTO _unpaid_count, _unpaid_total, _overdue_count, _overdue_total
    FROM public.invoices
   WHERE business_id = p_business_id AND status IN ('sent','overdue','partial');

  SELECT COUNT(*), COALESCE(SUM(qty*cost_price),0), COALESCE(SUM(qty*selling_price),0),
         COUNT(*) FILTER (WHERE qty=0),
         COALESCE(jsonb_agg(
           jsonb_build_object('id',id,'name',name,'qty',qty,'reorder_level',reorder_level,
                              'cost_price',cost_price,'selling_price',selling_price)
           ORDER BY qty ASC
         ) FILTER (WHERE qty <= reorder_level), '[]'::jsonb)
    INTO _total_products, _inv_cost, _inv_retail, _out_of_stock, _low_stock
    FROM public.products WHERE business_id = p_business_id;

  SELECT COUNT(*) INTO _customer_count FROM public.customers WHERE business_id = p_business_id;
  SELECT COUNT(*) INTO _open_leads FROM public.leads
   WHERE business_id = p_business_id AND status IN ('new','contacted','qualified');

  SELECT COUNT(*), COALESCE(SUM(total),0) INTO _open_pos_count, _open_pos_total
    FROM public.purchase_orders WHERE business_id = p_business_id AND status IN ('draft','sent','confirmed');

  SELECT COUNT(*) INTO _active_production FROM public.production_orders
   WHERE business_id = p_business_id AND status IN ('planned','in_progress');

  SELECT COUNT(*), COALESCE(SUM(balance),0) INTO _bank_count, _bank_balance
    FROM public.bank_accounts WHERE business_id = p_business_id AND is_active = true;

  SELECT COALESCE(SUM(amount),0) INTO _month_expenses
    FROM public.expenses WHERE business_id = p_business_id AND date >= _month_start;

  SELECT COALESCE(SUM(stage_count),0), COALESCE(SUM(stage_value),0),
         COALESCE(jsonb_object_agg(stage, jsonb_build_object('count',stage_count,'value',stage_value)), '{}')
    INTO _pipeline_count, _pipeline_value, _pipeline_stages
    FROM (
      SELECT stage, COUNT(*) AS stage_count, COALESCE(SUM(value),0) AS stage_value
        FROM public.opportunities
       WHERE business_id = p_business_id AND status = 'open'
       GROUP BY stage
    ) sub;

  RETURN jsonb_build_object(
    'today_total',_today_total,         'today_count',_today_count,
    'yesterday_total',_yesterday_total,
    'unpaid_count',_unpaid_count,       'unpaid_total',_unpaid_total,
    'overdue_count',_overdue_count,     'overdue_total',_overdue_total,
    'low_stock',_low_stock,             'out_of_stock',_out_of_stock,
    'total_products',_total_products,   'inv_cost',_inv_cost, 'inv_retail',_inv_retail,
    'customer_count',_customer_count,
    'open_leads',_open_leads,
    'open_pos_count',_open_pos_count,   'open_pos_total',_open_pos_total,
    'active_production',_active_production,
    'bank_balance',_bank_balance,       'bank_count',_bank_count,
    'month_expenses',_month_expenses,
    'pipeline_count',_pipeline_count,   'pipeline_value',_pipeline_value,
    'pipeline_stages',_pipeline_stages
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;


-- ================================================================
-- PART 22 — AUTO IN-APP NOTIFICATIONS
-- ================================================================

-- Trigger: invoice marked overdue → notification
CREATE OR REPLACE FUNCTION public.notify_invoice_overdue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'overdue' AND (OLD.status IS DISTINCT FROM 'overdue') THEN
    INSERT INTO public.notifications (business_id, type, title, message, link)
    VALUES (
      NEW.business_id, 'warning',
      'Invoice Overdue: ' || NEW.invoice_number,
      NEW.customer_name || ' — GHS ' || to_char(NEW.total,'FM999,999,990.00') || ' overdue since ' || NEW.due_date,
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

-- Trigger: product qty drops to/below reorder level → notification
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- RPC to bulk-mark overdue invoices (called by pg_cron)
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _updated integer;
BEGIN
  UPDATE public.invoices
     SET status = 'overdue'
   WHERE status IN ('sent','partial')
     AND due_date < CURRENT_DATE::text;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_overdue_invoices() TO service_role;


-- ================================================================
-- PART 23 — pg_cron SCHEDULE
-- Requires pg_cron extension (available on Supabase Pro / Team plans).
-- If you are on the free plan, skip this section — you can call
-- mark_overdue_invoices() manually or via an Edge Function schedule.
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
-- DONE
-- ================================================================
-- After running this SQL, deploy your Edge Functions:
--   supabase functions deploy send-notifications
--   supabase functions deploy momo-collect
--
-- Then set secrets in Supabase Dashboard → Edge Functions → Secrets:
--   RESEND_API_KEY, FROM_EMAIL, HUBTEL_CLIENT_ID, HUBTEL_CLIENT_SECRET
-- ================================================================
