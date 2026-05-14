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
      // Use array + limit(1) instead of maybeSingle() so the query never
      // errors if a user accidentally ended up with duplicate rows in the DB.
      // The UNIQUE(owner_id) DB constraint (fix_duplicate_businesses.sql)
      // ensures duplicates cannot happen going forward.
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data && data.length > 0 ? (data[0] as Business) : null);
    },
    enabled: !!user,
    // Keep cached data fresh for 5 minutes so guards never see stale null
    // during background refetches.
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
      // Populate cache immediately — avoids the race where invalidate triggers
      // a background refetch and BusinessGuard sees null during the refetch.
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
    // 'pending' = not yet resolved (no data, fetching or about to fetch)
    // 'success' = resolved — data is either a Business or null
    // 'error'   = query threw
    status:     query.status,
    createBusiness,
    updateBusiness,
  };
}
