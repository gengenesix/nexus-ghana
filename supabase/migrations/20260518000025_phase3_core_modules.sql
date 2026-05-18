-- ============================================================
-- Phase 3: Core New Modules
-- Tables: payroll_periods, payroll_entries, attendance_records,
--         budgets, budget_lines, assets, petty_cash_funds,
--         petty_cash_transactions
-- All tables use standard multi-tenant RLS pattern.
-- ============================================================

-- ── 1. Payroll ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payroll_periods (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          text        NOT NULL,                -- "January 2026"
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
  staff_member_id      uuid,                          -- optional link to staff_members
  basic_salary         numeric(12,2) NOT NULL DEFAULT 0,
  housing_allowance    numeric(12,2) NOT NULL DEFAULT 0,
  transport_allowance  numeric(12,2) NOT NULL DEFAULT 0,
  other_allowances     numeric(12,2) NOT NULL DEFAULT 0,
  gross_salary         numeric(12,2) NOT NULL DEFAULT 0,
  ssnit_employee       numeric(12,2) NOT NULL DEFAULT 0,  -- 5.5% of basic
  ssnit_employer       numeric(12,2) NOT NULL DEFAULT 0,  -- 13% of basic
  taxable_income       numeric(12,2) NOT NULL DEFAULT 0,  -- gross - ssnit_employee
  paye                 numeric(12,2) NOT NULL DEFAULT 0,  -- Ghana PAYE
  other_deductions     numeric(12,2) NOT NULL DEFAULT 0,
  net_pay              numeric(12,2) NOT NULL DEFAULT 0,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_business ON payroll_periods(business_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_period ON payroll_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_business ON payroll_entries(business_id);

ALTER TABLE payroll_periods  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries  ENABLE ROW LEVEL SECURITY;

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
  staff_member_id uuid,                               -- link to staff_members
  employee_name   text        NOT NULL,
  attendance_date date        NOT NULL,
  clock_in        time,
  clock_out       time,
  hours_worked    numeric(5,2),                       -- computed or manual
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
  name          text        NOT NULL,                -- "FY 2026", "Q1 2026"
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
  category      text        NOT NULL,                -- "Salaries", "Rent", "Marketing"…
  description   text,
  budgeted      numeric(14,2) NOT NULL DEFAULT 0,
  actual        numeric(14,2) NOT NULL DEFAULT 0,    -- updated manually or via expenses
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
  asset_code        text,                             -- internal tag e.g. "AST-001"
  category          text        NOT NULL DEFAULT 'Other', -- Vehicle, Equipment, Furniture…
  purchase_date     date        NOT NULL,
  purchase_cost     numeric(14,2) NOT NULL DEFAULT 0,
  salvage_value     numeric(14,2) NOT NULL DEFAULT 0,
  useful_life_years smallint    NOT NULL DEFAULT 5,   -- for straight-line depreciation
  depreciation_method text      NOT NULL DEFAULT 'straight-line'
                    CHECK (depreciation_method IN ('straight-line','none')),
  current_value     numeric(14,2),                   -- optional manual override
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
  name          text        NOT NULL,                -- "Main Office", "Branch 1"
  custodian     text,                                -- person responsible
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
  amount        numeric(12,2) NOT NULL,              -- positive = expenditure
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
-- (This updates the DB module_registry to match the frontend industryConfig.ts)

UPDATE module_registry
SET is_available = true,
    updated_at   = now()
WHERE key IN ('payroll','attendance','budget','assets','petty-cash');

-- Add new modules to industry defaults for all industries that benefit
-- (Only inserts where the industry + module combination doesn't already exist)

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
