import { useState, useEffect } from "react";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useDebounce } from "@/hooks/useDebounce";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatGHS, PAYMENT_METHODS } from "@/lib/ghana";
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, UserPlus, PauseCircle, PlayCircle, ScanBarcode, WifiOff, Star, Scissors } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";
import { SplitPaymentDialog, PaymentSplit } from "@/components/pos/SplitPaymentDialog";
import { MoMoPaymentDialog } from "@/components/pos/MoMoPaymentDialog";
import { toast } from "sonner";

const MOMO_METHODS = ["mtn_momo", "telecel_cash", "airteltigo"];

const POINTS_RATE = 0.05; // 1 loyalty point = GHS 0.05

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

interface HeldSale {
  id: string;
  label: string;
  cart: CartItem[];
  customerId: string | null;
  discount: number;
  paymentMethod: string;
  timestamp: number;
}

export default function POS() {
  const { business } = useBusiness();
  const { staff } = useStaffSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastReceipt, setLastReceipt] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [skuSearch, setSkuSearch] = useState("");
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [showMoMoDialog, setShowMoMoDialog] = useState(false);
  const [pendingReceiptNum, setPendingReceiptNum] = useState("");
  const { isOnline, queue, enqueue, removeFromQueue } = useOfflineQueue();

  const { data: products = [] } = useQuery({
    queryKey: ["products", business?.id, debouncedSearch],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("*")
        .eq("business_id", business!.id)
        .gt("qty", 0)
        .order("name")
        .limit(80);

      if (debouncedSearch.trim()) {
        const term = debouncedSearch.trim();
        q = q.or(`name.ilike.%${term}%,sku.ilike.%${term}%,barcode.ilike.%${term}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-pos", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, phone, loyalty_points").eq("business_id", business!.id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  // Live stock updates — if another cashier sells an item, this POS refreshes
  useRealtimeInvalidate("products", [["products", business?.id]]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === product.id);
      if (existing) {
        if (existing.qty >= product.qty) { toast.error("Not enough stock"); return prev; }
        return prev.map(c => c.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { id: product.id, name: product.name, price: Number(product.selling_price), qty: 1 }];
    });
  };

  const handleSkuAdd = async () => {
    if (!skuSearch.trim() || !business) return;
    const q = skuSearch.trim();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("business_id", business.id)
      .gt("qty", 0)
      .or(`sku.ilike.${q},barcode.ilike.${q}`)
      .limit(1)
      .maybeSingle();
    const product = data;
    if (product) {
      addToCart(product);
      setSkuSearch("");
    } else {
      toast.error("Product not found");
    }
  };

  const updateQty = (id: string, delta: number) => {
    const product = products.find((p: any) => p.id === id);
    setCart(prev => prev.map(c => {
      if (c.id !== id) return c;
      const newQty = Math.max(1, c.qty + delta);
      if (product && newQty > product.qty) { toast.error("Not enough stock"); return c; }
      return { ...c, qty: newQty };
    }));
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(c => c.id !== id));

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discountAmount = discount > 0 ? subtotal * (discount / 100) : 0;
  const selectedCustomer = customers.find((c: any) => c.id === selectedCustomerId);
  const availablePoints: number = (selectedCustomer as any)?.loyalty_points ?? 0;
  const maxPointsDiscount = Math.floor(Math.min(availablePoints * POINTS_RATE, subtotal - discountAmount) * 100) / 100;
  const pointsDiscount = redeemPoints && availablePoints > 0 ? maxPointsDiscount : 0;
  const pointsToRedeem = Math.ceil(pointsDiscount / POINTS_RATE);
  const total = subtotal - discountAmount - pointsDiscount;

  // Hold / Recall
  const holdSale = () => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    const held: HeldSale = {
      id: crypto.randomUUID(),
      label: `Sale #${heldSales.length + 1}`,
      cart: [...cart],
      customerId: selectedCustomerId,
      discount,
      paymentMethod,
      timestamp: Date.now(),
    };
    setHeldSales(prev => [...prev, held]);
    setCart([]);
    setDiscount(0);
    setSelectedCustomerId(null);
    toast.success("Sale held — you can recall it later");
  };

  const recallSale = (held: HeldSale) => {
    if (cart.length > 0) {
      // Hold current cart first
      holdSale();
    }
    setCart(held.cart);
    setSelectedCustomerId(held.customerId);
    setDiscount(held.discount);
    setPaymentMethod(held.paymentMethod);
    setHeldSales(prev => prev.filter(h => h.id !== held.id));
    toast.success(`Recalled: ${held.label}`);
  };

  const submitSale = async (receiptNum: string, saleCart: CartItem[], saleTotal: number, saleSubtotal: number, saleDiscountAmount: number, saleCustomerId: string | null, saleRedeemPoints: boolean, salePointsToRedeem: number, saleSplits: PaymentSplit[] = []) => {
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        business_id: business!.id,
        subtotal: saleSubtotal,
        discount_percent: discount,
        discount_amount: saleDiscountAmount,
        total: saleTotal,
        payment_method: saleSplits.length > 0 ? "split" : paymentMethod,
        payment_splits: saleSplits.length > 0 ? saleSplits : null,
        receipt_number: receiptNum,
        staff_id: staff?.id || null,
        customer_id: saleCustomerId,
      })
      .select()
      .single();
    if (saleError) throw saleError;

    const items = saleCart.map(c => ({
      sale_id: sale.id,
      product_id: c.id,
      product_name: c.name,
      qty: c.qty,
      unit_price: c.price,
    }));
    const { error: itemsError } = await supabase.from("sale_items").insert(items);
    if (itemsError) throw itemsError;

    if (saleCustomerId) {
      // Deduct redeemed points
      if (saleRedeemPoints && salePointsToRedeem > 0) {
        try { await supabase.rpc("decrement_loyalty_points", { p_customer_id: saleCustomerId, p_points: salePointsToRedeem }); } catch {}
      }
      // Award new points (1 point per GHS 10)
      const earned = Math.floor(saleTotal / 10);
      if (earned > 0) {
        try { await supabase.rpc("increment_loyalty_points", { p_customer_id: saleCustomerId, p_points: earned }); } catch {}
      }
    }
  };

  const saleMutation = useMutation({
    mutationFn: async (receiptNum: string) =>
      submitSale(receiptNum, cart, total, subtotal, discountAmount, selectedCustomerId, redeemPoints, pointsToRedeem, splits),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["recent-sales"] });
      queryClient.invalidateQueries({ queryKey: ["today-sales"] });
      queryClient.invalidateQueries({ queryKey: ["customers-pos"] });
    },
    onError: (err: any) => {
      setShowReceipt(false);
      toast.error(err.message || "Sale failed — please try again");
    },
  });

  // Flush offline queue when connectivity returns
  useEffect(() => {
    if (!isOnline || queue.length === 0) return;
    (async () => {
      for (const s of queue) {
        try {
          await submitSale(s.receiptNum, s.cart, s.total, s.subtotal, s.discountAmount, s.customerId, s.redeemPoints, s.pointsToRedeem);
          removeFromQueue(s.id);
        } catch {}
      }
      if (queue.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["products"] });
        toast.success(`${queue.length} queued sale(s) synced`);
      }
    })();
  }, [isOnline]);

  const completeSale = () => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    const receiptNum = Date.now().toString().slice(-6);
    setLastReceipt(receiptNum);

    // MoMo payments — show confirmation dialog first (online only)
    if (isOnline && MOMO_METHODS.includes(paymentMethod) && splits.length === 0) {
      setPendingReceiptNum(receiptNum);
      setShowMoMoDialog(true);
      return;
    }

    finaliseSale(receiptNum);
  };

  const finaliseSale = (receiptNum: string) => {
    setShowReceipt(true);
    if (!isOnline) {
      enqueue({
        receiptNum, businessId: business!.id, subtotal, discountPercent: discount,
        discountAmount, total, paymentMethod, staffId: staff?.id || null,
        customerId: selectedCustomerId, redeemPoints, pointsToRedeem, cart,
      });
      toast.warning("Offline — sale saved locally and will sync when connected");
    } else {
      toast.success("Sale completed!");
      saleMutation.mutate(receiptNum);
    }
  };

  const newSale = () => {
    setCart([]);
    setDiscount(0);
    setSelectedCustomerId(null);
    setRedeemPoints(false);
    setSplits([]);
    setShowReceipt(false);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-display font-bold">Point of Sale</h1>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <Badge variant="destructive" className="text-xs gap-1">
              <WifiOff className="h-3 w-3" /> Offline{queue.length > 0 ? ` · ${queue.length} queued` : ""}
            </Badge>
          )}
          {heldSales.length > 0 && (
            <Badge variant="secondary" className="text-sm">
              <PauseCircle className="h-3.5 w-3.5 mr-1" /> {heldSales.length} held
            </Badge>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Search & SKU quick-add */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search products..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1">
              <Input
                placeholder="SKU / Barcode"
                className="flex-1 sm:w-36"
                value={skuSearch}
                onChange={e => setSkuSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSkuAdd()}
              />
              <Button variant="outline" size="icon" onClick={handleSkuAdd} title="Add by SKU">
                <ScanBarcode className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {products.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No products found. Add products in Inventory first.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
              {products.map((product: any) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="flex flex-col items-center gap-1.5 sm:gap-2 rounded-xl border border-border bg-card p-3 sm:p-4 transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/5"
                >
                  <span className="text-3xl">📦</span>
                  <span className="text-sm font-medium text-center leading-tight">{product.name}</span>
                  <span className="text-sm font-bold text-primary">{formatGHS(Number(product.selling_price))}</span>
                  <div className="flex gap-1.5">
                    <Badge variant="secondary" className="text-xs">Qty: {product.qty}</Badge>
                    {product.sku && <Badge variant="outline" className="text-xs">{product.sku}</Badge>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <Card className="h-fit sticky top-20">
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5 text-primary" /> Cart ({cart.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Customer selector */}
            <Select value={selectedCustomerId || "walk-in"} onValueChange={v => setSelectedCustomerId(v === "walk-in" ? null : v)}>
              <SelectTrigger className="h-9">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Walk-in Customer" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                {customers.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {cart.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Add products to start a sale</p>
            ) : (
              <>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{formatGHS(item.price)} each</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQty(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQty(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input type="number" placeholder="Discount %" className="w-24" min={0} max={100} value={discount || ""} onChange={e => setDiscount(Number(e.target.value))} />
                    <span className="text-xs text-muted-foreground">% off</span>
                  </div>
                  {selectedCustomerId && availablePoints > 0 && (
                    <button
                      onClick={() => setRedeemPoints(p => !p)}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${redeemPoints ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                    >
                      <Star className={`h-3.5 w-3.5 ${redeemPoints ? "fill-primary text-primary" : ""}`} />
                      <span>Redeem {availablePoints} pts</span>
                      <span className="ml-auto font-semibold">{redeemPoints ? `-${formatGHS(pointsDiscount)}` : `= ${formatGHS(availablePoints * POINTS_RATE)}`}</span>
                    </button>
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatGHS(subtotal)}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-destructive"><span>Discount</span><span>-{formatGHS(discountAmount)}</span></div>}
                  {pointsDiscount > 0 && <div className="flex justify-between text-[#3a7a44]"><span><Star className="h-3 w-3 inline mr-0.5" />Points</span><span>-{formatGHS(pointsDiscount)}</span></div>}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-primary">{formatGHS(total)}</span></div>
                </div>
                {splits.length > 0 ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Split Payment</span>
                      <button onClick={() => setSplits([])} className="text-xs text-destructive hover:underline">Clear</button>
                    </div>
                    {splits.map((s, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground capitalize">{PAYMENT_METHODS.find(m => m.value === s.method)?.label ?? s.method}</span>
                        <span className="font-medium">{formatGHS(s.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Payment method" /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" title="Split payment" onClick={() => setShowSplitDialog(true)}>
                      <Scissors className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={holdSale}>
                    <PauseCircle className="h-4 w-4 mr-1" /> Hold
                  </Button>
                  <Button className="flex-[2] bg-[#1a3a22] text-white font-semibold hover:bg-[#152e1a]" onClick={completeSale} disabled={saleMutation.isPending}>
                    <CreditCard className="h-4 w-4 mr-2" /> {saleMutation.isPending ? "Processing..." : "Complete Sale"}
                  </Button>
                </div>
              </>
            )}

            {/* Held sales */}
            {heldSales.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Held Sales</p>
                {heldSales.map(held => (
                  <button
                    key={held.id}
                    onClick={() => recallSale(held)}
                    className="w-full flex items-center justify-between rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-left hover:bg-primary/10 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{held.label}</p>
                      <p className="text-xs text-muted-foreground">{held.cart.length} items · {new Date(held.timestamp).toLocaleTimeString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-primary">
                        {formatGHS(held.cart.reduce((s, c) => s + c.price * c.qty, 0))}
                      </span>
                      <PlayCircle className="h-4 w-4 text-primary" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SplitPaymentDialog
        open={showSplitDialog}
        onOpenChange={setShowSplitDialog}
        total={total}
        onConfirm={(s) => { setSplits(s); setShowSplitDialog(false); }}
      />

      <MoMoPaymentDialog
        open={showMoMoDialog}
        onOpenChange={setShowMoMoDialog}
        paymentMethod={paymentMethod}
        amount={total}
        clientReference={pendingReceiptNum}
        onSuccess={() => { setShowMoMoDialog(false); finaliseSale(pendingReceiptNum); }}
        onSkip={() => { setShowMoMoDialog(false); finaliseSale(pendingReceiptNum); }}
      />

      <ReceiptDialog
        open={showReceipt}
        onOpenChange={setShowReceipt}
        cart={cart}
        total={total}
        subtotal={subtotal}
        discountAmount={discountAmount}
        paymentMethod={paymentMethod}
        receiptNumber={lastReceipt}
        business={business}
        onNewSale={newSale}
        customerPhone={selectedCustomer?.phone}
        customerName={selectedCustomer?.name}
      />
    </div>
  );
}
