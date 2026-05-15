import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, Search, Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ALL_MODULES } from "@/lib/rbac";

const ACTION_COLORS: Record<string, string> = {
  created:  "bg-lime-600/20 text-lime-700 border-lime-600/30",
  updated:  "bg-blue-500/20 text-blue-600 border-blue-500/30",
  deleted:  "bg-red-500/20 text-red-600 border-red-500/30",
  approved: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
  rejected: "bg-orange-500/20 text-orange-600 border-orange-500/30",
  login:    "bg-purple-500/20 text-purple-600 border-purple-500/30",
};

function actionColor(action: string): string {
  for (const [key, cls] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return cls;
  }
  return "bg-secondary text-secondary-foreground";
}

export default function AuditLog() {
  const { business } = useBusiness();
  const { user } = useAuth();
  const { staff, ownerBypass } = useStaffSession();

  const [search, setSearch]   = useState("");
  const [module, setModule]   = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [page, setPage]       = useState(0);
  const PAGE_SIZE = 50;

  const isOwner = !!user && !!business && business.owner_id === user.id;
  const isAdmin = isOwner || ownerBypass || staff?.role === "Administrator";

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["audit-log", business?.id, module, search, dateFrom, dateTo, page],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (module !== "all") q = q.eq("module", module);
      if (dateFrom)         q = q.gte("created_at", new Date(dateFrom).toISOString());
      if (dateTo)           q = q.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());
      if (search)           q = q.or(`action.ilike.%${search}%,staff_name.ilike.%${search}%,record_id.ilike.%${search}%`);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
    enabled: !!business && isAdmin,
  });

  const exportCSV = () => {
    if (!data?.rows.length) return;
    const headers = ["Timestamp","User","Role","Action","Module","Record ID","IP"];
    const rows = data.rows.map((r: any) => [
      format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss"),
      r.staff_name,
      r.role_at_time,
      r.action,
      r.module,
      r.record_id,
      r.ip_address,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c: any) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `audit-log-${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold">Access Restricted</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Only Administrators can view the audit log.
          </p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Audit Log</h1>
            <p className="text-sm text-muted-foreground">
              {data?.total ?? "–"} total entries · append-only
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data?.rows.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search action, user, record ID..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
            <Select value={module} onValueChange={(v) => { setModule(v); setPage(0); }}>
              <SelectTrigger>
                <SelectValue placeholder="All modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {ALL_MODULES.map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
              placeholder="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
              placeholder="To date"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.rows.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <FileText className="h-8 w-8 opacity-30" />
              <p className="text-sm">No audit entries found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs whitespace-nowrap font-mono text-muted-foreground">
                      {format(new Date(row.created_at), "MMM d, HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{row.staff_name}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{row.role_at_time}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${actionColor(row.action)}`}>
                        {row.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs capitalize text-muted-foreground">{row.module}</span>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">
                      {row.record_id || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.ip_address || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page + 1} of {totalPages} · {data?.total} entries
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
