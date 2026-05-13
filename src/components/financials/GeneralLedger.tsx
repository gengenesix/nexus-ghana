import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, ChevronRight, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function GeneralLedger() {
  const { business } = useBusiness();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ["chart_of_accounts", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("business_id", business!.id)
        .order("account_code");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const { data: lines = [], isLoading: loadingLines } = useQuery({
    queryKey: ["ledger-lines", business?.id, selectedAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entry_lines")
        .select("*, journal_entries(entry_number, date, description, status)")
        .eq("account_id", selectedAccountId!)
        .order("journal_entries(date)", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAccountId,
  });

  const selectedAccount = accounts.find((a: any) => a.id === selectedAccountId);
  const totalDebits = lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
  const totalCredits = lines.reduce((s: number, l: any) => s + Number(l.credit), 0);

  // Running balance
  const linesWithBalance = [...lines].reverse().reduce(
    (acc: { line: any; running: number }[], l: any) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].running : 0;
      const isDebit = ["asset", "expense"].includes(selectedAccount?.account_type ?? "");
      const running = isDebit ? prev + Number(l.debit) - Number(l.credit) : prev + Number(l.credit) - Number(l.debit);
      acc.push({ line: l, running });
      return acc;
    },
    []
  ).reverse();

  if (loadingAccounts) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Set up your Chart of Accounts first to see the General Ledger.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selectedAccountId ?? ""} onValueChange={setSelectedAccountId}>
          <SelectTrigger className="w-[320px]">
            <SelectValue placeholder="Select an account to drill into..." />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a: any) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="font-mono text-xs text-muted-foreground mr-2">{a.account_code}</span>
                {a.name}
                <span className="ml-2 text-xs text-muted-foreground capitalize">({a.account_type})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedAccount && (
          <Badge variant="outline" className="capitalize">{selectedAccount.account_type}</Badge>
        )}
      </div>

      {!selectedAccountId ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Select an account above to view all its journal postings.</p>
          </CardContent>
        </Card>
      ) : loadingLines ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : lines.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>No postings for <span className="font-semibold">{selectedAccount?.name}</span> yet.</p>
            <p className="text-xs mt-1">Create journal entries to see activity here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              {selectedAccount?.account_code} — {selectedAccount?.name}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                Opening Balance: GHS {Number(selectedAccount?.balance ?? 0).toLocaleString("en-GH", { minimumFractionDigits: 2 })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Entry #</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linesWithBalance.map(({ line, running }: any) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {line.journal_entries?.date
                        ? format(new Date(line.journal_entries.date), "dd MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary">
                      {line.journal_entries?.entry_number ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {line.description || line.journal_entries?.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {line.journal_entries?.status ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {Number(line.debit) > 0 ? `GHS ${Number(line.debit).toLocaleString("en-GH", { minimumFractionDigits: 2 })}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {Number(line.credit) > 0 ? `GHS ${Number(line.credit).toLocaleString("en-GH", { minimumFractionDigits: 2 })}` : "—"}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm font-medium ${running < 0 ? "text-destructive" : "text-primary"}`}>
                      GHS {Math.abs(running).toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                      {running < 0 ? " Cr" : " Dr"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2 bg-secondary/30">
                  <TableCell colSpan={4} className="font-bold">Totals</TableCell>
                  <TableCell className="text-right font-mono">GHS {totalDebits.toLocaleString("en-GH", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-mono">GHS {totalCredits.toLocaleString("en-GH", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Account summary grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-sm">All Accounts Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc: any) => (
                <TableRow
                  key={acc.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedAccountId(acc.id)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">{acc.account_code}</TableCell>
                  <TableCell className="font-medium">{acc.name}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize text-xs">{acc.account_type}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    GHS {Number(acc.balance).toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
