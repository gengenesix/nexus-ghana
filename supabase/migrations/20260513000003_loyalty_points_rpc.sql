-- Atomic loyalty points increment — prevents overwrite race condition
-- Old code was: UPDATE customers SET loyalty_points = NEW_VALUE (replaces balance)
-- New code uses: UPDATE customers SET loyalty_points = loyalty_points + p_points

CREATE OR REPLACE FUNCTION increment_loyalty_points(
  p_customer_id uuid,
  p_points integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE customers
  SET loyalty_points = loyalty_points + p_points
  WHERE id = p_customer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_loyalty_points(uuid, integer) TO authenticated;
