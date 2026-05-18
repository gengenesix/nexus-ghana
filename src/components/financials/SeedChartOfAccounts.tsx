import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ListOrdered } from "lucide-react";

// DB constraint: account_type IN ('asset','liability','equity','revenue','expense','cost_of_sales')
const DEFAULT_ACCOUNTS = [
  // Assets
  { account_code: "1000", name: "Cash",                      account_type: "asset" },
  { account_code: "1010", name: "Petty Cash",                account_type: "asset" },
  { account_code: "1100", name: "Bank - GHS",                account_type: "asset" },
  { account_code: "1200", name: "Accounts Receivable",       account_type: "asset" },
  { account_code: "1300", name: "Inventory",                 account_type: "asset" },
  { account_code: "1400", name: "Prepaid Expenses",          account_type: "asset" },
  { account_code: "1500", name: "Fixed Assets",              account_type: "asset" },
  { account_code: "1510", name: "Accumulated Depreciation",  account_type: "asset" },
  // Liabilities
  { account_code: "2000", name: "Accounts Payable",          account_type: "liability" },
  { account_code: "2100", name: "Accrued Expenses",          account_type: "liability" },
  { account_code: "2200", name: "VAT Payable",               account_type: "liability" },
  { account_code: "2300", name: "NHIL Payable",              account_type: "liability" },
  { account_code: "2310", name: "GETFund Levy Payable",      account_type: "liability" },
  { account_code: "2400", name: "PAYE Payable",              account_type: "liability" },
  { account_code: "2500", name: "SSNIT Payable",             account_type: "liability" },
  { account_code: "2600", name: "Short-term Loans",          account_type: "liability" },
  { account_code: "2700", name: "Long-term Loans",           account_type: "liability" },
  // Equity
  { account_code: "3000", name: "Owner's Equity / Capital",  account_type: "equity" },
  { account_code: "3100", name: "Retained Earnings",         account_type: "equity" },
  { account_code: "3200", name: "Current Year Earnings",     account_type: "equity" },
  // Revenue
  { account_code: "4000", name: "Sales Revenue",             account_type: "revenue" },
  { account_code: "4100", name: "Service Revenue",           account_type: "revenue" },
  { account_code: "4200", name: "Interest Income",           account_type: "revenue" },
  { account_code: "4300", name: "Other Income",              account_type: "revenue" },
  { account_code: "4400", name: "Discount Received",         account_type: "revenue" },
  // Cost of Sales
  { account_code: "5000", name: "Cost of Goods Sold",        account_type: "cost_of_sales" },
  // Expenses
  { account_code: "5100", name: "Salaries & Wages",          account_type: "expense" },
  { account_code: "5200", name: "Rent Expense",              account_type: "expense" },
  { account_code: "5300", name: "Utilities",                 account_type: "expense" },
  { account_code: "5400", name: "Office Supplies",           account_type: "expense" },
  { account_code: "5500", name: "Transport & Logistics",     account_type: "expense" },
  { account_code: "5600", name: "Marketing & Advertising",   account_type: "expense" },
  { account_code: "5700", name: "Depreciation Expense",      account_type: "expense" },
  { account_code: "5800", name: "Bank Charges",              account_type: "expense" },
  { account_code: "5900", name: "Insurance",                 account_type: "expense" },
  { account_code: "6000", name: "Miscellaneous Expenses",    account_type: "expense" },
  { account_code: "6100", name: "Discount Given",            account_type: "expense" },
];

export default function SeedChartOfAccounts() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();

  const seed = useMutation({
    mutationFn: async () => {
      const inserts = DEFAULT_ACCOUNTS.map(a => ({ ...a, business_id: business!.id }));
      const { error } = await supabase
        .from("chart_of_accounts")
        .upsert(inserts, { onConflict: "business_id,account_code", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart_of_accounts"] });
      toast.success("Ghana-standard Chart of Accounts ready — 37 accounts loaded");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Button onClick={() => seed.mutate()} disabled={seed.isPending} variant="outline">
      {seed.isPending
        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        : <ListOrdered className="h-4 w-4 mr-2" />}
      Generate Default Chart of Accounts
    </Button>
  );
}
