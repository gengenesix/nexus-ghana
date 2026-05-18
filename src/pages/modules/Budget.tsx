import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  PieChart, TrendingUp, TrendingDown, Plus, ChevronLeft,
  Edit2, Trash2, Save, X, BarChart3, AlertTriangle, CheckCircle2
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

type BudgetStatus = "draft" | "active" | "closed";

interface Budget {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: BudgetStatus;
  total_budget: number;
  notes: string | null;
  created_at: string;
}

interface BudgetLine {
  id: string;
  budget_id: string;
  category: string;
  description: string | null;
  budgeted: number;
  actual: number;
  variance: number;
  sort_order: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const LINE_CATEGORIES = [
  "Salaries & Wages", "Rent & Utilities", "Marketing", "Raw Materials",
  "Transport & Logistics", "Insurance", "Equipment", "Maintenance",
  "Professional Fees", "Taxes & Levies", "Miscellaneous",
];

const STATUS_CONFIG: Record<BudgetStatus, { label: string; color: string }> = {
  draft:  { label: "Draft",  color: "bg-amber-100 text-amber-700"  },
  active: { label: "Active", color: "bg-green-100 text-green-700"  },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-600"  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(actual: number, budgeted: number): number {
  if (!budgeted) return 0;
  return Math.round((actual / budgeted) * 100);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BudgetCard({ budget, onClick }: { budget: Budget; onClick: () => void }) {
  const cfg   = STATUS_CONFIG[budget.status];
  const spent = budget.total_budget; // We compute actual from lines
  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="bg-card border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold">{budget.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(parseISO(budget.period_start), "d MMM yyyy")} –{" "}
            {format(parseISO(budget.period_end),   "d MMM yyyy")}
          </p>
        </div>
        <Badge className={cfg.color + " border-0"}>{cfg.label}</Badge>
      </div>
      <div className="text-2xl font-bold">{formatGHS(budget.total_budget)}</div>
      <p className="text-xs text-muted-foreground mt-0.5">Total budget</p>
    </motion.div>
  );
}

function VarianceBar({ actual, budgeted }: { actual: number; budgeted: number }) {
  const ratio  = budgeted > 0 ? Math.min(actual / budgeted, 1) : 0;
  const over   = actual > budgeted;
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-[var(--forest)]"}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Budget() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const businessId = business?.id;

  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [showNewBudget,   setShowNewBudget]  = useState(false);
  const [showNewLine,     setShowNewLine]    = useState(false);
  const [editingLine,     setEditingLine]    = useState<BudgetLine | null>(null);

  // New budget form
  const [bName,  setBName]  = useState("");
  const [bStart, setBStart] = useState(format(new Date(), "yyyy-MM-01"));
  const [bEnd,   setBEnd]   = useState(format(new Date(), "yyyy-MM-dd"));
  const [bNotes, setBNotes] = useState("");

  // New line form
  const [lCategory, setLCategory] = useState(LINE_CATEGORIES[0]);
  const [lDesc,     setLDesc]     = useState("");
  const [lBudgeted, setLBudgeted] = useState("");
  const [lActual,   setLActual]   = useState("0");

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: budgets = [], isLoading } = useQuery<Budget[]>({
    queryKey: ["budgets", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("budgets")
        .select("*")
        .eq("business_id", businessId)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: lines = [] } = useQuery<BudgetLine[]>({
    queryKey: ["budget-lines", selectedBudget?.id],
    enabled: !!selectedBudget,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("budget_lines")
        .select("*")
        .eq("budget_id", selectedBudget!.id)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createBudget = useMutation({
    mutationFn: async () => {
      if (!businessId || !bName) throw new Error("Name required");
      const { error } = await (supabase as any)
        .from("budgets")
        .insert({ business_id: businessId, name: bName, period_start: bStart, period_end: bEnd, notes: bNotes || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Budget created");
      qc.invalidateQueries({ queryKey: ["budgets"] });
      setShowNewBudget(false);
      setBName(""); setBNotes("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BudgetStatus }) => {
      const { error } = await (supabase as any)
        .from("budgets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(`Budget marked as ${status}`);
      qc.invalidateQueries({ queryKey: ["budgets"] });
      if (selectedBudget) setSelectedBudget(prev => prev ? { ...prev, status } : null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addLine = useMutation({
    mutationFn: async () => {
      if (!businessId || !selectedBudget || !lBudgeted) throw new Error("Fill required fields");
      const budgeted = parseFloat(lBudgeted);
      const actual   = parseFloat(lActual)   || 0;
      const { error } = await (supabase as any)
        .from("budget_lines")
        .insert({
          business_id: businessId,
          budget_id:   selectedBudget.id,
          category:    lCategory,
          description: lDesc || null,
          budgeted,
          actual,
          sort_order:  lines.length,
        });
      if (error) throw error;
      // Update budget total
      const newTotal = lines.reduce((s, l) => s + l.budgeted, 0) + budgeted;
      await (supabase as any)
        .from("budgets")
        .update({ total_budget: newTotal, updated_at: new Date().toISOString() })
        .eq("id", selectedBudget.id);
    },
    onSuccess: () => {
      toast.success("Line added");
      qc.invalidateQueries({ queryKey: ["budget-lines"] });
      qc.invalidateQueries({ queryKey: ["budgets"] });
      setShowNewLine(false);
      setLDesc(""); setLBudgeted(""); setLActual("0");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateLine = useMutation({
    mutationFn: async () => {
      if (!editingLine) return;
      const { error } = await (supabase as any)
        .from("budget_lines")
        .update({ actual: editingLine.actual })
        .eq("id", editingLine.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Actual updated");
      qc.invalidateQueries({ queryKey: ["budget-lines"] });
      setEditingLine(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteLine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("budget_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Line removed");
      qc.invalidateQueries({ queryKey: ["budget-lines"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ── Totals ─────────────────────────────────────────────────────────────────

  const totalBudgeted = lines.reduce((s, l) => s + l.budgeted, 0);
  const totalActual   = lines.reduce((s, l) => s + l.actual,   0);
  const totalVariance = totalBudgeted - totalActual;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (selectedBudget) {
    return (
      <div className="space-y-6">
        {/* Detail header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedBudget(null)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{selectedBudget.name}</h1>
            <p className="text-sm text-muted-foreground">
              {format(parseISO(selectedBudget.period_start), "d MMM yyyy")} –{" "}
              {format(parseISO(selectedBudget.period_end),   "d MMM yyyy")}
            </p>
          </div>
          <Badge className={STATUS_CONFIG[selectedBudget.status].color + " border-0"}>
            {STATUS_CONFIG[selectedBudget.status].label}
          </Badge>
          {selectedBudget.status === "draft" && (
            <Button size="sm" style={{ background: "var(--forest)" }}
              onClick={() => updateStatus.mutate({ id: selectedBudget.id, status: "active" })}>
              Activate
            </Button>
          )}
          {selectedBudget.status === "active" && (
            <Button size="sm" variant="outline"
              onClick={() => updateStatus.mutate({ id: selectedBudget.id, status: "closed" })}>
              Close Budget
            </Button>
          )}
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Budgeted", value: formatGHS(totalBudgeted), icon: PieChart,     color: "text-blue-600"  },
            { label: "Total Actual",   value: formatGHS(totalActual),   icon: BarChart3,    color: "text-[var(--forest)]" },
            { label: "Variance",       value: formatGHS(totalVariance), icon: totalVariance >= 0 ? TrendingDown : TrendingUp,
              color: totalVariance >= 0 ? "text-green-600" : "text-red-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border rounded-xl p-4">
              <div className={`flex items-center gap-2 mb-2 ${color}`}>
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
              </div>
              <div className={`text-xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Overall progress */}
        {totalBudgeted > 0 && (
          <div className="bg-card border rounded-xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Overall Utilisation</span>
              <span className={pct(totalActual, totalBudgeted) > 100 ? "text-red-500 font-bold" : "text-muted-foreground"}>
                {pct(totalActual, totalBudgeted)}%
              </span>
            </div>
            <VarianceBar actual={totalActual} budgeted={totalBudgeted} />
          </div>
        )}

        {/* Lines table */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="font-semibold">Budget Lines</h2>
            {selectedBudget.status !== "closed" && (
              <Button size="sm" onClick={() => setShowNewLine(true)} style={{ background: "var(--forest)" }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Line
              </Button>
            )}
          </div>

          {lines.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No budget lines yet. Add income/expense categories to get started.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  {["Category","Description","Budgeted","Actual","Variance","%",""].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map(line => {
                  const overBudget = line.actual > line.budgeted;
                  return (
                    <tr key={line.id} className="border-b hover:bg-muted/20 group">
                      <td className="px-3 py-2 font-medium">{line.category}</td>
                      <td className="px-3 py-2 text-muted-foreground">{line.description ?? "—"}</td>
                      <td className="px-3 py-2">{formatGHS(line.budgeted)}</td>
                      <td className="px-3 py-2">
                        {editingLine?.id === line.id ? (
                          <Input
                            type="number"
                            className="h-7 w-28 text-xs"
                            value={editingLine.actual}
                            onChange={e => setEditingLine({ ...editingLine, actual: parseFloat(e.target.value) || 0 })}
                          />
                        ) : (
                          <span>{formatGHS(line.actual)}</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 font-medium ${overBudget ? "text-red-500" : "text-green-600"}`}>
                        {overBudget ? "-" : "+"}{formatGHS(Math.abs(line.variance))}
                      </td>
                      <td className="px-3 py-2 w-24">
                        <div className="flex items-center gap-1.5">
                          <VarianceBar actual={line.actual} budgeted={line.budgeted} />
                          <span className={`text-xs ${overBudget ? "text-red-500" : "text-muted-foreground"}`}>
                            {pct(line.actual, line.budgeted)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {editingLine?.id === line.id ? (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateLine.mutate()}>
                                <Save className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingLine(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingLine(line)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteLine.mutate(line.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Add line panel */}
        <AnimatePresence>
          {showNewLine && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              className="bg-card border rounded-xl p-4 space-y-3"
            >
              <h3 className="font-semibold">New Budget Line</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Category</label>
                  <Select value={lCategory} onValueChange={setLCategory}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LINE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Description</label>
                  <Input className="h-9" placeholder="Optional" value={lDesc} onChange={e => setLDesc(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Budgeted (GHS)</label>
                  <Input className="h-9" type="number" placeholder="0.00" value={lBudgeted} onChange={e => setLBudgeted(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Actual (GHS)</label>
                  <Input className="h-9" type="number" placeholder="0.00" value={lActual} onChange={e => setLActual(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowNewLine(false)}>Cancel</Button>
                <Button size="sm" style={{ background: "var(--forest)" }}
                  onClick={() => addLine.mutate()} disabled={addLine.isPending || !lBudgeted}>
                  {addLine.isPending ? "Adding…" : "Add Line"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Budget list view ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track planned vs. actual spend across periods</p>
        </div>
        <Button style={{ background: "var(--forest)" }} onClick={() => setShowNewBudget(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Budget
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No budgets yet. Create your first budget period.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map(b => (
            <BudgetCard key={b.id} budget={b} onClick={() => setSelectedBudget(b)} />
          ))}
        </div>
      )}

      {/* New budget form */}
      <AnimatePresence>
        {showNewBudget && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setShowNewBudget(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-background border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
                <h2 className="font-bold text-lg">New Budget Period</h2>
                <div>
                  <label className="text-sm font-medium mb-1 block">Name</label>
                  <Input placeholder="e.g. FY 2026, Q2 2026" value={bName} onChange={e => setBName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Start Date</label>
                    <Input type="date" value={bStart} onChange={e => setBStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">End Date</label>
                    <Input type="date" value={bEnd} onChange={e => setBEnd(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Notes</label>
                  <Input placeholder="Optional" value={bNotes} onChange={e => setBNotes(e.target.value)} />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setShowNewBudget(false)}>Cancel</Button>
                  <Button style={{ background: "var(--forest)" }}
                    onClick={() => createBudget.mutate()} disabled={createBudget.isPending || !bName}>
                    {createBudget.isPending ? "Creating…" : "Create Budget"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
