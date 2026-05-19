import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  Truck, Plus, ChevronLeft, Fuel, Wrench, MapPin,
  User, Activity, Save, Gauge, AlertCircle, Navigation
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

type VehicleStatus = "active" | "maintenance" | "disposed";
type VehicleType   = "truck" | "van" | "sedan" | "bus" | "pickup" | "motorcycle" | "other";
type LogType       = "trip" | "fuel" | "maintenance" | "inspection";
type FuelType      = "petrol" | "diesel" | "electric" | "lpg";

interface FleetVehicle {
  id: string;
  registration: string;
  make: string;
  model: string;
  year: number | null;
  vehicle_type: VehicleType;
  status: VehicleStatus;
  assigned_driver: string | null;
  fuel_type: FuelType | null;
  odometer_km: number;
  notes: string | null;
}

interface FleetLog {
  id: string;
  vehicle_id: string;
  log_date: string;
  log_type: LogType;
  description: string;
  driver: string | null;
  origin: string | null;
  destination: string | null;
  distance_km: number | null;
  fuel_litres: number | null;
  cost: number;
  odometer_end: number | null;
  notes: string | null;
}

// ── Config ─────────────────────────────────────────────────────────────────────

const VEHICLE_STATUS_CFG: Record<VehicleStatus, { label: string; color: string }> = {
  active:      { label: "Active",      color: "bg-green-100 text-green-700"  },
  maintenance: { label: "Maintenance", color: "bg-amber-100 text-amber-700"  },
  disposed:    { label: "Disposed",    color: "bg-slate-100 text-slate-600"  },
};

const LOG_TYPE_CFG: Record<LogType, { label: string; icon: typeof Truck; color: string }> = {
  trip:        { label: "Trip",        icon: Navigation, color: "text-blue-500"   },
  fuel:        { label: "Fuel",        icon: Fuel,       color: "text-amber-500"  },
  maintenance: { label: "Maintenance", icon: Wrench,     color: "text-red-500"    },
  inspection:  { label: "Inspection",  icon: Activity,   color: "text-green-500"  },
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function Fleet() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const businessId = business?.id;

  const [selected, setSelected]       = useState<FleetVehicle | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddLog,     setShowAddLog]     = useState(false);
  const [filterStatus, setFilterStatus]     = useState<VehicleStatus | "all">("active");

  // Add vehicle form
  const [vReg,    setVReg]    = useState("");
  const [vMake,   setVMake]   = useState("");
  const [vModel,  setVModel]  = useState("");
  const [vYear,   setVYear]   = useState(String(new Date().getFullYear()));
  const [vType,   setVType]   = useState<VehicleType>("truck");
  const [vDriver, setVDriver] = useState("");
  const [vFuel,   setVFuel]   = useState<FuelType>("diesel");
  const [vOdo,    setVOdo]    = useState("0");

  // Add log form
  const [lType,   setLType]   = useState<LogType>("trip");
  const [lDate,   setLDate]   = useState(format(new Date(), "yyyy-MM-dd"));
  const [lDesc,   setLDesc]   = useState("");
  const [lDriver, setLDriver] = useState("");
  const [lOrigin, setLOrigin] = useState("");
  const [lDest,   setLDest]   = useState("");
  const [lDist,   setLDist]   = useState("");
  const [lFuelL,  setLFuelL]  = useState("");
  const [lCost,   setLCost]   = useState("0");
  const [lOdo,    setLOdo]    = useState("");

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: vehicles = [], isLoading } = useQuery<FleetVehicle[]>({
    queryKey: ["fleet-vehicles", businessId, filterStatus],
    enabled: !!businessId,
    queryFn: async () => {
      let q = supabase
        .from("fleet_vehicles")
        .select("*")
        .eq("business_id", businessId)
        .order("registration");
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: logs = [] } = useQuery<FleetLog[]>({
    queryKey: ["fleet-logs", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_logs")
        .select("*")
        .eq("vehicle_id", selected!.id)
        .order("log_date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addVehicle = useMutation({
    mutationFn: async () => {
      if (!businessId || !vReg || !vMake || !vModel) throw new Error("Registration, make and model required");
      const { error } = await supabase
        .from("fleet_vehicles")
        .insert({
          business_id:     businessId,
          registration:    vReg.toUpperCase(),
          make:            vMake,
          model:           vModel,
          year:            parseInt(vYear) || null,
          vehicle_type:    vType,
          assigned_driver: vDriver || null,
          fuel_type:       vFuel,
          odometer_km:     parseInt(vOdo) || 0,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vehicle added");
      qc.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      setShowAddVehicle(false);
      setVReg(""); setVMake(""); setVModel(""); setVDriver("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addLog = useMutation({
    mutationFn: async () => {
      if (!selected || !lDesc) throw new Error("Description required");
      const { error } = await supabase
        .from("fleet_logs")
        .insert({
          business_id:  businessId,
          vehicle_id:   selected.id,
          log_date:     lDate,
          log_type:     lType,
          description:  lDesc,
          driver:       lDriver || null,
          origin:       lOrigin || null,
          destination:  lDest   || null,
          distance_km:  lDist   ? parseFloat(lDist)  : null,
          fuel_litres:  lFuelL  ? parseFloat(lFuelL) : null,
          cost:         parseFloat(lCost) || 0,
          odometer_end: lOdo ? parseInt(lOdo) : null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Log entry added");
      qc.invalidateQueries({ queryKey: ["fleet-logs"] });
      setShowAddLog(false);
      setLDesc(""); setLDriver(""); setLOrigin(""); setLDest(""); setLDist(""); setLFuelL(""); setLCost("0"); setLOdo("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ── Summary for selected vehicle ───────────────────────────────────────────

  const totalKm    = logs.filter(l => l.distance_km).reduce((s, l) => s + (l.distance_km ?? 0), 0);
  const totalFuel  = logs.filter(l => l.fuel_litres).reduce((s, l) => s + (l.fuel_litres ?? 0), 0);
  const totalCost  = logs.reduce((s, l) => s + l.cost, 0);

  // ── Detail view ────────────────────────────────────────────────────────────

  if (selected) {
    const cfg = VEHICLE_STATUS_CFG[selected.status];
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelected(null)}><ChevronLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{selected.registration}</h1>
              <Badge className={cfg.color + " border-0"}>{cfg.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{selected.year} {selected.make} {selected.model}</p>
          </div>
          <Button style={{ background: "var(--forest)" }} onClick={() => setShowAddLog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Log Entry
          </Button>
        </div>

        {/* Vehicle stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total KM",    value: `${totalKm.toLocaleString()} km`, icon: Gauge      },
            { label: "Fuel Used",   value: `${totalFuel.toLocaleString()} L`, icon: Fuel      },
            { label: "Total Cost",  value: formatGHS(totalCost),              icon: Activity  },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card border rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-xs">{label}</span>
              </div>
              <p className="font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Info row */}
        <div className="bg-card border rounded-xl p-4 flex gap-4 text-sm flex-wrap">
          {selected.assigned_driver && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3.5 w-3.5" />{selected.assigned_driver}
            </div>
          )}
          {selected.fuel_type && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Fuel className="h-3.5 w-3.5" />{selected.fuel_type}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" />Current ODO: {(selected.odometer_km ?? 0).toLocaleString()} km
          </div>
        </div>

        {/* Log entries */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold">Log Entries</h2>
          </div>
          {logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No log entries yet</div>
          ) : (
            <div className="divide-y">
              {logs.map(log => {
                const cfg = LOG_TYPE_CFG[log.log_type];
                const Icon = cfg.icon;
                return (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                    <div className={`p-1.5 rounded-full bg-muted mt-0.5 ${cfg.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{log.description}</p>
                        <span className="text-xs text-muted-foreground">{cfg.label}</span>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>{format(parseISO(log.log_date), "d MMM yyyy")}</span>
                        {log.driver && <span><User className="h-2.5 w-2.5 inline" /> {log.driver}</span>}
                        {log.origin && log.destination && <span>{log.origin} → {log.destination}</span>}
                        {log.distance_km && <span>{log.distance_km} km</span>}
                        {log.fuel_litres && <span>{log.fuel_litres} L</span>}
                      </div>
                    </div>
                    {log.cost > 0 && <span className="text-sm font-medium shrink-0">{formatGHS(log.cost)}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add log slide-in */}
        <AnimatePresence>
          {showAddLog && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowAddLog(false)} />
              <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 260 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-2xl z-50 flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="font-bold text-lg">Add Log Entry</h2>
                  <Button variant="ghost" size="icon" onClick={() => setShowAddLog(false)}>✕</Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="grid grid-cols-4 gap-2">
                    {(["trip","fuel","maintenance","inspection"] as LogType[]).map(t => {
                      const cfg = LOG_TYPE_CFG[t];
                      const Icon = cfg.icon;
                      return (
                        <button key={t} onClick={() => setLType(t)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-colors ${
                            lType === t ? "border-[var(--forest)] bg-[var(--forest)]/10" : "hover:bg-muted"
                          }`}>
                          <Icon className={`h-4 w-4 ${lType === t ? "text-[var(--forest)]" : cfg.color}`} />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Date</label>
                    <Input type="date" value={lDate} onChange={e => setLDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Description *</label>
                    <Input placeholder="e.g. Accra – Kumasi delivery run" value={lDesc} onChange={e => setLDesc(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Driver</label>
                    <Input placeholder="Driver name" value={lDriver} onChange={e => setLDriver(e.target.value)} />
                  </div>
                  {lType === "trip" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Origin</label>
                        <Input placeholder="Accra" value={lOrigin} onChange={e => setLOrigin(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Destination</label>
                        <Input placeholder="Kumasi" value={lDest} onChange={e => setLDest(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Distance (km)</label>
                        <Input type="number" value={lDist} onChange={e => setLDist(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Odometer End</label>
                        <Input type="number" placeholder="km" value={lOdo} onChange={e => setLOdo(e.target.value)} />
                      </div>
                    </div>
                  )}
                  {lType === "fuel" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Litres</label>
                        <Input type="number" value={lFuelL} onChange={e => setLFuelL(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Odometer</label>
                        <Input type="number" placeholder="km" value={lOdo} onChange={e => setLOdo(e.target.value)} />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium mb-1 block">Cost (GHS)</label>
                    <Input type="number" value={lCost} onChange={e => setLCost(e.target.value)} />
                  </div>
                </div>
                <div className="p-4 border-t">
                  <Button className="w-full" style={{ background: "var(--forest)" }}
                    onClick={() => addLog.mutate()} disabled={addLog.isPending || !lDesc}>
                    <Save className="h-4 w-4 mr-2" />
                    {addLog.isPending ? "Saving…" : "Save Log Entry"}
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Vehicle list ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fleet Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Vehicles, trips, fuel and maintenance tracking</p>
        </div>
        <Button style={{ background: "var(--forest)" }} onClick={() => setShowAddVehicle(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Vehicle
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {(["all", "active", "maintenance", "disposed"] as const).map(s => (
          <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"}
            style={filterStatus === s ? { background: "var(--forest)" } : {}}
            onClick={() => setFilterStatus(s)}>
            {s === "all" ? "All" : VEHICLE_STATUS_CFG[s as VehicleStatus]?.label ?? s}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center">
          <Truck className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No vehicles yet. Add your first vehicle.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {vehicles.map(v => {
            const cfg = VEHICLE_STATUS_CFG[v.status];
            return (
              <motion.div key={v.id} whileHover={{ y: -2 }}
                onClick={() => setSelected(v)}
                className="bg-card border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-lg">{v.registration}</p>
                    <p className="text-sm text-muted-foreground">{v.year} {v.make} {v.model}</p>
                  </div>
                  <Badge className={cfg.color + " border-0"}>{cfg.label}</Badge>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                  {v.assigned_driver && <span className="flex items-center gap-1"><User className="h-3 w-3" />{v.assigned_driver}</span>}
                  {v.fuel_type && <span className="flex items-center gap-1"><Fuel className="h-3 w-3" />{v.fuel_type}</span>}
                  <span className="flex items-center gap-1"><Gauge className="h-3 w-3" />{(v.odometer_km ?? 0).toLocaleString()} km</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add vehicle modal */}
      <AnimatePresence>
        {showAddVehicle && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowAddVehicle(false)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-2xl z-50 flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-bold text-lg">Add Vehicle</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowAddVehicle(false)}>✕</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">Registration *</label>
                    <Input placeholder="GR-1234-20" value={vReg} onChange={e => setVReg(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Make *</label>
                    <Input placeholder="Toyota" value={vMake} onChange={e => setVMake(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Model *</label>
                    <Input placeholder="Hilux" value={vModel} onChange={e => setVModel(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Year</label>
                    <Input type="number" value={vYear} onChange={e => setVYear(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Type</label>
                    <Select value={vType} onValueChange={v => setVType(v as VehicleType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["truck","van","sedan","bus","pickup","motorcycle","other"].map(t => (
                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Fuel Type</label>
                    <Select value={vFuel} onValueChange={v => setVFuel(v as FuelType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["petrol","diesel","electric","lpg"].map(f => (
                          <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Odometer (km)</label>
                    <Input type="number" value={vOdo} onChange={e => setVOdo(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">Assigned Driver</label>
                    <Input placeholder="Driver name" value={vDriver} onChange={e => setVDriver(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t">
                <Button className="w-full" style={{ background: "var(--forest)" }}
                  onClick={() => addVehicle.mutate()} disabled={addVehicle.isPending || !vReg || !vMake || !vModel}>
                  <Save className="h-4 w-4 mr-2" />
                  {addVehicle.isPending ? "Saving…" : "Add Vehicle"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
