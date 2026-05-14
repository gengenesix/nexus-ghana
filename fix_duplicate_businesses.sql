-- ============================================================
-- Fix: clean up duplicate businesses + add UNIQUE constraint
-- Run this ONCE in Supabase SQL editor.
-- ============================================================

-- Step 1: Remove duplicate rows, keeping the OLDEST business per owner.
-- This is safe because the oldest one is the one the user originally set up.
DELETE FROM public.businesses
WHERE id NOT IN (
  SELECT DISTINCT ON (owner_id) id
  FROM public.businesses
  ORDER BY owner_id, created_at ASC
);

-- Step 2: Add a UNIQUE constraint so the DB itself enforces one business
-- per owner going forward. If this errors with "already exists", you're fine.
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_owner_id_unique UNIQUE (owner_id);
