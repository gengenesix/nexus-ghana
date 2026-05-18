-- ============================================================
-- Migration 000028 — Approval requests table + RLS patch
-- Creates approval_requests if it doesn't exist and ensures
-- the RLS update policy allows the business owner to approve.
-- All statements are idempotent.
-- ============================================================

-- ── 1. Create table if it doesn't exist ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requested_by   uuid        REFERENCES public.staff_members(id),   -- nullable so owner can also create
  requester_name text        NOT NULL DEFAULT '',
  action_type    text        NOT NULL,
  module         text        NOT NULL,
  payload        jsonb       NOT NULL DEFAULT '{}',
  status         text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected')),
  reviewed_by    uuid        REFERENCES public.staff_members(id),
  reviewer_name  text        NOT NULL DEFAULT '',
  reviewer_note  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_at    timestamptz
);

-- Make requested_by nullable if it was created with NOT NULL constraint before
ALTER TABLE public.approval_requests
  ALTER COLUMN requested_by DROP NOT NULL;

CREATE INDEX IF NOT EXISTS approval_requests_business_status
  ON public.approval_requests(business_id, status, created_at DESC);

-- ── 2. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- Drop old policies (idempotent)
DROP POLICY IF EXISTS "approval_requests_read"   ON public.approval_requests;
DROP POLICY IF EXISTS "approval_requests_insert" ON public.approval_requests;
DROP POLICY IF EXISTS "approval_requests_update" ON public.approval_requests;
DROP POLICY IF EXISTS "approval_requests_delete" ON public.approval_requests;

-- SELECT: any member of the business
CREATE POLICY "approval_requests_read" ON public.approval_requests
  FOR SELECT USING (business_id = get_business_id());

-- INSERT: any member of the business (staff create requests, owner rarely)
CREATE POLICY "approval_requests_insert" ON public.approval_requests
  FOR INSERT WITH CHECK (business_id = get_business_id());

-- UPDATE: any member of the business (owner approves/rejects)
CREATE POLICY "approval_requests_update" ON public.approval_requests
  FOR UPDATE USING (business_id = get_business_id());

-- ── 3. Grant to authenticated role ────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO authenticated;

-- ── 4. Ensure leave_requests UPDATE policy exists ─────────────────────────
-- (already created by old migration, but recreate defensively)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'leave_requests'
      AND policyname = 'Business members can update leave requests'
  ) THEN
    CREATE POLICY "Business members can update leave requests"
      ON public.leave_requests FOR UPDATE
      USING (business_id = get_business_id());
  END IF;
END;
$$;

-- ── 5. Ensure journal_entries UPDATE policy exists ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'journal_entries'
      AND policyname = 'Business members can update journal entries'
  ) THEN
    CREATE POLICY "Business members can update journal entries"
      ON public.journal_entries FOR UPDATE
      USING (business_id = get_business_id());
  END IF;
END;
$$;
