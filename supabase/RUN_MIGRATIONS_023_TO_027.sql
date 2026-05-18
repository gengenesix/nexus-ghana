-- ============================================================
-- NEXUS GH — Run This Once in Supabase SQL Editor
-- Combines migrations 000023 → 000027 (Phases 1–5)
-- All statements are idempotent (IF NOT EXISTS / OR REPLACE /
-- ON CONFLICT DO NOTHING) — safe to re-run if needed.
-- ============================================================


-- ============================================================
-- [23] Phase 1 — Industry KPIs RPC
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
  -- Security: caller must own or work at this business
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

  BEGIN
    SELECT COALESCE(SUM(total), 0) INTO v_monthly_total
    FROM sales
    WHERE business_id = p_business_id AND voided = false
      AND created_at >= date_trunc('month', now());
  EXCEPTION WHEN OTHERS THEN v_monthly_total := 0; END;

  BEGIN
    SELECT COALESCE(SUM(covers), 0) INTO v_covers_today
    FROM sales
    WHERE business_id = p_business_id AND voided = false
      AND covers IS NOT NULL AND created_at >= current_date;
  EXCEPTION WHEN OTHERS THEN v_covers_today := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_expiring_30
    FROM products
    WHERE business_id = p_business_id AND expiry_date IS NOT NULL
      AND expiry_date <= (current_date + INTERVAL '30 days')
      AND expiry_date >= current_date AND quantity > 0;
  EXCEPTION WHEN OTHERS THEN v_expiring_30 := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_expiring_90
    FROM products
    WHERE business_id = p_business_id AND expiry_date IS NOT NULL
      AND expiry_date <= (current_date + INTERVAL '90 days')
      AND expiry_date >= current_date AND quantity > 0;
  EXCEPTION WHEN OTHERS THEN v_expiring_90 := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_active_projects
    FROM projects
    WHERE business_id = p_business_id
      AND status NOT IN ('completed', 'cancelled');
  EXCEPTION WHEN OTHERS THEN v_active_projects := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_pending_approvals
    FROM approval_requests
    WHERE business_id = p_business_id AND status = 'pending';
  EXCEPTION WHEN OTHERS THEN v_pending_approvals := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_new_customers_month
    FROM customers
    WHERE business_id = p_business_id
      AND created_at >= date_trunc('month', now());
  EXCEPTION WHEN OTHERS THEN v_new_customers_month := 0; END;

  BEGIN
    SELECT COALESCE(AVG(total), 0) INTO v_avg_basket
    FROM sales
    WHERE business_id = p_business_id AND voided = false
      AND created_at >= (now() - INTERVAL '30 days');
  EXCEPTION WHEN OTHERS THEN v_avg_basket := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_open_service_jobs
    FROM service_tickets
    WHERE business_id = p_business_id
      AND status NOT IN ('completed', 'cancelled');
  EXCEPTION WHEN OTHERS THEN v_open_service_jobs := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_pending_leave
    FROM leave_requests
    WHERE business_id = p_business_id AND status = 'pending';
  EXCEPTION WHEN OTHERS THEN v_pending_leave := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_active_employees
    FROM employees
    WHERE business_id = p_business_id AND status = 'active';
  EXCEPTION WHEN OTHERS THEN v_active_employees := 0; END;

  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_monthly_expenses
    FROM expenses
    WHERE business_id = p_business_id
      AND created_at >= date_trunc('month', now());
  EXCEPTION WHEN OTHERS THEN v_monthly_expenses := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_open_purchase_orders
    FROM purchase_orders
    WHERE business_id = p_business_id
      AND status NOT IN ('received', 'cancelled');
  EXCEPTION WHEN OTHERS THEN v_open_purchase_orders := 0; END;

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
-- [24] Phase 2 — Welcome screen flag
-- ============================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS welcome_shown boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_businesses_welcome_shown
  ON businesses(owner_id, welcome_shown)
  WHERE welcome_shown = false;


-- ============================================================
-- [25] Phase 3 — Core new modules
-- ============================================================

-- ── Payroll ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payroll_periods (
  id            uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          text          NOT NULL,
  period_start  date          NOT NULL,
  period_end    date          NOT NULL,
  status        text          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  total_gross   numeric(14,2) DEFAULT 0,
  total_paye    numeric(14,2) DEFAULT 0,
  total_ssnit_employee numeric(14,2) DEFAULT 0,
  total_ssnit_employer numeric(14,2) DEFAULT 0,
  total_net     numeric(14,2) DEFAULT 0,
  notes         text,
  created_at    timestamptz   DEFAULT now(),
  updated_at    timestamptz   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_entries (
  id                   uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id          uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  period_id            uuid          NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_name        text          NOT NULL,
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
  created_at           timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_business ON payroll_periods(business_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_period   ON payroll_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_business ON payroll_entries(business_id);

ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_periods_owner ON payroll_periods;
DROP POLICY IF EXISTS payroll_entries_owner ON payroll_entries;

CREATE POLICY payroll_periods_owner ON payroll_periods USING (is_owner_or_staff(business_id));
CREATE POLICY payroll_entries_owner ON payroll_entries USING (is_owner_or_staff(business_id));

-- ── Attendance ────────────────────────────────────────────────────────────────

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
CREATE POLICY attendance_owner ON attendance_records USING (is_owner_or_staff(business_id));

-- ── Budgets ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS budgets (
  id            uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          text          NOT NULL,
  period_start  date          NOT NULL,
  period_end    date          NOT NULL,
  status        text          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  total_budget  numeric(14,2) DEFAULT 0,
  notes         text,
  created_at    timestamptz   DEFAULT now(),
  updated_at    timestamptz   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_lines (
  id            uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  budget_id     uuid          NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category      text          NOT NULL,
  description   text,
  budgeted      numeric(14,2) NOT NULL DEFAULT 0,
  actual        numeric(14,2) NOT NULL DEFAULT 0,
  variance      numeric(14,2) GENERATED ALWAYS AS (budgeted - actual) STORED,
  sort_order    smallint      DEFAULT 0,
  created_at    timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budgets_business    ON budgets(business_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON budget_lines(budget_id);

ALTER TABLE budgets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budgets_owner      ON budgets;
DROP POLICY IF EXISTS budget_lines_owner ON budget_lines;

CREATE POLICY budgets_owner      ON budgets      USING (is_owner_or_staff(business_id));
CREATE POLICY budget_lines_owner ON budget_lines USING (is_owner_or_staff(business_id));

-- ── Fixed Assets ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assets (
  id                  uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id         uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name                text          NOT NULL,
  asset_code          text,
  category            text          NOT NULL DEFAULT 'Other',
  purchase_date       date          NOT NULL,
  purchase_cost       numeric(14,2) NOT NULL DEFAULT 0,
  salvage_value       numeric(14,2) NOT NULL DEFAULT 0,
  useful_life_years   smallint      NOT NULL DEFAULT 5,
  depreciation_method text          NOT NULL DEFAULT 'straight-line'
                      CHECK (depreciation_method IN ('straight-line','none')),
  current_value       numeric(14,2),
  location            text,
  status              text          NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','disposed','sold','written-off')),
  disposal_date       date,
  disposal_value      numeric(14,2),
  notes               text,
  created_at          timestamptz   DEFAULT now(),
  updated_at          timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_business ON assets(business_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(business_id, category);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assets_owner ON assets;
CREATE POLICY assets_owner ON assets USING (is_owner_or_staff(business_id));

-- ── Petty Cash ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS petty_cash_funds (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id     uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            text          NOT NULL,
  custodian       text,
  opening_float   numeric(12,2) NOT NULL DEFAULT 0,
  current_balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at      timestamptz   DEFAULT now(),
  updated_at      timestamptz   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS petty_cash_transactions (
  id          uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  fund_id     uuid          NOT NULL REFERENCES petty_cash_funds(id) ON DELETE CASCADE,
  txn_date    date          NOT NULL DEFAULT current_date,
  description text          NOT NULL,
  category    text          NOT NULL DEFAULT 'General',
  amount      numeric(12,2) NOT NULL,
  txn_type    text          NOT NULL DEFAULT 'expense'
              CHECK (txn_type IN ('expense','top-up','adjustment')),
  receipt_ref text,
  created_at  timestamptz   DEFAULT now()
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

-- ── Mark Phase 3 modules available ───────────────────────────────────────────

UPDATE module_registry
SET is_available = true, updated_at = now()
WHERE key IN ('payroll','attendance','budget','assets','petty-cash');

INSERT INTO industry_module_defaults (industry_slug, module_key, is_default, sort_order)
SELECT iv.slug, m.key, true, 95
FROM industry_verticals iv CROSS JOIN module_registry m
WHERE m.key IN ('payroll','attendance','petty-cash')
  AND iv.slug IN ('retail','food-beverage','wholesale','manufacturing','pharmacy',
                  'professional','construction','transport','hospitality',
                  'auto','agriculture','beauty','financial')
ON CONFLICT (industry_slug, module_key) DO NOTHING;

INSERT INTO industry_module_defaults (industry_slug, module_key, is_default, sort_order)
SELECT iv.slug, m.key, true, 96
FROM industry_verticals iv CROSS JOIN module_registry m
WHERE m.key = 'budget'
  AND iv.slug IN ('manufacturing','professional','construction','transport',
                  'hospitality','financial','wholesale','pharmacy')
ON CONFLICT (industry_slug, module_key) DO NOTHING;

INSERT INTO industry_module_defaults (industry_slug, module_key, is_default, sort_order)
SELECT iv.slug, m.key, true, 97
FROM industry_verticals iv CROSS JOIN module_registry m
WHERE m.key = 'assets'
  AND iv.slug IN ('manufacturing','construction','transport','hospitality',
                  'auto','agriculture','financial','pharmacy')
ON CONFLICT (industry_slug, module_key) DO NOTHING;


-- ============================================================
-- [26] Phase 4 — Industry packs
-- ============================================================

-- ── Restaurant ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id           uuid     DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id  uuid     NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_number text     NOT NULL,
  name         text,
  capacity     smallint NOT NULL DEFAULT 4,
  section      text     DEFAULT 'Main',
  status       text     NOT NULL DEFAULT 'available'
               CHECK (status IN ('available','occupied','reserved','cleaning')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (business_id, table_number)
);

CREATE TABLE IF NOT EXISTS restaurant_orders (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id  uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_id     uuid        REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  covers       smallint    DEFAULT 1,
  opened_at    timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz,
  status       text        NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','settled','cancelled')),
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_order_items (
  id           uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id     uuid         NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,
  business_id  uuid         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_name text         NOT NULL,
  quantity     numeric(8,2) NOT NULL DEFAULT 1,
  unit_price   numeric(10,2) NOT NULL DEFAULT 0,
  notes        text,
  created_at   timestamptz  DEFAULT now()
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

-- ── Pharmacy Rx ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prescriptions (
  id              uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id     uuid  NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  rx_number       text  NOT NULL,
  patient_name    text  NOT NULL,
  patient_phone   text,
  prescriber_name text,
  rx_date         date  NOT NULL DEFAULT current_date,
  status          text  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','dispensed','partial','cancelled')),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (business_id, rx_number)
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id                  uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  prescription_id     uuid          NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  business_id         uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  drug_name           text          NOT NULL,
  dosage_instructions text,
  quantity_prescribed numeric(10,2) NOT NULL DEFAULT 1,
  quantity_dispensed  numeric(10,2) NOT NULL DEFAULT 0,
  batch_number        text,
  expiry_date         date,
  unit_price          numeric(10,2) NOT NULL DEFAULT 0,
  notes               text,
  created_at          timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_business ON prescriptions(business_id, rx_date DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status   ON prescriptions(business_id, status);
CREATE INDEX IF NOT EXISTS idx_rx_items_prescription  ON prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_rx_items_expiry        ON prescription_items(business_id, expiry_date)
  WHERE expiry_date IS NOT NULL;

ALTER TABLE prescriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prescriptions_owner ON prescriptions;
DROP POLICY IF EXISTS rx_items_owner      ON prescription_items;

CREATE POLICY prescriptions_owner ON prescriptions      USING (is_owner_or_staff(business_id));
CREATE POLICY rx_items_owner      ON prescription_items USING (is_owner_or_staff(business_id));

-- ── Hotel Management ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hotel_rooms (
  id             uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id    uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  room_number    text          NOT NULL,
  room_type      text          NOT NULL DEFAULT 'Standard'
                 CHECK (room_type IN ('Standard','Deluxe','Suite','Executive','Family','Dormitory')),
  floor          text,
  capacity       smallint      NOT NULL DEFAULT 2,
  rate_per_night numeric(10,2) NOT NULL DEFAULT 0,
  status         text          NOT NULL DEFAULT 'available'
                 CHECK (status IN ('available','occupied','reserved','maintenance','cleaning')),
  amenities      text,
  created_at     timestamptz   DEFAULT now(),
  UNIQUE (business_id, room_number)
);

CREATE TABLE IF NOT EXISTS hotel_bookings (
  id             uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id    uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  room_id        uuid          REFERENCES hotel_rooms(id) ON DELETE SET NULL,
  guest_name     text          NOT NULL,
  guest_phone    text,
  guest_email    text,
  check_in_date  date          NOT NULL,
  check_out_date date          NOT NULL,
  adults         smallint      NOT NULL DEFAULT 1,
  children       smallint      NOT NULL DEFAULT 0,
  status         text          NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('confirmed','checked-in','checked-out','cancelled','no-show')),
  total_amount   numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount    numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text,
  notes          text,
  created_at     timestamptz   DEFAULT now(),
  updated_at     timestamptz   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hotel_charges (
  id          uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  booking_id  uuid          NOT NULL REFERENCES hotel_bookings(id) ON DELETE CASCADE,
  charge_date date          NOT NULL DEFAULT current_date,
  description text          NOT NULL,
  category    text          NOT NULL DEFAULT 'Accommodation',
  amount      numeric(10,2) NOT NULL,
  created_at  timestamptz   DEFAULT now()
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

-- ── Fleet Management ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id     uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  registration    text          NOT NULL,
  make            text          NOT NULL,
  model           text          NOT NULL,
  year            smallint,
  vehicle_type    text          NOT NULL DEFAULT 'truck'
                  CHECK (vehicle_type IN ('truck','van','sedan','bus','pickup','motorcycle','other')),
  status          text          NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','maintenance','disposed')),
  assigned_driver text,
  fuel_type       text          DEFAULT 'petrol'
                  CHECK (fuel_type IN ('petrol','diesel','electric','lpg')),
  odometer_km     numeric(10,0) DEFAULT 0,
  notes           text,
  created_at      timestamptz   DEFAULT now(),
  UNIQUE (business_id, registration)
);

CREATE TABLE IF NOT EXISTS fleet_logs (
  id          uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  vehicle_id  uuid          NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  log_date    date          NOT NULL DEFAULT current_date,
  log_type    text          NOT NULL DEFAULT 'trip'
              CHECK (log_type IN ('trip','fuel','maintenance','inspection')),
  description text          NOT NULL,
  driver      text,
  origin      text,
  destination text,
  distance_km numeric(8,1),
  fuel_litres numeric(8,2),
  cost        numeric(10,2) NOT NULL DEFAULT 0,
  odometer_end numeric(10,0),
  notes       text,
  created_at  timestamptz   DEFAULT now()
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

-- ── Garage / Job Cards ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_cards (
  id                uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id       uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_number        text          NOT NULL,
  customer_name     text          NOT NULL,
  customer_phone    text,
  vehicle_reg       text          NOT NULL,
  vehicle_make      text,
  vehicle_model     text,
  vehicle_year      smallint,
  complaint         text          NOT NULL,
  diagnosis         text,
  status            text          NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received','in-progress','awaiting-parts','ready','delivered','cancelled')),
  assigned_mechanic text,
  estimated_cost    numeric(10,2) DEFAULT 0,
  actual_cost       numeric(10,2) DEFAULT 0,
  received_date     date          NOT NULL DEFAULT current_date,
  completed_date    date,
  notes             text,
  created_at        timestamptz   DEFAULT now(),
  updated_at        timestamptz   DEFAULT now(),
  UNIQUE (business_id, job_number)
);

CREATE TABLE IF NOT EXISTS job_card_items (
  id          uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  job_card_id uuid          NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  business_id uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  item_type   text          NOT NULL DEFAULT 'labour'
              CHECK (item_type IN ('labour','part')),
  description text          NOT NULL,
  quantity    numeric(8,2)  NOT NULL DEFAULT 1,
  unit_price  numeric(10,2) NOT NULL DEFAULT 0,
  created_at  timestamptz   DEFAULT now()
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

-- ── Farm Management ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS farm_plots (
  id            uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          text         NOT NULL,
  size_hectares numeric(8,2),
  location      text,
  crop_type     text,
  status        text         NOT NULL DEFAULT 'fallow'
                CHECK (status IN ('fallow','planted','growing','harvested')),
  notes         text,
  created_at    timestamptz  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_seasons (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  start_date  date        NOT NULL,
  end_date    date        NOT NULL,
  status      text        NOT NULL DEFAULT 'planning'
              CHECK (status IN ('planning','active','completed')),
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_activities (
  id            uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plot_id       uuid          REFERENCES farm_plots(id) ON DELETE SET NULL,
  season_id     uuid          REFERENCES farm_seasons(id) ON DELETE SET NULL,
  activity_date date          NOT NULL DEFAULT current_date,
  activity_type text          NOT NULL DEFAULT 'other'
                CHECK (activity_type IN ('planting','fertilising','spraying','irrigating','weeding','harvesting','other')),
  description   text          NOT NULL,
  cost          numeric(10,2) DEFAULT 0,
  quantity      numeric(10,2),
  unit          text,
  notes         text,
  created_at    timestamptz   DEFAULT now()
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

-- ── Mark Phase 4 modules available ───────────────────────────────────────────

UPDATE module_registry
SET is_available = true, updated_at = now()
WHERE key IN ('restaurant','pharmacy-rx','hotel-mgmt','fleet','garage','farm-mgmt');

INSERT INTO industry_module_defaults (industry_slug, module_key, is_default, sort_order)
VALUES
  ('food-beverage', 'restaurant',  true, 50),
  ('hospitality',   'restaurant',  true, 51),
  ('hospitality',   'hotel-mgmt',  true, 52),
  ('pharmacy',      'pharmacy-rx', true, 50),
  ('transport',     'fleet',       true, 50),
  ('auto',          'garage',      true, 50),
  ('agriculture',   'farm-mgmt',   true, 50)
ON CONFLICT (industry_slug, module_key) DO NOTHING;


-- ============================================================
-- [27] Phase 5 — Performance indexes + daily summary view
-- ============================================================

-- Phase 3 indexes
CREATE INDEX IF NOT EXISTS idx_attendance_biz_date      ON attendance_records (business_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date     ON attendance_records (business_id, staff_member_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_biz_status        ON budgets (business_id, status);
CREATE INDEX IF NOT EXISTS idx_budget_lines_biz          ON budget_lines (budget_id);
CREATE INDEX IF NOT EXISTS idx_assets_biz_status         ON assets (business_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_biz_category       ON assets (business_id, category);
CREATE INDEX IF NOT EXISTS idx_petty_cash_funds_biz      ON petty_cash_funds (business_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_txns_fund_date ON petty_cash_transactions (fund_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_biz       ON payroll_periods (business_id, period_start DESC);

-- Phase 4 indexes
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_biz_status  ON restaurant_tables (business_id, status);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_biz_status  ON restaurant_orders (business_id, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_order  ON restaurant_order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_biz_status      ON prescriptions (business_id, status, rx_date DESC);
CREATE INDEX IF NOT EXISTS idx_prescription_items_rx         ON prescription_items (prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_expiry     ON prescription_items (prescription_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_biz_status        ON hotel_rooms (business_id, status);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_biz_status     ON hotel_bookings (business_id, status, check_in_date DESC);
CREATE INDEX IF NOT EXISTS idx_hotel_charges_booking_date    ON hotel_charges (booking_id, charge_date DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_biz_status     ON fleet_vehicles (business_id, status);
CREATE INDEX IF NOT EXISTS idx_fleet_logs_vehicle_date       ON fleet_logs (vehicle_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_logs_biz_type           ON fleet_logs (business_id, log_type, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_cards_biz_status          ON job_cards (business_id, status, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_job_card_items_job            ON job_card_items (job_card_id);
CREATE INDEX IF NOT EXISTS idx_farm_plots_biz_status         ON farm_plots (business_id, status);
CREATE INDEX IF NOT EXISTS idx_farm_seasons_biz_status       ON farm_seasons (business_id, status, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_farm_activities_plot_date     ON farm_activities (plot_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_farm_activities_season        ON farm_activities (season_id, activity_date DESC);

-- Core table gap-fill indexes
CREATE INDEX IF NOT EXISTS idx_sales_biz_created          ON sales (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_biz_status_date   ON invoices (business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_biz_qty_reorder   ON products (business_id, quantity, reorder_level);

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
