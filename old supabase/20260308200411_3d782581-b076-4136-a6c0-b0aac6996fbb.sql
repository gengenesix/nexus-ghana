
-- Profiles table (auto-created on signup)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Businesses table
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  region text DEFAULT '',
  address text DEFAULT '',
  logo_url text,
  momo_merchant_mtn text DEFAULT '',
  momo_merchant_telecel text DEFAULT '',
  momo_merchant_airteltigo text DEFAULT '',
  tax_vat boolean NOT NULL DEFAULT true,
  tax_nhil boolean NOT NULL DEFAULT true,
  tax_getfl boolean NOT NULL DEFAULT true,
  receipt_header text DEFAULT '',
  receipt_footer text DEFAULT '',
  receipt_show_logo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own businesses" ON public.businesses FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own businesses" ON public.businesses FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own businesses" ON public.businesses FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own businesses" ON public.businesses FOR DELETE USING (auth.uid() = owner_id);

-- Helper function to get user's business_id
CREATE OR REPLACE FUNCTION public.get_business_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.businesses WHERE owner_id = auth.uid() LIMIT 1
$$;

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view categories" ON public.categories FOR SELECT USING (business_id = public.get_business_id());
CREATE POLICY "Business members can insert categories" ON public.categories FOR INSERT WITH CHECK (business_id = public.get_business_id());
CREATE POLICY "Business members can update categories" ON public.categories FOR UPDATE USING (business_id = public.get_business_id());
CREATE POLICY "Business members can delete categories" ON public.categories FOR DELETE USING (business_id = public.get_business_id());

-- Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  sku text DEFAULT '',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  qty integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 10,
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view products" ON public.products FOR SELECT USING (business_id = public.get_business_id());
CREATE POLICY "Business members can insert products" ON public.products FOR INSERT WITH CHECK (business_id = public.get_business_id());
CREATE POLICY "Business members can update products" ON public.products FOR UPDATE USING (business_id = public.get_business_id());
CREATE POLICY "Business members can delete products" ON public.products FOR DELETE USING (business_id = public.get_business_id());

-- Customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  region text DEFAULT '',
  notes text DEFAULT '',
  loyalty_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view customers" ON public.customers FOR SELECT USING (business_id = public.get_business_id());
CREATE POLICY "Business members can insert customers" ON public.customers FOR INSERT WITH CHECK (business_id = public.get_business_id());
CREATE POLICY "Business members can update customers" ON public.customers FOR UPDATE USING (business_id = public.get_business_id());
CREATE POLICY "Business members can delete customers" ON public.customers FOR DELETE USING (business_id = public.get_business_id());

-- Suppliers
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  contact_person text DEFAULT '',
  phone text DEFAULT '',
  location text DEFAULT '',
  products_supplied text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view suppliers" ON public.suppliers FOR SELECT USING (business_id = public.get_business_id());
CREATE POLICY "Business members can insert suppliers" ON public.suppliers FOR INSERT WITH CHECK (business_id = public.get_business_id());
CREATE POLICY "Business members can update suppliers" ON public.suppliers FOR UPDATE USING (business_id = public.get_business_id());
CREATE POLICY "Business members can delete suppliers" ON public.suppliers FOR DELETE USING (business_id = public.get_business_id());

-- Staff members (business staff, not auth users)
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'Staff',
  phone text DEFAULT '',
  email text DEFAULT '',
  pin text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view staff" ON public.staff_members FOR SELECT USING (business_id = public.get_business_id());
CREATE POLICY "Business members can insert staff" ON public.staff_members FOR INSERT WITH CHECK (business_id = public.get_business_id());
CREATE POLICY "Business members can update staff" ON public.staff_members FOR UPDATE USING (business_id = public.get_business_id());
CREATE POLICY "Business members can delete staff" ON public.staff_members FOR DELETE USING (business_id = public.get_business_id());

-- Sales
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  receipt_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view sales" ON public.sales FOR SELECT USING (business_id = public.get_business_id());
CREATE POLICY "Business members can insert sales" ON public.sales FOR INSERT WITH CHECK (business_id = public.get_business_id());

-- Sale items
CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view sale items" ON public.sale_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.business_id = public.get_business_id())
);
CREATE POLICY "Business members can insert sale items" ON public.sale_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND sales.business_id = public.get_business_id())
);

-- Invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  invoice_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  nhil_amount numeric(12,2) NOT NULL DEFAULT 0,
  getfl_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  apply_vat boolean NOT NULL DEFAULT true,
  apply_nhil boolean NOT NULL DEFAULT true,
  apply_getfl boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view invoices" ON public.invoices FOR SELECT USING (business_id = public.get_business_id());
CREATE POLICY "Business members can insert invoices" ON public.invoices FOR INSERT WITH CHECK (business_id = public.get_business_id());
CREATE POLICY "Business members can update invoices" ON public.invoices FOR UPDATE USING (business_id = public.get_business_id());
CREATE POLICY "Business members can delete invoices" ON public.invoices FOR DELETE USING (business_id = public.get_business_id());

-- Invoice items
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  qty integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0
);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view invoice items" ON public.invoice_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.business_id = public.get_business_id())
);
CREATE POLICY "Business members can insert invoice items" ON public.invoice_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.business_id = public.get_business_id())
);
CREATE POLICY "Business members can delete invoice items" ON public.invoice_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.business_id = public.get_business_id())
);

-- Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  description text DEFAULT '',
  paid_by text DEFAULT 'Cash',
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view expenses" ON public.expenses FOR SELECT USING (business_id = public.get_business_id());
CREATE POLICY "Business members can insert expenses" ON public.expenses FOR INSERT WITH CHECK (business_id = public.get_business_id());
CREATE POLICY "Business members can update expenses" ON public.expenses FOR UPDATE USING (business_id = public.get_business_id());
CREATE POLICY "Business members can delete expenses" ON public.expenses FOR DELETE USING (business_id = public.get_business_id());

-- Invoice number sequence function
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
  year_str text;
BEGIN
  year_str := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS integer)
  ), 0) + 1
  INTO next_num
  FROM public.invoices
  WHERE business_id = public.get_business_id()
    AND invoice_number LIKE 'NXG-' || year_str || '-%';
  RETURN 'NXG-' || year_str || '-' || LPAD(next_num::text, 3, '0');
END;
$$;

-- Function to decrement product stock on sale
CREATE OR REPLACE FUNCTION public.handle_sale_item_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET qty = qty - NEW.qty, updated_at = now()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_sale_item_created
  AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_sale_item_stock();
