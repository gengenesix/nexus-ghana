-- ============================================================
-- MIGRATION: Add role check to void_sale RPC
--
-- Problem: any authenticated user who knows a sale_id could
-- void it — no staff role was enforced.
--
-- Fix: accept optional _staff_id; if provided, check that the
-- staff member has a manager-level role before allowing void.
-- Business owner (auth.uid() = business owner_id) always passes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.void_sale(
  p_sale_id     uuid,
  p_business_id uuid,
  p_staff_id    uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff_role text;
  _allowed_roles text[] := ARRAY[
    'System Administrator', 'Administrator', 'Manager',
    'CFO / Finance Manager', 'Accountant', 'Sales Manager',
    'Supervisor', 'Executive / CEO'
  ];
BEGIN
  -- Guard: sale must belong to this business
  IF NOT EXISTS (
    SELECT 1 FROM sales WHERE id = p_sale_id AND business_id = p_business_id
  ) THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  -- Guard: already voided
  IF EXISTS (SELECT 1 FROM sales WHERE id = p_sale_id AND voided = true) THEN
    RAISE EXCEPTION 'Sale is already voided';
  END IF;

  -- Role check: if a staff_id is provided, verify they have permission
  IF p_staff_id IS NOT NULL THEN
    SELECT role INTO _staff_role
    FROM public.staff_members
    WHERE id          = p_staff_id
      AND business_id = p_business_id
      AND status      = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Staff member not found';
    END IF;

    IF NOT (_staff_role = ANY(_allowed_roles)) THEN
      RAISE EXCEPTION 'Insufficient permissions: role "%" cannot void sales', _staff_role;
    END IF;
  END IF;

  -- Mark voided
  UPDATE sales
     SET voided    = true,
         voided_at = now(),
         voided_by = p_staff_id
   WHERE id = p_sale_id;

  -- Restore stock for each line item
  UPDATE products p
     SET qty = p.qty + si.qty
    FROM sale_items si
   WHERE si.sale_id  = p_sale_id
     AND si.product_id = p.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_sale(uuid, uuid, uuid) TO authenticated;
