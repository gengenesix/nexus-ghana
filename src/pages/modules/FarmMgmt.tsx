import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  Leaf, Plus, ChevronLeft, Sun, Droplets, Scissors,
  Sprout, Map, Calendar, Save, BarChart3
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

type PlotStatus    = "fallow" | "planted" | "growing" | "harvested";
type SeasonStatus  = "planning" | "active" | "completed";
type ActivityType  = "planting" | "fertilising" | "spraying" | "irrigating" | "weeding" | "harvesting" | "other";

interface FarmPlot {
  id: string;
  name: string;
  size_hectares: number | null;
  location: string | null;
  crop_type: string | null;
  status: PlotStatus;
  notes: string | null;
}

interface FarmSeason {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: SeasonStatus;
  notes: string | null;
}

interface FarmActivity {
  id: string;
  plot_id: string | null;
  season_id: string | null;
  activity_date: string;
  activity_type: ActivityType;
  description: string;
  cost: number | null;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
}

// ── Config ─────────────────────────────────────────────────────────────────────

const PLOT_STATUS_CFG: Record<PlotStatus, { label: string; color: string }> = {
  fallow:    { label: "Fallow",    color: "bg-slate-100 text-slate-600"  },
  planted:   { label: "Planted",   color: "bg-amber-100 text-amber-700"  },
  growing:   { label: "Growing",   color: "bg-green-100 text-green-700"  },
  harvested: { label: "Harvested", color: "bg-blue-100 text-blue-700"    },
};

const SEASON_STATUS_CFG: Record<SeasonStatus, { label: string; color: string }> = {
  planning:  { label: "Planning",  color: "bg-slate-100 text-slate-600"  },
  active:    { label: "Active",    color: "bg-green-100 text-green-700"  },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-700"    },
};

const ACTIVITY_CFG: Record<ActivityType, { label: string; icon: typeof Leaf; color: string }> = {
  planting:    { label: "Planting",    icon: Sprout,   color: "text-green-600"  },
  fertilising: { label: "Fertilising", icon: Leaf,     color: "text-amber-600"  },
  spraying:    { label: "Spraying",    icon: Droplets, color: "text-blue-500"   },
  irrigating:  { label: "Irrigating",  icon: Droplets, color: "text-cyan-500"   },
  weeding:     { label: "Weeding",     icon: Scissors, color: "text-orange-500" },
  harvesting:  { label: "Harvesting",  icon: Sun,      color: "text-yellow-500" },
  other:       { label: "Other",       icon: Leaf,     color: "text-slate-500"  },
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function FarmMgmt() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const businessId = business?.id;

  const [tab, setTab]               = useState<"plots" | "seasons" | "activities">("plots");
  const [selectedPlot, setSelectedPlot] = useState<FarmPlot | null>(null);
  const [showAddPlot,   setShowAddPlot] = useState(false);
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);

  // Plot form
  const [pName,  setPName]  = useState("");
  const [pSize,  setPSize]  = useState("");
  const [pLoc,   setPLoc]   = useState("");
  const [pCrop,  setPCrop]  = useState("");

  // Season form
  const [sName,  setSName]  = useState("");
  const [sStart, setSStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [sEnd,   setSEnd]   = useState("");

  // Activity form
  const [aDate,  setADate]  = useState(format(new Date(), "yyyy-MM-dd"));
  const [aType,  setAType]  = useState<ActivityType>("planting");
  const [aDesc,  setADesc]  = useState("");
  const [aCost,  setACost]  = useState("0");
  const [aQty,   setAQty]   = useState("");
  const [aUnit,  setAUnit]  = useState("");
  const [aPlot,  setAPlot]  = useState<string>("all");
  const [aSeason,setASeason]= useState<string>("none");

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: plots = [], isLoading: plotsLoading } = useQuery<FarmPlot[]>({
    queryKey: ["farm-plots", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("farm_plots").select("*").eq("business_id", businessId).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: seasons = [] } = useQuery<FarmSeason[]>({
    queryKey: ["farm-seasons", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("farm_seasons").select("*").eq("business_id", businessId).order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: activities = [] } = useQuery<(FarmActivity & { plot_name?: string; season_name?: string })[]>({
    queryKey: ["farm-activities", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("farm_activities")
        .select("*, farm_plots(name), farm_seasons(name)")
        .eq("business_id", businessId)
        .order("activity_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((a: any) => ({
        ...a,
        plot_name:   a.farm_plots?.name   ?? null,
        season_name: a.farm_seasons?.name ?? null,
      }));
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addPlot = useMutation({
    mutationFn: async () => {
      if (!businessId || !pName) throw new Error("Plot name required");
      const { error } = await (supabase as any)
        .from("farm_plots")
        .insert({ business_id: businessId, name: pName, size_hectares: pSize ? parseFloat(pSize) : null, location: pLoc || null, crop_type: pCrop || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plot added");
      qc.invalidateQueries({ queryKey: ["farm-plots"] });
      setShowAddPlot(false);
      setPName(""); setPSize(""); setPLoc(""); setPCrop("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addSeason = useMutation({
    mutationFn: async () => {
      if (!businessId || !sName || !sEnd) throw new Error("Name and end date required");
      const { error } = await (supabase as any)
        .from("farm_seasons")
        .insert({ business_id: businessId, name: sName, start_date: sStart, end_date: sEnd });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Season created");
      qc.invalidateQueries({ queryKey: ["farm-seasons"] });
      setShowAddSeason(false);
      setSName(""); setSEnd("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const activateSeason = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("farm_seasons").update({ status: "active" }).eq("id", id);
    },
    onSuccess: () => {
      toast.success("Season activated");
      qc.invalidateQueries({ queryKey: ["farm-seasons"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updatePlotStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PlotStatus }) => {
      const { error } = await (supabase as any).from("farm_plots").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["farm-plots"] });
      if (selectedPlot) setSelectedPlot(prev => prev ? { ...prev } : null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addActivity = useMutation({
    mutationFn: async () => {
      if (!businessId || !aDesc) throw new Error("Description required");
      const { error } = await (supabase as any)
        .from("farm_activities")
        .insert({
          business_id:   businessId,
          plot_id:       aPlot   !== "all"  ? aPlot   : null,
          season_id:     aSeason !== "none" ? aSeason : null,
          activity_date: aDate,
          activity_type: aType,
          description:   aDesc,
          cost:          parseFloat(aCost) || null,
          quantity:      aQty  ? parseFloat(aQty)  : null,
          unit:          aUnit || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activity logged");
      qc.invalidateQueries({ queryKey: ["farm-activities"] });
      setShowAddActivity(false);
      setADesc(""); setACost("0"); setAQty(""); setAUnit("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ── Summaries ──────────────────────────────────────────────────────────────

  const totalHa      = plots.reduce((s, p) => s + (p.size_hectares ?? 0), 0);
  const totalCost    = activities.reduce((s, a) => s + (a.cost ?? 0), 0);
  const activePlots  = plots.filter(p => p.status === "growing" || p.status === "planted").length;
  const activeSeason = seasons.find(s => s.status === "active");

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Farm Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Plots, seasons, crop activities & harvest tracking</p>
        </div>
        <div className="flex gap-2">
          {tab === "plots"      && <Button size="sm" style={{ background: "var(--forest)" }} onClick={() => setShowAddPlot(true)}><Plus className="h-4 w-4 mr-1" /> Add Plot</Button>}
          {tab === "seasons"    && <Button size="sm" style={{ background: "var(--forest)" }} onClick={() => setShowAddSeason(true)}><Plus className="h-4 w-4 mr-1" /> New Season</Button>}
          {tab === "activities" && <Button size="sm" style={{ background: "var(--forest)" }} onClick={() => setShowAddActivity(true)}><Plus className="h-4 w-4 mr-1" /> Log Activity</Button>}
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Plots",    value: `${plots.length}`,       color: "" },
          { label: "Total Area",     value: `${totalHa.toFixed(1)} ha`, color: "" },
          { label: "Active Plots",   value: `${activePlots}`,        color: "text-green-600" },
          { label: "Season Cost",    value: formatGHS(totalCost),    color: "text-amber-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Active season badge */}
      {activeSeason && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 flex items-center gap-2 text-sm text-green-700">
          <Sun className="h-4 w-4" />
          <strong>Active Season:</strong> {activeSeason.name} (ends {format(parseISO(activeSeason.end_date), "d MMM yyyy")})
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-2 border-b">
        {([
          { key: "plots",      label: "Plots",      icon: Map      },
          { key: "seasons",    label: "Seasons",    icon: Calendar },
          { key: "activities", label: "Activities", icon: BarChart3 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? "border-[var(--forest)] text-[var(--forest)]" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* Plots tab */}
      {tab === "plots" && (
        plotsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : plots.length === 0 ? (
          <div className="bg-card border rounded-xl p-12 text-center">
            <Leaf className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No plots yet. Add your first farm plot or field.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plots.map(plot => {
              const cfg = PLOT_STATUS_CFG[plot.status];
              return (
                <div key={plot.id} className="bg-card border rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold">{plot.name}</h3>
                    <Badge className={cfg.color + " border-0 text-xs"}>{cfg.label}</Badge>
                  </div>
                  {plot.crop_type && <p className="text-sm text-muted-foreground">{plot.crop_type}</p>}
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {plot.size_hectares && <span>{plot.size_hectares} ha</span>}
                    {plot.location && <span>{plot.location}</span>}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {(["fallow","planted","growing","harvested"] as PlotStatus[]).map(s => (
                      <button key={s} onClick={() => updatePlotStatus.mutate({ id: plot.id, status: s })}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          plot.status === s ? "bg-[var(--forest)] text-white border-[var(--forest)]" : "hover:bg-muted"
                        }`}>
                        {PLOT_STATUS_CFG[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Seasons tab */}
      {tab === "seasons" && (
        seasons.length === 0 ? (
          <div className="bg-card border rounded-xl p-12 text-center">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No seasons created. Start a new farming season.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {seasons.map(season => {
              const cfg = SEASON_STATUS_CFG[season.status];
              return (
                <div key={season.id} className="bg-card border rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{season.name}</p>
                      <Badge className={cfg.color + " border-0 text-xs"}>{cfg.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(season.start_date), "d MMM yyyy")} – {format(parseISO(season.end_date), "d MMM yyyy")}
                    </p>
                  </div>
                  {season.status === "planning" && (
                    <Button size="sm" style={{ background: "var(--forest)" }}
                      onClick={() => activateSeason.mutate(season.id)}>
                      Activate
                    </Button>
                  )}
                  {season.status === "active" && (
                    <Button size="sm" variant="outline"
                      onClick={() => (supabase as any).from("farm_seasons").update({ status: "completed" }).eq("id", season.id).then(() => qc.invalidateQueries({ queryKey: ["farm-seasons"] }))}>
                      Complete
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Activities tab */}
      {tab === "activities" && (
        activities.length === 0 ? (
          <div className="bg-card border rounded-xl p-12 text-center">
            <Sprout className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No activities logged yet.</p>
          </div>
        ) : (
          <div className="bg-card border rounded-xl divide-y overflow-hidden">
            {activities.map(act => {
              const cfg  = ACTIVITY_CFG[act.activity_type];
              const Icon = cfg.icon;
              return (
                <div key={act.id} className="flex items-start gap-3 px-4 py-3">
                  <div className={`p-1.5 rounded-full bg-muted mt-0.5 ${cfg.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{act.description}</p>
                      <span className="text-xs text-muted-foreground">{cfg.label}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span>{format(parseISO(act.activity_date), "d MMM yyyy")}</span>
                      {(act as any).plot_name   && <span>Plot: {(act as any).plot_name}</span>}
                      {(act as any).season_name && <span>Season: {(act as any).season_name}</span>}
                      {act.quantity && act.unit  && <span>{act.quantity} {act.unit}</span>}
                    </div>
                  </div>
                  {act.cost != null && act.cost > 0 && (
                    <span className="text-sm font-medium shrink-0">{formatGHS(act.cost)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Add Plot modal */}
      <AnimatePresence>
        {showAddPlot && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowAddPlot(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-background border rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <h2 className="font-bold text-lg">Add Farm Plot</h2>
                <div>
                  <label className="text-sm font-medium mb-1 block">Plot Name *</label>
                  <Input placeholder="e.g. Block A, North Field" value={pName} onChange={e => setPName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Size (hectares)</label>
                    <Input type="number" step="0.1" value={pSize} onChange={e => setPSize(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Location</label>
                    <Input placeholder="GPS / area" value={pLoc} onChange={e => setPLoc(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Crop Type</label>
                  <Input placeholder="Maize, Tomatoes, Cocoa…" value={pCrop} onChange={e => setPCrop(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddPlot(false)}>Cancel</Button>
                  <Button className="flex-1" style={{ background: "var(--forest)" }}
                    onClick={() => addPlot.mutate()} disabled={addPlot.isPending || !pName}>
                    {addPlot.isPending ? "Adding…" : "Add Plot"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Season modal */}
      <AnimatePresence>
        {showAddSeason && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowAddSeason(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-background border rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <h2 className="font-bold text-lg">New Farming Season</h2>
                <div>
                  <label className="text-sm font-medium mb-1 block">Season Name *</label>
                  <Input placeholder="2026 Major Season" value={sName} onChange={e => setSName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Start Date</label>
                    <Input type="date" value={sStart} onChange={e => setSStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">End Date *</label>
                    <Input type="date" value={sEnd} onChange={e => setSEnd(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddSeason(false)}>Cancel</Button>
                  <Button className="flex-1" style={{ background: "var(--forest)" }}
                    onClick={() => addSeason.mutate()} disabled={addSeason.isPending || !sName || !sEnd}>
                    {addSeason.isPending ? "Creating…" : "Create Season"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Log Activity slide-in */}
      <AnimatePresence>
        {showAddActivity && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowAddActivity(false)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-2xl z-50 flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-bold text-lg">Log Farm Activity</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowAddActivity(false)}>✕</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Activity type grid */}
                <div className="grid grid-cols-4 gap-2">
                  {(Object.entries(ACTIVITY_CFG) as [ActivityType, typeof ACTIVITY_CFG[ActivityType]][]).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button key={key} onClick={() => setAType(key)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-colors ${
                          aType === key ? "border-[var(--forest)] bg-[var(--forest)]/10 text-[var(--forest)]" : "hover:bg-muted"
                        }`}>
                        <Icon className={`h-4 w-4 ${aType === key ? "text-[var(--forest)]" : cfg.color}`} />
                        <span className="truncate w-full text-center">{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date</label>
                  <Input type="date" value={aDate} onChange={e => setADate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Description *</label>
                  <Input placeholder="What was done?" value={aDesc} onChange={e => setADesc(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Plot</label>
                  <Select value={aPlot} onValueChange={setAPlot}>
                    <SelectTrigger><SelectValue placeholder="All plots" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All plots</SelectItem>
                      {plots.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {seasons.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Season</label>
                    <Select value={aSeason} onValueChange={setASeason}>
                      <SelectTrigger><SelectValue placeholder="No season" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No season</SelectItem>
                        {seasons.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Quantity</label>
                    <Input type="number" placeholder="50" value={aQty} onChange={e => setAQty(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Unit</label>
                    <Input placeholder="kg, bags…" value={aUnit} onChange={e => setAUnit(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Cost (GHS)</label>
                    <Input type="number" value={aCost} onChange={e => setACost(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t">
                <Button className="w-full" style={{ background: "var(--forest)" }}
                  onClick={() => addActivity.mutate()} disabled={addActivity.isPending || !aDesc}>
                  <Save className="h-4 w-4 mr-2" />
                  {addActivity.isPending ? "Logging…" : "Log Activity"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
