-- ============================================================
-- Fix: safely add UNIQUE constraint on businesses.owner_id
-- NO DATA IS DELETED. Run this ONCE in Supabase SQL editor.
-- ============================================================

-- Step 1: Check for duplicates (run this first to see if you have any).
-- If this returns rows, you have duplicates. Identify which one has
-- your real data (products, sales, customers) and note its id.
--
-- SELECT owner_id, COUNT(*), array_agg(id ORDER BY created_at) as ids
-- FROM public.businesses
-- GROUP BY owner_id
-- HAVING COUNT(*) > 1;

-- Step 2: Add the UNIQUE constraint.
-- This will FAIL if duplicates exist (that's intentional — it protects your data).
-- If it fails, resolve duplicates manually first (see Step 1 above),
-- then re-run. If it succeeds, you're done.
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_owner_id_unique UNIQUE (owner_id);

-- If the constraint already exists you'll see "already exists" — that's fine, ignore it.
