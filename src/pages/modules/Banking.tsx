import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Landmark, ArrowDownLeft, ArrowUpRight, RefreshCcw, Plus } from "lucide-react";
import { format } from "date-fns";
import BankAccountDialog from "@/components/banking/BankAccountDialog";
import PaymentDialog from "@/components/banking/PaymentDialog";
import { BankReconciliationTab } from "@/components/banking/BankReconciliationTab";

export default function Banking() {
  const { business } = useBusiness();
  const [activeTab, setActiveTab] = useState("accounts");
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; type: "incoming" | "outgoing" }>({ open: false, type: "incoming" });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank_accounts", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").eq("business_id", business!.id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const totalBalance = bankAccounts.reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);
  const incoming = payments.filter((p: any) => p.type === "incoming").reduce((s: number, p: any) => s + Number(p.amount), 0);
  const outgoing = payments.filter((p: any) => p.type === "outgoing").reduce((s: number, p: any) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Banking</h1>
        <p className="text-muted-foreground">Bank accounts, payments, and reconciliation</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Landmark className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" /><div className="min-w-0"><p className="text-lg sm:text-2xl font-bold truncate">GHS {totalBalance.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Balance</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><ArrowDownLeft className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 shrink-0" /><div className="min-w-0"><p className="text-lg sm:text-2xl font-bold truncate">GHS {incoming.toLocaleString()}</p><p className="text-xs text-muted-foreground">Incoming</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><ArrowUpRight className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 shrink-0" /><div className="min-w-0"><p className="text-lg sm:text-2xl font-bold truncate">GHS {outgoing.toLocaleString()}</p><p className="text-xs text-muted-foreground">Outgoing</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Landmark className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 shrink-0" /><div className="min-w-0"><p className="text-lg sm:text-2xl font-bold">{bankAccounts.length}</p><p className="text-xs text-muted-foreground">Accounts</p></div></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="accounts">Bank Accounts</TabsTrigger>
          <TabsTrigger value="incoming">Incoming Payments</TabsTrigger>
          <TabsTrigger value="outgoing">Outgoing Payments</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Bank Accounts</h3><Button onClick={() => setBankDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Account</Button></div>
          <Card><CardContent className="pt-4">
            {bankAccounts.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Bank</TableHead><TableHead>Type</TableHead><TableHead>Currency</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{bankAccounts.map((ba: any) => (
                  <TableRow key={ba.id}>
                    <TableCell className="font-medium">{ba.name}</TableCell>
                    <TableCell>{ba.bank_name}</TableCell>
                    <TableCell className="capitalize">{ba.account_type.replace("_", " ")}</TableCell>
                    <TableCell>{ba.currency}</TableCell>
                    <TableCell className="text-right font-mono">GHS {Number(ba.balance).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={ba.is_active ? "default" : "secondary"}>{ba.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><Landmark className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No bank accounts registered. Add your company bank accounts.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="incoming" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Incoming Payments</h3><Button onClick={() => setPaymentDialog({ open: true, type: "incoming" })}><Plus className="h-4 w-4 mr-1" />Record Payment</Button></div>
          <Card><CardContent className="pt-4">
            {payments.filter((p: any) => p.type === "incoming").length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Payment #</TableHead><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{payments.filter((p: any) => p.type === "incoming").map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.payment_number}</TableCell>
                    <TableCell>{format(new Date(p.date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="capitalize">{p.payment_method.replace("_", " ")}</TableCell>
                    <TableCell>{p.reference || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-green-500">+GHS {Number(p.amount).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{p.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><ArrowDownLeft className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No incoming payments recorded.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="outgoing" className="space-y-4">
          <div className="flex justify-between"><h3 className="font-semibold">Outgoing Payments</h3><Button onClick={() => setPaymentDialog({ open: true, type: "outgoing" })}><Plus className="h-4 w-4 mr-1" />Record Payment</Button></div>
          <Card><CardContent className="pt-4">
            {payments.filter((p: any) => p.type === "outgoing").length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>Payment #</TableHead><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{payments.filter((p: any) => p.type === "outgoing").map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.payment_number}</TableCell>
                    <TableCell>{format(new Date(p.date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="capitalize">{p.payment_method.replace("_", " ")}</TableCell>
                    <TableCell>{p.reference || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-red-500">-GHS {Number(p.amount).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{p.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground"><ArrowUpRight className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No outgoing payments recorded.</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-4">
          <BankReconciliationTab bankAccounts={bankAccounts} payments={payments} />
        </TabsContent>
      </Tabs>

      <BankAccountDialog open={bankDialogOpen} onOpenChange={setBankDialogOpen} />
      <PaymentDialog open={paymentDialog.open} onOpenChange={(o) => setPaymentDialog(p => ({ ...p, open: o }))} type={paymentDialog.type} />
    </div>
  );
}
