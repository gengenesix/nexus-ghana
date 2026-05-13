-- Add voided flag to sales table
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS voided boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES staff(id);

-- RPC: void a sale and restore stock atomically
CREATE OR REPLACE FUNCTION void_sale(
  p_sale_id uuid,
  p_business_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Guard: must belong to same business
  IF NOT EXISTS (
    SELECT 1 FROM sales WHERE id = p_sale_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  -- Guard: already voided
  IF EXISTS (SELECT 1 FROM sales WHERE id = p_sale_id AND voided = true) THEN
    RAISE EXCEPTION 'Sale is already voided';
  END IF;

  -- Mark voided
  UPDATE sales
  SET voided = true, voided_at = now()
  WHERE id = p_sale_id;

  -- Restore stock for each line item
  UPDATE products p
  SET qty = p.qty + si.qty
  FROM sale_items si
  WHERE si.sale_id = p_sale_id
    AND si.product_id = p.id;
END;
$$;

GRANT EXECUTE ON FUNCTION void_sale(uuid, uuid) TO authenticated;
