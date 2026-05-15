
-- Recurring invoices table
CREATE TABLE public.recurring_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT 'monthly',
  next_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  apply_vat BOOLEAN NOT NULL DEFAULT true,
  apply_nhil BOOLEAN NOT NULL DEFAULT true,
  apply_getfl BOOLEAN NOT NULL DEFAULT true,
  notes TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view recurring invoices" ON public.recurring_invoices FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert recurring invoices" ON public.recurring_invoices FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update recurring invoices" ON public.recurring_invoices FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete recurring invoices" ON public.recurring_invoices FOR DELETE USING (business_id = get_business_id());

-- Serial/batch tracking
CREATE TABLE public.serial_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL,
  batch_number TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available',
  received_date DATE DEFAULT CURRENT_DATE,
  sold_date DATE,
  warranty_end DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.serial_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view serial numbers" ON public.serial_numbers FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert serial numbers" ON public.serial_numbers FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update serial numbers" ON public.serial_numbers FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete serial numbers" ON public.serial_numbers FOR DELETE USING (business_id = get_business_id());

-- Exchange rates for multi-currency
CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  from_currency TEXT NOT NULL DEFAULT 'USD',
  to_currency TEXT NOT NULL DEFAULT 'GHS',
  rate NUMERIC NOT NULL DEFAULT 1,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view exchange rates" ON public.exchange_rates FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert exchange rates" ON public.exchange_rates FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update exchange rates" ON public.exchange_rates FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete exchange rates" ON public.exchange_rates FOR DELETE USING (business_id = get_business_id());

-- Attachments table
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL DEFAULT '',
  record_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  mime_type TEXT DEFAULT '',
  uploaded_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view attachments" ON public.attachments FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert attachments" ON public.attachments FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can delete attachments" ON public.attachments FOR DELETE USING (business_id = get_business_id());

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "Anyone can view attachments" ON storage.objects FOR SELECT USING (bucket_id = 'attachments');
CREATE POLICY "Authenticated users can delete attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'attachments');
