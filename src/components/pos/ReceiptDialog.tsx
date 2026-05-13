import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatGHS, PAYMENT_METHODS } from "@/lib/ghana";
import { generateReceiptPDF } from "@/lib/pdf";
import { Printer, MessageCircle, Share2 } from "lucide-react";

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  total: number;
  subtotal: number;
  discountAmount: number;
  paymentMethod: string;
  receiptNumber: string;
  business: any;
  onNewSale: () => void;
  customerPhone?: string | null;
  customerName?: string | null;
}

export function ReceiptDialog({ open, onOpenChange, cart, total, subtotal, discountAmount, paymentMethod, receiptNumber, business, onNewSale, customerPhone, customerName }: ReceiptDialogProps) {
  const paymentLabel = PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label || paymentMethod;

  const downloadReceipt = () => {
    if (cart.length === 0) return;
    generateReceiptPDF(
      { receipt_number: receiptNumber, items: cart, subtotal, discount_amount: discountAmount, total, payment_method: paymentLabel },
      business || { name: "Nexus-GH" }
    );
  };

  const thermalPrint = () => {
    const printWindow = window.open("", "_blank", "width=300,height=600");
    if (!printWindow) return;

    const itemsHtml = cart.map(item =>
      `<tr><td>${item.name}</td><td style="text-align:center">${item.qty}</td><td style="text-align:right">${(item.price * item.qty).toFixed(2)}</td></tr>`
    ).join("");

    printWindow.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body { font-family: monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 10px; }
        h2 { text-align: center; margin: 5px 0; }
        .center { text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; }
        hr { border: none; border-top: 1px dashed #000; }
        .total { font-size: 16px; font-weight: bold; }
        @media print { body { margin: 0; } }
      </style></head><body>
        <h2>${business?.name || "Nexus-GH"}</h2>
        ${business?.address ? `<p class="center">${business.address}</p>` : ""}
        ${business?.phone ? `<p class="center">Tel: ${business.phone}</p>` : ""}
        <hr/>
        <p class="center">Receipt #${receiptNumber}</p>
        <p class="center">${new Date().toLocaleString()}</p>
        <hr/>
        <table>
          <tr><td><b>Item</b></td><td style="text-align:center"><b>Qty</b></td><td style="text-align:right"><b>Amount</b></td></tr>
          ${itemsHtml}
        </table>
        <hr/>
        <table>
          <tr><td>Subtotal</td><td style="text-align:right">${subtotal.toFixed(2)}</td></tr>
          ${discountAmount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${discountAmount.toFixed(2)}</td></tr>` : ""}
          <tr class="total"><td>TOTAL</td><td style="text-align:right">GHS ${total.toFixed(2)}</td></tr>
        </table>
        <hr/>
        <p class="center">Paid via ${paymentLabel}</p>
        ${business?.receipt_footer ? `<p class="center">${business.receipt_footer}</p>` : '<p class="center">Thank you for your patronage!</p>'}
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const shareWhatsApp = () => {
    const itemsList = cart.map(item => `• ${item.name} x${item.qty} = ${formatGHS(item.price * item.qty)}`).join("\n");
    const greeting = customerName ? `Hello ${customerName.split(" ")[0]},\n\n` : "";
    const message = `${greeting}🧾 *${business?.name || "NexusGH"}*\nReceipt #${receiptNumber}\n${new Date().toLocaleString()}\n\n${itemsList}\n\n${discountAmount > 0 ? `Discount: -${formatGHS(discountAmount)}\n` : ""}*Total: ${formatGHS(total)}*\nPaid via: ${paymentLabel}\n\n${business?.receipt_footer || "Thank you for your patronage! 🙏"}`;
    // If customer has a phone, send directly to them; otherwise open share picker
    const phone = customerPhone?.replace(/\D/g, "").replace(/^0/, "233");
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-center">Sale Receipt</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="text-center">
            <p className="font-bold text-primary text-lg">{business?.name || "Nexus-GH"}</p>
            <p className="text-muted-foreground text-xs">Receipt #{receiptNumber}</p>
            <p className="text-muted-foreground text-xs">{new Date().toLocaleString()}</p>
          </div>
          <Separator />
          {cart.map(item => (
            <div key={item.id} className="flex justify-between">
              <span>{item.name} x{item.qty}</span>
              <span>{formatGHS(item.price * item.qty)}</span>
            </div>
          ))}
          <Separator />
          {discountAmount > 0 && (
            <div className="flex justify-between text-destructive"><span>Discount</span><span>-{formatGHS(discountAmount)}</span></div>
          )}
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-primary">{formatGHS(total)}</span>
          </div>
          <p className="text-center text-xs text-muted-foreground">Paid via {paymentLabel}</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" size="sm" onClick={downloadReceipt}><Printer className="h-4 w-4 mr-1" /> PDF</Button>
            <Button variant="secondary" size="sm" onClick={thermalPrint}><Share2 className="h-4 w-4 mr-1" /> Print</Button>
            <Button variant="secondary" size="sm" onClick={shareWhatsApp}><MessageCircle className="h-4 w-4 mr-1" /> WhatsApp</Button>
          </div>
          <Button className="w-full" onClick={onNewSale}>New Sale</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
