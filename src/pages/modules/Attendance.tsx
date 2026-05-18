import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from "date-fns";
import {
  CalendarDays, Clock, UserCheck, UserX, AlertCircle, ChevronLeft,
  ChevronRight, Plus, Save, Users, TrendingUp, Timer, Coffee
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = "present" | "absent" | "late" | "half-day" | "leave" | "holiday";

interface AttendanceRecord {
  id: string;
  staff_member_id: string | null;
  employee_name: string;
  attendance_date: string;
  clock_in: string | null;
  clock_out: string | null;
  hours_worked: number | null;
  status: AttendanceStatus;
  notes: string | null;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; bg: string }> = {
  present:  { label: "Present",  color: "text-green-700",  bg: "bg-green-100" },
  absent:   { label: "Absent",   color: "text-red-700",    bg: "bg-red-100"   },
  late:     { label: "Late",     color: "text-amber-700",  bg: "bg-amber-100" },
  "half-day": { label: "Half Day", color: "text-blue-700", bg: "bg-blue-100"  },
  leave:    { label: "Leave",    color: "text-purple-700", bg: "bg-purple-100"},
  holiday:  { label: "Holiday",  color: "text-slate-700",  bg: "bg-slate-100" },
};

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function calcHours(clockIn: string | null, clockOut: string | null): number | null {
  if (!clockIn || !clockOut) return null;
  const [ih, im] = clockIn.split(":").map(Number);
  const [oh, om] = clockOut.split(":").map(Number);
  const minutes = (oh * 60 + om) - (ih * 60 + im);
  return minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Attendance() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const businessId = business?.id;

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState(format(now, "yyyy-MM-dd"));
  const [view, setView]   = useState<"calendar" | "list">("calendar");

  // Mark attendance form state
  const [markingEmployee, setMarkingEmployee] = useState<string>("");
  const [markingName, setMarkingName]         = useState<string>("");
  const [markingStatus, setMarkingStatus]     = useState<AttendanceStatus>("present");
  const [clockIn, setClockIn]   = useState("09:00");
  const [clockOut, setClockOut] = useState("17:00");
  const [notes, setNotes]       = useState("");
  const [showMarkForm, setShowMarkForm] = useState(false);

  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd   = endOfMonth(new Date(year, month));

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ["staff-list", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("id, name, role")
        .eq("business_id", businessId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: records = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["attendance", businessId, year, month],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("attendance_records")
        .select("*")
        .eq("business_id", businessId)
        .gte("attendance_date", format(monthStart, "yyyy-MM-dd"))
        .lte("attendance_date", format(monthEnd, "yyyy-MM-dd"))
        .order("attendance_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: dayRecords = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["attendance-day", businessId, selectedDate],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("attendance_records")
        .select("*")
        .eq("business_id", businessId)
        .eq("attendance_date", selectedDate)
        .order("employee_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Mutation ───────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business");
      const employeeName = markingName || staff.find(s => s.id === markingEmployee)?.name || "";
      if (!employeeName) throw new Error("Employee name required");

      const hoursWorked = (markingStatus === "present" || markingStatus === "late")
        ? calcHours(clockIn, clockOut)
        : null;

      const payload = {
        business_id:     businessId,
        staff_member_id: markingEmployee || null,
        employee_name:   employeeName,
        attendance_date: selectedDate,
        clock_in:        (markingStatus === "present" || markingStatus === "late") ? clockIn : null,
        clock_out:       (markingStatus === "present" || markingStatus === "late") ? clockOut : null,
        hours_worked:    hoursWorked,
        status:          markingStatus,
        notes:           notes || null,
      };

      const { error } = await (supabase as any)
        .from("attendance_records")
        .upsert(payload, {
          onConflict: "business_id,staff_member_id,attendance_date",
          ignoreDuplicates: false,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance recorded");
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["attendance-day"] });
      setShowMarkForm(false);
      setMarkingEmployee("");
      setMarkingName("");
      setNotes("");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to save attendance");
    },
  });

  // ── Month navigation ───────────────────────────────────────────────────────

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // ── Calendar grid ──────────────────────────────────────────────────────────

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = monthStart.getDay(); // 0=Sun

  // Build a lookup: date → records
  const recordsByDate = records.reduce<Record<string, AttendanceRecord[]>>((acc, r) => {
    (acc[r.attendance_date] ??= []).push(r);
    return acc;
  }, {});

  // ── Monthly summary stats ─────────────────────────────────────────────────

  const totalPresent  = records.filter(r => r.status === "present").length;
  const totalAbsent   = records.filter(r => r.status === "absent").length;
  const totalLate     = records.filter(r => r.status === "late").length;
  const totalLeave    = records.filter(r => r.status === "leave").length;
  const avgHours      = records.filter(r => r.hours_worked).reduce((s, r) => s + (r.hours_worked ?? 0), 0)
                        / (records.filter(r => r.hours_worked).length || 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track daily staff attendance and working hours</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setView(v => v === "calendar" ? "list" : "calendar")}>
            {view === "calendar" ? <Users className="h-4 w-4 mr-1.5" /> : <CalendarDays className="h-4 w-4 mr-1.5" />}
            {view === "calendar" ? "List View" : "Calendar"}
          </Button>
          <Button size="sm" onClick={() => setShowMarkForm(true)} style={{ background: "var(--forest)" }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Mark Attendance
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: UserCheck,    label: "Present",     value: totalPresent,        color: "text-green-600" },
          { icon: UserX,        label: "Absent",      value: totalAbsent,         color: "text-red-500"   },
          { icon: AlertCircle,  label: "Late",        value: totalLate,           color: "text-amber-500" },
          { icon: Coffee,       label: "On Leave",    value: totalLeave,          color: "text-purple-500"},
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card border rounded-lg p-3 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="font-semibold text-lg">{format(new Date(year, month), "MMMM yyyy")}</span>
        <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {view === "calendar" ? (
        <div className="bg-card border rounded-xl overflow-hidden">
          {/* Day labels */}
          <div className="grid grid-cols-7 border-b">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {/* Empty cells for offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="border-b border-r min-h-[80px] bg-muted/20" />
            ))}
            {days.map(day => {
              const dateStr   = format(day, "yyyy-MM-dd");
              const dayRecs   = recordsByDate[dateStr] ?? [];
              const isSelected = dateStr === selectedDate;
              const todayCell  = isToday(day);
              const presentCount = dayRecs.filter(r => r.status === "present" || r.status === "late").length;
              const absentCount  = dayRecs.filter(r => r.status === "absent").length;

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`border-b border-r min-h-[80px] p-1.5 cursor-pointer transition-colors ${
                    isSelected ? "bg-[var(--forest)]/10 border-[var(--forest)]" :
                    todayCell  ? "bg-amber-50/10" : "hover:bg-muted/30"
                  }`}
                >
                  <div className={`text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    todayCell ? "bg-[var(--forest)] text-white" : ""
                  }`}>
                    {day.getDate()}
                  </div>
                  {dayRecs.length > 0 && (
                    <div className="space-y-0.5">
                      {presentCount > 0 && (
                        <div className="text-xs bg-green-100 text-green-700 rounded px-1">
                          {presentCount} present
                        </div>
                      )}
                      {absentCount > 0 && (
                        <div className="text-xs bg-red-100 text-red-700 rounded px-1">
                          {absentCount} absent
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List view — all records for month */
        <div className="bg-card border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No attendance records this month</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  {["Date","Employee","Status","Clock In","Clock Out","Hours","Notes"].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2">{format(parseISO(r.attendance_date), "d MMM")}</td>
                    <td className="px-3 py-2 font-medium">{r.employee_name}</td>
                    <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-2 text-muted-foreground">{r.clock_in ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.clock_out ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.hours_worked != null ? `${r.hours_worked}h` : "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">{r.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Selected day panel */}
      {view === "calendar" && (
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">
              {isToday(parseISO(selectedDate)) ? "Today" : format(parseISO(selectedDate), "EEEE, d MMMM yyyy")}
            </h2>
            <Button size="sm" variant="outline" onClick={() => setShowMarkForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Record
            </Button>
          </div>
          {dayRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records for this day.</p>
          ) : (
            <div className="space-y-2">
              {dayRecords.map(r => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <StatusBadge status={r.status} />
                  <span className="font-medium text-sm flex-1">{r.employee_name}</span>
                  {r.clock_in && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Timer className="h-3 w-3" />
                      {r.clock_in} – {r.clock_out ?? "?"}
                    </span>
                  )}
                  {r.hours_worked != null && (
                    <span className="text-xs font-medium text-muted-foreground">{r.hours_worked}h</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mark attendance slide-in form */}
      <AnimatePresence>
        {showMarkForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setShowMarkForm(false)}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-2xl z-50 flex flex-col"
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-bold text-lg">Mark Attendance</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowMarkForm(false)}>✕</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">

                <div>
                  <label className="text-sm font-medium mb-1 block">Date</label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                  />
                </div>

                {staff.length > 0 ? (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Employee</label>
                    <Select value={markingEmployee} onValueChange={v => {
                      setMarkingEmployee(v);
                      setMarkingName(staff.find(s => s.id === v)?.name ?? "");
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select staff member…" /></SelectTrigger>
                      <SelectContent>
                        {staff.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} — {s.role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Employee Name</label>
                    <Input
                      placeholder="Enter employee name"
                      value={markingName}
                      onChange={e => setMarkingName(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <Select value={markingStatus} onValueChange={v => setMarkingStatus(v as AttendanceStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, typeof STATUS_CONFIG[AttendanceStatus]][]).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(markingStatus === "present" || markingStatus === "late") && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Clock In</label>
                      <Input type="time" value={clockIn} onChange={e => setClockIn(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Clock Out</label>
                      <Input type="time" value={clockOut} onChange={e => setClockOut(e.target.value)} />
                    </div>
                    {clockIn && clockOut && calcHours(clockIn, clockOut) !== null && (
                      <div className="col-span-2 rounded-lg bg-muted px-3 py-2 text-sm">
                        <Clock className="h-3.5 w-3.5 inline mr-1" />
                        <strong>{calcHours(clockIn, clockOut)}</strong> hours worked
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
                  <Input placeholder="e.g. doctor's appointment" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>

              <div className="p-4 border-t">
                <Button
                  className="w-full"
                  style={{ background: "var(--forest)" }}
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || (!markingEmployee && !markingName)}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveMutation.isPending ? "Saving…" : "Save Attendance"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
