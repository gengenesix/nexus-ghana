-- ─── 5.2  Barcode column on products ────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode text;

-- ─── 5.1  Loyalty points deduction RPC ──────────────────────────────────────
CREATE OR REPLACE FUNCTION decrement_loyalty_points(
  p_customer_id uuid,
  p_points       integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE customers
  SET loyalty_points = GREATEST(0, loyalty_points - p_points)
  WHERE id = p_customer_id;
END;
$$;
GRANT EXECUTE ON FUNCTION decrement_loyalty_points(uuid, integer) TO authenticated;

-- ─── 5.6  Purchase order items table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id       uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES public.products(id),
  description text NOT NULL,
  qty         numeric NOT NULL DEFAULT 1,
  unit_price  numeric NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_items_select" ON public.purchase_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_id
        AND po.business_id = get_business_id()
    )
  );

CREATE POLICY "po_items_insert" ON public.purchase_order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_id
        AND po.business_id = get_business_id()
    )
  );

CREATE POLICY "po_items_delete" ON public.purchase_order_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = po_id
        AND po.business_id = get_business_id()
    )
  );

-- ─── 5.6  Receive purchase order RPC ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION receive_purchase_order(
  p_po_id       uuid,
  p_business_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE id = p_po_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE id = p_po_id AND status = 'received'
  ) THEN
    RAISE EXCEPTION 'Purchase order already received';
  END IF;

  -- Increment stock for items linked to a product
  UPDATE products p
  SET qty = p.qty + poi.qty,
      updated_at = now()
  FROM purchase_order_items poi
  WHERE poi.po_id = p_po_id
    AND poi.product_id = p.id;

  -- Mark PO received
  UPDATE purchase_orders
  SET status = 'received'
  WHERE id = p_po_id;
END;
$$;
GRANT EXECUTE ON FUNCTION receive_purchase_order(uuid, uuid) TO authenticated;
