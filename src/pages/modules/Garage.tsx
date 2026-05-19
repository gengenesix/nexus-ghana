import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  Wrench, Plus, ChevronLeft, Car, User, Phone,
  Save, Trash2, Tool, Package, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { formatGHS } from "@/lib/ghana";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

type JobStatus = "received" | "in-progress" | "awaiting-parts" | "ready" | "delivered" | "cancelled";
type ItemType  = "labour" | "part";

interface JobCard {
  id: string;
  job_number: string;
  customer_name: string;
  customer_phone: string | null;
  vehicle_reg: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  complaint: string;
  diagnosis: string | null;
  status: JobStatus;
  assigned_mechanic: string | null;
  estimated_cost: number;
  actual_cost: number;
  received_date: string;
  completed_date: string | null;
  notes: string | null;
}

interface JobCardItem {
  id: string;
  job_card_id: string;
  item_type: ItemType;
  description: string;
  quantity: number;
  unit_price: number;
}

// ── Config ─────────────────────────────────────────────────────────────────────

const STATUS_ORDER: JobStatus[] = ["received","in-progress","awaiting-parts","ready","delivered","cancelled"];

const STATUS_CFG: Record<JobStatus, { label: string; color: string; next?: JobStatus }> = {
  "received":       { label: "Received",        color: "bg-blue-100 text-blue-700",    next: "in-progress"      },
  "in-progress":    { label: "In Progress",     color: "bg-amber-100 text-amber-700",  next: "ready"            },
  "awaiting-parts": { label: "Awaiting Parts",  color: "bg-orange-100 text-orange-700",next: "in-progress"      },
  "ready":          { label: "Ready",           color: "bg-green-100 text-green-700",  next: "delivered"        },
  "delivered":      { label: "Delivered",       color: "bg-slate-100 text-slate-700",                           },
  "cancelled":      { label: "Cancelled",       color: "bg-red-100 text-red-600",                               },
};

function nextJobNumber(count: number): string {
  return `JC-${String(count + 1).padStart(4, "0")}`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Garage() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const businessId = business?.id;

  const [selected, setSelected]   = useState<JobCard | null>(null);
  const [showNew, setShowNew]     = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [filterStatus, setFilterStatus] = useState<JobStatus | "active">("active");

  // New job form
  const [jCustomer,  setJCustomer]  = useState("");
  const [jPhone,     setJPhone]     = useState("");
  const [jVehicleReg,setJVehicleReg]= useState("");
  const [jMake,      setJMake]      = useState("");
  const [jModel,     setJModel]     = useState("");
  const [jYear,      setJYear]      = useState("");
  const [jComplaint, setJComplaint] = useState("");
  const [jMechanic,  setJMechanic]  = useState("");
  const [jEstimate,  setJEstimate]  = useState("");
  const [jNotes,     setJNotes]     = useState("");

  // New item form
  const [iType,  setIType]  = useState<ItemType>("labour");
  const [iDesc,  setIDesc]  = useState("");
  const [iQty,   setIQty]   = useState("1");
  const [iPrice, setIPrice] = useState("0");

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: jobs = [], isLoading } = useQuery<JobCard[]>({
    queryKey: ["job-cards", businessId, filterStatus],
    enabled: !!businessId,
    queryFn: async () => {
      let q = supabase
        .from("job_cards")
        .select("*")
        .eq("business_id", businessId)
        .order("received_date", { ascending: false });
      if (filterStatus === "active") {
        q = q.not("status", "in", '("delivered","cancelled")');
      } else {
        q = q.eq("status", filterStatus);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: items = [] } = useQuery<JobCardItem[]>({
    queryKey: ["job-items", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_card_items")
        .select("*")
        .eq("job_card_id", selected!.id)
        .order("item_type").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createJob = useMutation({
    mutationFn: async () => {
      if (!businessId || !jCustomer || !jVehicleReg || !jComplaint)
        throw new Error("Customer, vehicle registration, and complaint required");
      const jobNumber = nextJobNumber(jobs.length);
      const { error } = await supabase
        .from("job_cards")
        .insert({
          business_id:       businessId,
          job_number:        jobNumber,
          customer_name:     jCustomer,
          customer_phone:    jPhone || null,
          vehicle_reg:       jVehicleReg.toUpperCase(),
          vehicle_make:      jMake   || null,
          vehicle_model:     jModel  || null,
          vehicle_year:      jYear   ? parseInt(jYear) : null,
          complaint:         jComplaint,
          assigned_mechanic: jMechanic || null,
          estimated_cost:    parseFloat(jEstimate) || 0,
          notes:             jNotes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job card created");
      qc.invalidateQueries({ queryKey: ["job-cards"] });
      setShowNew(false);
      setJCustomer(""); setJPhone(""); setJVehicleReg(""); setJMake(""); setJModel("");
      setJYear(""); setJComplaint(""); setJMechanic(""); setJEstimate(""); setJNotes("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!selected || !iDesc) throw new Error("Description required");
      const qty   = parseFloat(iQty)   || 1;
      const price = parseFloat(iPrice) || 0;
      const { error } = await supabase
        .from("job_card_items")
        .insert({
          job_card_id:  selected.id,
          business_id:  businessId,
          item_type:    iType,
          description:  iDesc,
          quantity:     qty,
          unit_price:   price,
        });
      if (error) throw error;
      // Update actual cost
      const newTotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0) + qty * price;
      await supabase
        .from("job_cards")
        .update({ actual_cost: Math.round(newTotal * 100) / 100, updated_at: new Date().toISOString() })
        .eq("id", selected.id);
    },
    onSuccess: () => {
      toast.success("Item added");
      qc.invalidateQueries({ queryKey: ["job-items"] });
      qc.invalidateQueries({ queryKey: ["job-cards"] });
      setShowAddItem(false);
      setIDesc(""); setIQty("1"); setIPrice("0");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const item = items.find(i => i.id === itemId);
      await supabase.from("job_card_items").delete().eq("id", itemId);
      if (item && selected) {
        const newTotal = items.filter(i => i.id !== itemId).reduce((s, i) => s + i.quantity * i.unit_price, 0);
        await supabase.from("job_cards").update({ actual_cost: Math.round(newTotal * 100) / 100 }).eq("id", selected.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-items"] });
      qc.invalidateQueries({ queryKey: ["job-cards"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: JobStatus) => {
      if (!selected) return;
      const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === "delivered") updates.completed_date = format(new Date(), "yyyy-MM-dd");
      const { error } = await supabase.from("job_cards").update(updates).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      toast.success(`Job ${status}`);
      qc.invalidateQueries({ queryKey: ["job-cards"] });
      setSelected(prev => prev ? { ...prev, status } : null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ── Detail view ────────────────────────────────────────────────────────────

  if (selected) {
    const cfg = STATUS_CFG[selected.status];
    const labourItems = items.filter(i => i.item_type === "labour");
    const partItems   = items.filter(i => i.item_type === "part");
    const totalActual = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelected(null)}><ChevronLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{selected.job_number}</h1>
              <Badge className={cfg.color + " border-0"}>{cfg.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{selected.vehicle_reg} · {selected.customer_name}</p>
          </div>
          {cfg.next && (
            <Button size="sm" style={{ background: "var(--forest)" }}
              onClick={() => updateStatus.mutate(cfg.next!)}>
              → {STATUS_CFG[cfg.next].label}
            </Button>
          )}
          {selected.status !== "delivered" && selected.status !== "cancelled" && (
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("awaiting-parts")}>
              Awaiting Parts
            </Button>
          )}
        </div>

        {/* Job info */}
        <div className="bg-card border rounded-xl p-4 grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Customer</p>
            <p className="font-medium">{selected.customer_name}</p>
            {selected.customer_phone && <p className="text-xs text-muted-foreground">{selected.customer_phone}</p>}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Vehicle</p>
            <p className="font-medium">{selected.vehicle_reg}</p>
            <p className="text-xs text-muted-foreground">
              {[selected.vehicle_year, selected.vehicle_make, selected.vehicle_model].filter(Boolean).join(" ")}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground mb-0.5">Complaint</p>
            <p>{selected.complaint}</p>
          </div>
          {selected.diagnosis && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground mb-0.5">Diagnosis</p>
              <p>{selected.diagnosis}</p>
            </div>
          )}
          {selected.assigned_mechanic && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3.5 w-3.5" /> {selected.assigned_mechanic}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Received: {format(parseISO(selected.received_date), "d MMM yyyy")}
          </div>
        </div>

        {/* Cost summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-1">Estimate</p>
            <p className="text-xl font-bold text-muted-foreground">{formatGHS(selected.estimated_cost)}</p>
          </div>
          <div className="bg-card border rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-1">Actual</p>
            <p className={`text-xl font-bold ${totalActual > selected.estimated_cost && selected.estimated_cost > 0 ? "text-red-500" : ""}`}>
              {formatGHS(totalActual)}
            </p>
          </div>
        </div>

        {/* Items */}
        {[
          { label: "Labour", items: labourItems, type: "labour" as ItemType, icon: Wrench },
          { label: "Parts",  items: partItems,   type: "part"   as ItemType, icon: Package },
        ].map(({ label, items: group, type, icon: Icon }) => (
          <div key={type} className="bg-card border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">{label}</h3>
              </div>
              {selected.status !== "delivered" && selected.status !== "cancelled" && (
                <Button size="sm" variant="outline" onClick={() => { setIType(type); setShowAddItem(true); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              )}
            </div>
            {group.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">None added</div>
            ) : (
              <div className="divide-y">
                {group.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1">
                      <p className="text-sm">{item.description}</p>
                      <p className="text-xs text-muted-foreground">×{item.quantity} @ {formatGHS(item.unit_price)}</p>
                    </div>
                    <span className="text-sm font-medium">{formatGHS(item.quantity * item.unit_price)}</span>
                    {selected.status !== "delivered" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem.mutate(item.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Add item inline */}
        <AnimatePresence>
          {showAddItem && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              className="bg-card border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold">Add {iType === "labour" ? "Labour" : "Part"}</h3>
              <div className="grid grid-cols-2 gap-3">
                <Input className="col-span-2 h-9 text-sm" placeholder="Description" value={iDesc} onChange={e => setIDesc(e.target.value)} />
                <Input className="h-9 text-sm" placeholder="Qty" type="number" value={iQty} onChange={e => setIQty(e.target.value)} />
                <Input className="h-9 text-sm" placeholder="Unit price (GHS)" type="number" value={iPrice} onChange={e => setIPrice(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAddItem(false)}>Cancel</Button>
                <Button size="sm" style={{ background: "var(--forest)" }}
                  onClick={() => addItem.mutate()} disabled={addItem.isPending || !iDesc}>
                  {addItem.isPending ? "Adding…" : "Add"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Job Cards</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Vehicle service jobs, labour and parts tracking</p>
        </div>
        <Button style={{ background: "var(--forest)" }} onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Job Card
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {([{ key: "active", label: "Active" }, ...STATUS_ORDER.map(s => ({ key: s, label: STATUS_CFG[s].label }))] as const).map(({ key, label }) => (
          <Button key={key} size="sm" variant={filterStatus === key ? "default" : "outline"}
            style={filterStatus === key ? { background: "var(--forest)" } : {}}
            onClick={() => setFilterStatus(key as any)}>
            {label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center">
          <Wrench className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No job cards yet. Create your first.</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl divide-y overflow-hidden">
          {jobs.map(job => {
            const cfg = STATUS_CFG[job.status];
            return (
              <motion.div key={job.id} whileHover={{ backgroundColor: "var(--muted)" }}
                onClick={() => setSelected(job)}
                className="flex items-center gap-4 px-4 py-3 cursor-pointer">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{job.job_number}</span>
                    <Badge className={cfg.color + " border-0 text-xs"}>{cfg.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {job.vehicle_reg} · {job.customer_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-xs">{job.complaint}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">{formatGHS(job.actual_cost)}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(job.received_date), "d MMM")}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New job card slide-in */}
      <AnimatePresence>
        {showNew && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowNew(false)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-2xl z-50 flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-bold text-lg">New Job Card</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowNew(false)}>✕</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Customer Name *</label>
                  <Input placeholder="Full name" value={jCustomer} onChange={e => setJCustomer(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Customer Phone</label>
                  <Input placeholder="0XX XXX XXXX" value={jPhone} onChange={e => setJPhone(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">Vehicle Registration *</label>
                    <Input placeholder="GR-1234-20" value={jVehicleReg} onChange={e => setJVehicleReg(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Make</label>
                    <Input placeholder="Toyota" value={jMake} onChange={e => setJMake(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Model</label>
                    <Input placeholder="Camry" value={jModel} onChange={e => setJModel(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Year</label>
                    <Input type="number" placeholder="2019" value={jYear} onChange={e => setJYear(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Mechanic</label>
                    <Input placeholder="Assigned technician" value={jMechanic} onChange={e => setJMechanic(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Customer Complaint *</label>
                  <Input placeholder="What is the vehicle issue?" value={jComplaint} onChange={e => setJComplaint(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Estimated Cost (GHS)</label>
                  <Input type="number" placeholder="0.00" value={jEstimate} onChange={e => setJEstimate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Notes</label>
                  <Input placeholder="Internal notes" value={jNotes} onChange={e => setJNotes(e.target.value)} />
                </div>
              </div>
              <div className="p-4 border-t">
                <Button className="w-full" style={{ background: "var(--forest)" }}
                  onClick={() => createJob.mutate()}
                  disabled={createJob.isPending || !jCustomer || !jVehicleReg || !jComplaint}>
                  <Save className="h-4 w-4 mr-2" />
                  {createJob.isPending ? "Creating…" : "Create Job Card"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
