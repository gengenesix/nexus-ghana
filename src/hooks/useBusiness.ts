import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  phone: string;
  email: string;
  region: string;
  address: string;
  logo_url: string | null;
  momo_merchant_mtn: string;
  momo_merchant_telecel: string;
  momo_merchant_airteltigo: string;
  tax_vat: boolean;
  tax_nhil: boolean;
  tax_getfl: boolean;
  receipt_header: string;
  receipt_footer: string;
  receipt_show_logo: boolean;
  created_at: string;
  updated_at: string;
}

export function useBusiness() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["business", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Business | null;
    },
    enabled: !!user,
    // Keep cached data while refetching so guards never see a stale null
    staleTime: 5 * 60 * 1000,
  });

  const createBusiness = useMutation({
    mutationFn: async (values: {
      name: string;
      phone?: string;
      email?: string;
      region?: string;
      address?: string;
    }) => {
      const { data, error } = await supabase
        .from("businesses")
        .insert({ ...values, owner_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as Business;
    },
    onSuccess: (data) => {
      // Write directly into the cache so BusinessGuard immediately sees the
      // new business — avoids the race where invalidate triggers a background
      // refetch and the guard sees null during the brief refetch window.
      queryClient.setQueryData(["business", user!.id], data);
    },
  });

  const updateBusiness = useMutation({
    mutationFn: async (values: Partial<Business>) => {
      const { data, error } = await supabase
        .from("businesses")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", query.data!.id)
        .select()
        .single();
      if (error) throw error;
      return data as Business;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["business", user!.id], data);
    },
  });

  return {
    business:   query.data ?? null,
    isLoading:  query.isLoading,
    isFetching: query.isFetching,
    isError:    query.isError,
    createBusiness,
    updateBusiness,
  };
}
