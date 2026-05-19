/**
 * Payroll — Ghana SSNIT + PAYE compliant payroll
 * ────────────────────────────────────────────────
 * Manages monthly payroll periods with per-employee SSNIT
 * and PAYE calculations using the 2024 Ghana tax bands.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Banknote, Plus, ChevronRight, CheckCircle2, Loader2,
  Download, Users, Trash2, ArrowLeft, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { formatGHS, calculatePayroll } from "@/lib/ghana";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────
interface PayrollPeriod {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: "draft" | "approved" | "paid";
  total_gross: number;
  total_paye: number;
  total_ssnit_employee: number;
  total_ssnit_employer: number;
  total_net: number;
  created_at: string;
}

interface PayrollEntry {
  id: string;
  employee_name: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  gross_salary: number;
  ssnit_employee: number;
  ssnit_employer: number;
  taxable_income: number;
  paye: number;
  other_deductions: number;
  net_pay: number;
}

// ── Employee row form (inside a period) ──────────────────────────────────────
function EmployeeRow({
  entry, onDelete,
}: { entry: PayrollEntry; onDelete: (id: string) => void }) {
  return (
    <div
      className="grid gap-2 rounded-2xl p-4 text-sm"
      style={{ backgroundColor: "hsl(var(--muted)/0.35)", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr 40px" }}
    >
      <span className="font-semibold truncate">{entry.employee_name}</span>
      <span>{formatGHS(entry.gross_salary)}</span>
      <span className="text-muted-foreground">{formatGHS(entry.ssnit_employee)}</span>
      <span className="text-muted-foreground">{formatGHS(entry.ssnit_employer)}</span>
      <span className="text-muted-foreground">{formatGHS(entry.taxable_income)}</span>
      <span className="text-muted-foreground">{formatGHS(entry.paye)}</span>
      <span className="font-bold" style={{ color: "var(--forest)" }}>{formatGHS(entry.net_pay)}</span>
      <button onClick={() => onDelete(entry.id)} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Add employee form ─────────────────────────────────────────────────────────
function AddEmployeeForm({ periodId, businessId, onAdded }: {
  periodId: string;
  businessId: string;
  onAdded: () => void;
}) {
  const [name,      setName]      = useState("");
  const [basic,     setBasic]     = useState("");
  const [housing,   setHousing]   = useState("");
  const [transport, setTransport] = useState("");
  const [otherAllow,setOtherAllow]= useState("");
  const [otherDed,  setOtherDed]  = useState("");
  const [saving, setSaving] = useState(false);

  const preview = calculatePayroll({
    basicSalary:        Number(basic)      || 0,
    housingAllowance:   Number(housing)    || 0,
    transportAllowance: Number(transport)  || 0,
    otherAllowances:    Number(otherAllow) || 0,
    otherDeductions:    Number(otherDed)   || 0,
  });

  const handleAdd = async () => {
    if (!name.trim() || !basic) { toast.error("Name and basic salary required"); return; }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("payroll_entries").insert({
        business_id:         businessId,
        period_id:           periodId,
        employee_name:       name.trim(),
        basic_salary:        preview.grossSalary - (Number(housing)||0) - (Number(transport)||0) - (Number(otherAllow)||0),
        housing_allowance:   Number(housing)    || 0,
        transport_allowance: Number(transport)  || 0,
        other_allowances:    Number(otherAllow) || 0,
        gross_salary:        preview.grossSalary,
        ssnit_employee:      preview.ssnit_employee,
        ssnit_employer:      preview.ssnit_employer,
        taxable_income:      preview.taxableIncome,
        paye:                preview.paye,
        other_deductions:    Number(otherDed) || 0,
        net_pay:             preview.netPay,
      });
      if (error) throw error;
      setName(""); setBasic(""); setHousing(""); setTransport(""); setOtherAllow(""); setOtherDed("");
      onAdded();
      toast.success(`${name} added`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add employee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border p-4">
      <p className="text-sm font-semibold" style={{ color: "var(--forest)" }}>Add Employee</p>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Employee Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Kwame Mensah" className="rounded-xl" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Basic Salary (GHS) *</Label>
          <Input type="number" value={basic} onChange={e => setBasic(e.target.value)} placeholder="2500" className="rounded-xl" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Housing Allowance</Label>
          <Input type="number" value={housing} onChange={e => setHousing(e.target.value)} placeholder="0" className="rounded-xl" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Transport Allowance</Label>
          <Input type="number" value={transport} onChange={e => setTransport(e.target.value)} placeholder="0" className="rounded-xl" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Other Allowances</Label>
          <Input type="number" value={otherAllow} onChange={e => setOtherAllow(e.target.value)} placeholder="0" className="rounded-xl" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Other Deductions</Label>
          <Input type="number" value={otherDed} onChange={e => setOtherDed(e.target.value)} placeholder="0" className="rounded-xl" />
        </div>
      </div>

      {/* Live calculation preview */}
      {Number(basic) > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 rounded-xl p-3" style={{ backgroundColor: "var(--cream-dark)" }}>
          {[
            { label: "Gross",          value: formatGHS(preview.grossSalary) },
            { label: "SSNIT (Emp)",    value: formatGHS(preview.ssnit_employee) },
            { label: "SSNIT (Employer)",value: formatGHS(preview.ssnit_employer) },
            { label: "Taxable",        value: formatGHS(preview.taxableIncome) },
            { label: "PAYE",           value: formatGHS(preview.paye) },
            { label: "Net Pay",        value: formatGHS(preview.netPay), bold: true },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{item.label}</p>
              <p className={`text-sm ${item.bold ? "font-bold" : "font-medium"}`} style={{ color: item.bold ? "var(--forest)" : undefined }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <Button onClick={handleAdd} disabled={saving} size="sm" style={{ backgroundColor: "var(--forest)", color: "white" }} className="rounded-xl">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1.5" />Add Employee</>}
      </Button>
    </div>
  );
}

// ── Period Detail View ────────────────────────────────────────────────────────
function PeriodDetail({ period, onBack }: { period: PayrollPeriod; onBack: () => void }) {
  const { business } = useBusiness();
  const qc = useQueryClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entries = [], refetch } = useQuery<PayrollEntry[]>({
    queryKey: ["payroll-entries", period.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase.from("payroll_entries")
        .select("*")
        .eq("period_id", period.id)
        .order("employee_name");
      if (error) throw error;
      return data as PayrollEntry[];
    },
  });

  const totals = entries.reduce((acc, e) => ({
    gross: acc.gross + e.gross_salary,
    ssnit_emp: acc.ssnit_emp + e.ssnit_employee,
    ssnit_er: acc.ssnit_er + e.ssnit_employer,
    paye: acc.paye + e.paye,
    net: acc.net + e.net_pay,
  }), { gross: 0, ssnit_emp: 0, ssnit_er: 0, paye: 0, net: 0 });

  const approveMutation = useMutation({
    mutationFn: async (status: "approved" | "paid") => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("payroll_periods").update({
        status,
        total_gross: totals.gross,
        total_paye: totals.paye,
        total_ssnit_employee: totals.ssnit_emp,
        total_ssnit_employer: totals.ssnit_er,
        total_net: totals.net,
      }).eq("id", period.id);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ["payroll-periods", business?.id] });
      toast.success(status === "approved" ? "Payroll approved" : "Payroll marked as paid");
      onBack();
    },
  });

  const deleteEntry = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("payroll_entries").delete().eq("id", id);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--forest)" }}>{period.name}</h2>
          <p className="text-xs text-muted-foreground">
            {format(new Date(period.period_start), "dd MMM")} – {format(new Date(period.period_end), "dd MMM yyyy")}
          </p>
        </div>
        <Badge className="ml-auto capitalize" variant={period.status === "paid" ? "default" : "outline"}>
          {period.status}
        </Badge>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Gross",         value: totals.gross },
          { label: "SSNIT (Employees)",   value: totals.ssnit_emp },
          { label: "SSNIT (Employer)",    value: totals.ssnit_er },
          { label: "Total PAYE",          value: totals.paye },
          { label: "Total Net Pay",       value: totals.net },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{s.label}</p>
              <p className="text-sm font-bold" style={{ color: "var(--forest)" }}>{formatGHS(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add employee */}
      {period.status === "draft" && (
        <AddEmployeeForm periodId={period.id} businessId={business!.id} onAdded={refetch} />
      )}

      {/* Table header */}
      {entries.length > 0 && (
        <div>
          <div
            className="grid gap-2 px-4 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
            style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr 40px" }}
          >
            <span>Employee</span><span>Gross</span><span>SSNIT(E)</span>
            <span>SSNIT(R)</span><span>Taxable</span><span>PAYE</span><span>Net Pay</span><span />
          </div>
          <div className="space-y-2">
            {entries.map(e => (
              <EmployeeRow key={e.id} entry={e} onDelete={period.status === "draft" ? deleteEntry : () => {}} />
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <Users className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">No employees added yet.</p>
        </div>
      )}

      {/* Actions */}
      {entries.length > 0 && period.status === "draft" && (
        <div className="flex gap-3">
          <Button
            onClick={() => approveMutation.mutate("approved")}
            disabled={approveMutation.isPending}
            style={{ backgroundColor: "var(--forest)", color: "white" }}
            className="rounded-xl"
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve Payroll
          </Button>
        </div>
      )}
      {period.status === "approved" && (
        <Button
          onClick={() => approveMutation.mutate("paid")}
          disabled={approveMutation.isPending}
          style={{ backgroundColor: "var(--forest)", color: "white" }}
          className="rounded-xl"
        >
          <Download className="h-4 w-4 mr-1.5" /> Mark as Paid
        </Button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Payroll() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<PayrollPeriod | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd,   setNewEnd]   = useState("");

  const { data: periods = [], isLoading } = useQuery<PayrollPeriod[]>({
    queryKey: ["payroll-periods", business?.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase.from("payroll_periods")
        .select("*")
        .eq("business_id", business!.id)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data as PayrollPeriod[];
    },
    enabled: !!business,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newName || !newStart || !newEnd) throw new Error("All fields required");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("payroll_periods").insert({
        business_id: business!.id,
        name: newName,
        period_start: newStart,
        period_end: newEnd,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-periods", business?.id] });
      setCreating(false); setNewName(""); setNewStart(""); setNewEnd("");
      toast.success("Payroll period created");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (selected) return <PeriodDetail period={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="space-y-6">
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: "var(--forest)" }}>
            <Banknote className="h-6 w-6 text-white" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--forest)", letterSpacing: "-0.02em" }}>Payroll</h1>
            <p className="text-xs text-muted-foreground">Ghana SSNIT + PAYE — 2024 tax bands</p>
          </div>
        </div>
        <Button
          onClick={() => setCreating(true)}
          style={{ backgroundColor: "var(--forest)", color: "white" }}
          className="rounded-xl"
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Period
        </Button>
      </motion.div>

      {/* Tax info banner */}
      <div className="grid sm:grid-cols-3 gap-3 rounded-2xl p-4" style={{ backgroundColor: "hsl(86,68%,95%)", border: "1px solid hsl(86,68%,82%)" }}>
        {[
          { label: "Employee SSNIT",  value: "5.5% of basic" },
          { label: "Employer SSNIT",  value: "10.5% + 2.5% NHIA" },
          { label: "PAYE Bands",      value: "0% – 35% (Ghana 2024)" },
        ].map(item => (
          <div key={item.label} className="text-center">
            <p className="text-[11px] font-semibold" style={{ color: "var(--forest)" }}>{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Create form */}
      {creating && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              New Payroll Period
              <button onClick={() => setCreating(false)}><XCircle className="h-5 w-5 text-muted-foreground" /></button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Period Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="January 2026" className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              style={{ backgroundColor: "var(--forest)", color: "white" }}
              className="rounded-xl"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Period"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Period list */}
      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

      {!isLoading && periods.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Banknote className="h-12 w-12 text-muted-foreground/25" strokeWidth={1.4} />
          <p className="text-muted-foreground text-sm">No payroll periods yet.</p>
          <Button onClick={() => setCreating(true)} variant="outline" className="rounded-xl">Create First Period</Button>
        </div>
      )}

      <div className="space-y-3">
        {periods.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setSelected(p)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold" style={{ color: "var(--forest)" }}>{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.period_start), "dd MMM")} – {format(new Date(p.period_end), "dd MMM yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {p.total_net > 0 && (
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: "var(--forest)" }}>{formatGHS(p.total_net)}</p>
                      <p className="text-[10px] text-muted-foreground">Net pay</p>
                    </div>
                  )}
                  <Badge
                    variant={p.status === "paid" ? "default" : "outline"}
                    className="capitalize"
                    style={p.status === "paid" ? { backgroundColor: "var(--forest)", color: "white" } : {}}
                  >
                    {p.status}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
