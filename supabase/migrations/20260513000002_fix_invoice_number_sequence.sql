-- ============================================================
-- MIGRATION: Fix invoice number race condition
-- Replace MAX()-based generation with an atomic per-business counter
-- using SELECT ... FOR UPDATE to prevent duplicate invoice numbers
-- under concurrent usage.
-- ============================================================

-- Atomic counter table — one row per business per year
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  year        integer NOT NULL,
  last_value  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, year)
);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business owner can manage invoice counters"
  ON public.invoice_counters
  FOR ALL
  USING (business_id = public.get_business_id())
  WITH CHECK (business_id = public.get_business_id());

-- Seed counters from existing invoices so numbering continues correctly
INSERT INTO public.invoice_counters (business_id, year, last_value)
SELECT
  business_id,
  EXTRACT(YEAR FROM CURRENT_DATE)::integer AS year,
  COALESCE(
    MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS integer)),
    0
  ) AS last_value
FROM public.invoices
WHERE invoice_number LIKE 'NXG-%'
GROUP BY business_id
ON CONFLICT (business_id, year) DO UPDATE
  SET last_value = GREATEST(invoice_counters.last_value, EXCLUDED.last_value);

-- Drop old function
DROP FUNCTION IF EXISTS public.generate_invoice_number();

-- New atomic invoice number generator
-- Uses SELECT ... FOR UPDATE to lock the counter row, preventing races
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _business_id uuid;
  _year        integer;
  _next        integer;
  _year_str    text;
BEGIN
  _business_id := public.get_business_id();
  _year        := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  _year_str    := _year::text;

  -- Upsert the counter row, then lock it for this transaction
  INSERT INTO public.invoice_counters (business_id, year, last_value)
  VALUES (_business_id, _year, 0)
  ON CONFLICT (business_id, year) DO NOTHING;

  -- Atomic increment — row is locked until transaction commits
  UPDATE public.invoice_counters
  SET last_value = last_value + 1
  WHERE business_id = _business_id
    AND year = _year
  RETURNING last_value INTO _next;

  RETURN 'NXG-' || _year_str || '-' || LPAD(_next::text, 3, '0');
END;
$$;
