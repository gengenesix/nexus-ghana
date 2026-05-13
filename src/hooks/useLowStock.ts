import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

export function useLowStock() {
  const { business } = useBusiness();

  // Refresh when stock changes anywhere
  useRealtimeInvalidate("products", [["low-stock", business?.id]]);

  return useQuery({
    queryKey: ["low-stock", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, qty, reorder_level")
        .eq("business_id", business!.id)
        .order("qty");

      if (error) throw error;
      return (data ?? []).filter((p: any) => p.qty <= p.reorder_level);
    },
    enabled: !!business,
    staleTime: 60_000,
  });
}
