import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Search, Trash2, Barcode } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  available: "bg-success/10 text-success",
  sold: "bg-muted text-muted-foreground",
  reserved: "bg-warning/10 text-warning",
  defective: "bg-destructive/10 text-destructive",
};

export default function SerialBatchTab() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [formProductId, setFormProductId] = useState("");
  const [formSerial, setFormSerial] = useState("");
  const [formBatch, setFormBatch] = useState("");
  const [formStatus, setFormStatus] = useState("available");
  const [formWarrantyEnd, setFormWarrantyEnd] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products-list", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: serials = [], isLoading } = useQuery({
    queryKey: ["serial_numbers", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("serial_numbers")
        .select("*, products(name)")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const filtered = serials.filter((s: any) =>
    s.serial_number.toLowerCase().includes(search.toLowerCase()) ||
    (s.batch_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.products?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formProductId || !formSerial.trim()) throw new Error("Product and serial number required");
      const { error } = await supabase.from("serial_numbers").insert({
        business_id: business!.id,
        product_id: formProductId,
        serial_number: formSerial.trim(),
        batch_number: formBatch.trim(),
        status: formStatus,
        warranty_end: formWarrantyEnd || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serial_numbers"] });
      setShowAdd(false);
      setFormSerial(""); setFormBatch(""); setFormWarrantyEnd("");
      toast.success("Serial/batch number added");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("serial_numbers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["serial_numbers"] });
      toast.success("Deleted");
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("serial_numbers").update({ status, sold_date: status === "sold" ? new Date().toISOString().split("T")[0] : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["serial_numbers"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><Barcode className="h-5 w-5" /> Serial & Batch Tracking</h3>
          <p className="text-sm text-muted-foreground">{serials.length} tracked items · {serials.filter((s: any) => s.status === "available").length} available</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Serial/Batch</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search serial, batch, or product..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Serial #</TableHead>
                <TableHead>Batch #</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="hidden md:table-cell">Received</TableHead>
                <TableHead className="hidden md:table-cell">Warranty</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No serial numbers tracked yet</TableCell></TableRow>
              ) : filtered.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.products?.name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{s.serial_number}</TableCell>
                  <TableCell className="text-muted-foreground">{s.batch_number || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Select value={s.status} onValueChange={(v) => updateStatus.mutate({ id: s.id, status: v })}>
                      <SelectTrigger className="h-7 text-xs w-[100px] mx-auto">
                        <Badge className={`${statusColors[s.status]} capitalize text-xs`}>{s.status}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {["available", "sold", "reserved", "defective"].map(st => <SelectItem key={st} value={st} className="capitalize">{st}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{s.received_date}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{s.warranty_end || "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(s.id)}>
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
          <DialogHeader><DialogTitle>Add Serial / Batch Number</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select value={formProductId} onValueChange={setFormProductId}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Serial Number *</Label><Input value={formSerial} onChange={e => setFormSerial(e.target.value)} placeholder="e.g. SN-001234" /></div>
              <div className="space-y-2"><Label>Batch Number</Label><Input value={formBatch} onChange={e => setFormBatch(e.target.value)} placeholder="e.g. BATCH-2026-03" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["available", "sold", "reserved", "defective"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Warranty End</Label><Input type="date" value={formWarrantyEnd} onChange={e => setFormWarrantyEnd(e.target.value)} /></div>
            </div>
            <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !formProductId || !formSerial.trim()}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Serial/Batch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
