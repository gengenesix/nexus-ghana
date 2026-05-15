
-- Delivery Notes table
CREATE TABLE public.delivery_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  delivery_number TEXT NOT NULL,
  sales_order_id UUID REFERENCES public.sales_orders(id),
  customer_name TEXT NOT NULL DEFAULT '',
  customer_id UUID REFERENCES public.customers(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  shipping_address TEXT DEFAULT '',
  carrier TEXT DEFAULT '',
  tracking_number TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT '',
  staff_id UUID REFERENCES public.staff_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Credit Notes table
CREATE TABLE public.credit_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  credit_number TEXT NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id),
  customer_name TEXT NOT NULL DEFAULT '',
  customer_id UUID REFERENCES public.customers(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT DEFAULT '',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT DEFAULT '',
  staff_id UUID REFERENCES public.staff_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for delivery_notes
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view delivery notes" ON public.delivery_notes
  FOR SELECT TO public USING (business_id = get_business_id());

CREATE POLICY "Business members can insert delivery notes" ON public.delivery_notes
  FOR INSERT TO public WITH CHECK (business_id = get_business_id());

CREATE POLICY "Business members can update delivery notes" ON public.delivery_notes
  FOR UPDATE TO public USING (business_id = get_business_id());

CREATE POLICY "Business members can delete delivery notes" ON public.delivery_notes
  FOR DELETE TO public USING (business_id = get_business_id());

-- RLS for credit_notes
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view credit notes" ON public.credit_notes
  FOR SELECT TO public USING (business_id = get_business_id());

CREATE POLICY "Business members can insert credit notes" ON public.credit_notes
  FOR INSERT TO public WITH CHECK (business_id = get_business_id());

CREATE POLICY "Business members can update credit notes" ON public.credit_notes
  FOR UPDATE TO public USING (business_id = get_business_id());

CREATE POLICY "Business members can delete credit notes" ON public.credit_notes
  FOR DELETE TO public USING (business_id = get_business_id());
