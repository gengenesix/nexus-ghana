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
