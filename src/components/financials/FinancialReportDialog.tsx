import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";

interface Account {
  id: string;
  account_code: string;
  name: string;
  account_type: string;
  balance: number;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reportType: "pl" | "balance" | "trial" | "cashflow" | null;
  accounts: Account[];
  businessName?: string;
}

function fmtGHS(n: number) {
  return `GHS ${Math.abs(n).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SectionTotal({ label, amount, bold = true }: { label: string; amount: number; bold?: boolean }) {
  return (
    <TableRow className={bold ? "font-bold border-t-2" : ""}>
      <TableCell colSpan={2} className={bold ? "font-bold" : "font-semibold text-muted-foreground"}>{label}</TableCell>
      <TableCell className={`text-right ${bold ? "font-bold" : ""} ${amount < 0 ? "text-destructive" : ""}`}>
        {fmtGHS(amount)}
      </TableCell>
    </TableRow>
  );
}

function ProfitLoss({ accounts }: { accounts: Account[] }) {
  const revenue = accounts.filter(a => a.account_type === "income");
  const expenses = accounts.filter(a => a.account_type === "expense");
  const totalRevenue = revenue.reduce((s, a) => s + Number(a.balance), 0);
  const totalExpenses = expenses.reduce((s, a) => s + Number(a.balance), 0);
  const netProfit = totalRevenue - totalExpenses;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Account</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="bg-secondary/30"><TableCell colSpan={3} className="font-semibold text-sm uppercase tracking-wider py-2">Revenue</TableCell></TableRow>
        {revenue.map(a => (
          <TableRow key={a.id}>
            <TableCell className="font-mono text-xs text-muted-foreground">{a.account_code}</TableCell>
            <TableCell>{a.name}</TableCell>
            <TableCell className="text-right">{fmtGHS(Number(a.balance))}</TableCell>
          </TableRow>
        ))}
        <SectionTotal label="Total Revenue" amount={totalRevenue} />

        <TableRow><TableCell colSpan={3} className="py-2" /></TableRow>
        <TableRow className="bg-secondary/30"><TableCell colSpan={3} className="font-semibold text-sm uppercase tracking-wider py-2">Expenses</TableCell></TableRow>
        {expenses.map(a => (
          <TableRow key={a.id}>
            <TableCell className="font-mono text-xs text-muted-foreground">{a.account_code}</TableCell>
            <TableCell>{a.name}</TableCell>
            <TableCell className="text-right">{fmtGHS(Number(a.balance))}</TableCell>
          </TableRow>
        ))}
        <SectionTotal label="Total Expenses" amount={totalExpenses} />

        <TableRow><TableCell colSpan={3} className="py-2" /></TableRow>
        <TableRow className="bg-primary/10">
          <TableCell colSpan={2} className="font-bold text-base">Net Profit / (Loss)</TableCell>
          <TableCell className={`text-right font-bold text-base ${netProfit < 0 ? "text-destructive" : "text-primary"}`}>
            {netProfit < 0 ? `(${fmtGHS(netProfit)})` : fmtGHS(netProfit)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function BalanceSheet({ accounts }: { accounts: Account[] }) {
  const assets = accounts.filter(a => a.account_type === "asset");
  const liabilities = accounts.filter(a => a.account_type === "liability");
  const equity = accounts.filter(a => a.account_type === "equity");
  const totalAssets = assets.reduce((s, a) => s + Number(a.balance), 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + Number(a.balance), 0);
  const totalEquity = equity.reduce((s, a) => s + Number(a.balance), 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Account</TableHead>
          <TableHead className="text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="bg-secondary/30"><TableCell colSpan={3} className="font-semibold text-sm uppercase tracking-wider py-2">Assets</TableCell></TableRow>
        {assets.map(a => (
          <TableRow key={a.id}>
            <TableCell className="font-mono text-xs text-muted-foreground">{a.account_code}</TableCell>
            <TableCell>{a.name}</TableCell>
            <TableCell className="text-right">{fmtGHS(Number(a.balance))}</TableCell>
          </TableRow>
        ))}
        <SectionTotal label="Total Assets" amount={totalAssets} />

        <TableRow><TableCell colSpan={3} className="py-2" /></TableRow>
        <TableRow className="bg-secondary/30"><TableCell colSpan={3} className="font-semibold text-sm uppercase tracking-wider py-2">Liabilities</TableCell></TableRow>
        {liabilities.map(a => (
          <TableRow key={a.id}>
            <TableCell className="font-mono text-xs text-muted-foreground">{a.account_code}</TableCell>
            <TableCell>{a.name}</TableCell>
            <TableCell className="text-right">{fmtGHS(Number(a.balance))}</TableCell>
          </TableRow>
        ))}
        <SectionTotal label="Total Liabilities" amount={totalLiabilities} />

        <TableRow><TableCell colSpan={3} className="py-2" /></TableRow>
        <TableRow className="bg-secondary/30"><TableCell colSpan={3} className="font-semibold text-sm uppercase tracking-wider py-2">Equity</TableCell></TableRow>
        {equity.map(a => (
          <TableRow key={a.id}>
            <TableCell className="font-mono text-xs text-muted-foreground">{a.account_code}</TableCell>
            <TableCell>{a.name}</TableCell>
            <TableCell className="text-right">{fmtGHS(Number(a.balance))}</TableCell>
          </TableRow>
        ))}
        <SectionTotal label="Total Equity" amount={totalEquity} />

        <TableRow><TableCell colSpan={3} className="py-2" /></TableRow>
        <TableRow className="bg-primary/10">
          <TableCell colSpan={2} className="font-bold text-base">Total Liabilities + Equity</TableCell>
          <TableCell className="text-right font-bold text-base">{fmtGHS(totalLiabilities + totalEquity)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function TrialBalance({ accounts }: { accounts: Account[] }) {
  const activeAccounts = accounts.filter(a => Number(a.balance) !== 0);
  const totalDebits = activeAccounts.filter(a => ["asset", "expense"].includes(a.account_type)).reduce((s, a) => s + Number(a.balance), 0);
  const totalCredits = activeAccounts.filter(a => ["liability", "equity", "income"].includes(a.account_type)).reduce((s, a) => s + Number(a.balance), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Debit</TableHead>
          <TableHead className="text-right">Credit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activeAccounts.map(a => {
          const isDebit = ["asset", "expense"].includes(a.account_type);
          return (
            <TableRow key={a.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">{a.account_code}</TableCell>
              <TableCell>{a.name}</TableCell>
              <TableCell className="capitalize text-xs text-muted-foreground">{a.account_type}</TableCell>
              <TableCell className="text-right">{isDebit ? fmtGHS(Number(a.balance)) : "—"}</TableCell>
              <TableCell className="text-right">{!isDebit ? fmtGHS(Number(a.balance)) : "—"}</TableCell>
            </TableRow>
          );
        })}
        <TableRow className="font-bold border-t-2">
          <TableCell colSpan={3} className="font-bold">
            Totals {isBalanced ? <span className="text-xs font-normal text-green-500 ml-2">✓ Balanced</span> : <span className="text-xs font-normal text-destructive ml-2">⚠ Out of balance</span>}
          </TableCell>
          <TableCell className="text-right font-bold">{fmtGHS(totalDebits)}</TableCell>
          <TableCell className="text-right font-bold">{fmtGHS(totalCredits)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function CashFlow({ accounts }: { accounts: Account[] }) {
  const cashAccounts = accounts.filter(a => a.account_type === "asset" && (a.name.toLowerCase().includes("cash") || a.name.toLowerCase().includes("bank") || a.name.toLowerCase().includes("momo")));
  const operatingIncome = accounts.filter(a => a.account_type === "income").reduce((s, a) => s + Number(a.balance), 0);
  const operatingExpenses = accounts.filter(a => a.account_type === "expense").reduce((s, a) => s + Number(a.balance), 0);
  const netOperating = operatingIncome - operatingExpenses;
  const totalCash = cashAccounts.reduce((s, a) => s + Number(a.balance), 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="bg-secondary/30"><TableCell colSpan={3} className="font-semibold text-sm uppercase tracking-wider py-2">Operating Activities</TableCell></TableRow>
        <TableRow>
          <TableCell className="text-muted-foreground text-sm">Revenue</TableCell>
          <TableCell>Cash from sales and income</TableCell>
          <TableCell className="text-right text-primary">{fmtGHS(operatingIncome)}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="text-muted-foreground text-sm">Expenses</TableCell>
          <TableCell>Cash paid for operating expenses</TableCell>
          <TableCell className="text-right text-destructive">({fmtGHS(operatingExpenses)})</TableCell>
        </TableRow>
        <SectionTotal label="Net Cash from Operations" amount={netOperating} />

        <TableRow><TableCell colSpan={3} className="py-2" /></TableRow>
        <TableRow className="bg-secondary/30"><TableCell colSpan={3} className="font-semibold text-sm uppercase tracking-wider py-2">Cash & Bank Balances</TableCell></TableRow>
        {cashAccounts.length > 0 ? cashAccounts.map(a => (
          <TableRow key={a.id}>
            <TableCell className="font-mono text-xs text-muted-foreground">{a.account_code}</TableCell>
            <TableCell>{a.name}</TableCell>
            <TableCell className="text-right">{fmtGHS(Number(a.balance))}</TableCell>
          </TableRow>
        )) : (
          <TableRow><TableCell colSpan={3} className="text-muted-foreground text-sm py-4 text-center">No cash/bank accounts found. Add accounts with "cash" or "bank" in the name.</TableCell></TableRow>
        )}
        <SectionTotal label="Total Cash & Bank" amount={totalCash} />
      </TableBody>
    </Table>
  );
}

const REPORT_TITLES: Record<string, string> = {
  pl: "Profit & Loss Statement",
  balance: "Balance Sheet",
  trial: "Trial Balance",
  cashflow: "Cash Flow Statement",
};

export default function FinancialReportDialog({ open, onOpenChange, reportType, accounts, businessName }: Props) {
  if (!reportType) return null;

  const title = REPORT_TITLES[reportType];
  const today = format(new Date(), "MMMM d, yyyy");

  const handlePrint = () => window.print();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="font-display text-xl">{title}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{businessName} · As of {today}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Download className="h-4 w-4 mr-1" /> Print / Export
            </Button>
          </div>
        </DialogHeader>
        <Separator />
        {accounts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No accounts found. Set up your Chart of Accounts first.</p>
          </div>
        ) : (
          <>
            {reportType === "pl" && <ProfitLoss accounts={accounts} />}
            {reportType === "balance" && <BalanceSheet accounts={accounts} />}
            {reportType === "trial" && <TrialBalance accounts={accounts} />}
            {reportType === "cashflow" && <CashFlow accounts={accounts} />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
