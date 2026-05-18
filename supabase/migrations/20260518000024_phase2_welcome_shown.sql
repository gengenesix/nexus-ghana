-- ============================================================
-- Phase 2: Welcome screen flag
-- Adds welcome_shown to businesses so we only show the
-- post-onboarding welcome screen once per business.
-- ============================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS welcome_shown boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN businesses.welcome_shown IS
  'Phase 2 — true once the business owner has seen the post-onboarding welcome screen.';

-- Fast lookup so BusinessGuard can filter efficiently
CREATE INDEX IF NOT EXISTS idx_businesses_welcome_shown
  ON businesses(owner_id, welcome_shown)
  WHERE welcome_shown = false;
