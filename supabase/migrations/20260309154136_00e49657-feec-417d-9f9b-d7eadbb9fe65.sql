
-- Leave requests table for HR module
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL DEFAULT 'annual',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL DEFAULT CURRENT_DATE,
  days integer NOT NULL DEFAULT 1,
  reason text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES public.staff_members(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view leave requests" ON public.leave_requests FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert leave requests" ON public.leave_requests FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update leave requests" ON public.leave_requests FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete leave requests" ON public.leave_requests FOR DELETE USING (business_id = get_business_id());
