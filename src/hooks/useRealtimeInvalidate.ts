import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to Supabase Realtime on a given table and invalidates
 * the specified query keys on any INSERT/UPDATE/DELETE event.
 *
 * Usage:
 *   useRealtimeInvalidate("sales", [["dashboard-stats", businessId], ["recent-sales", businessId]])
 */
export function useRealtimeInvalidate(
  table: string,
  queryKeys: unknown[][],
  filter?: string
) {
  const queryClient = useQueryClient();
  // Keep a stable ref to the latest queryKeys so the subscription
  // always invalidates the current keys without needing to re-subscribe.
  const queryKeysRef = useRef(queryKeys);
  queryKeysRef.current = queryKeys;

  useEffect(() => {
    if (queryKeysRef.current.length === 0) return;

    const channelName = `realtime:${table}:${filter ?? "all"}:${Math.random()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, filter },
        () => {
          queryKeysRef.current.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, queryClient]);
}
