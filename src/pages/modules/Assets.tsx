import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, differenceInYears } from "date-fns";
import {
  Package, Plus, ChevronLeft, Edit2, Trash2, Save, X,
  Calculator, MapPin, Tag, Calendar, TrendingDown, Activity
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

type AssetStatus = "active" | "disposed" | "sold" | "written-off";
type DepreciationMethod = "straight-line" | "none";

interface Asset {
  id: string;
  name: string;
  asset_code: string | null;
  category: string;
  purchase_date: string;
  purchase_cost: number;
  salvage_value: number;
  useful_life_years: number;
  depreciation_method: DepreciationMethod;
  current_value: number | null;
  location: string | null;
  status: AssetStatus;
  disposal_date: string | null;
  disposal_value: number | null;
  notes: string | null;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ASSET_CATEGORIES = [
  "Vehicle", "Equipment", "Furniture & Fixtures", "Computer & IT",
  "Land & Building", "Plant & Machinery", "Tools", "Other",
];

const STATUS_CONFIG: Record<AssetStatus, { label: string; color: string }> = {
  "active":     { label: "Active",      color: "bg-green-100 text-green-700"  },
  "disposed":   { label: "Disposed",    color: "bg-slate-100 text-slate-600"  },
  "sold":       { label: "Sold",        color: "bg-blue-100 text-blue-700"    },
  "written-off":{ label: "Written Off", color: "bg-red-100 text-red-600"      },
};

// ── Depreciation helpers ──────────────────────────────────────────────────────

function calcDepreciation(asset: Asset): {
  annualDep: number;
  accumulatedDep: number;
  bookValue: number;
  yearsUsed: number;
} {
  if (asset.depreciation_method === "none") {
    return { annualDep: 0, accumulatedDep: 0, bookValue: asset.purchase_cost, yearsUsed: 0 };
  }
  const yearsUsed = Math.max(0, differenceInYears(new Date(), parseISO(asset.purchase_date)));
  const depBase   = asset.purchase_cost - asset.salvage_value;
  const annualDep = asset.useful_life_years > 0 ? depBase / asset.useful_life_years : 0;
  const accumulated = Math.min(annualDep * yearsUsed, depBase);
  const bookValue   = Math.max(asset.purchase_cost - accumulated, asset.salvage_value);
  return {
    annualDep:      Math.round(annualDep      * 100) / 100,
    accumulatedDep: Math.round(accumulated    * 100) / 100,
    bookValue:      Math.round(bookValue      * 100) / 100,
    yearsUsed,
  };
}

// ── Asset card ────────────────────────────────────────────────────────────────

function AssetCard({ asset, onClick }: { asset: Asset; onClick: () => void }) {
  const { bookValue } = calcDepreciation(asset);
  const cfg = STATUS_CONFIG[asset.status];
  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="bg-card border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow space-y-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{asset.name}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            {asset.asset_code && (
              <span className="text-xs text-muted-foreground font-mono">{asset.asset_code}</span>
            )}
            <span className="text-xs text-muted-foreground">· {asset.category}</span>
          </div>
        </div>
        <Badge className={cfg.color + " border-0 text-xs shrink-0"}>{cfg.label}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Cost</p>
          <p className="font-medium">{formatGHS(asset.purchase_cost)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Book Value</p>
          <p className="font-medium">{formatGHS(asset.current_value ?? bookValue)}</p>
        </div>
      </div>
      {asset.location && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {asset.location}
        </div>
      )}
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Assets() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const businessId = business?.id;

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showForm, setShowForm]           = useState(false);
  const [filterStatus, setFilterStatus]   = useState<AssetStatus | "all">("active");
  const [filterCat,    setFilterCat]      = useState("all");
  const [editing, setEditing]             = useState(false);

  // Form state
  const [fName,       setFName]       = useState("");
  const [fCode,       setFCode]       = useState("");
  const [fCategory,   setFCategory]   = useState(ASSET_CATEGORIES[0]);
  const [fPurchDate,  setFPurchDate]  = useState(format(new Date(), "yyyy-MM-dd"));
  const [fCost,       setFCost]       = useState("");
  const [fSalvage,    setFSalvage]    = useState("0");
  const [fLife,       setFLife]       = useState("5");
  const [fMethod,     setFMethod]     = useState<DepreciationMethod>("straight-line");
  const [fLocation,   setFLocation]   = useState("");
  const [fNotes,      setFNotes]      = useState("");

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ["assets", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createAsset = useMutation({
    mutationFn: async () => {
      if (!businessId || !fName || !fCost) throw new Error("Fill required fields");
      const { error } = await supabase
        .from("assets")
        .insert({
          business_id:         businessId,
          name:                fName,
          asset_code:          fCode || null,
          category:            fCategory,
          purchase_date:       fPurchDate,
          purchase_cost:       parseFloat(fCost),
          salvage_value:       parseFloat(fSalvage) || 0,
          useful_life_years:   parseInt(fLife) || 5,
          depreciation_method: fMethod,
          location:            fLocation || null,
          notes:               fNotes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Asset added");
      qc.invalidateQueries({ queryKey: ["assets"] });
      setShowForm(false);
      setFName(""); setFCode(""); setFCost(""); setFSalvage("0");
      setFLife("5"); setFLocation(""); setFNotes("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AssetStatus }) => {
      const { error } = await supabase
        .from("assets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(`Asset marked as ${status}`);
      qc.invalidateQueries({ queryKey: ["assets"] });
      if (selectedAsset) setSelectedAsset(prev => prev ? { ...prev, status } : null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Asset deleted");
      qc.invalidateQueries({ queryKey: ["assets"] });
      setSelectedAsset(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ── Filtered assets ────────────────────────────────────────────────────────

  const filtered = assets.filter(a => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterCat    !== "all" && a.category !== filterCat)  return false;
    return true;
  });

  const categories = [...new Set(assets.map(a => a.category))];

  // ── Summary ────────────────────────────────────────────────────────────────

  const totalCost       = assets.filter(a => a.status === "active").reduce((s, a) => s + a.purchase_cost, 0);
  const totalBookValue  = assets.filter(a => a.status === "active").reduce((s, a) => s + (a.current_value ?? calcDepreciation(a).bookValue), 0);
  const totalDepreciated = totalCost - totalBookValue;

  // ── Detail view ────────────────────────────────────────────────────────────

  if (selectedAsset) {
    const dep = calcDepreciation(selectedAsset);
    const cfg = STATUS_CONFIG[selectedAsset.status];

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedAsset(null)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{selectedAsset.name}</h1>
              {selectedAsset.asset_code && (
                <span className="font-mono text-sm text-muted-foreground">({selectedAsset.asset_code})</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{selectedAsset.category}</p>
          </div>
          <Badge className={cfg.color + " border-0"}>{cfg.label}</Badge>
          {selectedAsset.status === "active" && (
            <Button variant="outline" size="sm"
              onClick={() => updateStatus.mutate({ id: selectedAsset.id, status: "disposed" })}>
              Dispose
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-red-500"
            onClick={() => { if (confirm("Delete this asset?")) deleteAsset.mutate(selectedAsset.id); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Purchase Cost",    value: formatGHS(selectedAsset.purchase_cost),       icon: Tag          },
            { label: "Book Value",       value: formatGHS(selectedAsset.current_value ?? dep.bookValue), icon: TrendingDown },
            { label: "Annual Deprec.",   value: formatGHS(dep.annualDep),                     icon: Calculator   },
            { label: "Accumulated Dep.", value: formatGHS(dep.accumulatedDep),                icon: Activity     },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-xs">{label}</span>
              </div>
              <div className="font-bold text-lg">{value}</div>
            </div>
          ))}
        </div>

        {/* Depreciation schedule */}
        {selectedAsset.depreciation_method === "straight-line" && (
          <div className="bg-card border rounded-xl p-4">
            <h2 className="font-semibold mb-3">Depreciation Schedule</h2>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p><strong className="text-foreground">Method:</strong> Straight-Line</p>
              <p><strong className="text-foreground">Useful Life:</strong> {selectedAsset.useful_life_years} years</p>
              <p><strong className="text-foreground">Salvage Value:</strong> {formatGHS(selectedAsset.salvage_value)}</p>
              <p><strong className="text-foreground">Annual Charge:</strong> {formatGHS(dep.annualDep)}</p>
              <p><strong className="text-foreground">Years Used:</strong> {dep.yearsUsed} yr(s)</p>
            </div>
            {/* Visual bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span>Accumulated</span>
                <span>{selectedAsset.purchase_cost > 0 ? Math.round((dep.accumulatedDep / selectedAsset.purchase_cost) * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${selectedAsset.purchase_cost > 0 ? (dep.accumulatedDep / selectedAsset.purchase_cost) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Details panel */}
        <div className="bg-card border rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
          {[
            { label: "Purchase Date", value: format(parseISO(selectedAsset.purchase_date), "d MMMM yyyy"), icon: Calendar },
            { label: "Location",      value: selectedAsset.location ?? "—",                                icon: MapPin   },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label}>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                <Icon className="h-3.5 w-3.5" /><span className="text-xs">{label}</span>
              </div>
              <p className="font-medium">{value}</p>
            </div>
          ))}
          {selectedAsset.notes && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
              <p>{selectedAsset.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fixed Assets</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Asset register with straight-line depreciation</p>
        </div>
        <Button style={{ background: "var(--forest)" }} onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Asset
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Cost (Active)",  value: formatGHS(totalCost),        color: "text-blue-600"  },
          { label: "Total Book Value",     value: formatGHS(totalBookValue),    color: "text-[var(--forest)]" },
          { label: "Total Depreciated",    value: formatGHS(totalDepreciated),  color: "text-amber-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "active", "disposed", "sold", "written-off"] as const).map(s => (
          <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"}
            style={filterStatus === s ? { background: "var(--forest)" } : {}}
            onClick={() => setFilterStatus(s)}>
            {s === "all" ? "All" : STATUS_CONFIG[s as AssetStatus]?.label ?? s}
          </Button>
        ))}
        {categories.length > 0 && (
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center">
          <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No assets found. Add your first fixed asset.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => <AssetCard key={a.id} asset={a} onClick={() => setSelectedAsset(a)} />)}
        </div>
      )}

      {/* Add asset modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-2xl z-50 flex flex-col"
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-bold text-lg">Add Fixed Asset</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>✕</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">Asset Name *</label>
                    <Input placeholder="e.g. Toyota Hilux 2023" value={fName} onChange={e => setFName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Asset Code</label>
                    <Input placeholder="AST-001" value={fCode} onChange={e => setFCode(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Category</label>
                    <Select value={fCategory} onValueChange={setFCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASSET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Purchase Date *</label>
                    <Input type="date" value={fPurchDate} onChange={e => setFPurchDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Purchase Cost (GHS) *</label>
                    <Input type="number" placeholder="0.00" value={fCost} onChange={e => setFCost(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Salvage Value (GHS)</label>
                    <Input type="number" placeholder="0.00" value={fSalvage} onChange={e => setFSalvage(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Useful Life (years)</label>
                    <Input type="number" min="1" max="50" value={fLife} onChange={e => setFLife(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Depreciation Method</label>
                    <Select value={fMethod} onValueChange={v => setFMethod(v as DepreciationMethod)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="straight-line">Straight-Line</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {fCost && fMethod === "straight-line" && (
                    <div className="col-span-2 bg-muted rounded-lg px-3 py-2 text-sm">
                      <Calculator className="h-3.5 w-3.5 inline mr-1" />
                      Annual depreciation: <strong>
                        {formatGHS(((parseFloat(fCost) || 0) - (parseFloat(fSalvage) || 0)) / (parseInt(fLife) || 1))}
                      </strong>
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">Location</label>
                    <Input placeholder="e.g. Head Office, Branch 1" value={fLocation} onChange={e => setFLocation(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium mb-1 block">Notes</label>
                    <Input placeholder="Optional" value={fNotes} onChange={e => setFNotes(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t">
                <Button
                  className="w-full"
                  style={{ background: "var(--forest)" }}
                  onClick={() => createAsset.mutate()}
                  disabled={createAsset.isPending || !fName || !fCost}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createAsset.isPending ? "Saving…" : "Save Asset"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
