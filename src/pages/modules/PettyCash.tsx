import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  Wallet, Plus, ChevronLeft, ArrowUpCircle, ArrowDownCircle,
  RefreshCw, Save, Receipt, User, AlertTriangle, TrendingDown
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

type TxnType = "expense" | "top-up" | "adjustment";

interface PettyCashFund {
  id: string;
  name: string;
  custodian: string | null;
  opening_float: number;
  current_balance: number;
  created_at: string;
}

interface PettyCashTransaction {
  id: string;
  fund_id: string;
  txn_date: string;
  description: string;
  category: string;
  amount: number;
  txn_type: TxnType;
  receipt_ref: string | null;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TXN_CATEGORIES = [
  "Office Supplies", "Transport", "Refreshments", "Utilities",
  "Repairs", "Postage", "Cleaning", "Staff Welfare", "Miscellaneous",
];

const TXN_CONFIG: Record<TxnType, { label: string; icon: typeof ArrowDownCircle; color: string; sign: string }> = {
  expense:    { label: "Expense",    icon: ArrowDownCircle, color: "text-red-500",   sign: "-" },
  "top-up":   { label: "Top-Up",    icon: ArrowUpCircle,   color: "text-green-600", sign: "+" },
  adjustment: { label: "Adjustment",icon: RefreshCw,       color: "text-blue-500",  sign: "±" },
};

// ── Fund card ─────────────────────────────────────────────────────────────────

function FundCard({ fund, onClick }: { fund: PettyCashFund; onClick: () => void }) {
  const pct = fund.opening_float > 0
    ? Math.round((fund.current_balance / fund.opening_float) * 100)
    : 0;
  const low = fund.current_balance < fund.opening_float * 0.2;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`bg-card border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow space-y-3 ${
        low ? "border-amber-400" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{fund.name}</h3>
          {fund.custodian && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <User className="h-3 w-3" />{fund.custodian}
            </div>
          )}
        </div>
        {low && <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Low</Badge>}
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">Balance</span>
          <span className={`font-bold ${low ? "text-amber-600" : ""}`}>{formatGHS(fund.current_balance)}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${low ? "bg-amber-400" : "bg-[var(--forest)]"}`}
            style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Float: {formatGHS(fund.opening_float)}</span>
          <span>{pct}% remaining</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PettyCash() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const businessId = business?.id;

  const [selectedFund, setSelectedFund]   = useState<PettyCashFund | null>(null);
  const [showNewFund,  setShowNewFund]    = useState(false);
  const [showNewTxn,   setShowNewTxn]    = useState(false);

  // New fund form
  const [fName,      setFName]      = useState("");
  const [fCustodian, setFCustodian] = useState("");
  const [fFloat,     setFFloat]     = useState("");

  // New transaction form
  const [tDate,     setTDate]     = useState(format(new Date(), "yyyy-MM-dd"));
  const [tDesc,     setTDesc]     = useState("");
  const [tCategory, setTCategory] = useState(TXN_CATEGORIES[0]);
  const [tAmount,   setTAmount]   = useState("");
  const [tType,     setTType]     = useState<TxnType>("expense");
  const [tReceipt,  setTReceipt]  = useState("");

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: funds = [], isLoading } = useQuery<PettyCashFund[]>({
    queryKey: ["petty-funds", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("petty_cash_funds")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: transactions = [] } = useQuery<PettyCashTransaction[]>({
    queryKey: ["petty-txns", selectedFund?.id],
    enabled: !!selectedFund,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("petty_cash_transactions")
        .select("*")
        .eq("fund_id", selectedFund!.id)
        .order("txn_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createFund = useMutation({
    mutationFn: async () => {
      if (!businessId || !fName || !fFloat) throw new Error("Fill required fields");
      const floatAmt = parseFloat(fFloat);
      const { error } = await supabase
        .from("petty_cash_funds")
        .insert({
          business_id:     businessId,
          name:            fName,
          custodian:       fCustodian || null,
          opening_float:   floatAmt,
          current_balance: floatAmt,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fund created");
      qc.invalidateQueries({ queryKey: ["petty-funds"] });
      setShowNewFund(false);
      setFName(""); setFCustodian(""); setFFloat("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addTransaction = useMutation({
    mutationFn: async () => {
      if (!businessId || !selectedFund || !tDesc || !tAmount) throw new Error("Fill required fields");
      const amount = parseFloat(tAmount);
      if (isNaN(amount) || amount <= 0) throw new Error("Enter a valid amount");

      // Insert transaction
      const { error: txnError } = await supabase
        .from("petty_cash_transactions")
        .insert({
          business_id: businessId,
          fund_id:     selectedFund.id,
          txn_date:    tDate,
          description: tDesc,
          category:    tCategory,
          amount,
          txn_type:    tType,
          receipt_ref: tReceipt || null,
        });
      if (txnError) throw txnError;

      // Update balance
      let balanceDelta = 0;
      if (tType === "expense")    balanceDelta = -amount;
      if (tType === "top-up")     balanceDelta = +amount;
      if (tType === "adjustment") balanceDelta = amount; // can be positive or negative

      const newBalance = selectedFund.current_balance + balanceDelta;
      const { error: fundError } = await supabase
        .from("petty_cash_funds")
        .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", selectedFund.id);
      if (fundError) throw fundError;
    },
    onSuccess: () => {
      toast.success("Transaction recorded");
      qc.invalidateQueries({ queryKey: ["petty-txns"] });
      qc.invalidateQueries({ queryKey: ["petty-funds"] });
      // Refresh selected fund balance
      setSelectedFund(prev =>
        prev ? {
          ...prev,
          current_balance: prev.current_balance + (
            tType === "expense"    ? -(parseFloat(tAmount) || 0) :
            tType === "top-up"     ? +(parseFloat(tAmount) || 0) :
                                      (parseFloat(tAmount) || 0)
          ),
        } : null
      );
      setShowNewTxn(false);
      setTDesc(""); setTAmount(""); setTReceipt("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ── Summary ────────────────────────────────────────────────────────────────

  const totalBalance = funds.reduce((s, f) => s + f.current_balance, 0);
  const totalFloat   = funds.reduce((s, f) => s + f.opening_float,   0);

  // ── Detail view ────────────────────────────────────────────────────────────

  if (selectedFund) {
    const totalExpenses = transactions.filter(t => t.txn_type === "expense").reduce((s, t) => s + t.amount, 0);
    const totalTopUps   = transactions.filter(t => t.txn_type === "top-up").reduce((s, t) => s + t.amount, 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedFund(null)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{selectedFund.name}</h1>
            {selectedFund.custodian && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> {selectedFund.custodian}
              </p>
            )}
          </div>
          <Button style={{ background: "var(--forest)" }} onClick={() => setShowNewTxn(true)}>
            <Plus className="h-4 w-4 mr-2" /> Record Transaction
          </Button>
        </div>

        {/* Fund summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Current Balance",  value: formatGHS(selectedFund.current_balance), color: "text-[var(--forest)]" },
            { label: "Total Expenses",   value: formatGHS(totalExpenses),                color: "text-red-500"         },
            { label: "Total Top-Ups",    value: formatGHS(totalTopUps),                  color: "text-green-600"       },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Transactions */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold">Transactions</h2>
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No transactions yet. Record an expense or top-up.
            </div>
          ) : (
            <div className="divide-y">
              {transactions.map(txn => {
                const cfg = TXN_CONFIG[txn.txn_type];
                const Icon = cfg.icon;
                return (
                  <div key={txn.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20">
                    <div className={`p-1.5 rounded-full bg-muted ${cfg.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{txn.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(parseISO(txn.txn_date), "d MMM yyyy")}</span>
                        <span>·</span>
                        <span>{txn.category}</span>
                        {txn.receipt_ref && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-0.5">
                              <Receipt className="h-3 w-3" />{txn.receipt_ref}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={`text-sm font-bold ${cfg.color}`}>
                      {cfg.sign}{formatGHS(txn.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Record transaction slide-in */}
        <AnimatePresence>
          {showNewTxn && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowNewTxn(false)}
              />
              <motion.div
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 260 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-2xl z-50 flex flex-col"
              >
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="font-bold text-lg">Record Transaction</h2>
                  <Button variant="ghost" size="icon" onClick={() => setShowNewTxn(false)}>✕</Button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Type selector */}
                  <div className="grid grid-cols-3 gap-2">
                    {(["expense", "top-up", "adjustment"] as TxnType[]).map(t => {
                      const cfg = TXN_CONFIG[t];
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={t}
                          onClick={() => setTType(t)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs font-medium transition-colors ${
                            tType === t ? "border-[var(--forest)] bg-[var(--forest)]/10 text-[var(--forest)]" : "hover:bg-muted"
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${tType === t ? "text-[var(--forest)]" : cfg.color}`} />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Date</label>
                    <Input type="date" value={tDate} onChange={e => setTDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Description *</label>
                    <Input placeholder="What was this for?" value={tDesc} onChange={e => setTDesc(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Category</label>
                    <Select value={tCategory} onValueChange={setTCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TXN_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Amount (GHS) *</label>
                    <Input type="number" placeholder="0.00" value={tAmount} onChange={e => setTAmount(e.target.value)} />
                    {tType === "expense" && selectedFund.current_balance < parseFloat(tAmount || "0") && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Amount exceeds current balance
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Receipt Ref.</label>
                    <Input placeholder="e.g. REC-001" value={tReceipt} onChange={e => setTReceipt(e.target.value)} />
                  </div>
                </div>
                <div className="p-4 border-t">
                  <Button
                    className="w-full"
                    style={{ background: "var(--forest)" }}
                    onClick={() => addTransaction.mutate()}
                    disabled={addTransaction.isPending || !tDesc || !tAmount}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {addTransaction.isPending ? "Saving…" : "Record Transaction"}
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Fund list view ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Petty Cash</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage cash floats across offices and branches</p>
        </div>
        <Button style={{ background: "var(--forest)" }} onClick={() => setShowNewFund(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Fund
        </Button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Float</p>
          <p className="text-2xl font-bold">{formatGHS(totalFloat)}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
          <p className={`text-2xl font-bold ${totalBalance < totalFloat * 0.2 ? "text-amber-600" : ""}`}>
            {formatGHS(totalBalance)}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : funds.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center">
          <Wallet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No petty cash funds yet. Create one for each office or branch.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {funds.map(f => <FundCard key={f.id} fund={f} onClick={() => setSelectedFund(f)} />)}
        </div>
      )}

      {/* New fund modal */}
      <AnimatePresence>
        {showNewFund && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowNewFund(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-background border rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <h2 className="font-bold text-lg">New Petty Cash Fund</h2>
                <div>
                  <label className="text-sm font-medium mb-1 block">Fund Name *</label>
                  <Input placeholder="e.g. Head Office, Branch 1" value={fName} onChange={e => setFName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Custodian</label>
                  <Input placeholder="Person responsible" value={fCustodian} onChange={e => setFCustodian(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Opening Float (GHS) *</label>
                  <Input type="number" placeholder="500.00" value={fFloat} onChange={e => setFFloat(e.target.value)} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowNewFund(false)}>Cancel</Button>
                  <Button className="flex-1" style={{ background: "var(--forest)" }}
                    onClick={() => createFund.mutate()} disabled={createFund.isPending || !fName || !fFloat}>
                    {createFund.isPending ? "Creating…" : "Create Fund"}
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
