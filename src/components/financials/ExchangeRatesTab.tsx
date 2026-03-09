import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Trash2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "XOF", "ZAR", "CNY", "JPY", "CAD", "AUD"];

export default function ExchangeRatesTab() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [formFrom, setFormFrom] = useState("USD");
  const [formTo, setFormTo] = useState("GHS");
  const [formRate, setFormRate] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [convertAmount, setConvertAmount] = useState("");
  const [convertFrom, setConvertFrom] = useState("USD");

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ["exchange_rates", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("business_id", business!.id)
        .order("effective_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const latestRates = CURRENCIES.reduce((acc: Record<string, number>, curr) => {
    const r = rates.find((r: any) => r.from_currency === curr && r.to_currency === "GHS");
    if (r) acc[curr] = Number(r.rate);
    return acc;
  }, {});

  const convertedValue = convertAmount && latestRates[convertFrom]
    ? (Number(convertAmount) * latestRates[convertFrom]).toFixed(2)
    : null;

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("exchange_rates").insert({
        business_id: business!.id,
        from_currency: formFrom,
        to_currency: formTo,
        rate: Number(formRate) || 1,
        effective_date: formDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange_rates"] });
      setShowAdd(false); setFormRate("");
      toast.success("Exchange rate added");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exchange_rates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange_rates"] });
      toast.success("Deleted");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> Exchange Rates</h3>
          <p className="text-sm text-muted-foreground">Manage FX rates for multi-currency transactions</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Rate</Button>
      </div>

      {/* Currency Converter */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-3">Quick Converter</p>
          <div className="flex items-end gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Amount</Label>
              <Input type="number" value={convertAmount} onChange={e => setConvertAmount(e.target.value)} placeholder="100" />
            </div>
            <div className="space-y-1 w-[100px]">
              <Label className="text-xs">From</Label>
              <Select value={convertFrom} onValueChange={setConvertFrom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="pb-2"><ArrowRightLeft className="h-4 w-4 text-muted-foreground" /></div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">GHS</Label>
              <Input readOnly value={convertedValue || "—"} className="bg-muted" />
            </div>
          </div>
          {convertFrom && latestRates[convertFrom] && (
            <p className="text-xs text-muted-foreground mt-2">Rate: 1 {convertFrom} = {latestRates[convertFrom]} GHS</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : rates.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No exchange rates configured</TableCell></TableRow>
              ) : rates.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.from_currency}</TableCell>
                  <TableCell className="font-mono">{r.to_currency}</TableCell>
                  <TableCell className="text-right font-medium">{Number(r.rate).toFixed(4)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.effective_date}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Exchange Rate</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Currency</Label>
                <Select value={formFrom} onValueChange={setFormFrom}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To Currency</Label>
                <Select value={formTo} onValueChange={setFormTo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GHS">GHS</SelectItem>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Rate</Label><Input type="number" step="0.0001" value={formRate} onChange={e => setFormRate(e.target.value)} placeholder="e.g. 15.50" /></div>
              <div className="space-y-2"><Label>Effective Date</Label><Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} /></div>
            </div>
            <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !formRate}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Rate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
