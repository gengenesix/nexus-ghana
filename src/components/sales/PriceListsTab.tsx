import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

export function PriceListsTab() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: priceLists = [] } = useQuery({
    queryKey: ["price_lists", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("price_lists").select("*").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });

  const savePriceList = useMutation({
    mutationFn: async () => {
      const payload = { business_id: business!.id, name: name.trim(), description: description.trim() };
      if (editing) {
        const { error } = await supabase.from("price_lists").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("price_lists").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price_lists"] });
      setDialogOpen(false);
      setEditing(null);
      setName("");
      setDescription("");
      toast.success(editing ? "Price list updated" : "Price list created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deletePriceList = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("price_lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price_lists"] });
      toast.success("Price list deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div>
          <h3 className="font-semibold">Price Lists</h3>
          <p className="text-sm text-muted-foreground">Create multiple pricing tiers for customer groups</p>
        </div>
        <Button onClick={() => { setEditing(null); setName(""); setDescription(""); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Price List
        </Button>
      </div>

      <Card><CardContent className="pt-4">
        {priceLists.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Currency</TableHead><TableHead>Status</TableHead><TableHead className="w-20"></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {priceLists.map((pl: any) => (
                <TableRow key={pl.id}>
                  <TableCell className="font-medium">{pl.name}</TableCell>
                  <TableCell className="text-muted-foreground">{pl.description || "—"}</TableCell>
                  <TableCell>{pl.currency}</TableCell>
                  <TableCell>
                    <Badge variant={pl.is_active ? "default" : "secondary"}>
                      {pl.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {pl.is_default && <Badge variant="outline" className="ml-1">Default</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(pl); setName(pl.name); setDescription(pl.description || ""); setDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deletePriceList.mutate(pl.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No price lists yet. Create one to set customer-specific pricing.</p>
          </div>
        )}
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Price List</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wholesale, VIP, Retail" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => savePriceList.mutate()} disabled={!name.trim()}>
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
