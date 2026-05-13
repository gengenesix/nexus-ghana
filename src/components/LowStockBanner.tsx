import { useState } from "react";
import { useLowStock } from "@/hooks/useLowStock";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X, ArrowRight } from "lucide-react";

export function LowStockBanner() {
  const { data: lowStockItems = [] } = useLowStock();
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  if (dismissed || lowStockItems.length === 0) return null;

  const outOfStock = lowStockItems.filter((p: any) => p.qty === 0).length;

  return (
    <div className="flex items-center gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
      <p className="flex-1 text-destructive">
        <span className="font-semibold">{lowStockItems.length} item{lowStockItems.length !== 1 ? "s" : ""} low on stock</span>
        {outOfStock > 0 && <span className="ml-1">({outOfStock} out of stock)</span>}
        {" — "}
        <button
          onClick={() => navigate("/inventory")}
          className="inline-flex items-center gap-0.5 underline underline-offset-2"
        >
          View inventory <ArrowRight className="h-3 w-3" />
        </button>
      </p>
      <button onClick={() => setDismissed(true)} className="shrink-0 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
