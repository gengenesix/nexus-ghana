-- ============================================================
-- MIGRATION: Service contracts + customer equipment tables
-- ============================================================

-- ── Service Contracts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_contracts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id      uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name    text        NOT NULL,
  contract_number  text        NOT NULL,
  type             text        NOT NULL DEFAULT 'maintenance',  -- maintenance|warranty|service|support
  start_date       date        NOT NULL,
  end_date         date        NOT NULL,
  value            numeric     NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'active',       -- active|expired|cancelled|pending
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_contracts' AND policyname = 'sc_select') THEN
    CREATE POLICY "sc_select" ON public.service_contracts FOR SELECT USING (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_contracts' AND policyname = 'sc_insert') THEN
    CREATE POLICY "sc_insert" ON public.service_contracts FOR INSERT WITH CHECK (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_contracts' AND policyname = 'sc_update') THEN
    CREATE POLICY "sc_update" ON public.service_contracts FOR UPDATE USING (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_contracts' AND policyname = 'sc_delete') THEN
    CREATE POLICY "sc_delete" ON public.service_contracts FOR DELETE USING (business_id = public.get_business_id());
  END IF;
END $$;

-- ── Customer Equipment ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_equipment (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id     uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name   text        NOT NULL,
  product_id      uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  serial_number   text,
  model           text,
  brand           text,
  purchase_date   date,
  warranty_end    date,
  status          text        NOT NULL DEFAULT 'active',  -- active|retired|lost
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_equipment ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_equipment' AND policyname = 'ce_select') THEN
    CREATE POLICY "ce_select" ON public.customer_equipment FOR SELECT USING (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_equipment' AND policyname = 'ce_insert') THEN
    CREATE POLICY "ce_insert" ON public.customer_equipment FOR INSERT WITH CHECK (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_equipment' AND policyname = 'ce_update') THEN
    CREATE POLICY "ce_update" ON public.customer_equipment FOR UPDATE USING (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_equipment' AND policyname = 'ce_delete') THEN
    CREATE POLICY "ce_delete" ON public.customer_equipment FOR DELETE USING (business_id = public.get_business_id());
  END IF;
END $$;
