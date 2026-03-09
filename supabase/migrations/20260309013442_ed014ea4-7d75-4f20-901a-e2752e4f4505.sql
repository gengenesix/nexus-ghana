-- Drop dependent indexes first, then move extension to extensions schema
DROP INDEX IF EXISTS idx_products_name_search;
DROP INDEX IF EXISTS idx_customers_name_search;

DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Recreate trigram indexes
CREATE INDEX IF NOT EXISTS idx_products_name_search ON public.products USING gin(name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_name_search ON public.customers USING gin(name extensions.gin_trgm_ops);