import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatGHS, PAYMENT_METHODS } from "@/lib/ghana";
import { Plus, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export interface PaymentSplit {
  method: string;
  amount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  onConfirm: (splits: PaymentSplit[]) => void;
}

export function SplitPaymentDialog({ open, onOpenChange, total, onConfirm }: Props) {
  const [splits, setSplits] = useState<PaymentSplit[]>([
    { method: "cash", amount: total },
    { method: "mtn_momo", amount: 0 },
  ]);

  const allocated = splits.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = Math.round((total - allocated) * 100) / 100;

  const updateSplit = (i: number, field: keyof PaymentSplit, value: string) => {
    setSplits(prev => prev.map((s, idx) =>
      idx === i ? { ...s, [field]: field === "amount" ? Number(value) || 0 : value } : s
    ));
  };

  const addSplit = () => setSplits(prev => [...prev, { method: "card", amount: 0 }]);
  const removeSplit = (i: number) => setSplits(prev => prev.filter((_, idx) => idx !== i));

  const handleConfirm = () => {
    const valid = splits.filter(s => s.amount > 0);
    if (valid.length === 0) { toast.error("Add at least one payment"); return; }
    if (Math.abs(remaining) > 0.01) { toast.error(`GHS ${Math.abs(remaining).toFixed(2)} ${remaining > 0 ? "unallocated" : "over-allocated"}`); return; }
    onConfirm(valid);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Split Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-2">
            <span className="text-sm text-muted-foreground">Total to pay</span>
            <span className="font-display font-bold text-primary">{formatGHS(total)}</span>
          </div>

          <div className="space-y-2">
            {splits.map((split, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={split.method} onValueChange={v => updateSplit(i, "method", v)}>
                  <SelectTrigger className="flex-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  className="w-28 h-9"
                  value={split.amount || ""}
                  onChange={e => updateSplit(i, "amount", e.target.value)}
                />
                {splits.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive" onClick={() => removeSplit(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button variant="ghost" size="sm" onClick={addSplit} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add payment method
          </Button>

          <div className={`flex items-center justify-between rounded-lg px-4 py-2 text-sm ${Math.abs(remaining) < 0.01 ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}`}>
            <span>{remaining > 0 ? "Remaining" : remaining < 0 ? "Over by" : "Balanced ✓"}</span>
            {Math.abs(remaining) >= 0.01 && <span className="font-bold">{formatGHS(Math.abs(remaining))}</span>}
          </div>

          <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleConfirm} disabled={Math.abs(remaining) > 0.01}>
            <CheckCircle className="h-4 w-4 mr-2" /> Confirm Split
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
