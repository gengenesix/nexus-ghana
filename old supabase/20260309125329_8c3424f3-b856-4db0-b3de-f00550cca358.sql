
-- =============================================
-- RBAC & ERP FOUNDATION SCHEMA
-- =============================================

-- License tiers enum
CREATE TYPE public.license_tier AS ENUM ('professional', 'limited_financial', 'limited_logistics', 'limited_sales_crm', 'starter');

-- Permission levels enum
CREATE TYPE public.permission_level AS ENUM ('full', 'read_only', 'none');

-- User type enum
CREATE TYPE public.user_type AS ENUM ('superuser', 'standard', 'support_auditor');

-- =============================================
-- Role Templates table
-- =============================================
CREATE TABLE public.role_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '{}',
  license_tier public.license_tier NOT NULL DEFAULT 'professional',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, name)
);
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view role templates" ON public.role_templates FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert role templates" ON public.role_templates FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update role templates" ON public.role_templates FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete role templates" ON public.role_templates FOR DELETE USING (business_id = get_business_id());

-- =============================================
-- User Groups table
-- =============================================
CREATE TABLE public.user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  group_type text NOT NULL DEFAULT 'authorization',
  permissions jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, name)
);
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view user groups" ON public.user_groups FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert user groups" ON public.user_groups FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update user groups" ON public.user_groups FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete user groups" ON public.user_groups FOR DELETE USING (business_id = get_business_id());

-- =============================================
-- Staff-Group junction table
-- =============================================
CREATE TABLE public.staff_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE CASCADE NOT NULL,
  group_id uuid REFERENCES public.user_groups(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_id, group_id)
);
ALTER TABLE public.staff_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view staff groups" ON public.staff_group_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.staff_members sm WHERE sm.id = staff_group_members.staff_id AND sm.business_id = get_business_id())
);
CREATE POLICY "Business members can insert staff groups" ON public.staff_group_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.staff_members sm WHERE sm.id = staff_group_members.staff_id AND sm.business_id = get_business_id())
);
CREATE POLICY "Business members can delete staff groups" ON public.staff_group_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.staff_members sm WHERE sm.id = staff_group_members.staff_id AND sm.business_id = get_business_id())
);

-- =============================================
-- Add license/permission fields to staff_members
-- =============================================
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS license_tier public.license_tier DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS user_type public.user_type DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS role_template_id uuid REFERENCES public.role_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department text DEFAULT '';

-- =============================================
-- Audit Log table
-- =============================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  staff_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  module text NOT NULL DEFAULT '',
  record_type text NOT NULL DEFAULT '',
  record_id text DEFAULT '',
  details jsonb DEFAULT '{}',
  old_values jsonb DEFAULT '{}',
  new_values jsonb DEFAULT '{}',
  ip_address text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view audit logs" ON public.audit_logs FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE INDEX idx_audit_logs_business ON public.audit_logs(business_id, created_at DESC);
CREATE INDEX idx_audit_logs_module ON public.audit_logs(business_id, module, created_at DESC);

-- =============================================
-- Approval Workflows table
-- =============================================
CREATE TABLE public.approval_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  document_type text NOT NULL,
  conditions jsonb DEFAULT '{}',
  steps jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view workflows" ON public.approval_workflows FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert workflows" ON public.approval_workflows FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update workflows" ON public.approval_workflows FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete workflows" ON public.approval_workflows FOR DELETE USING (business_id = get_business_id());

-- =============================================
-- Number Series table
-- =============================================
CREATE TABLE public.number_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL,
  prefix text NOT NULL DEFAULT '',
  next_number integer NOT NULL DEFAULT 1,
  suffix text DEFAULT '',
  pad_length integer NOT NULL DEFAULT 4,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, document_type)
);
ALTER TABLE public.number_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view number series" ON public.number_series FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert number series" ON public.number_series FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update number series" ON public.number_series FOR UPDATE USING (business_id = get_business_id());

-- =============================================
-- Add more fields to businesses for ERP config
-- =============================================
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'GHS',
  ADD COLUMN IF NOT EXISTS fiscal_year_start integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Africa/Accra',
  ADD COLUMN IF NOT EXISTS industry text DEFAULT '';

-- =============================================
-- Notifications / Alerts table
-- =============================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'info',
  module text DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  link text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view notifications" ON public.notifications FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert notifications" ON public.notifications FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update notifications" ON public.notifications FOR UPDATE USING (business_id = get_business_id());

-- =============================================
-- CRM: Leads table
-- =============================================
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  company text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  source text DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  value numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view leads" ON public.leads FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert leads" ON public.leads FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update leads" ON public.leads FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete leads" ON public.leads FOR DELETE USING (business_id = get_business_id());

-- =============================================
-- CRM: Opportunities table
-- =============================================
CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'prospecting',
  probability integer DEFAULT 10,
  value numeric DEFAULT 0,
  expected_close date,
  assigned_to uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  won_reason text DEFAULT '',
  lost_reason text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view opportunities" ON public.opportunities FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert opportunities" ON public.opportunities FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update opportunities" ON public.opportunities FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete opportunities" ON public.opportunities FOR DELETE USING (business_id = get_business_id());

-- =============================================
-- CRM: Activities table
-- =============================================
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL DEFAULT 'note',
  subject text NOT NULL,
  description text DEFAULT '',
  contact_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  due_date timestamptz,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view activities" ON public.activities FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert activities" ON public.activities FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update activities" ON public.activities FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete activities" ON public.activities FOR DELETE USING (business_id = get_business_id());

-- =============================================
-- Sales: Quotations table
-- =============================================
CREATE TABLE public.sales_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  quotation_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date NOT NULL DEFAULT (CURRENT_DATE + interval '30 days'),
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text DEFAULT '',
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view quotations" ON public.sales_quotations FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert quotations" ON public.sales_quotations FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update quotations" ON public.sales_quotations FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete quotations" ON public.sales_quotations FOR DELETE USING (business_id = get_business_id());

-- =============================================
-- Sales: Sales Orders table
-- =============================================
CREATE TABLE public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  order_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  quotation_id uuid REFERENCES public.sales_quotations(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  delivery_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  notes text DEFAULT '',
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view sales orders" ON public.sales_orders FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert sales orders" ON public.sales_orders FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update sales orders" ON public.sales_orders FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete sales orders" ON public.sales_orders FOR DELETE USING (business_id = get_business_id());

-- =============================================
-- Purchasing: Purchase Orders table
-- =============================================
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  po_number text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text NOT NULL DEFAULT '',
  date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text DEFAULT '',
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view purchase orders" ON public.purchase_orders FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert purchase orders" ON public.purchase_orders FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update purchase orders" ON public.purchase_orders FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete purchase orders" ON public.purchase_orders FOR DELETE USING (business_id = get_business_id());

-- =============================================
-- Financials: Chart of Accounts
-- =============================================
CREATE TABLE public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  account_code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL,
  parent_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, account_code)
);
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view accounts" ON public.chart_of_accounts FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert accounts" ON public.chart_of_accounts FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update accounts" ON public.chart_of_accounts FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete accounts" ON public.chart_of_accounts FOR DELETE USING (business_id = get_business_id());

-- =============================================
-- Financials: Journal Entries
-- =============================================
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  entry_number text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text DEFAULT '',
  reference text DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  total_debit numeric NOT NULL DEFAULT 0,
  total_credit numeric NOT NULL DEFAULT 0,
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view journal entries" ON public.journal_entries FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert journal entries" ON public.journal_entries FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update journal entries" ON public.journal_entries FOR UPDATE USING (business_id = get_business_id());

CREATE TABLE public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT NOT NULL,
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  description text DEFAULT '',
  cost_center text DEFAULT ''
);
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view journal lines" ON public.journal_entry_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_entry_lines.journal_entry_id AND je.business_id = get_business_id())
);
CREATE POLICY "Business members can insert journal lines" ON public.journal_entry_lines FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_entry_lines.journal_entry_id AND je.business_id = get_business_id())
);

-- =============================================
-- Banking: Bank Accounts
-- =============================================
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  bank_name text NOT NULL DEFAULT '',
  account_number text DEFAULT '',
  account_type text NOT NULL DEFAULT 'checking',
  currency text NOT NULL DEFAULT 'GHS',
  balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  chart_account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view bank accounts" ON public.bank_accounts FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert bank accounts" ON public.bank_accounts FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update bank accounts" ON public.bank_accounts FOR UPDATE USING (business_id = get_business_id());

-- =============================================
-- Banking: Payments
-- =============================================
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  payment_number text NOT NULL,
  type text NOT NULL DEFAULT 'incoming',
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GHS',
  payment_method text NOT NULL DEFAULT 'cash',
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  reference text DEFAULT '',
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'completed',
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view payments" ON public.payments FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert payments" ON public.payments FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update payments" ON public.payments FOR UPDATE USING (business_id = get_business_id());

-- =============================================
-- HR: Employees table
-- =============================================
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL DEFAULT '',
  position text DEFAULT '',
  department text DEFAULT '',
  date_of_birth date,
  hire_date date DEFAULT CURRENT_DATE,
  salary numeric DEFAULT 0,
  salary_frequency text DEFAULT 'monthly',
  bank_account text DEFAULT '',
  emergency_contact text DEFAULT '',
  emergency_phone text DEFAULT '',
  address text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view employees" ON public.employees FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert employees" ON public.employees FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update employees" ON public.employees FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete employees" ON public.employees FOR DELETE USING (business_id = get_business_id());

-- =============================================
-- Projects table
-- =============================================
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  budget numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'planning',
  priority text DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view projects" ON public.projects FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert projects" ON public.projects FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update projects" ON public.projects FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete projects" ON public.projects FOR DELETE USING (business_id = get_business_id());

-- =============================================
-- Project Tasks table
-- =============================================
CREATE TABLE public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  assigned_to uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  start_date date,
  due_date date,
  priority text DEFAULT 'medium',
  status text NOT NULL DEFAULT 'todo',
  hours_estimated numeric DEFAULT 0,
  hours_actual numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
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

-- =============================================
-- Service: Service Calls table
-- =============================================
CREATE TABLE public.service_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  call_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  subject text NOT NULL,
  description text DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  resolution text DEFAULT '',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view service calls" ON public.service_calls FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert service calls" ON public.service_calls FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update service calls" ON public.service_calls FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete service calls" ON public.service_calls FOR DELETE USING (business_id = get_business_id());

-- =============================================
-- Production: Bill of Materials
-- =============================================
CREATE TABLE public.bill_of_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  quantity_to_produce numeric NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view bom" ON public.bill_of_materials FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert bom" ON public.bill_of_materials FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update bom" ON public.bill_of_materials FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete bom" ON public.bill_of_materials FOR DELETE USING (business_id = get_business_id());

CREATE TABLE public.bom_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id uuid REFERENCES public.bill_of_materials(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_cost numeric NOT NULL DEFAULT 0
);
ALTER TABLE public.bom_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view bom components" ON public.bom_components FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bill_of_materials b WHERE b.id = bom_components.bom_id AND b.business_id = get_business_id())
);
CREATE POLICY "Business members can insert bom components" ON public.bom_components FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.bill_of_materials b WHERE b.id = bom_components.bom_id AND b.business_id = get_business_id())
);

-- =============================================
-- Production Orders table
-- =============================================
CREATE TABLE public.production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  order_number text NOT NULL,
  bom_id uuid REFERENCES public.bill_of_materials(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 1,
  planned_date date DEFAULT CURRENT_DATE,
  completion_date date,
  status text NOT NULL DEFAULT 'planned',
  notes text DEFAULT '',
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view production orders" ON public.production_orders FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert production orders" ON public.production_orders FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update production orders" ON public.production_orders FOR UPDATE USING (business_id = get_business_id());

-- =============================================
-- Warehouses table (multi-warehouse)
-- =============================================
CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  code text NOT NULL DEFAULT '',
  address text DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, code)
);
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view warehouses" ON public.warehouses FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert warehouses" ON public.warehouses FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update warehouses" ON public.warehouses FOR UPDATE USING (business_id = get_business_id());

-- =============================================
-- Stock Transfers table
-- =============================================
CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  transfer_number text NOT NULL,
  from_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  to_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'completed',
  notes text DEFAULT '',
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view stock transfers" ON public.stock_transfers FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert stock transfers" ON public.stock_transfers FOR INSERT WITH CHECK (business_id = get_business_id());
