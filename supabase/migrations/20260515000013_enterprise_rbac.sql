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
