import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { format } from "date-fns";

export default function NotificationsTab() {
  const { business } = useBusiness();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Alerts & Notifications</CardTitle>
        <CardDescription>Recent alerts and system notifications</CardDescription>
      </CardHeader>
      <CardContent>
        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((n: any) => (
              <div key={n.id} className={`flex items-start gap-3 p-3 rounded-lg border ${n.is_read ? "bg-background" : "bg-secondary/30"}`}>
                <Bell className={`h-4 w-4 mt-1 ${n.is_read ? "text-muted-foreground" : "text-primary"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.created_at), "MMM d, HH:mm")}</p>
                </div>
                {n.module && <Badge variant="outline" className="text-xs capitalize">{n.module}</Badge>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No notifications yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
