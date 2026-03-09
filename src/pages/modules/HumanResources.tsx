import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Calendar, Award, GraduationCap, Plus, Pencil, Trash2, CheckCircle, XCircle, Network } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import EmployeeDialog from "@/components/hr/EmployeeDialog";
import LeaveDialog from "@/components/hr/LeaveDialog";
import { OrgChart } from "@/components/hr/OrgChart";

export default function HumanResources() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("employees");
  const [dialog, setDialog] = useState<{ open: boolean; employee?: any }>({ open: false });
  const [leaveDialog, setLeaveDialog] = useState<{ open: boolean; request?: any }>({ open: false });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("business_id", business!.id).order("first_name");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const { data: leaveRequests = [] } = useQuery({
    queryKey: ["leave_requests", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_requests").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employees"] }); toast.success("Employee removed"); },
    onError: (err: any) => toast.error(err.message),
  });

  const updateLeaveStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leave_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leave_requests"] }); toast.success("Leave request updated"); },
    onError: (err: any) => toast.error(err.message),
  });

  const totalSalary = employees.filter((e: any) => e.status === "active").reduce((s: number, e: any) => s + Number(e.salary || 0), 0);
  const pendingLeaves = leaveRequests.filter((l: any) => l.status === "pending").length;

  const getEmployeeName = (empId: string) => {
    const emp = employees.find((e: any) => e.id === empId);
    return emp ? `${emp.first_name} ${emp.last_name}` : "Unknown";
  };

  const leaveTypeColors: Record<string, string> = {
    annual: "bg-blue-500/10 text-blue-500",
    sick: "bg-red-500/10 text-red-500",
    personal: "bg-purple-500/10 text-purple-500",
    maternity: "bg-pink-500/10 text-pink-500",
    paternity: "bg-cyan-500/10 text-cyan-500",
    unpaid: "bg-orange-500/10 text-orange-500",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Human Resources</h1>
        <p className="text-muted-foreground">Employee management, payroll, leave, and performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{employees.length}</p><p className="text-xs text-muted-foreground">Employees</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">{employees.filter((e: any) => e.status === "active").length}</p><p className="text-xs text-muted-foreground">Active</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Calendar className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">GHS {totalSalary.toLocaleString()}</p><p className="text-xs text-muted-foreground">Monthly Payroll</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Award className="h-8 w-8 text-orange-500" /><div><p className="text-2xl font-bold">{pendingLeaves}</p><p className="text-xs text-muted-foreground">Pending Leave Requests</p></div></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="leave">Leave {pendingLeaves > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{pendingLeaves}</Badge>}</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="orgchart">Org Chart</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Employee Directory</h3><Button onClick={() => setDialog({ open: true })}><Plus className="h-4 w-4 mr-1" />Add Employee</Button></div>
          <Card><CardContent className="pt-4">
            {employees.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Position</TableHead><TableHead>Department</TableHead><TableHead>Hire Date</TableHead><TableHead className="text-right">Salary</TableHead><TableHead>Status</TableHead><TableHead className="w-20"></TableHead></TableRow></TableHeader>
                <TableBody>{employees.map((emp: any) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.first_name} {emp.last_name}</TableCell>
                    <TableCell>{emp.position || "—"}</TableCell>
                    <TableCell>{emp.department || "—"}</TableCell>
                    <TableCell>{emp.hire_date ? format(new Date(emp.hire_date), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell className="text-right font-mono">GHS {Number(emp.salary || 0).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={emp.status === "active" ? "default" : "secondary"} className="capitalize">{emp.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ open: true, employee: emp })}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteEmployee.mutate(emp.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><Users className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No employees yet. Add your team members.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card><CardContent className="pt-4">
            {employees.filter((e: any) => e.status === "active").length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Position</TableHead><TableHead>Frequency</TableHead><TableHead className="text-right">Gross Salary</TableHead><TableHead className="text-right">SSNIT (5.5%)</TableHead><TableHead className="text-right">Net Pay</TableHead></TableRow></TableHeader>
                <TableBody>{employees.filter((e: any) => e.status === "active").map((emp: any) => {
                  const gross = Number(emp.salary || 0);
                  const ssnit = gross * 0.055;
                  const net = gross - ssnit;
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.first_name} {emp.last_name}</TableCell>
                      <TableCell>{emp.position || "—"}</TableCell>
                      <TableCell className="capitalize">{emp.salary_frequency || "monthly"}</TableCell>
                      <TableCell className="text-right font-mono">GHS {gross.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">-GHS {ssnit.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">GHS {net.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><p>No active employees for payroll.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          <div className="flex justify-between">
            <h3 className="font-semibold">Leave Requests</h3>
            <Button onClick={() => setLeaveDialog({ open: true })}><Plus className="h-4 w-4 mr-1" />New Request</Button>
          </div>
          <Card><CardContent className="pt-4">
            {leaveRequests.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead><TableHead>Reason</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
                <TableBody>{leaveRequests.map((lr: any) => (
                  <TableRow key={lr.id}>
                    <TableCell className="font-medium">{getEmployeeName(lr.employee_id)}</TableCell>
                    <TableCell><Badge className={`capitalize ${leaveTypeColors[lr.leave_type] || ""}`}>{lr.leave_type}</Badge></TableCell>
                    <TableCell>{format(new Date(lr.start_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{format(new Date(lr.end_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{lr.days}</TableCell>
                    <TableCell>
                      <Badge variant={lr.status === "approved" ? "default" : lr.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                        {lr.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">{lr.reason || "—"}</TableCell>
                    <TableCell>
                      {lr.status === "pending" && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateLeaveStatus.mutate({ id: lr.id, status: "approved" })} title="Approve">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateLeaveStatus.mutate({ id: lr.id, status: "rejected" })} title="Reject">
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No leave requests yet.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reviews"><Card><CardContent className="text-center py-12 text-muted-foreground"><Award className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Performance reviews — structured review forms.</p></CardContent></Card></TabsContent>
        <TabsContent value="training"><Card><CardContent className="text-center py-12 text-muted-foreground"><GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Training records and certifications.</p></CardContent></Card></TabsContent>
        <TabsContent value="orgchart">
          <OrgChart employees={employees} />
        </TabsContent>
      </Tabs>

      <EmployeeDialog open={dialog.open} onOpenChange={(o) => setDialog({ open: o })} employee={dialog.employee} />
      <LeaveDialog open={leaveDialog.open} onOpenChange={(o) => setLeaveDialog({ open: o })} employees={employees} leaveRequest={leaveDialog.request} />
    </div>
  );
}
