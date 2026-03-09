import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, CheckCircle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { parseCsv } from "@/lib/export";
import { format } from "date-fns";

interface BankReconciliationTabProps {
  bankAccounts: any[];
  payments: any[];
}

export function BankReconciliationTab({ bankAccounts, payments }: BankReconciliationTabProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [statementItems, setStatementItems] = useState<any[]>([]);
  const [statementBalance, setStatementBalance] = useState("");
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());

  const account = bankAccounts.find((a: any) => a.id === selectedAccount);
  const accountPayments = payments.filter((p: any) => p.bank_account_id === selectedAccount);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCsv(text);

      const dateIdx = headers.findIndex((h) => /date/i.test(h));
      const descIdx = headers.findIndex((h) => /desc|narr|detail/i.test(h));
      const refIdx = headers.findIndex((h) => /ref|check|cheque/i.test(h));
      const amtIdx = headers.findIndex((h) => /amount|value/i.test(h));
      const debitIdx = headers.findIndex((h) => /debit|withdrawal/i.test(h));
      const creditIdx = headers.findIndex((h) => /credit|deposit/i.test(h));

      const items = rows.map((row, i) => {
        let amount = 0;
        let type = "debit";
        if (amtIdx >= 0) {
          amount = Math.abs(parseFloat(row[amtIdx]?.replace(/[^0-9.-]/g, "") || "0"));
          type = parseFloat(row[amtIdx]?.replace(/[^0-9.-]/g, "") || "0") >= 0 ? "credit" : "debit";
        } else {
          const debit = parseFloat(row[debitIdx]?.replace(/[^0-9.-]/g, "") || "0");
          const credit = parseFloat(row[creditIdx]?.replace(/[^0-9.-]/g, "") || "0");
          if (credit > 0) { amount = credit; type = "credit"; }
          else { amount = Math.abs(debit); type = "debit"; }
        }

        return {
          id: `stmt-${i}`,
          date: row[dateIdx] || "",
          description: row[descIdx >= 0 ? descIdx : 1] || "",
          reference: row[refIdx >= 0 ? refIdx : -1] || "",
          amount,
          type,
          matched: false,
        };
      }).filter((item) => item.amount > 0);

      setStatementItems(items);
      toast.success(`Imported ${items.length} statement lines`);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const toggleMatch = (stmtId: string) => {
    setMatchedIds((prev) => {
      const next = new Set(prev);
      if (next.has(stmtId)) next.delete(stmtId);
      else next.add(stmtId);
      return next;
    });
  };

  const systemBalance = account ? Number(account.balance) : 0;
  const stmtBal = parseFloat(statementBalance) || 0;
  const difference = stmtBal - systemBalance;
  const matchedCount = matchedIds.size;

  const saveReconciliation = useMutation({
    mutationFn: async () => {
      if (!business?.id || !selectedAccount) return;
      const { data, error } = await supabase.from("bank_reconciliations").insert({
        business_id: business.id,
        bank_account_id: selectedAccount,
        statement_date: new Date().toISOString().split("T")[0],
        statement_balance: stmtBal,
        system_balance: systemBalance,
        difference,
        status: Math.abs(difference) < 0.01 ? "reconciled" : "draft",
      }).select().single();
      if (error) throw error;

      // Save matched items
      const items = statementItems.map((item) => ({
        reconciliation_id: data.id,
        date: item.date ? new Date(item.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        description: item.description,
        reference: item.reference,
        amount: item.amount,
        type: item.type,
        matched: matchedIds.has(item.id),
      }));
      if (items.length > 0) {
        const { error: itemErr } = await supabase.from("reconciliation_items").insert(items);
        if (itemErr) throw itemErr;
      }
    },
    onSuccess: () => {
      toast.success("Reconciliation saved");
      queryClient.invalidateQueries({ queryKey: ["bank_reconciliations"] });
      setStatementItems([]);
      setMatchedIds(new Set());
      setStatementBalance("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-2 min-w-[200px]">
          <Label>Bank Account</Label>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>
              {bankAccounts.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.name} - {a.bank_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Statement Balance</Label>
          <Input type="number" step="0.01" placeholder="Enter closing balance" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} className="w-48" />
        </div>
        <div>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!selectedAccount}>
            <Upload className="h-4 w-4 mr-1" /> Import Statement CSV
          </Button>
        </div>
      </div>

      {selectedAccount && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">System Balance</p>
              <p className="text-xl font-bold font-mono">GHS {systemBalance.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Statement Balance</p>
              <p className="text-xl font-bold font-mono">GHS {stmtBal.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Difference</p>
              <p className={`text-xl font-bold font-mono ${Math.abs(difference) < 0.01 ? "text-green-500" : "text-destructive"}`}>
                GHS {difference.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {statementItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Statement Lines ({statementItems.length})</CardTitle>
              <Badge variant="secondary">{matchedCount} matched</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Match</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statementItems.map((item) => (
                  <TableRow key={item.id} className={matchedIds.has(item.id) ? "bg-green-500/5" : ""}>
                    <TableCell>
                      <Checkbox checked={matchedIds.has(item.id)} onCheckedChange={() => toggleMatch(item.id)} />
                    </TableCell>
                    <TableCell>{item.date}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{item.description}</TableCell>
                    <TableCell>{item.reference || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{item.type}</Badge></TableCell>
                    <TableCell className={`text-right font-mono ${item.type === "credit" ? "text-green-500" : "text-destructive"}`}>
                      {item.type === "credit" ? "+" : "-"}GHS {item.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {statementItems.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setStatementItems([]); setMatchedIds(new Set()); }}>Clear</Button>
          <Button onClick={() => saveReconciliation.mutate()} disabled={saveReconciliation.isPending}>
            <CheckCircle className="h-4 w-4 mr-1" /> Save Reconciliation
          </Button>
        </div>
      )}

      {statementItems.length === 0 && selectedAccount && (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <RefreshCcw className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Import a bank statement CSV to start reconciling.</p>
            <p className="text-xs mt-1">Expected columns: Date, Description/Narration, Reference, Amount (or Debit/Credit)</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
