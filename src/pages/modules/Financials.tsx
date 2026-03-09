import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useBusiness } from "@/hooks/useBusiness";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileText, TrendingUp, Wallet, Calculator, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Financials() {
  const { business } = useBusiness();
  const [activeTab, setActiveTab] = useState("chart");

  const { data: accounts = [], isLoading } = useQuery({
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

  const { data: journalEntries = [] } = useQuery({
    queryKey: ["journal_entries", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Financials</h1>
        <p className="text-muted-foreground">Double-entry accounting, general ledger, and financial reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><BookOpen className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{accounts.length}</p><p className="text-xs text-muted-foreground">Chart of Accounts</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><FileText className="h-8 w-8 text-blue-500" /><div><p className="text-2xl font-bold">{journalEntries.length}</p><p className="text-xs text-muted-foreground">Journal Entries</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingUp className="h-8 w-8 text-green-500" /><div><p className="text-2xl font-bold">GHS 0</p><p className="text-xs text-muted-foreground">Revenue (MTD)</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Wallet className="h-8 w-8 text-orange-500" /><div><p className="text-2xl font-bold">GHS 0</p><p className="text-xs text-muted-foreground">Expenses (MTD)</p></div></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="chart">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="journal">Journal Entries</TabsTrigger>
          <TabsTrigger value="ledger">General Ledger</TabsTrigger>
          <TabsTrigger value="reports">Financial Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Chart of Accounts</h3>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Account</Button>
          </div>
          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : accounts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((acc: any) => (
                      <TableRow key={acc.id}>
                        <TableCell className="font-mono">{acc.account_code}</TableCell>
                        <TableCell className="font-medium">{acc.name}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{acc.account_type}</Badge></TableCell>
                        <TableCell className="text-right font-mono">GHS {Number(acc.balance).toLocaleString()}</TableCell>
                        <TableCell><Badge variant={acc.is_active ? "default" : "secondary"}>{acc.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="font-semibold text-lg">No Accounts Yet</h3>
                  <p className="text-sm">Create your chart of accounts to start double-entry accounting.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Journal Entries</CardTitle>
              <CardDescription>Manual and automatic postings</CardDescription>
            </CardHeader>
            <CardContent>
              {journalEntries.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entry #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalEntries.map((je: any) => (
                      <TableRow key={je.id}>
                        <TableCell className="font-mono">{je.entry_number}</TableCell>
                        <TableCell>{format(new Date(je.date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{je.description}</TableCell>
                        <TableCell className="text-right font-mono">GHS {Number(je.total_debit).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">GHS {Number(je.total_credit).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{je.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No journal entries yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="font-semibold text-lg">General Ledger</h3>
                <p className="text-sm">View all postings per account with drill-down. Create accounts first to see ledger entries.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {["Profit & Loss", "Balance Sheet", "Trial Balance", "Cash Flow Statement"].map((report) => (
              <Card key={report} className="cursor-pointer hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="text-base">{report}</CardTitle>
                  <CardDescription>Generate {report.toLowerCase()} report</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-1" />Generate</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
