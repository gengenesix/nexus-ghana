import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatGHS, PAYMENT_METHODS } from "@/lib/ghana";
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, X, Printer, MessageCircle, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface CartItem {
  id: number;
  name: string;
  price: number;
  qty: number;
}

const sampleProducts = [
  { id: 1, name: "Indomie Noodles", price: 12, category: "Food", image: "🍜" },
  { id: 2, name: "Frytol Oil 5L", price: 40, category: "Food", image: "🫗" },
  { id: 3, name: "Peak Milk (Tin)", price: 7, category: "Dairy", image: "🥛" },
  { id: 4, name: "Sugar 1kg", price: 9, category: "Food", image: "🍬" },
  { id: 5, name: "Milo 400g", price: 20, category: "Beverages", image: "☕" },
  { id: 6, name: "Gari 5kg", price: 35, category: "Food", image: "🌾" },
  { id: 7, name: "Coca-Cola 1.5L", price: 12, category: "Beverages", image: "🥤" },
  { id: 8, name: "Rice 5kg", price: 45, category: "Food", image: "🍚" },
  { id: 9, name: "Toilet Roll (Pack)", price: 15, category: "Household", image: "🧻" },
  { id: 10, name: "Omo Detergent 500g", price: 8, category: "Household", image: "🧴" },
  { id: 11, name: "Bread (Butter)", price: 10, category: "Bakery", image: "🍞" },
  { id: 12, name: "Eggs (Crate 30)", price: 48, category: "Food", image: "🥚" },
];

export default function POS() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);

  const filtered = sampleProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const addToCart = (product: typeof sampleProducts[0]) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === product.id);
      if (existing) return prev.map(c => c.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c));
  };

  const removeItem = (id: number) => setCart(prev => prev.filter(c => c.id !== id));

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const discountAmount = discount > 0 ? subtotal * (discount / 100) : 0;
  const total = subtotal - discountAmount;

  const completeSale = () => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    setShowReceipt(true);
    toast.success("Sale completed!");
  };

  const newSale = () => {
    setCart([]);
    setDiscount(0);
    setShowReceipt(false);
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl md:text-3xl font-display font-bold mb-4">Point of Sale</h1>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Products */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/5"
              >
                <span className="text-3xl">{product.image}</span>
                <span className="text-sm font-medium text-center leading-tight">{product.name}</span>
                <span className="text-sm font-bold text-primary">{formatGHS(product.price)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cart */}
        <Card className="h-fit sticky top-20">
          <CardHeader className="pb-3">
            <CardTitle className="font-display flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Cart ({cart.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQty(item.id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQty(item.id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
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
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatGHS(subtotal)}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-destructive"><span>Discount</span><span>-{formatGHS(discountAmount)}</span></div>}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg"><span>Total</span><span className="text-primary">{formatGHS(total)}</span></div>
                </div>

                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button className="w-full gold-gradient text-primary-foreground font-semibold" onClick={completeSale}>
                  <CreditCard className="h-4 w-4 mr-2" /> Complete Sale
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-center">Sale Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-center">
              <p className="font-bold text-primary text-lg">NexusGH</p>
              <p className="text-muted-foreground text-xs">Receipt #{Date.now().toString().slice(-6)}</p>
            </div>
            <Separator />
            {cart.map(item => (
              <div key={item.id} className="flex justify-between">
                <span>{item.name} x{item.qty}</span>
                <span>{formatGHS(item.price * item.qty)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">{formatGHS(total)}</span>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Paid via {PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1"><Printer className="h-4 w-4 mr-1" /> Print</Button>
              <Button variant="secondary" size="sm" className="flex-1">
                <a href={`https://wa.me/?text=${encodeURIComponent(`NexusGH Receipt\nTotal: ${formatGHS(total)}`)}`} target="_blank" rel="noreferrer" className="flex items-center">
                  <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                </a>
              </Button>
            </div>
            <Button className="w-full" onClick={newSale}>New Sale</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
