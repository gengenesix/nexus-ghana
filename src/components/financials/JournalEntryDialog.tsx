import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface Line { account_id: string; description: string; debit: string; credit: string; }

interface JournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function JournalEntryDialog({ open, onOpenChange }: JournalEntryDialogProps) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], description: "", reference: "" });
  const [lines, setLines] = useState<Line[]>([
    { account_id: "", description: "", debit: "", credit: "" },
    { account_id: "", description: "", debit: "", credit: "" },
  ]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["chart_of_accounts", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("chart_of_accounts").select("id, account_code, name").eq("business_id", business!.id).eq("is_active", true).order("account_code");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id && open,
  });

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;

  const handleSave = async () => {
    if (!isBalanced) { toast.error("Debits must equal credits"); return; }
    const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit) || parseFloat(l.credit)));
    if (validLines.length < 2) { toast.error("At least 2 lines required"); return; }
    setSaving(true);
    try {
      const entryNum = `JE-${Date.now().toString(36).toUpperCase()}`;
      const { data: entry, error: entryErr } = await supabase.from("journal_entries").insert({
        business_id: business!.id,
        entry_number: entryNum,
        date: form.date,
        description: form.description || null,
        reference: form.reference || null,
        total_debit: totalDebit,
        total_credit: totalCredit,
        status: "posted",
      }).select().single();
      if (entryErr) throw entryErr;

      const lineInserts = validLines.map(l => ({
        journal_entry_id: entry.id,
        account_id: l.account_id,
        description: l.description || null,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      }));
      const { error: lineErr } = await supabase.from("journal_entry_lines").insert(lineInserts);
      if (lineErr) throw lineErr;

      toast.success("Journal entry posted");
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      onOpenChange(false);
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  const updateLine = (i: number, field: keyof Line, value: string) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Reference</Label><Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label>Entry Lines</Label>
              <Button variant="ghost" size="sm" onClick={() => setLines(prev => [...prev, { account_id: "", description: "", debit: "", credit: "" }])}><Plus className="h-3.5 w-3.5 mr-1" />Add Line</Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="p-2 text-left">Account</th><th className="p-2 text-left">Memo</th><th className="p-2 text-right w-28">Debit</th><th className="p-2 text-right w-28">Credit</th><th className="w-10"></th></tr></thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1">
                        <Select value={line.account_id} onValueChange={v => updateLine(i, "account_id", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select account" /></SelectTrigger>
                          <SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={a.id} className="text-xs">{a.account_code} — {a.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="p-1"><Input className="h-8 text-xs" value={line.description} onChange={e => updateLine(i, "description", e.target.value)} /></td>
                      <td className="p-1"><Input className="h-8 text-xs text-right" type="number" value={line.debit} onChange={e => updateLine(i, "debit", e.target.value)} placeholder="0.00" /></td>
                      <td className="p-1"><Input className="h-8 text-xs text-right" type="number" value={line.credit} onChange={e => updateLine(i, "credit", e.target.value)} placeholder="0.00" /></td>
                      <td className="p-1">{lines.length > 2 && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/30 font-medium">
                    <td colSpan={2} className="p-2 text-right">Totals</td>
                    <td className="p-2 text-right font-mono">{totalDebit.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono">{totalCredit.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            {!isBalanced && totalDebit > 0 && <p className="text-xs text-destructive">⚠ Entry is unbalanced by GHS {Math.abs(totalDebit - totalCredit).toFixed(2)}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !isBalanced}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Post Entry</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
