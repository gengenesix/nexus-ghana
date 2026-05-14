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
  access_code: string | null;
  created_at: string;
  updated_at: string;
}

export function useBusiness() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["business", user?.id],
    queryFn: async () => {
      // 1. Try owner lookup first (most common case)
      const { data: owned, error: ownerErr } = await supabase
        .from("businesses")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1);
      if (ownerErr) throw ownerErr;
      if (owned && owned.length > 0) return owned[0] as Business;

      // 2. Not an owner — check if this user is a staff member of a business
      //    (they registered via the "Join a Business" flow and have their
      //    supabase_user_id stored in staff_members)
      const { data: staffRow, error: staffErr } = await supabase
        .from("staff_members")
        .select("businesses(*)")
        .eq("supabase_user_id", user!.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (staffErr) throw staffErr;
      if (staffRow?.businesses) return staffRow.businesses as unknown as Business;

      return null;
    },
    enabled: !!user,
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
