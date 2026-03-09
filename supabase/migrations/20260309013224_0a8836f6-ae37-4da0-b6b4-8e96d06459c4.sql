-- Enable trigram extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Business lookups by owner
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON public.businesses(owner_id);

-- Product queries
CREATE INDEX IF NOT EXISTS idx_products_business_id ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name_search ON public.products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku) WHERE sku IS NOT NULL AND sku != '';

-- Sales performance indexes
CREATE INDEX IF NOT EXISTS idx_sales_business_id ON public.sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_business_date ON public.sales(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id) WHERE customer_id IS NOT NULL;

-- Sale items
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id) WHERE product_id IS NOT NULL;

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_business_id ON public.invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_business_date ON public.invoices(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(business_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_name_search ON public.customers USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone) WHERE phone IS NOT NULL AND phone != '';

-- Suppliers, Staff, Expenses, Categories
CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON public.suppliers(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_business_id ON public.staff_members(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_status ON public.staff_members(business_id, status);
CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON public.expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_business_date ON public.expenses(business_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(business_id, category);
CREATE INDEX IF NOT EXISTS idx_categories_business_id ON public.categories(business_id);

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_products_business_category_name ON public.products(business_id, category_id, name);
CREATE INDEX IF NOT EXISTS idx_sales_business_payment ON public.sales(business_id, payment_method, created_at DESC);