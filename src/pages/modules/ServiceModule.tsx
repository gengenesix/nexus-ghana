import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Headphones, AlertCircle, Clock, CheckCircle2, Plus,
  FileSignature, Cpu, Pencil, Trash2, ShieldCheck, CalendarClock,
} from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { formatGHS } from "@/lib/ghana";
import { toast } from "sonner";
import ServiceCallDialog from "@/components/service/ServiceCallDialog";
import ServiceContractDialog from "@/components/service/ServiceContractDialog";
import CustomerEquipmentDialog from "@/components/service/CustomerEquipmentDialog";

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-500",
  medium: "bg-yellow-500/10 text-yellow-600",
  high: "bg-orange-500/10 text-orange-500",
  critical: "bg-red-500/10 text-red-500",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-500/10 text-red-500",
  in_progress: "bg-yellow-500/10 text-yellow-600",
  resolved: "bg-green-500/10 text-green-600",
  closed: "bg-muted text-muted-foreground",
  active: "bg-green-500/10 text-green-600",
  pending: "bg-blue-500/10 text-blue-500",
  expired: "bg-orange-500/10 text-orange-500",
  cancelled: "bg-muted text-muted-foreground",
};

export default function ServiceModule() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("calls");
  const [callOpen, setCallOpen] = useState(false);
  const [contractDialog, setContractDialog] = useState<{ open: boolean; contract?: any }>({ open: false });
  const [equipmentDialog, setEquipmentDialog] = useState<{ open: boolean; equipment?: any }>({ open: false });

  // ── Service calls ─────────────────────────────────────────────
  const { data: serviceCalls = [] } = useQuery({
    queryKey: ["service_calls", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_calls").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  // ── Service contracts ─────────────────────────────────────────
  const { data: contracts = [] } = useQuery({
    queryKey: ["service_contracts", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_contracts").select("*").eq("business_id", business!.id).order("end_date");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const deleteContract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["service_contracts"] }); toast.success("Contract deleted"); },
  });

  // ── Customer equipment ────────────────────────────────────────
  const { data: equipment = [] } = useQuery({
    queryKey: ["customer_equipment", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_equipment").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const deleteEquipment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["customer_equipment"] }); toast.success("Equipment removed"); },
  });

  const activeContracts = contracts.filter((c: any) => c.status === "active").length;
  const expiringContracts = contracts.filter((c: any) => {
    if (c.status !== "active") return false;
    const end = parseISO(c.end_date);
    const daysLeft = (end.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft <= 30 && daysLeft >= 0;
  }).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Service</h1>
        <p className="text-muted-foreground">Post-sales support, service calls, contracts, and equipment</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Headphones className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{serviceCalls.filter((c: any) => c.status === "open").length}</p><p className="text-xs text-muted-foreground">Open Calls</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-yellow-500" /><div><p className="text-2xl font-bold">{serviceCalls.filter((c: any) => c.status === "in_progress").length}</p><p className="text-xs text-muted-foreground">In Progress</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{activeContracts}</p><p className="text-xs text-muted-foreground">Active Contracts</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><CalendarClock className="h-8 w-8 text-orange-500" /><div><p className="text-2xl font-bold">{expiringContracts}</p><p className="text-xs text-muted-foreground">Expiring (30d)</p></div></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="calls">Service Calls</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
        </TabsList>

        {/* ── Service Calls ── */}
        <TabsContent value="calls" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Service Calls</h3>
            <Button onClick={() => setCallOpen(true)}><Plus className="h-4 w-4 mr-1" />New Call</Button>
          </div>
          <Card><CardContent className="pt-4">
            {serviceCalls.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Call #</TableHead><TableHead>Customer</TableHead><TableHead>Subject</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Opened</TableHead></TableRow></TableHeader>
                <TableBody>{serviceCalls.map((sc: any) => (
                  <TableRow key={sc.id}>
                    <TableCell className="font-mono text-sm">{sc.call_number}</TableCell>
                    <TableCell>{sc.customer_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{sc.subject}</TableCell>
                    <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITY_COLORS[sc.priority] || ""}`}>{sc.priority}</span></TableCell>
                    <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[sc.status] || ""}`}>{sc.status}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(sc.opened_at || sc.created_at), "MMM d, HH:mm")}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><Headphones className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No service calls yet. Log the first one!</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* ── Contracts ── */}
        <TabsContent value="contracts" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Service Contracts</h3>
            <Button onClick={() => setContractDialog({ open: true })}><Plus className="h-4 w-4 mr-1" />New Contract</Button>
          </div>
          <Card><CardContent className="pt-4">
            {contracts.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Contract #</TableHead><TableHead>Customer</TableHead><TableHead>Type</TableHead><TableHead>Period</TableHead><TableHead>Value</TableHead><TableHead>Status</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
                <TableBody>{contracts.map((c: any) => {
                  const expiring = c.status === "active" && !isPast(parseISO(c.end_date)) &&
                    (parseISO(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 30;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{c.contract_number}</TableCell>
                      <TableCell>{c.customer_name}</TableCell>
                      <TableCell className="capitalize">{c.type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(parseISO(c.start_date), "MMM d, yy")} → {format(parseISO(c.end_date), "MMM d, yy")}
                      </TableCell>
                      <TableCell className="font-mono">{formatGHS(c.value)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[c.status] || ""}`}>{c.status}</span>
                          {expiring && <Badge variant="outline" className="text-[10px] text-orange-500 border-orange-500/40">Expiring</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setContractDialog({ open: true, contract: c })}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteContract.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No contracts yet. Add maintenance or warranty agreements.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* ── Equipment ── */}
        <TabsContent value="equipment" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Customer Equipment</h3>
            <Button onClick={() => setEquipmentDialog({ open: true })}><Plus className="h-4 w-4 mr-1" />Register Equipment</Button>
          </div>
          <Card><CardContent className="pt-4">
            {equipment.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Brand / Model</TableHead><TableHead>Serial #</TableHead><TableHead>Warranty End</TableHead><TableHead>Status</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
                <TableBody>{equipment.map((eq: any) => {
                  const warrantyExpired = eq.warranty_end && isPast(parseISO(eq.warranty_end));
                  return (
                    <TableRow key={eq.id}>
                      <TableCell>{eq.customer_name}</TableCell>
                      <TableCell>{[eq.brand, eq.model].filter(Boolean).join(" ") || "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{eq.serial_number || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {eq.warranty_end
                          ? <span className={warrantyExpired ? "text-destructive" : "text-green-600"}>{format(parseISO(eq.warranty_end), "MMM d, yyyy")}{warrantyExpired ? " (expired)" : ""}</span>
                          : "—"}
                      </TableCell>
                      <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[eq.status] || ""}`}>{eq.status}</span></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEquipmentDialog({ open: true, equipment: eq })}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteEquipment.mutate(eq.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><Cpu className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No equipment registered. Track devices and machines you service.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <ServiceCallDialog open={callOpen} onOpenChange={setCallOpen} />
      <ServiceContractDialog
        open={contractDialog.open}
        onOpenChange={(o) => setContractDialog({ open: o })}
        contract={contractDialog.contract}
      />
      <CustomerEquipmentDialog
        open={equipmentDialog.open}
        onOpenChange={(o) => setEquipmentDialog({ open: o })}
        equipment={equipmentDialog.equipment}
      />
    </div>
  );
}
