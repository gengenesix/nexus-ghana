import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, differenceInDays } from "date-fns";
import {
  Pill, Plus, ChevronLeft, AlertTriangle, CheckCircle2,
  User, Stethoscope, Calendar, Save, Clock, X
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

type RxStatus = "pending" | "dispensed" | "partial" | "cancelled";

interface Prescription {
  id: string;
  rx_number: string;
  patient_name: string;
  patient_phone: string | null;
  prescriber_name: string | null;
  rx_date: string;
  status: RxStatus;
  notes: string | null;
  created_at: string;
}

interface RxItem {
  id: string;
  prescription_id: string;
  drug_name: string;
  dosage_instructions: string | null;
  quantity_prescribed: number;
  quantity_dispensed: number;
  batch_number: string | null;
  expiry_date: string | null;
  unit_price: number;
  notes: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<RxStatus, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-700"  },
  dispensed: { label: "Dispensed", color: "bg-green-100 text-green-700"  },
  partial:   { label: "Partial",   color: "bg-blue-100 text-blue-700"    },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-600"      },
};

function expiryAlert(dateStr: string | null): { days: number; level: "ok" | "warning" | "critical" } | null {
  if (!dateStr) return null;
  const days = differenceInDays(parseISO(dateStr), new Date());
  if (days <= 0)  return { days, level: "critical" };
  if (days <= 30) return { days, level: "critical" };
  if (days <= 90) return { days, level: "warning"  };
  return { days, level: "ok" };
}

function nextRxNumber(count: number): string {
  const yr = new Date().getFullYear();
  return `RX-${yr}-${String(count + 1).padStart(4, "0")}`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PharmacyRx() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const businessId = business?.id;

  const [selected, setSelected]       = useState<Prescription | null>(null);
  const [showNewRx, setShowNewRx]     = useState(false);
  const [filterStatus, setFilterStatus] = useState<RxStatus | "all">("all");

  // New Rx form
  const [patient, setPatient]       = useState("");
  const [phone,   setPhone]         = useState("");
  const [prescriber, setPrescriber] = useState("");
  const [rxDate,  setRxDate]        = useState(format(new Date(), "yyyy-MM-dd"));
  const [rxNotes, setRxNotes]       = useState("");

  // Item form
  const [iDrug,     setIDrug]     = useState("");
  const [iDosage,   setIDosage]   = useState("");
  const [iQtyPres,  setIQtyPres]  = useState("1");
  const [iBatch,    setIBatch]    = useState("");
  const [iExpiry,   setIExpiry]   = useState("");
  const [iPrice,    setIPrice]    = useState("0");
  const [showAddItem, setShowAddItem] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: rxList = [], isLoading } = useQuery<Prescription[]>({
    queryKey: ["prescriptions", businessId, filterStatus],
    enabled: !!businessId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("prescriptions")
        .select("*")
        .eq("business_id", businessId)
        .order("rx_date", { ascending: false });
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: items = [] } = useQuery<RxItem[]>({
    queryKey: ["rx-items", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("prescription_items")
        .select("*")
        .eq("prescription_id", selected!.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createRx = useMutation({
    mutationFn: async () => {
      if (!businessId || !patient) throw new Error("Patient name required");
      const rxNumber = nextRxNumber(rxList.length);
      const { error } = await (supabase as any)
        .from("prescriptions")
        .insert({
          business_id:     businessId,
          rx_number:       rxNumber,
          patient_name:    patient,
          patient_phone:   phone || null,
          prescriber_name: prescriber || null,
          rx_date:         rxDate,
          notes:           rxNotes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prescription created");
      qc.invalidateQueries({ queryKey: ["prescriptions"] });
      setShowNewRx(false);
      setPatient(""); setPhone(""); setPrescriber(""); setRxNotes("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!selected || !iDrug) throw new Error("Drug name required");
      const { error } = await (supabase as any)
        .from("prescription_items")
        .insert({
          prescription_id:     selected.id,
          business_id:         businessId,
          drug_name:           iDrug,
          dosage_instructions: iDosage || null,
          quantity_prescribed: parseFloat(iQtyPres) || 1,
          quantity_dispensed:  0,
          batch_number:        iBatch || null,
          expiry_date:         iExpiry || null,
          unit_price:          parseFloat(iPrice) || 0,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Drug added");
      qc.invalidateQueries({ queryKey: ["rx-items"] });
      setShowAddItem(false);
      setIDrug(""); setIDosage(""); setIQtyPres("1"); setIBatch(""); setIExpiry(""); setIPrice("0");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const dispenseItem = useMutation({
    mutationFn: async (item: RxItem) => {
      const { error } = await (supabase as any)
        .from("prescription_items")
        .update({ quantity_dispensed: item.quantity_prescribed })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["rx-items"] });
      // Check if all items dispensed → mark Rx dispensed
      const refreshed: RxItem[] = qc.getQueryData(["rx-items", selected?.id]) ?? [];
      const allDone = refreshed.every(i => i.quantity_dispensed >= i.quantity_prescribed);
      if (selected && allDone) {
        await (supabase as any).from("prescriptions").update({ status: "dispensed" }).eq("id", selected.id);
        qc.invalidateQueries({ queryKey: ["prescriptions"] });
        setSelected(prev => prev ? { ...prev, status: "dispensed" } : null);
      }
      toast.success("Dispensed");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateRxStatus = useMutation({
    mutationFn: async (status: RxStatus) => {
      if (!selected) return;
      const { error } = await (supabase as any).from("prescriptions").update({ status }).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      toast.success(`Marked as ${status}`);
      qc.invalidateQueries({ queryKey: ["prescriptions"] });
      setSelected(prev => prev ? { ...prev, status } : null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ── Expiry alerts ──────────────────────────────────────────────────────────

  const expiringItems = items.filter(i => {
    const alert = expiryAlert(i.expiry_date);
    return alert && alert.level !== "ok";
  });

  // ── Detail view ────────────────────────────────────────────────────────────

  if (selected) {
    const cfg = STATUS_CFG[selected.status];
    const totalValue = items.reduce((s, i) => s + i.quantity_prescribed * i.unit_price, 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelected(null)}><ChevronLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{selected.rx_number}</h1>
              <Badge className={cfg.color + " border-0"}>{cfg.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{format(parseISO(selected.rx_date), "d MMMM yyyy")}</p>
          </div>
          {selected.status === "pending" && (
            <>
              <Button size="sm" style={{ background: "var(--forest)" }}
                onClick={() => updateRxStatus.mutate("dispensed")}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Mark Dispensed
              </Button>
              <Button size="sm" variant="outline" onClick={() => updateRxStatus.mutate("cancelled")}>Cancel Rx</Button>
            </>
          )}
        </div>

        {/* Patient info */}
        <div className="bg-card border rounded-xl p-4 grid sm:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Patient</p>
              <p className="font-medium">{selected.patient_name}</p>
              {selected.patient_phone && <p className="text-xs text-muted-foreground">{selected.patient_phone}</p>}
            </div>
          </div>
          {selected.prescriber_name && (
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Prescriber</p>
                <p className="font-medium">{selected.prescriber_name}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-medium">{format(parseISO(selected.rx_date), "d MMM yyyy")}</p>
            </div>
          </div>
        </div>

        {/* Expiry warnings */}
        {expiringItems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {expiringItems.length} drug(s) expiring within 30 days
          </div>
        )}

        {/* Drug items */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="font-semibold">Drugs</h2>
            {selected.status === "pending" && (
              <Button size="sm" style={{ background: "var(--forest)" }} onClick={() => setShowAddItem(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Drug
              </Button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No drugs added yet</div>
          ) : (
            <div className="divide-y">
              {items.map(item => {
                const alert = expiryAlert(item.expiry_date);
                const dispensed = item.quantity_dispensed >= item.quantity_prescribed;
                return (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{item.drug_name}</p>
                          {dispensed && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                        </div>
                        {item.dosage_instructions && <p className="text-xs text-muted-foreground mt-0.5">{item.dosage_instructions}</p>}
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>Qty: {item.quantity_prescribed}</span>
                          {item.batch_number && <span>Batch: {item.batch_number}</span>}
                          {item.expiry_date && (
                            <span className={alert?.level === "critical" ? "text-red-600 font-medium" : alert?.level === "warning" ? "text-amber-600" : ""}>
                              Exp: {format(parseISO(item.expiry_date), "MMM yyyy")}
                              {alert && alert.level !== "ok" && ` (${alert.days}d)`}
                            </span>
                          )}
                          {item.unit_price > 0 && <span>{formatGHS(item.unit_price)} each</span>}
                        </div>
                      </div>
                      {!dispensed && selected.status === "pending" && (
                        <Button size="sm" variant="outline" className="text-xs shrink-0"
                          onClick={() => dispenseItem.mutate(item)}>
                          Dispense
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {totalValue > 0 && (
          <div className="bg-card border rounded-xl p-3 flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total Drug Value</span>
            <span className="font-bold text-lg">{formatGHS(totalValue)}</span>
          </div>
        )}

        {/* Add drug form */}
        <AnimatePresence>
          {showAddItem && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              className="bg-card border rounded-xl p-4 space-y-3"
            >
              <h3 className="font-semibold">Add Drug to Prescription</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium mb-1 block">Drug Name *</label>
                  <Input placeholder="e.g. Amoxicillin 500mg" value={iDrug} onChange={e => setIDrug(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium mb-1 block">Dosage Instructions</label>
                  <Input placeholder="e.g. 1 tablet 3× daily for 7 days" value={iDosage} onChange={e => setIDosage(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Quantity</label>
                  <Input type="number" value={iQtyPres} onChange={e => setIQtyPres(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Unit Price (GHS)</label>
                  <Input type="number" value={iPrice} onChange={e => setIPrice(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Batch Number</label>
                  <Input placeholder="Optional" value={iBatch} onChange={e => setIBatch(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Expiry Date</label>
                  <Input type="date" value={iExpiry} onChange={e => setIExpiry(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAddItem(false)}>Cancel</Button>
                <Button size="sm" style={{ background: "var(--forest)" }}
                  onClick={() => addItem.mutate()} disabled={addItem.isPending || !iDrug}>
                  {addItem.isPending ? "Adding…" : "Add Drug"}
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
          <h1 className="text-2xl font-bold">Pharmacy Rx</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Prescription register and dispensing records</p>
        </div>
        <Button style={{ background: "var(--forest)" }} onClick={() => setShowNewRx(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Prescription
        </Button>
      </div>

      {/* Summary */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "dispensed", "partial", "cancelled"] as const).map(s => (
          <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"}
            style={filterStatus === s ? { background: "var(--forest)" } : {}}
            onClick={() => setFilterStatus(s)}>
            {s === "all" ? "All" : STATUS_CFG[s as RxStatus].label}
            {s !== "all" && <span className="ml-1 text-xs opacity-70">({rxList.filter(r => r.status === s).length})</span>}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : rxList.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center">
          <Pill className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No prescriptions yet.</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl divide-y overflow-hidden">
          {rxList.map(rx => {
            const cfg = STATUS_CFG[rx.status];
            return (
              <motion.div
                key={rx.id}
                whileHover={{ backgroundColor: "var(--muted)" }}
                onClick={() => setSelected(rx)}
                className="flex items-center gap-4 px-4 py-3 cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{rx.rx_number}</span>
                    <Badge className={cfg.color + " border-0 text-xs"}>{cfg.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{rx.patient_name}</p>
                </div>
                {rx.prescriber_name && (
                  <span className="text-xs text-muted-foreground hidden sm:block">{rx.prescriber_name}</span>
                )}
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(parseISO(rx.rx_date), "d MMM yyyy")}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New Rx slide-in */}
      <AnimatePresence>
        {showNewRx && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowNewRx(false)} />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-2xl z-50 flex flex-col"
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-bold text-lg">New Prescription</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowNewRx(false)}>✕</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Patient Name *</label>
                  <Input placeholder="Full name" value={patient} onChange={e => setPatient(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Patient Phone</label>
                  <Input placeholder="0XX XXX XXXX" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Prescribing Doctor / Clinician</label>
                  <Input placeholder="Dr. Mensah, Nurse Ama…" value={prescriber} onChange={e => setPrescriber(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date</label>
                  <Input type="date" value={rxDate} onChange={e => setRxDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Notes</label>
                  <Input placeholder="Optional" value={rxNotes} onChange={e => setRxNotes(e.target.value)} />
                </div>
              </div>
              <div className="p-4 border-t">
                <Button className="w-full" style={{ background: "var(--forest)" }}
                  onClick={() => createRx.mutate()} disabled={createRx.isPending || !patient}>
                  <Save className="h-4 w-4 mr-2" />
                  {createRx.isPending ? "Creating…" : "Create Prescription"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
