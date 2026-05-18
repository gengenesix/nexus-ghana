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
