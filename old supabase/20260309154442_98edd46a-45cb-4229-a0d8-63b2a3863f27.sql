
-- Price lists for customer group pricing
CREATE TABLE public.price_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  currency text NOT NULL DEFAULT 'GHS',
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.price_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id uuid NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price numeric NOT NULL DEFAULT 0,
  min_quantity integer NOT NULL DEFAULT 1,
  discount_percent numeric NOT NULL DEFAULT 0
);

-- Commission tracking
CREATE TABLE public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff_members(id),
  invoice_id uuid REFERENCES public.invoices(id),
  sale_id uuid REFERENCES public.sales(id),
  amount numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0,
  base_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Bank reconciliation records
CREATE TABLE public.bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  statement_date date NOT NULL DEFAULT CURRENT_DATE,
  statement_balance numeric NOT NULL DEFAULT 0,
  system_balance numeric NOT NULL DEFAULT 0,
  difference numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid NOT NULL REFERENCES public.bank_reconciliations(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL DEFAULT '',
  reference text DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'debit',
  matched boolean NOT NULL DEFAULT false,
  payment_id uuid REFERENCES public.payments(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Credit limit on customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS outstanding_balance numeric DEFAULT 0;

-- Enable RLS
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_items ENABLE ROW LEVEL SECURITY;

-- Price lists policies
CREATE POLICY "Business members can view price lists" ON public.price_lists FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert price lists" ON public.price_lists FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update price lists" ON public.price_lists FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete price lists" ON public.price_lists FOR DELETE USING (business_id = get_business_id());

-- Price list items policies
CREATE POLICY "Business members can view price list items" ON public.price_list_items FOR SELECT USING (EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = price_list_items.price_list_id AND pl.business_id = get_business_id()));
CREATE POLICY "Business members can insert price list items" ON public.price_list_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = price_list_items.price_list_id AND pl.business_id = get_business_id()));
CREATE POLICY "Business members can update price list items" ON public.price_list_items FOR UPDATE USING (EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = price_list_items.price_list_id AND pl.business_id = get_business_id()));
CREATE POLICY "Business members can delete price list items" ON public.price_list_items FOR DELETE USING (EXISTS (SELECT 1 FROM price_lists pl WHERE pl.id = price_list_items.price_list_id AND pl.business_id = get_business_id()));

-- Commissions policies
CREATE POLICY "Business members can view commissions" ON public.commissions FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert commissions" ON public.commissions FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update commissions" ON public.commissions FOR UPDATE USING (business_id = get_business_id());

-- Bank reconciliation policies
CREATE POLICY "Business members can view reconciliations" ON public.bank_reconciliations FOR SELECT USING (business_id = get_business_id());
CREATE POLICY "Business members can insert reconciliations" ON public.bank_reconciliations FOR INSERT WITH CHECK (business_id = get_business_id());
CREATE POLICY "Business members can update reconciliations" ON public.bank_reconciliations FOR UPDATE USING (business_id = get_business_id());
CREATE POLICY "Business members can delete reconciliations" ON public.bank_reconciliations FOR DELETE USING (business_id = get_business_id());

-- Reconciliation items policies
CREATE POLICY "Business members can view recon items" ON public.reconciliation_items FOR SELECT USING (EXISTS (SELECT 1 FROM bank_reconciliations br WHERE br.id = reconciliation_items.reconciliation_id AND br.business_id = get_business_id()));
CREATE POLICY "Business members can insert recon items" ON public.reconciliation_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM bank_reconciliations br WHERE br.id = reconciliation_items.reconciliation_id AND br.business_id = get_business_id()));
CREATE POLICY "Business members can update recon items" ON public.reconciliation_items FOR UPDATE USING (EXISTS (SELECT 1 FROM bank_reconciliations br WHERE br.id = reconciliation_items.reconciliation_id AND br.business_id = get_business_id()));
