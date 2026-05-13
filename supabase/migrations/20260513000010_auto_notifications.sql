-- ============================================================
-- MIGRATION: Auto in-app notifications
--
-- 1. Ensure notifications table exists with correct schema
-- 2. Trigger: notify when invoice status → 'overdue'
-- 3. Trigger: notify when product qty drops to/below reorder_level
-- 4. RPC: mark_overdue_invoices() — run daily via cron
-- ============================================================

-- ── Notifications table (create if not exists) ────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type        text        NOT NULL DEFAULT 'info',   -- info | warning | error | success
  title       text        NOT NULL,
  message     text        NOT NULL DEFAULT '',
  is_read     boolean     NOT NULL DEFAULT false,
  link        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Business members can view notifications'
  ) THEN
    CREATE POLICY "Business members can view notifications"
      ON public.notifications FOR SELECT
      USING (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'Business members can update notifications'
  ) THEN
    CREATE POLICY "Business members can update notifications"
      ON public.notifications FOR UPDATE
      USING (business_id = public.get_business_id());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications' AND policyname = 'System can insert notifications'
  ) THEN
    CREATE POLICY "System can insert notifications"
      ON public.notifications FOR INSERT
      WITH CHECK (true);  -- service role & triggers insert freely
  END IF;
END $$;

-- ── Trigger: invoice status changes to overdue ────────────────
CREATE OR REPLACE FUNCTION public.notify_invoice_overdue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when transitioning INTO 'overdue'
  IF NEW.status = 'overdue' AND (OLD.status IS DISTINCT FROM 'overdue') THEN
    INSERT INTO public.notifications (business_id, type, title, message, link)
    VALUES (
      NEW.business_id,
      'warning',
      'Invoice Overdue: ' || NEW.invoice_number,
      NEW.customer_name || ' — GHS ' || to_char(NEW.total, 'FM999,999,990.00') || ' overdue since ' || NEW.due_date,
      '/invoices'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_overdue ON public.invoices;
CREATE TRIGGER trg_invoice_overdue
  AFTER INSERT OR UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.notify_invoice_overdue();

-- ── Trigger: product stock drops to/below reorder level ──────
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fire when qty crosses DOWN through reorder_level
  IF NEW.qty <= NEW.reorder_level AND OLD.qty > OLD.reorder_level THEN
    INSERT INTO public.notifications (business_id, type, title, message, link)
    VALUES (
      NEW.business_id,
      CASE WHEN NEW.qty = 0 THEN 'error' ELSE 'warning' END,
      CASE WHEN NEW.qty = 0 THEN 'Out of Stock: ' || NEW.name
           ELSE 'Low Stock: ' || NEW.name END,
      CASE WHEN NEW.qty = 0 THEN NEW.name || ' is out of stock — restock immediately.'
           ELSE NEW.name || ' has only ' || NEW.qty || ' units left (reorder at ' || NEW.reorder_level || ').' END,
      '/inventory'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_low_stock ON public.products;
CREATE TRIGGER trg_low_stock
  AFTER UPDATE OF qty ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();

-- ── RPC: mark_overdue_invoices — call daily via pg_cron ──────
-- Updates invoices whose due_date has passed to status='overdue'
-- (which fires the trigger above, creating notifications)
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated integer;
BEGIN
  UPDATE public.invoices
     SET status = 'overdue'
   WHERE status IN ('sent', 'partial')
     AND due_date < CURRENT_DATE::text;

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_overdue_invoices() TO service_role;
