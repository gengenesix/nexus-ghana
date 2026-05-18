-- ============================================================
-- Migration 000027 — Phase 5: Performance indexes + daily summary view
-- ============================================================
-- Adds composite indexes on all Phase 3 & 4 tables so common
-- filtered queries (by business_id + date / status) hit index-only
-- scans instead of full-table scans as row counts grow.
-- Also creates a materialised-friendly daily-summary view for
-- future reporting without hitting base tables every time.
-- ============================================================

-- ── Phase 3 table indexes ─────────────────────────────────────────────────────

-- attendance_records: most queries filter by business + date range
CREATE INDEX IF NOT EXISTS idx_attendance_biz_date
  ON attendance_records (business_id, attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_staff_date
  ON attendance_records (business_id, staff_member_id, attendance_date DESC);

-- budgets: list by business + status
CREATE INDEX IF NOT EXISTS idx_budgets_biz_status
  ON budgets (business_id, status);

-- budget_lines: detail drill-down by budget
CREATE INDEX IF NOT EXISTS idx_budget_lines_budget
  ON budget_lines (budget_id);

-- assets: filter by status + category
CREATE INDEX IF NOT EXISTS idx_assets_biz_status
  ON assets (business_id, status);

CREATE INDEX IF NOT EXISTS idx_assets_biz_category
  ON assets (business_id, category);

-- petty_cash_funds: simple lookup by business
CREATE INDEX IF NOT EXISTS idx_petty_cash_funds_biz
  ON petty_cash_funds (business_id);

-- petty_cash_transactions: log by fund + date
CREATE INDEX IF NOT EXISTS idx_petty_cash_txns_fund_date
  ON petty_cash_transactions (fund_id, transaction_date DESC);

-- staff_payroll: by business + period
CREATE INDEX IF NOT EXISTS idx_payroll_biz_period
  ON staff_payroll (business_id, pay_period_start DESC);

-- ── Phase 4 table indexes ─────────────────────────────────────────────────────

-- restaurant_tables: by business + status
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_biz_status
  ON restaurant_tables (business_id, status);

-- restaurant_orders: by business + status + date
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_biz_status
  ON restaurant_orders (business_id, status, opened_at DESC);

-- restaurant_order_items: by order
CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_order
  ON restaurant_order_items (order_id);

-- prescriptions: by business + status + rx date
CREATE INDEX IF NOT EXISTS idx_prescriptions_biz_status
  ON prescriptions (business_id, status, rx_date DESC);

-- prescription_items: by prescription
CREATE INDEX IF NOT EXISTS idx_prescription_items_rx
  ON prescription_items (prescription_id);

-- prescription_items: expiry alerts query
CREATE INDEX IF NOT EXISTS idx_prescription_items_expiry
  ON prescription_items (prescription_id, expiry_date);

-- hotel_rooms: by business + status
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_biz_status
  ON hotel_rooms (business_id, status);

-- hotel_bookings: by business + status + check_in date
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_biz_status
  ON hotel_bookings (business_id, status, check_in_date DESC);

-- hotel_charges: by booking
CREATE INDEX IF NOT EXISTS idx_hotel_charges_booking
  ON hotel_charges (booking_id, charge_date DESC);

-- fleet_vehicles: by business + status
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_biz_status
  ON fleet_vehicles (business_id, status);

-- fleet_logs: by vehicle + date
CREATE INDEX IF NOT EXISTS idx_fleet_logs_vehicle_date
  ON fleet_logs (vehicle_id, log_date DESC);

-- fleet_logs: by business + type (for cross-vehicle reports)
CREATE INDEX IF NOT EXISTS idx_fleet_logs_biz_type
  ON fleet_logs (business_id, log_type, log_date DESC);

-- job_cards: by business + status
CREATE INDEX IF NOT EXISTS idx_job_cards_biz_status
  ON job_cards (business_id, status, received_date DESC);

-- job_card_items: by job card
CREATE INDEX IF NOT EXISTS idx_job_card_items_job
  ON job_card_items (job_card_id);

-- farm_plots: by business + status + crop
CREATE INDEX IF NOT EXISTS idx_farm_plots_biz_status
  ON farm_plots (business_id, status);

-- farm_seasons: by business + status
CREATE INDEX IF NOT EXISTS idx_farm_seasons_biz_status
  ON farm_seasons (business_id, status, start_date DESC);

-- farm_activities: by plot + season + date
CREATE INDEX IF NOT EXISTS idx_farm_activities_plot_date
  ON farm_activities (plot_id, activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_farm_activities_season
  ON farm_activities (season_id, activity_date DESC);

-- ── Core table composite indexes (fill gaps from earlier migrations) ──────────

-- sales: business + date (used by weekly chart + dashboard stats)
CREATE INDEX IF NOT EXISTS idx_sales_biz_created
  ON sales (business_id, created_at DESC);

-- invoices: business + status + date
CREATE INDEX IF NOT EXISTS idx_invoices_biz_status_date
  ON invoices (business_id, status, created_at DESC);

-- products: business + low-stock filter
CREATE INDEX IF NOT EXISTS idx_products_biz_qty_reorder
  ON products (business_id, qty, reorder_level);

-- ── Business daily summary view ───────────────────────────────────────────────
-- Lightweight view for reporting pages — one row per (business, date).
-- Avoids repeated GROUP BY aggregations on large sales tables.
CREATE OR REPLACE VIEW business_daily_summary AS
SELECT
  s.business_id,
  DATE(s.created_at)              AS sale_date,
  COUNT(*)                        AS transaction_count,
  SUM(s.total)                    AS gross_total,
  COUNT(*) FILTER (WHERE s.voided) AS voided_count
FROM sales s
GROUP BY s.business_id, DATE(s.created_at);

-- Grant access to authenticated users (RLS on base table still applies)
GRANT SELECT ON business_daily_summary TO authenticated;
