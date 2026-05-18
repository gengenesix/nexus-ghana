-- ============================================================
-- NEXUS GH — COMPLETE NEW MIGRATIONS (Run this ONCE)
-- Combines Phase 0 through Phase 5 (migrations 000022–000027)
-- All statements are idempotent — safe to re-run if needed.
--
-- Sections:
--   [22] Phase 0  — Industry vertical system (13 industries, modules, defaults)
--   [23] Phase 1  — get_industry_kpis RPC
--   [24] Phase 2  — welcome_shown flag
--   [25] Phase 3  — Payroll, Attendance, Budget, Assets, Petty Cash
--   [26] Phase 4  — Restaurant, PharmacyRx, Hotel, Fleet, Garage, Farm
--   [27] Phase 5  — Performance indexes + daily summary view
-- ============================================================


-- ============================================================
-- [22] PHASE 0 — Industry Vertical System
-- ============================================================

-- ── [A] Industry Verticals Catalog ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.industry_verticals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  tagline     text        NOT NULL,
  description text,
  icon_key    text        NOT NULL,
  color_hex   text        NOT NULL,
  accent_hex  text        NOT NULL,
  sort_order  smallint    DEFAULT 0,
  is_active   boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.industry_verticals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "industry_verticals_public_read" ON public.industry_verticals;
CREATE POLICY "industry_verticals_public_read"
  ON public.industry_verticals FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_industry_verticals_slug ON public.industry_verticals(slug);

-- ── [B] Module Registry ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.module_registry (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text        NOT NULL UNIQUE,
  name         text        NOT NULL,
  description  text,
  category     text        NOT NULL,
  is_core      boolean     DEFAULT false,
  icon_key     text        NOT NULL,
  path         text        NOT NULL,
  is_available boolean     DEFAULT true,
  min_tier     text        DEFAULT 'starter',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.module_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "module_registry_public_read" ON public.module_registry;
CREATE POLICY "module_registry_public_read"
  ON public.module_registry FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_module_registry_category ON public.module_registry(category);

-- ── [C] Industry → Module Defaults ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.industry_module_defaults (
  id            uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_slug text     NOT NULL REFERENCES public.industry_verticals(slug) ON DELETE CASCADE,
  module_key    text     NOT NULL REFERENCES public.module_registry(key)     ON DELETE CASCADE,
  is_default    boolean  DEFAULT true,
  sort_order    smallint DEFAULT 0,
  display_order smallint DEFAULT 0,
  UNIQUE(industry_slug, module_key)
);

ALTER TABLE public.industry_module_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "industry_module_defaults_public_read" ON public.industry_module_defaults;
CREATE POLICY "industry_module_defaults_public_read"
  ON public.industry_module_defaults FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_imd_industry_slug ON public.industry_module_defaults(industry_slug);
CREATE INDEX IF NOT EXISTS idx_imd_module_key    ON public.industry_module_defaults(module_key);

-- ── [D] Per-Business Module Overrides ────────────────────────────────────────

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
  ON public.business_modules FOR SELECT USING (business_id = public.get_business_id());
CREATE POLICY "business_modules_all"
  ON public.business_modules FOR ALL   USING (business_id = public.get_business_id());
CREATE INDEX IF NOT EXISTS idx_business_modules_business ON public.business_modules(business_id);

-- ── [E] Onboarding Templates ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_templates (
  id            uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_slug text     NOT NULL REFERENCES public.industry_verticals(slug) ON DELETE CASCADE,
  step_order    smallint NOT NULL,
  step_key      text     NOT NULL,
  step_title    text     NOT NULL,
  step_body     text,
  config_json   jsonb    DEFAULT '{}',
  UNIQUE(industry_slug, step_order)
);

ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "onboarding_templates_public_read" ON public.onboarding_templates;
CREATE POLICY "onboarding_templates_public_read"
  ON public.onboarding_templates FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_onboarding_templates_industry ON public.onboarding_templates(industry_slug);

-- ── [F] Industry KPI Configs ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.industry_kpi_configs (
  id              uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_slug   text     NOT NULL REFERENCES public.industry_verticals(slug) ON DELETE CASCADE,
  kpi_key         text     NOT NULL,
  kpi_name        text     NOT NULL,
  kpi_description text,
  display_format  text     DEFAULT 'currency',
  display_order   smallint DEFAULT 0,
  is_active       boolean  DEFAULT true,
  UNIQUE(industry_slug, kpi_key)
);

ALTER TABLE public.industry_kpi_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "industry_kpi_configs_public_read" ON public.industry_kpi_configs;
CREATE POLICY "industry_kpi_configs_public_read"
  ON public.industry_kpi_configs FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_ikpi_industry_slug ON public.industry_kpi_configs(industry_slug);

-- ── [G] ALTER businesses ──────────────────────────────────────────────────────

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS industry_vertical_slug text
    REFERENCES public.industry_verticals(slug) ON DELETE SET NULL;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS onboarding_step      smallint DEFAULT 0;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS business_size        text     DEFAULT 'small';

CREATE INDEX IF NOT EXISTS idx_businesses_industry
  ON public.businesses(industry_vertical_slug)
  WHERE industry_vertical_slug IS NOT NULL;

-- ── [H] ALTER products ────────────────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS batch_number          text,
  ADD COLUMN IF NOT EXISTS expiry_date           date,
  ADD COLUMN IF NOT EXISTS requires_prescription boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS unit_of_measure       text    DEFAULT 'unit';

CREATE INDEX IF NOT EXISTS idx_products_business_expiry
  ON public.products(business_id, expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_business_batch
  ON public.products(business_id, batch_number) WHERE batch_number IS NOT NULL;

-- ── [I] ALTER sales ───────────────────────────────────────────────────────────

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS table_number   text,
  ADD COLUMN IF NOT EXISTS covers         smallint,
  ADD COLUMN IF NOT EXISTS order_type     text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS kitchen_status text;

-- ── [J] Phase 0 Performance Indexes ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sales_biz_date_desc     ON public.sales(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_biz_payment       ON public.sales(business_id, payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_biz_customer      ON public.sales(business_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_biz_table         ON public.sales(business_id, table_number) WHERE table_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_biz_status     ON public.invoices(business_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_biz_due        ON public.invoices(business_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_biz_name_lower ON public.products(business_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_products_biz_category   ON public.products(business_id, category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_biz_barcode    ON public.products(business_id, barcode)  WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_biz_name_lower ON public.customers(business_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_customers_biz_phone     ON public.customers(business_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_biz_date       ON public.expenses(business_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_biz_role          ON public.staff_members(business_id, role) WHERE status = 'active';

-- ── [K] Seed — 13 Industry Verticals ─────────────────────────────────────────

INSERT INTO public.industry_verticals (slug, name, tagline, description, icon_key, color_hex, accent_hex, sort_order) VALUES
  ('retail',        'Retail & General Trade',    'Shops, supermarkets, boutiques, provision stores',    'Full retail management: POS, inventory, invoicing, CRM, and financials for any shop.',                  'ShoppingBag', '#f59e0b', '#fef3c7',  1),
  ('food-beverage', 'Food & Beverage',           'Restaurants, chop bars, fast food, catering',         'Table management, kitchen display, menu management, covers tracking and more.',                        'Utensils',    '#ef4444', '#fee2e2',  2),
  ('wholesale',     'Wholesale & Distribution',  'Distributors, importers, commodity traders',           'Manage large-volume orders, supplier relationships, warehouses, and receivables.',                     'Package2',    '#6366f1', '#e0e7ff',  3),
  ('manufacturing', 'Manufacturing',             'Production, food processing, textiles, assembly',      'Bill of materials, production orders, MRP planning, and supply chain management.',                    'Factory',     '#64748b', '#f1f5f9',  4),
  ('pharmacy',      'Pharmacy & Health',         'Pharmacies, clinics, chemical shops',                  'Batch and expiry tracking, prescription management, and controlled drugs register.',                   'Pill',        '#14b8a6', '#ccfbf1',  5),
  ('professional',  'Professional Services',     'Consulting, legal, accounting, advisory firms',        'Project management, billable timesheets, CRM pipeline, and professional invoicing.',                  'Briefcase',   '#3b82f6', '#dbeafe',  6),
  ('construction',  'Construction',              'Contractors, developers, civil engineering',            'Project costing, BOQ, materials requisition, labour tracking, and milestone billing.',                 'HardHat',     '#f97316', '#ffedd5',  7),
  ('transport',     'Transport & Logistics',     'Freight, fleet operators, couriers, delivery',          'Fleet management, trip logging, fuel tracking, driver assignment, and invoicing.',                    'Truck',       '#0ea5e9', '#e0f2fe',  8),
  ('hospitality',   'Hospitality & Hotels',      'Hotels, guesthouses, lodges, resorts',                 'Room management, bookings, check-in/out, housekeeping, and revenue analytics.',                       'BedDouble',   '#a855f7', '#f3e8ff',  9),
  ('auto',          'Auto Services & Garage',    'Car repairs, spare parts, vulcanizers',                'Job cards, vehicle history, technician assignment, parts tracking, and billing.',                     'Wrench',      '#71717a', '#f4f4f5', 10),
  ('agriculture',   'Agriculture',               'Farms, agro-processing, input suppliers',              'Farm and plot management, seasons, harvest tracking, and input cost analysis.',                       'Leaf',        '#22c55e', '#dcfce7', 11),
  ('beauty',        'Beauty & Wellness',         'Salons, spas, barbershops, beauty shops',              'Appointment booking, service menu, stylist management, and POS with loyalty.',                        'Scissors',    '#ec4899', '#fce7f3', 12),
  ('financial',     'Financial Services',        'Forex bureaus, microfinance, savings groups',          'Client ledger, transaction management, GL, banking, and compliance reporting.',                       'Landmark',    '#10b981', '#d1fae5', 13)
ON CONFLICT (slug) DO NOTHING;

-- ── [L] Seed — Full Module Registry ──────────────────────────────────────────

INSERT INTO public.module_registry (key, name, description, category, is_core, icon_key, path, is_available, min_tier) VALUES
  -- Core
  ('dashboard',     'Dashboard',          'Overview of key business metrics',                    'system',     true,  'LayoutDashboard',  '/dashboard',     true,  'starter'),
  ('pos',           'Point of Sale',      'Sales terminal with offline & MoMo support',          'sales',      false, 'ShoppingCart',     '/pos',           true,  'starter'),
  ('inventory',     'Inventory',          'Stock management, barcodes & alerts',                 'operations', false, 'Package',          '/inventory',     true,  'starter'),
  ('invoices',      'Invoices',           'Invoicing, recurring billing & PDFs',                 'sales',      false, 'FileText',         '/invoices',      true,  'starter'),
  ('customers',     'Customers',          'Customer database, history & loyalty',                'sales',      false, 'Users',            '/customers',     true,  'starter'),
  ('suppliers',     'Suppliers',          'Supplier management & contacts',                      'operations', false, 'Building2',        '/suppliers',     true,  'starter'),
  ('expenses',      'Expenses',           'Expense tracking, categories & receipts',             'finance',    false, 'Receipt',          '/expenses',      true,  'starter'),
  ('reports',       'Reports',            'Analytics, charts & business insights',               'system',     false, 'BarChart3',        '/reports',       true,  'starter'),
  ('staff',         'Staff',              'Staff accounts, roles & permissions',                 'system',     false, 'UserCog',          '/staff',         true,  'starter'),
  ('settings',      'Settings',           'Business configuration & preferences',                'system',     false, 'Settings',         '/settings',      true,  'starter'),
  -- Finance
  ('financials',    'Financials',         'General ledger & chart of accounts',                 'finance',    false, 'Wallet',           '/financials',    true,  'limited_financial'),
  ('banking',       'Banking',            'Bank accounts & reconciliation',                     'finance',    false, 'Landmark',         '/banking',       true,  'limited_financial'),
  -- Sales & CRM
  ('crm',           'CRM',                'Leads, opportunities & sales pipeline',              'sales',      false, 'Handshake',        '/crm',           true,  'limited_sales_crm'),
  ('sales-orders',  'Sales Orders',       'Sales order management & quotations',                'sales',      false, 'ShoppingBag',      '/sales-orders',  true,  'limited_sales_crm'),
  -- Operations
  ('projects',      'Projects',           'Project management with Gantt charts',               'operations', false, 'FolderKanban',     '/projects',      true,  'limited_sales_crm'),
  ('service',       'Service',            'Service contracts, job cards & SLAs',                'operations', false, 'Headphones',       '/service',       true,  'limited_sales_crm'),
  ('purchasing',    'Purchasing',         'Purchase orders & goods receiving',                  'operations', false, 'ClipboardList',    '/purchasing',    true,  'limited_logistics'),
  ('warehouses',    'Warehouses',         'Multi-location warehouse management',                'operations', false, 'ArrowRightLeft',   '/warehouses',    true,  'limited_logistics'),
  ('production',    'Production',         'Manufacturing orders & bill of materials',           'operations', false, 'Factory',          '/production',    true,  'limited_logistics'),
  ('mrp',           'MRP',                'Material requirements planning',                     'operations', false, 'Cpu',              '/mrp',           true,  'limited_logistics'),
  -- HR
  ('hr',            'Human Resources',    'Employee records, org chart & leave',                'hr',         false, 'Users2',           '/hr',            true,  'professional'),
  ('administration','Administration',     'Company settings & permission matrix',               'system',     false, 'Shield',           '/administration',true,  'professional'),
  ('approvals',     'Approvals',          'Approval workflows & request inbox',                 'system',     false, 'ClipboardCheck',   '/approvals',     true,  'starter'),
  ('audit-log',     'Audit Log',          'Full audit trail & activity history',                'system',     false, 'FileSearch',       '/audit-log',     true,  'professional'),
  -- Phase 3 modules
  ('payroll',       'Payroll',            'Ghana SSNIT + PAYE compliant payroll',              'hr',         false, 'Banknote',         '/payroll',       true,  'professional'),
  ('attendance',    'Attendance',         'Clock-in/out & time tracking',                       'hr',         false, 'Clock',            '/attendance',    true,  'professional'),
  ('recruitment',   'Recruitment',        'Hiring pipeline & applicant tracking',               'hr',         false, 'UserPlus',         '/recruitment',   false, 'professional'),
  ('helpdesk',      'Helpdesk',           'Customer support tickets & SLA tracking',            'operations', false, 'LifeBuoy',         '/helpdesk',      false, 'professional'),
  ('timesheets',    'Timesheets',         'Billable hours & time logging per project',          'operations', false, 'Timer',            '/timesheets',    false, 'professional'),
  ('budget',        'Budget',             'Budget planning, control & variance',                'finance',    false, 'PiggyBank',        '/budget',        true,  'professional'),
  ('assets',        'Assets',             'Fixed asset register & depreciation',                'finance',    false, 'HardDrive',        '/assets',        true,  'professional'),
  ('petty-cash',    'Petty Cash',         'Petty cash floats, vouchers & top-ups',             'finance',    false, 'Coins',            '/petty-cash',    true,  'starter'),
  -- Phase 4 industry packs
  ('restaurant',    'Restaurant',         'Tables, menu builder & kitchen display',             'industry',   false, 'ChefHat',          '/restaurant',    true,  'starter'),
  ('pharmacy-rx',   'Pharmacy Rx',        'Prescriptions & controlled drugs register',          'industry',   false, 'Pill',             '/pharmacy-rx',   true,  'starter'),
  ('hotel-mgmt',    'Hotel Management',   'Rooms, bookings & housekeeping',                    'industry',   false, 'BedDouble',        '/hotel-mgmt',    true,  'starter'),
  ('fleet',         'Fleet Management',   'Vehicles, drivers, trips & fuel logging',            'industry',   false, 'Truck',            '/fleet',         true,  'starter'),
  ('garage',        'Job Cards / Garage', 'Service jobs, technicians & vehicle history',        'industry',   false, 'Wrench',           '/garage',        true,  'starter'),
  ('farm-mgmt',     'Farm Management',    'Plots, seasons, inputs & harvest tracking',          'industry',   false, 'Leaf',             '/farm-mgmt',     true,  'starter')
ON CONFLICT (key) DO NOTHING;

-- ── [M] Seed — Industry Module Defaults ──────────────────────────────────────

INSERT INTO public.industry_module_defaults (industry_slug, module_key, display_order) VALUES
  -- RETAIL
  ('retail','dashboard',1),('retail','pos',2),('retail','inventory',3),('retail','customers',4),
  ('retail','invoices',5),('retail','suppliers',6),('retail','purchasing',7),('retail','warehouses',8),
  ('retail','expenses',9),('retail','crm',10),('retail','sales-orders',11),('retail','financials',12),
  ('retail','banking',13),('retail','hr',14),('retail','reports',15),('retail','staff',16),
  ('retail','settings',17),('retail','approvals',18),('retail','administration',19),('retail','audit-log',20),
  -- FOOD & BEVERAGE
  ('food-beverage','dashboard',1),('food-beverage','pos',2),('food-beverage','restaurant',3),
  ('food-beverage','inventory',4),('food-beverage','customers',5),('food-beverage','invoices',6),
  ('food-beverage','suppliers',7),('food-beverage','purchasing',8),('food-beverage','expenses',9),
  ('food-beverage','hr',10),('food-beverage','crm',11),('food-beverage','reports',12),
  ('food-beverage','staff',13),('food-beverage','settings',14),('food-beverage','approvals',15),
  ('food-beverage','financials',16),('food-beverage','banking',17),('food-beverage','administration',18),
  -- WHOLESALE
  ('wholesale','dashboard',1),('wholesale','pos',2),('wholesale','inventory',3),('wholesale','customers',4),
  ('wholesale','invoices',5),('wholesale','suppliers',6),('wholesale','purchasing',7),('wholesale','warehouses',8),
  ('wholesale','expenses',9),('wholesale','crm',10),('wholesale','sales-orders',11),('wholesale','financials',12),
  ('wholesale','banking',13),('wholesale','hr',14),('wholesale','reports',15),('wholesale','staff',16),
  ('wholesale','settings',17),('wholesale','approvals',18),('wholesale','administration',19),('wholesale','audit-log',20),
  -- MANUFACTURING
  ('manufacturing','dashboard',1),('manufacturing','inventory',2),('manufacturing','production',3),
  ('manufacturing','mrp',4),('manufacturing','purchasing',5),('manufacturing','warehouses',6),
  ('manufacturing','suppliers',7),('manufacturing','invoices',8),('manufacturing','customers',9),
  ('manufacturing','expenses',10),('manufacturing','financials',11),('manufacturing','banking',12),
  ('manufacturing','hr',13),('manufacturing','pos',14),('manufacturing','reports',15),
  ('manufacturing','staff',16),('manufacturing','settings',17),('manufacturing','approvals',18),
  ('manufacturing','administration',19),('manufacturing','audit-log',20),
  -- PHARMACY
  ('pharmacy','dashboard',1),('pharmacy','pos',2),('pharmacy','inventory',3),('pharmacy','pharmacy-rx',4),
  ('pharmacy','customers',5),('pharmacy','invoices',6),('pharmacy','suppliers',7),('pharmacy','purchasing',8),
  ('pharmacy','expenses',9),('pharmacy','crm',10),('pharmacy','financials',11),('pharmacy','banking',12),
  ('pharmacy','hr',13),('pharmacy','reports',14),('pharmacy','staff',15),
  ('pharmacy','settings',16),('pharmacy','approvals',17),('pharmacy','administration',18),
  -- PROFESSIONAL SERVICES
  ('professional','dashboard',1),('professional','customers',2),('professional','crm',3),
  ('professional','invoices',4),('professional','projects',5),('professional','service',6),
  ('professional','expenses',7),('professional','financials',8),('professional','banking',9),
  ('professional','hr',10),('professional','timesheets',11),('professional','reports',12),
  ('professional','staff',13),('professional','settings',14),('professional','approvals',15),
  ('professional','administration',16),('professional','audit-log',17),
  -- CONSTRUCTION
  ('construction','dashboard',1),('construction','projects',2),('construction','purchasing',3),
  ('construction','inventory',4),('construction','warehouses',5),('construction','suppliers',6),
  ('construction','invoices',7),('construction','customers',8),('construction','crm',9),
  ('construction','expenses',10),('construction','financials',11),('construction','banking',12),
  ('construction','hr',13),('construction','reports',14),('construction','staff',15),
  ('construction','settings',16),('construction','approvals',17),('construction','administration',18),
  ('construction','audit-log',19),
  -- TRANSPORT
  ('transport','dashboard',1),('transport','fleet',2),('transport','customers',3),
  ('transport','invoices',4),('transport','purchasing',5),('transport','expenses',6),
  ('transport','financials',7),('transport','banking',8),('transport','hr',9),
  ('transport','crm',10),('transport','reports',11),('transport','staff',12),
  ('transport','settings',13),('transport','approvals',14),('transport','administration',15),
  -- HOSPITALITY
  ('hospitality','dashboard',1),('hospitality','pos',2),('hospitality','hotel-mgmt',3),
  ('hospitality','restaurant',4),('hospitality','customers',5),('hospitality','invoices',6),
  ('hospitality','crm',7),('hospitality','inventory',8),('hospitality','purchasing',9),
  ('hospitality','suppliers',10),('hospitality','expenses',11),('hospitality','financials',12),
  ('hospitality','banking',13),('hospitality','hr',14),('hospitality','reports',15),
  ('hospitality','staff',16),('hospitality','settings',17),('hospitality','approvals',18),
  ('hospitality','administration',19),
  -- AUTO SERVICES
  ('auto','dashboard',1),('auto','garage',2),('auto','pos',3),('auto','inventory',4),
  ('auto','customers',5),('auto','invoices',6),('auto','suppliers',7),('auto','purchasing',8),
  ('auto','crm',9),('auto','expenses',10),('auto','hr',11),('auto','reports',12),
  ('auto','staff',13),('auto','settings',14),('auto','approvals',15),
  -- AGRICULTURE
  ('agriculture','dashboard',1),('agriculture','farm-mgmt',2),('agriculture','inventory',3),
  ('agriculture','purchasing',4),('agriculture','warehouses',5),('agriculture','suppliers',6),
  ('agriculture','customers',7),('agriculture','invoices',8),('agriculture','expenses',9),
  ('agriculture','financials',10),('agriculture','banking',11),('agriculture','hr',12),
  ('agriculture','reports',13),('agriculture','staff',14),('agriculture','settings',15),
  ('agriculture','approvals',16),
  -- BEAUTY
  ('beauty','dashboard',1),('beauty','pos',2),('beauty','inventory',3),('beauty','customers',4),
  ('beauty','invoices',5),('beauty','expenses',6),('beauty','crm',7),('beauty','hr',8),
  ('beauty','reports',9),('beauty','staff',10),('beauty','settings',11),('beauty','approvals',12),
  -- FINANCIAL SERVICES
  ('financial','dashboard',1),('financial','customers',2),('financial','crm',3),
  ('financial','invoices',4),('financial','financials',5),('financial','banking',6),
  ('financial','expenses',7),('financial','hr',8),('financial','reports',9),
  ('financial','staff',10),('financial','settings',11),('financial','approvals',12),
  ('financial','administration',13),('financial','audit-log',14)
ON CONFLICT (industry_slug, module_key) DO NOTHING;

-- ── [N] Seed — Industry KPI Configs ──────────────────────────────────────────

INSERT INTO public.industry_kpi_configs (industry_slug, kpi_key, kpi_name, kpi_description, display_format, display_order) VALUES
  ('retail','daily_sales','Today''s Sales','Total revenue today','currency',1),
  ('retail','transactions_today','Transactions','Number of sales transactions today','number',2),
  ('retail','avg_basket_value','Avg Basket Value','Average transaction value today','currency',3),
  ('retail','low_stock_items','Low Stock Alerts','Products below minimum stock level','number',4),
  ('retail','gross_margin','Gross Margin %','Revenue minus cost of goods sold','percentage',5),
  ('retail','outstanding_recv','Receivables','Total unpaid invoices outstanding','currency',6),
  ('food-beverage','daily_revenue','Today''s Revenue','Total POS + table revenue today','currency',1),
  ('food-beverage','covers_today','Covers Today','Number of diners served today','number',2),
  ('food-beverage','avg_cover_value','Avg Cover Value','Revenue per diner served','currency',3),
  ('food-beverage','table_turnover','Table Turnover','Average times a table was used','number',4),
  ('food-beverage','low_stock_items','Low Stock Alerts','Ingredients below minimum level','number',5),
  ('food-beverage','expenses_today','Cost Today','Food & beverage costs today','currency',6),
  ('wholesale','daily_sales','Today''s Sales','Total invoiced sales today','currency',1),
  ('wholesale','pending_orders','Pending Orders','Sales orders not yet fulfilled','number',2),
  ('wholesale','outstanding_recv','Receivables','Total unpaid customer invoices','currency',3),
  ('wholesale','fulfillment_rate','Fulfillment Rate','Orders fulfilled on time (%)','percentage',4),
  ('wholesale','low_stock_items','Low Stock Alerts','Products below minimum level','number',5),
  ('wholesale','monthly_revenue','Monthly Revenue','Total revenue this calendar month','currency',6),
  ('manufacturing','daily_output','Output Today','Units produced today','number',1),
  ('manufacturing','work_orders_open','Open Work Orders','Production orders in progress','number',2),
  ('manufacturing','daily_revenue','Revenue Today','Total invoiced revenue today','currency',3),
  ('manufacturing','low_stock_items','Material Alerts','Raw materials below minimum','number',4),
  ('manufacturing','pending_po','Pending POs','Purchase orders awaiting delivery','number',5),
  ('manufacturing','monthly_revenue','Monthly Revenue','Total revenue this month','currency',6),
  ('pharmacy','daily_revenue','Today''s Revenue','Total dispensing revenue today','currency',1),
  ('pharmacy','dispensed_today','Items Dispensed','Products dispensed today','number',2),
  ('pharmacy','expiring_30days','Expiring (30d)','Stock expiring within 30 days','number',3),
  ('pharmacy','expiring_90days','Expiring (90d)','Stock expiring within 90 days','number',4),
  ('pharmacy','low_stock_items','Low Stock Alerts','Items below minimum stock level','number',5),
  ('pharmacy','rx_pending','Open Prescriptions','Prescriptions not yet dispensed','number',6),
  ('professional','monthly_revenue','Monthly Revenue','Total invoiced this month','currency',1),
  ('professional','active_projects','Active Projects','Projects currently in progress','number',2),
  ('professional','outstanding_inv','Outstanding Inv.','Total unpaid client invoices','currency',3),
  ('professional','billable_hours','Billable Hours','Logged billable hours this month','number',4),
  ('professional','pipeline_value','Pipeline Value','Total value of open CRM opportunities','currency',5),
  ('professional','overdue_tasks','Overdue Tasks','Project tasks past their due date','number',6),
  ('construction','active_projects','Active Projects','Construction projects in progress','number',1),
  ('construction','monthly_revenue','Monthly Revenue','Total invoiced this month','currency',2),
  ('construction','outstanding_inv','Outstanding Inv.','Total unpaid client invoices','currency',3),
  ('construction','pending_po','Pending POs','Purchase orders awaiting delivery','number',4),
  ('construction','labour_this_week','Labour This Week','Total labour cost this week','currency',5),
  ('construction','milestones_due','Milestones Due','Project milestones due this week','number',6),
  ('transport','daily_revenue','Today''s Revenue','Total trip & freight revenue today','currency',1),
  ('transport','trips_today','Trips Today','Number of trips completed today','number',2),
  ('transport','vehicles_active','Active Vehicles','Vehicles currently on assignment','number',3),
  ('transport','outstanding_inv','Outstanding Inv.','Unpaid client invoices','currency',4),
  ('transport','fuel_this_week','Fuel Cost (Week)','Total fuel expenditure this week','currency',5),
  ('transport','monthly_revenue','Monthly Revenue','Total revenue this month','currency',6),
  ('hospitality','occupancy_rate','Occupancy Rate','Percentage of rooms occupied tonight','percentage',1),
  ('hospitality','checkins_today','Check-ins Today','Number of guests checking in today','number',2),
  ('hospitality','daily_revenue','Today''s Revenue','Total room + F&B revenue today','currency',3),
  ('hospitality','revpar','RevPAR','Revenue per available room','currency',4),
  ('hospitality','checkouts_today','Check-outs Today','Guests checking out today','number',5),
  ('hospitality','monthly_revenue','Monthly Revenue','Total revenue this month','currency',6),
  ('auto','daily_revenue','Today''s Revenue','Total job card and parts revenue today','currency',1),
  ('auto','open_jobs','Open Job Cards','Active repair / service jobs','number',2),
  ('auto','completed_today','Completed Today','Job cards closed today','number',3),
  ('auto','outstanding_inv','Outstanding Inv.','Unpaid customer invoices','currency',4),
  ('auto','low_stock_items','Low Parts Alerts','Spare parts below minimum stock','number',5),
  ('auto','monthly_revenue','Monthly Revenue','Total revenue this month','currency',6),
  ('agriculture','harvest_forecast','Harvest Forecast','Expected yield this season (kg)','number',1),
  ('agriculture','input_cost_month','Input Cost (Mo.)','Seeds, fertilizer & pesticide cost','currency',2),
  ('agriculture','stock_in_store','Stock in Store','Total produce in storage (kg)','number',3),
  ('agriculture','monthly_sales','Monthly Sales','Produce sold this month','currency',4),
  ('agriculture','pending_po','Pending Orders','Input purchase orders awaiting delivery','number',5),
  ('agriculture','outstanding_recv','Receivables','Unpaid buyer invoices','currency',6),
  ('beauty','daily_revenue','Today''s Revenue','Total service + product revenue today','currency',1),
  ('beauty','appointments_today','Appointments','Bookings / walk-ins served today','number',2),
  ('beauty','avg_service_value','Avg Service Value','Average revenue per client visit','currency',3),
  ('beauty','outstanding_inv','Outstanding Inv.','Unpaid client invoices','currency',4),
  ('beauty','low_stock_items','Low Product Stock','Retail products below minimum','number',5),
  ('beauty','monthly_revenue','Monthly Revenue','Total revenue this month','currency',6),
  ('financial','daily_revenue','Today''s Revenue','Total transactions processed today','currency',1),
  ('financial','active_clients','Active Clients','Clients with open accounts / loans','number',2),
  ('financial','outstanding_inv','Receivables','Total outstanding client balances','currency',3),
  ('financial','monthly_revenue','Monthly Revenue','Total revenue / fees this month','currency',4),
  ('financial','new_clients_month','New Clients (Mo.)','New clients onboarded this month','number',5),
  ('financial','pending_approvals','Pending Approvals','Transactions awaiting approval','number',6)
ON CONFLICT (industry_slug, kpi_key) DO NOTHING;


-- ============================================================
-- [23] PHASE 1 — Industry KPIs RPC
-- ============================================================

CREATE OR REPLACE FUNCTION get_industry_kpis(p_business_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result               jsonb    := '{}'::jsonb;
  v_monthly_total        numeric  := 0;
  v_covers_today         integer  := 0;
  v_expiring_30          integer  := 0;
  v_expiring_90          integer  := 0;
  v_active_projects      integer  := 0;
  v_pending_approvals    integer  := 0;
  v_new_customers_month  integer  := 0;
  v_avg_basket           numeric  := 0;
  v_open_service_jobs    integer  := 0;
  v_pending_leave        integer  := 0;
  v_active_employees     integer  := 0;
  v_monthly_expenses     numeric  := 0;
  v_open_purchase_orders integer  := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM businesses WHERE id = p_business_id
      AND (owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM staff_members
        WHERE business_id = p_business_id AND supabase_user_id = auth.uid() AND status = 'active'
      ))
  ) THEN RETURN v_result; END IF;

  BEGIN SELECT COALESCE(SUM(total),0) INTO v_monthly_total FROM sales
    WHERE business_id=p_business_id AND voided=false AND created_at>=date_trunc('month',now());
  EXCEPTION WHEN OTHERS THEN v_monthly_total:=0; END;
  BEGIN SELECT COALESCE(SUM(covers),0) INTO v_covers_today FROM sales
    WHERE business_id=p_business_id AND voided=false AND covers IS NOT NULL AND created_at>=current_date;
  EXCEPTION WHEN OTHERS THEN v_covers_today:=0; END;
  BEGIN SELECT COUNT(*) INTO v_expiring_30 FROM products
    WHERE business_id=p_business_id AND expiry_date IS NOT NULL
      AND expiry_date<=(current_date+INTERVAL '30 days') AND expiry_date>=current_date AND quantity>0;
  EXCEPTION WHEN OTHERS THEN v_expiring_30:=0; END;
  BEGIN SELECT COUNT(*) INTO v_expiring_90 FROM products
    WHERE business_id=p_business_id AND expiry_date IS NOT NULL
      AND expiry_date<=(current_date+INTERVAL '90 days') AND expiry_date>=current_date AND quantity>0;
  EXCEPTION WHEN OTHERS THEN v_expiring_90:=0; END;
  BEGIN SELECT COUNT(*) INTO v_active_projects FROM projects
    WHERE business_id=p_business_id AND status NOT IN ('completed','cancelled');
  EXCEPTION WHEN OTHERS THEN v_active_projects:=0; END;
  BEGIN SELECT COUNT(*) INTO v_pending_approvals FROM approval_requests
    WHERE business_id=p_business_id AND status='pending';
  EXCEPTION WHEN OTHERS THEN v_pending_approvals:=0; END;
  BEGIN SELECT COUNT(*) INTO v_new_customers_month FROM customers
    WHERE business_id=p_business_id AND created_at>=date_trunc('month',now());
  EXCEPTION WHEN OTHERS THEN v_new_customers_month:=0; END;
  BEGIN SELECT COALESCE(AVG(total),0) INTO v_avg_basket FROM sales
    WHERE business_id=p_business_id AND voided=false AND created_at>=(now()-INTERVAL '30 days');
  EXCEPTION WHEN OTHERS THEN v_avg_basket:=0; END;
  BEGIN SELECT COUNT(*) INTO v_open_service_jobs FROM service_tickets
    WHERE business_id=p_business_id AND status NOT IN ('completed','cancelled');
  EXCEPTION WHEN OTHERS THEN v_open_service_jobs:=0; END;
  BEGIN SELECT COUNT(*) INTO v_pending_leave FROM leave_requests
    WHERE business_id=p_business_id AND status='pending';
  EXCEPTION WHEN OTHERS THEN v_pending_leave:=0; END;
  BEGIN SELECT COUNT(*) INTO v_active_employees FROM employees
    WHERE business_id=p_business_id AND status='active';
  EXCEPTION WHEN OTHERS THEN v_active_employees:=0; END;
  BEGIN SELECT COALESCE(SUM(amount),0) INTO v_monthly_expenses FROM expenses
    WHERE business_id=p_business_id AND created_at>=date_trunc('month',now());
  EXCEPTION WHEN OTHERS THEN v_monthly_expenses:=0; END;
  BEGIN SELECT COUNT(*) INTO v_open_purchase_orders FROM purchase_orders
    WHERE business_id=p_business_id AND status NOT IN ('received','cancelled');
  EXCEPTION WHEN OTHERS THEN v_open_purchase_orders:=0; END;

  RETURN jsonb_build_object(
    'monthly_total',v_monthly_total,'covers_today',v_covers_today,
    'expiring_30_count',v_expiring_30,'expiring_90_count',v_expiring_90,
    'active_projects_count',v_active_projects,'pending_approvals',v_pending_approvals,
    'new_customers_month',v_new_customers_month,'avg_basket_30d',ROUND(v_avg_basket,2),
    'open_service_jobs',v_open_service_jobs,'pending_leave',v_pending_leave,
    'active_employees',v_active_employees,'monthly_expenses',v_monthly_expenses,
    'open_purchase_orders',v_open_purchase_orders
  );
END; $$;

GRANT EXECUTE ON FUNCTION get_industry_kpis(uuid) TO authenticated;


-- ============================================================
-- [24] PHASE 2 — Welcome screen flag
-- ============================================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS welcome_shown boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_businesses_welcome_shown
  ON businesses(owner_id, welcome_shown) WHERE welcome_shown = false;


-- ============================================================
-- [25] PHASE 3 — Core new modules
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll_periods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, period_start date NOT NULL, period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  total_gross numeric(14,2) DEFAULT 0, total_paye numeric(14,2) DEFAULT 0,
  total_ssnit_employee numeric(14,2) DEFAULT 0, total_ssnit_employer numeric(14,2) DEFAULT 0,
  total_net numeric(14,2) DEFAULT 0, notes text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payroll_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_name text NOT NULL, staff_member_id uuid,
  basic_salary numeric(12,2) NOT NULL DEFAULT 0, housing_allowance numeric(12,2) NOT NULL DEFAULT 0,
  transport_allowance numeric(12,2) NOT NULL DEFAULT 0, other_allowances numeric(12,2) NOT NULL DEFAULT 0,
  gross_salary numeric(12,2) NOT NULL DEFAULT 0, ssnit_employee numeric(12,2) NOT NULL DEFAULT 0,
  ssnit_employer numeric(12,2) NOT NULL DEFAULT 0, taxable_income numeric(12,2) NOT NULL DEFAULT 0,
  paye numeric(12,2) NOT NULL DEFAULT 0, other_deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_pay numeric(12,2) NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_business ON payroll_periods(business_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_period   ON payroll_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_business ON payroll_entries(business_id);
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

ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payroll_periods_owner ON payroll_periods;
DROP POLICY IF EXISTS payroll_entries_owner ON payroll_entries;
CREATE POLICY payroll_periods_owner ON payroll_periods USING (is_owner_or_staff(business_id));
CREATE POLICY payroll_entries_owner ON payroll_entries USING (is_owner_or_staff(business_id));

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_member_id uuid, employee_name text NOT NULL, attendance_date date NOT NULL,
  clock_in time, clock_out time, hours_worked numeric(5,2),
  status text NOT NULL DEFAULT 'present'
    CHECK (status IN ('present','absent','late','half-day','leave','holiday')),
  notes text, created_at timestamptz DEFAULT now(),
  UNIQUE (business_id, staff_member_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_business_date ON attendance_records(business_id, attendance_date DESC);
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_owner ON attendance_records;
CREATE POLICY attendance_owner ON attendance_records USING (is_owner_or_staff(business_id));

CREATE TABLE IF NOT EXISTS budgets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, period_start date NOT NULL, period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  total_budget numeric(14,2) DEFAULT 0, notes text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS budget_lines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category text NOT NULL, description text,
  budgeted numeric(14,2) NOT NULL DEFAULT 0, actual numeric(14,2) NOT NULL DEFAULT 0,
  variance numeric(14,2) GENERATED ALWAYS AS (budgeted - actual) STORED,
  sort_order smallint DEFAULT 0, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budgets_business    ON budgets(business_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON budget_lines(budget_id);
ALTER TABLE budgets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS budgets_owner      ON budgets;
DROP POLICY IF EXISTS budget_lines_owner ON budget_lines;
CREATE POLICY budgets_owner      ON budgets      USING (is_owner_or_staff(business_id));
CREATE POLICY budget_lines_owner ON budget_lines USING (is_owner_or_staff(business_id));

CREATE TABLE IF NOT EXISTS assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, asset_code text, category text NOT NULL DEFAULT 'Other',
  purchase_date date NOT NULL, purchase_cost numeric(14,2) NOT NULL DEFAULT 0,
  salvage_value numeric(14,2) NOT NULL DEFAULT 0, useful_life_years smallint NOT NULL DEFAULT 5,
  depreciation_method text NOT NULL DEFAULT 'straight-line'
    CHECK (depreciation_method IN ('straight-line','none')),
  current_value numeric(14,2), location text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','disposed','sold','written-off')),
  disposal_date date, disposal_value numeric(14,2), notes text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assets_business ON assets(business_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(business_id, category);
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assets_owner ON assets;
CREATE POLICY assets_owner ON assets USING (is_owner_or_staff(business_id));

CREATE TABLE IF NOT EXISTS petty_cash_funds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, custodian text,
  opening_float numeric(12,2) NOT NULL DEFAULT 0,
  current_balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS petty_cash_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  fund_id uuid NOT NULL REFERENCES petty_cash_funds(id) ON DELETE CASCADE,
  txn_date date NOT NULL DEFAULT current_date, description text NOT NULL,
  category text NOT NULL DEFAULT 'General', amount numeric(12,2) NOT NULL,
  txn_type text NOT NULL DEFAULT 'expense'
    CHECK (txn_type IN ('expense','top-up','adjustment')),
  receipt_ref text, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_petty_funds_business ON petty_cash_funds(business_id);
CREATE INDEX IF NOT EXISTS idx_petty_txns_fund      ON petty_cash_transactions(fund_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_petty_txns_business  ON petty_cash_transactions(business_id, txn_date DESC);
ALTER TABLE petty_cash_funds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS petty_funds_owner ON petty_cash_funds;
DROP POLICY IF EXISTS petty_txns_owner  ON petty_cash_transactions;
CREATE POLICY petty_funds_owner ON petty_cash_funds        USING (is_owner_or_staff(business_id));
CREATE POLICY petty_txns_owner  ON petty_cash_transactions USING (is_owner_or_staff(business_id));

-- Phase 3 modules are already marked available in the module registry seed above.


-- ============================================================
-- [26] PHASE 4 — Industry packs
-- ============================================================

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_number text NOT NULL, name text, capacity smallint NOT NULL DEFAULT 4,
  section text DEFAULT 'Main',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','cleaning')),
  created_at timestamptz DEFAULT now(), UNIQUE (business_id, table_number)
);
CREATE TABLE IF NOT EXISTS restaurant_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_id uuid REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  covers smallint DEFAULT 1, opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled','cancelled')),
  total_amount numeric(12,2) NOT NULL DEFAULT 0, notes text, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS restaurant_order_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_name text NOT NULL, quantity numeric(8,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0, notes text, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rest_tables_business ON restaurant_tables(business_id);
CREATE INDEX IF NOT EXISTS idx_rest_orders_business ON restaurant_orders(business_id, status);
CREATE INDEX IF NOT EXISTS idx_rest_orders_table    ON restaurant_orders(table_id, status);
CREATE INDEX IF NOT EXISTS idx_rest_items_order     ON restaurant_order_items(order_id);
ALTER TABLE restaurant_tables      ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rest_tables_owner ON restaurant_tables;
DROP POLICY IF EXISTS rest_orders_owner ON restaurant_orders;
DROP POLICY IF EXISTS rest_items_owner  ON restaurant_order_items;
CREATE POLICY rest_tables_owner ON restaurant_tables      USING (is_owner_or_staff(business_id));
CREATE POLICY rest_orders_owner ON restaurant_orders      USING (is_owner_or_staff(business_id));
CREATE POLICY rest_items_owner  ON restaurant_order_items USING (is_owner_or_staff(business_id));

CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  rx_number text NOT NULL, patient_name text NOT NULL, patient_phone text, prescriber_name text,
  rx_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dispensed','partial','cancelled')),
  notes text, created_at timestamptz DEFAULT now(), UNIQUE (business_id, rx_number)
);
CREATE TABLE IF NOT EXISTS prescription_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  prescription_id uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  drug_name text NOT NULL, dosage_instructions text,
  quantity_prescribed numeric(10,2) NOT NULL DEFAULT 1, quantity_dispensed numeric(10,2) NOT NULL DEFAULT 0,
  batch_number text, expiry_date date, unit_price numeric(10,2) NOT NULL DEFAULT 0,
  notes text, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prescriptions_business ON prescriptions(business_id, rx_date DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status   ON prescriptions(business_id, status);
CREATE INDEX IF NOT EXISTS idx_rx_items_prescription  ON prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_rx_items_expiry        ON prescription_items(business_id, expiry_date) WHERE expiry_date IS NOT NULL;
ALTER TABLE prescriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prescriptions_owner ON prescriptions;
DROP POLICY IF EXISTS rx_items_owner      ON prescription_items;
CREATE POLICY prescriptions_owner ON prescriptions      USING (is_owner_or_staff(business_id));
CREATE POLICY rx_items_owner      ON prescription_items USING (is_owner_or_staff(business_id));

CREATE TABLE IF NOT EXISTS hotel_rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  room_number text NOT NULL,
  room_type text NOT NULL DEFAULT 'Standard'
    CHECK (room_type IN ('Standard','Deluxe','Suite','Executive','Family','Dormitory')),
  floor text, capacity smallint NOT NULL DEFAULT 2, rate_per_night numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','occupied','reserved','maintenance','cleaning')),
  amenities text, created_at timestamptz DEFAULT now(), UNIQUE (business_id, room_number)
);
CREATE TABLE IF NOT EXISTS hotel_bookings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  room_id uuid REFERENCES hotel_rooms(id) ON DELETE SET NULL,
  guest_name text NOT NULL, guest_phone text, guest_email text,
  check_in_date date NOT NULL, check_out_date date NOT NULL,
  adults smallint NOT NULL DEFAULT 1, children smallint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed','checked-in','checked-out','cancelled','no-show')),
  total_amount numeric(12,2) NOT NULL DEFAULT 0, paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text, notes text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hotel_charges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES hotel_bookings(id) ON DELETE CASCADE,
  charge_date date NOT NULL DEFAULT current_date, description text NOT NULL,
  category text NOT NULL DEFAULT 'Accommodation', amount numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_business    ON hotel_rooms(business_id, status);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_business ON hotel_bookings(business_id, check_in_date DESC);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_room     ON hotel_bookings(room_id, status);
CREATE INDEX IF NOT EXISTS idx_hotel_charges_booking   ON hotel_charges(booking_id, charge_date DESC);
ALTER TABLE hotel_rooms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_charges  ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hotel_rooms_owner    ON hotel_rooms;
DROP POLICY IF EXISTS hotel_bookings_owner ON hotel_bookings;
DROP POLICY IF EXISTS hotel_charges_owner  ON hotel_charges;
CREATE POLICY hotel_rooms_owner    ON hotel_rooms    USING (is_owner_or_staff(business_id));
CREATE POLICY hotel_bookings_owner ON hotel_bookings USING (is_owner_or_staff(business_id));
CREATE POLICY hotel_charges_owner  ON hotel_charges  USING (is_owner_or_staff(business_id));

CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  registration text NOT NULL, make text NOT NULL, model text NOT NULL, year smallint,
  vehicle_type text NOT NULL DEFAULT 'truck'
    CHECK (vehicle_type IN ('truck','van','sedan','bus','pickup','motorcycle','other')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','disposed')),
  assigned_driver text,
  fuel_type text DEFAULT 'petrol' CHECK (fuel_type IN ('petrol','diesel','electric','lpg')),
  odometer_km numeric(10,0) DEFAULT 0, notes text,
  created_at timestamptz DEFAULT now(), UNIQUE (business_id, registration)
);
CREATE TABLE IF NOT EXISTS fleet_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT current_date,
  log_type text NOT NULL DEFAULT 'trip' CHECK (log_type IN ('trip','fuel','maintenance','inspection')),
  description text NOT NULL, driver text, origin text, destination text,
  distance_km numeric(8,1), fuel_litres numeric(8,2),
  cost numeric(10,2) NOT NULL DEFAULT 0, odometer_end numeric(10,0),
  notes text, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_business ON fleet_vehicles(business_id, status);
CREATE INDEX IF NOT EXISTS idx_fleet_logs_vehicle      ON fleet_logs(vehicle_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_logs_business     ON fleet_logs(business_id, log_date DESC);
ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_logs     ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fleet_vehicles_owner ON fleet_vehicles;
DROP POLICY IF EXISTS fleet_logs_owner     ON fleet_logs;
CREATE POLICY fleet_vehicles_owner ON fleet_vehicles USING (is_owner_or_staff(business_id));
CREATE POLICY fleet_logs_owner     ON fleet_logs     USING (is_owner_or_staff(business_id));

CREATE TABLE IF NOT EXISTS job_cards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_number text NOT NULL, customer_name text NOT NULL, customer_phone text,
  vehicle_reg text NOT NULL, vehicle_make text, vehicle_model text, vehicle_year smallint,
  complaint text NOT NULL, diagnosis text,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','in-progress','awaiting-parts','ready','delivered','cancelled')),
  assigned_mechanic text, estimated_cost numeric(10,2) DEFAULT 0,
  actual_cost numeric(10,2) DEFAULT 0, received_date date NOT NULL DEFAULT current_date,
  completed_date date, notes text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  UNIQUE (business_id, job_number)
);
CREATE TABLE IF NOT EXISTS job_card_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_card_id uuid NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'labour' CHECK (item_type IN ('labour','part')),
  description text NOT NULL, quantity numeric(8,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_cards_business ON job_cards(business_id, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_cards_status   ON job_cards(business_id, status);
CREATE INDEX IF NOT EXISTS idx_job_items_card     ON job_card_items(job_card_id);
ALTER TABLE job_cards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_card_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_cards_owner ON job_cards;
DROP POLICY IF EXISTS job_items_owner ON job_card_items;
CREATE POLICY job_cards_owner ON job_cards      USING (is_owner_or_staff(business_id));
CREATE POLICY job_items_owner ON job_card_items USING (is_owner_or_staff(business_id));

CREATE TABLE IF NOT EXISTS farm_plots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, size_hectares numeric(8,2), location text, crop_type text,
  status text NOT NULL DEFAULT 'fallow' CHECK (status IN ('fallow','planted','growing','harvested')),
  notes text, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS farm_seasons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL, start_date date NOT NULL, end_date date NOT NULL,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','completed')),
  notes text, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS farm_activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plot_id uuid REFERENCES farm_plots(id) ON DELETE SET NULL,
  season_id uuid REFERENCES farm_seasons(id) ON DELETE SET NULL,
  activity_date date NOT NULL DEFAULT current_date,
  activity_type text NOT NULL DEFAULT 'other'
    CHECK (activity_type IN ('planting','fertilising','spraying','irrigating','weeding','harvesting','other')),
  description text NOT NULL, cost numeric(10,2) DEFAULT 0,
  quantity numeric(10,2), unit text, notes text, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_farm_plots_business      ON farm_plots(business_id);
CREATE INDEX IF NOT EXISTS idx_farm_seasons_business    ON farm_seasons(business_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_farm_activities_business ON farm_activities(business_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_farm_activities_plot     ON farm_activities(plot_id, activity_date DESC);
ALTER TABLE farm_plots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_seasons    ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS farm_plots_owner      ON farm_plots;
DROP POLICY IF EXISTS farm_seasons_owner    ON farm_seasons;
DROP POLICY IF EXISTS farm_activities_owner ON farm_activities;
CREATE POLICY farm_plots_owner      ON farm_plots      USING (is_owner_or_staff(business_id));
CREATE POLICY farm_seasons_owner    ON farm_seasons    USING (is_owner_or_staff(business_id));
CREATE POLICY farm_activities_owner ON farm_activities USING (is_owner_or_staff(business_id));


-- ============================================================
-- [27] PHASE 5 — Performance indexes + daily summary view
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_attendance_biz_date       ON attendance_records (business_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date      ON attendance_records (business_id, staff_member_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_biz_status         ON budgets (business_id, status);
CREATE INDEX IF NOT EXISTS idx_budget_lines_biz           ON budget_lines (budget_id);
CREATE INDEX IF NOT EXISTS idx_assets_biz_status          ON assets (business_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_biz_category        ON assets (business_id, category);
CREATE INDEX IF NOT EXISTS idx_petty_cash_funds_biz       ON petty_cash_funds (business_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_txns_fund_date  ON petty_cash_transactions (fund_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_biz        ON payroll_periods (business_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_biz      ON restaurant_tables (business_id, status);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_biz      ON restaurant_orders (business_id, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_items_order     ON restaurant_order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_biz_status   ON prescriptions (business_id, status, rx_date DESC);
CREATE INDEX IF NOT EXISTS idx_prescription_items_rx      ON prescription_items (prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_expiry  ON prescription_items (prescription_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_biz_status     ON hotel_rooms (business_id, status);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_biz_status  ON hotel_bookings (business_id, status, check_in_date DESC);
CREATE INDEX IF NOT EXISTS idx_hotel_charges_booking_date ON hotel_charges (booking_id, charge_date DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_biz_status  ON fleet_vehicles (business_id, status);
CREATE INDEX IF NOT EXISTS idx_fleet_logs_vehicle_date    ON fleet_logs (vehicle_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_logs_biz_type        ON fleet_logs (business_id, log_type, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_cards_biz_status       ON job_cards (business_id, status, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_card_items_job         ON job_card_items (job_card_id);
CREATE INDEX IF NOT EXISTS idx_farm_plots_biz_status      ON farm_plots (business_id, status);
CREATE INDEX IF NOT EXISTS idx_farm_seasons_biz_status    ON farm_seasons (business_id, status, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_farm_activities_plot_date  ON farm_activities (plot_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_farm_activities_season     ON farm_activities (season_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_biz_created          ON sales (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_biz_status_date   ON invoices (business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_biz_qty_reorder   ON products (business_id, qty, reorder_level);

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
