import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  ChefHat, Plus, Users, Clock, CheckCircle2, XCircle,
  Save, Trash2, ShoppingBag, ChevronLeft, RotateCcw, UtensilsCrossed
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { formatGHS } from "@/lib/ghana";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

type TableStatus = "available" | "occupied" | "reserved" | "cleaning";
type OrderStatus = "open" | "settled" | "cancelled";

interface RestaurantTable {
  id: string;
  table_number: string;
  name: string | null;
  capacity: number;
  section: string;
  status: TableStatus;
}

interface RestaurantOrder {
  id: string;
  table_id: string | null;
  covers: number;
  opened_at: string;
  closed_at: string | null;
  status: OrderStatus;
  total_amount: number;
  notes: string | null;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABLE_STATUS_CFG: Record<TableStatus, { label: string; bg: string; border: string; text: string }> = {
  available: { label: "Available", bg: "bg-green-50",  border: "border-green-300", text: "text-green-700" },
  occupied:  { label: "Occupied",  bg: "bg-red-50",    border: "border-red-400",   text: "text-red-700"   },
  reserved:  { label: "Reserved",  bg: "bg-amber-50",  border: "border-amber-400", text: "text-amber-700" },
  cleaning:  { label: "Cleaning",  bg: "bg-slate-50",  border: "border-slate-400", text: "text-slate-600" },
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function Restaurant() {
  const { business } = useBusiness();
  const qc = useQueryClient();
  const businessId = business?.id;

  const [view, setView]               = useState<"tables" | "orders">("tables");
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [showAddTable,  setShowAddTable]  = useState(false);
  const [showOpenOrder, setShowOpenOrder] = useState(false);

  // Add table form
  const [tNum,  setTNum]  = useState("");
  const [tName, setTName] = useState("");
  const [tCap,  setTCap]  = useState("4");
  const [tSec,  setTSec]  = useState("Main");

  // Open order form
  const [covers, setCovers] = useState("2");
  const [oNotes, setONotes] = useState("");

  // Add item form
  const [itemName,  setItemName]  = useState("");
  const [itemQty,   setItemQty]   = useState("1");
  const [itemPrice, setItemPrice] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: tables = [], isLoading } = useQuery<RestaurantTable[]>({
    queryKey: ["restaurant-tables", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("business_id", businessId)
        .order("section").order("table_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: openOrder } = useQuery<RestaurantOrder | null>({
    queryKey: ["open-order", selectedTable?.id],
    enabled: !!selectedTable,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_orders")
        .select("*")
        .eq("table_id", selectedTable!.id)
        .eq("status", "open")
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const { data: orderItems = [] } = useQuery<OrderItem[]>({
    queryKey: ["order-items", openOrder?.id],
    enabled: !!openOrder,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_order_items")
        .select("*")
        .eq("order_id", openOrder!.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recentOrders = [] } = useQuery<(RestaurantOrder & { table_number?: string })[]>({
    queryKey: ["recent-orders", businessId],
    enabled: !!businessId && view === "orders",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_orders")
        .select("*, restaurant_tables(table_number)")
        .eq("business_id", businessId)
        .order("opened_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((o: any) => ({
        ...o,
        table_number: o.restaurant_tables?.table_number ?? "—",
      }));
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addTable = useMutation({
    mutationFn: async () => {
      if (!businessId || !tNum) throw new Error("Table number required");
      const { error } = await supabase
        .from("restaurant_tables")
        .insert({ business_id: businessId, table_number: tNum, name: tName || null, capacity: parseInt(tCap) || 4, section: tSec });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Table added");
      qc.invalidateQueries({ queryKey: ["restaurant-tables"] });
      setShowAddTable(false);
      setTNum(""); setTName("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const openOrderMut = useMutation({
    mutationFn: async () => {
      if (!businessId || !selectedTable) throw new Error("No table selected");
      const { data: order, error } = await supabase
        .from("restaurant_orders")
        .insert({
          business_id: businessId,
          table_id:    selectedTable.id,
          covers:      parseInt(covers) || 1,
          notes:       oNotes || null,
        })
        .select().single();
      if (error) throw error;
      // Mark table occupied
      await supabase
        .from("restaurant_tables")
        .update({ status: "occupied" })
        .eq("id", selectedTable.id);
      return order;
    },
    onSuccess: () => {
      toast.success("Order opened");
      qc.invalidateQueries({ queryKey: ["restaurant-tables"] });
      qc.invalidateQueries({ queryKey: ["open-order"] });
      setShowOpenOrder(false);
      setCovers("2"); setONotes("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!openOrder || !itemName || !itemPrice) throw new Error("Fill all fields");
      const qty   = parseFloat(itemQty)   || 1;
      const price = parseFloat(itemPrice) || 0;
      const { error } = await supabase
        .from("restaurant_order_items")
        .insert({
          order_id:     openOrder.id,
          business_id:  businessId,
          product_name: itemName,
          quantity:     qty,
          unit_price:   price,
          notes:        itemNotes || null,
        });
      if (error) throw error;
      // Update order total
      const newTotal = orderItems.reduce((s, i) => s + i.quantity * i.unit_price, 0) + qty * price;
      await supabase
        .from("restaurant_orders")
        .update({ total_amount: Math.round(newTotal * 100) / 100 })
        .eq("id", openOrder.id);
    },
    onSuccess: () => {
      toast.success("Item added");
      qc.invalidateQueries({ queryKey: ["order-items"] });
      qc.invalidateQueries({ queryKey: ["open-order"] });
      setShowAddItem(false);
      setItemName(""); setItemQty("1"); setItemPrice(""); setItemNotes("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const item = orderItems.find(i => i.id === itemId);
      const { error } = await supabase.from("restaurant_order_items").delete().eq("id", itemId);
      if (error) throw error;
      if (item && openOrder) {
        const newTotal = orderItems.filter(i => i.id !== itemId).reduce((s, i) => s + i.quantity * i.unit_price, 0);
        await supabase.from("restaurant_orders").update({ total_amount: Math.round(newTotal * 100) / 100 }).eq("id", openOrder.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-items"] });
      qc.invalidateQueries({ queryKey: ["open-order"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const settleOrder = useMutation({
    mutationFn: async () => {
      if (!openOrder || !selectedTable) throw new Error("No open order");
      await supabase
        .from("restaurant_orders")
        .update({ status: "settled", closed_at: new Date().toISOString() })
        .eq("id", openOrder.id);
      await supabase
        .from("restaurant_tables")
        .update({ status: "available" })
        .eq("id", selectedTable.id);
    },
    onSuccess: () => {
      toast.success("Order settled — table cleared");
      qc.invalidateQueries({ queryKey: ["restaurant-tables"] });
      qc.invalidateQueries({ queryKey: ["open-order"] });
      qc.invalidateQueries({ queryKey: ["order-items"] });
      qc.invalidateQueries({ queryKey: ["recent-orders"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const updateTableStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TableStatus }) => {
      const { error } = await supabase.from("restaurant_tables").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-tables"] });
      if (selectedTable) setSelectedTable(prev => prev ? { ...prev } : null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  // ── Summaries ─────────────────────────────────────────────────────────────

  const byStatus = {
    available: tables.filter(t => t.status === "available").length,
    occupied:  tables.filter(t => t.status === "occupied").length,
    reserved:  tables.filter(t => t.status === "reserved").length,
  };

  const orderTotal = orderItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  // ── Table detail panel (right side) ───────────────────────────────────────

  const TableDetail = selectedTable ? (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "100%" }}
        className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-2xl z-50 flex flex-col"
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">Table {selectedTable.table_number}</h2>
            {selectedTable.name && <p className="text-sm text-muted-foreground">{selectedTable.name}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSelectedTable(null)}>✕</Button>
        </div>

        {/* Table status + quick actions */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {(["available","reserved","cleaning"] as TableStatus[]).map(s => (
              <Button key={s} size="sm" variant="outline" className="text-xs"
                onClick={() => updateTableStatus.mutate({ id: selectedTable.id, status: s })}>
                Mark {TABLE_STATUS_CFG[s].label}
              </Button>
            ))}
          </div>

          {!openOrder && selectedTable.status !== "occupied" && (
            <Button className="w-full" style={{ background: "var(--forest)" }}
              onClick={() => setShowOpenOrder(true)}>
              <Plus className="h-4 w-4 mr-2" /> Open Order
            </Button>
          )}
        </div>

        {/* Open order detail */}
        {openOrder ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Open Tab</p>
                <p className="text-xs text-muted-foreground">
                  {openOrder.covers} covers · opened {format(new Date(openOrder.opened_at), "HH:mm")}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowAddItem(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {orderItems.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No items yet</div>
              ) : (
                <div className="divide-y">
                  {orderItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.product_name}</p>
                        {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                      <span className="text-sm font-medium">{formatGHS(item.quantity * item.unit_price)}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => removeItem.mutate(item.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add item inline form */}
            <AnimatePresence>
              {showAddItem && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="border-t bg-muted/30 p-3 space-y-2 overflow-hidden"
                >
                  <div className="grid grid-cols-3 gap-2">
                    <Input className="col-span-3 h-8 text-sm" placeholder="Item name" value={itemName} onChange={e => setItemName(e.target.value)} />
                    <Input className="h-8 text-sm" placeholder="Qty" type="number" value={itemQty} onChange={e => setItemQty(e.target.value)} />
                    <Input className="col-span-2 h-8 text-sm" placeholder="Unit price (GHS)" type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} />
                    <Input className="col-span-3 h-8 text-sm" placeholder="Note (optional)" value={itemNotes} onChange={e => setItemNotes(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
                    <Button size="sm" style={{ background: "var(--forest)" }}
                      onClick={() => addItem.mutate()} disabled={addItem.isPending || !itemName || !itemPrice}>
                      Add
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-4 border-t space-y-3">
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{formatGHS(orderTotal)}</span>
              </div>
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={() => settleOrder.mutate()} disabled={settleOrder.isPending || orderItems.length === 0}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {settleOrder.isPending ? "Settling…" : "Settle & Close Table"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            <div className="text-center">
              <UtensilsCrossed className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No open order on this table</p>
            </div>
          </div>
        )}

        {/* Open order form */}
        <AnimatePresence>
          {showOpenOrder && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="absolute inset-0 bg-background flex flex-col z-10"
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold">Open Order — Table {selectedTable.table_number}</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowOpenOrder(false)}>✕</Button>
              </div>
              <div className="flex-1 p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Number of Covers</label>
                  <Input type="number" min="1" value={covers} onChange={e => setCovers(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Notes (optional)</label>
                  <Input placeholder="e.g. Birthday party, allergies…" value={oNotes} onChange={e => setONotes(e.target.value)} />
                </div>
              </div>
              <div className="p-4 border-t">
                <Button className="w-full" style={{ background: "var(--forest)" }}
                  onClick={() => openOrderMut.mutate()} disabled={openOrderMut.isPending}>
                  {openOrderMut.isPending ? "Opening…" : "Open Order"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  ) : null;

  // ── Main view ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Restaurant</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Table management and order tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setView(v => v === "tables" ? "orders" : "tables")}>
            {view === "tables" ? <ShoppingBag className="h-4 w-4 mr-1.5" /> : <ChefHat className="h-4 w-4 mr-1.5" />}
            {view === "tables" ? "Order History" : "Tables"}
          </Button>
          {view === "tables" && (
            <Button size="sm" style={{ background: "var(--forest)" }} onClick={() => setShowAddTable(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Table
            </Button>
          )}
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3">
        {[
          { label: "Available", count: byStatus.available, color: "bg-green-100 text-green-700" },
          { label: "Occupied",  count: byStatus.occupied,  color: "bg-red-100 text-red-700"    },
          { label: "Reserved",  count: byStatus.reserved,  color: "bg-amber-100 text-amber-700"},
        ].map(({ label, count, color }) => (
          <div key={label} className={`rounded-full px-3 py-1 text-sm font-medium ${color}`}>
            {count} {label}
          </div>
        ))}
      </div>

      {view === "tables" ? (
        isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : tables.length === 0 ? (
          <div className="bg-card border rounded-xl p-12 text-center">
            <ChefHat className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No tables set up yet. Add your first table.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {tables.map(table => {
              const cfg = TABLE_STATUS_CFG[table.status];
              return (
                <motion.button
                  key={table.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedTable(table)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${cfg.bg} ${cfg.border}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-2xl font-bold">{table.table_number}</span>
                    <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {table.capacity} seats
                  </div>
                  {table.section && table.section !== "Main" && (
                    <p className="text-xs text-muted-foreground mt-0.5">{table.section}</p>
                  )}
                </motion.button>
              );
            })}
          </div>
        )
      ) : (
        /* Order history */
        <div className="bg-card border rounded-xl overflow-hidden">
          {recentOrders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No orders yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  {["Table","Covers","Opened","Status","Total"].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o.id} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{(o as any).table_number}</td>
                    <td className="px-3 py-2">{o.covers}</td>
                    <td className="px-3 py-2 text-muted-foreground">{format(new Date(o.opened_at), "d MMM HH:mm")}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        o.status === "open" ? "bg-blue-100 text-blue-700" :
                        o.status === "settled" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{formatGHS(o.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add table modal */}
      <AnimatePresence>
        {showAddTable && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowAddTable(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-background border rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <h2 className="font-bold text-lg">Add Table</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Table Number *</label>
                    <Input placeholder="e.g. T1, 12, A3" value={tNum} onChange={e => setTNum(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Name (optional)</label>
                    <Input placeholder="Window, VIP…" value={tName} onChange={e => setTName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Capacity</label>
                    <Input type="number" min="1" value={tCap} onChange={e => setTCap(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Section</label>
                    <Input placeholder="Main, Terrace, VIP…" value={tSec} onChange={e => setTSec(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddTable(false)}>Cancel</Button>
                  <Button className="flex-1" style={{ background: "var(--forest)" }}
                    onClick={() => addTable.mutate()} disabled={addTable.isPending || !tNum}>
                    {addTable.isPending ? "Adding…" : "Add Table"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Table detail panel */}
      {selectedTable && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setSelectedTable(null)}
        />
      )}
      <div onClick={e => e.stopPropagation()}>{TableDetail}</div>
    </div>
  );
}
