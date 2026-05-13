-- ============================================================
-- MIGRATION: Schedule mark_overdue_invoices via pg_cron
--
-- Runs daily at 07:50 UTC — 10 minutes before the email digest
-- (08:00 UTC) so overdue triggers fire and in-app notifications
-- are created before the email goes out.
-- ============================================================

-- Enable pg_cron (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent: remove existing job before (re)creating
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'mark-overdue-invoices-daily'
  ) THEN
    PERFORM cron.unschedule('mark-overdue-invoices-daily');
  END IF;
END $$;

-- Schedule: 07:50 UTC every day
SELECT cron.schedule(
  'mark-overdue-invoices-daily',
  '50 7 * * *',
  $$SELECT public.mark_overdue_invoices();$$
);
