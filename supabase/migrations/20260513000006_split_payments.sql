-- Store split payment breakdown as JSONB on sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_splits jsonb;
