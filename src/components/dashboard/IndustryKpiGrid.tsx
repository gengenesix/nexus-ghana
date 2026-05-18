/**
 * IndustryKpiGrid — brand-aligned KPI cards.
 * Uses CSS variables throughout so light/dark theme both work correctly.
 * No hardcoded hex — var(--forest) and var(--primary) flip automatically.
 */
import { motion } from "framer-motion";
import {
  ShoppingCart, FileText, AlertTriangle, Users, TrendingUp, Landmark,
  ShoppingBag, ChefHat, Package, Truck, Factory, Briefcase,
  FolderKanban, Handshake, Receipt, Wrench, UserPlus,
  ClipboardCheck, BarChart3, Clock, HardHat, Pill, BedDouble,
  Leaf, ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatGHS } from "@/lib/ghana";
import type { KpiCardDef, KpiFormat } from "@/lib/kpiMapping";
import type { DashboardStats } from "@/hooks/useIndustryDashboard";
import type { IndustryVertical } from "@/lib/industryConfig";

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, FileText, AlertTriangle, Users, TrendingUp, Landmark,
  ShoppingBag, ChefHat, Package, Truck, Factory, Briefcase,
  FolderKanban, Handshake, Receipt, Wrench, UserPlus,
  ClipboardCheck, BarChart3, Clock, HardHat, Pill, BedDouble, Leaf,
};

function formatValue(value: number, format: KpiFormat): string {
  switch (format) {
    case "ghs":     return formatGHS(value);
    case "percent": return `${value.toFixed(1)}%`;
    case "decimal": return value.toFixed(2);
    default:
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000)     return `${(value / 1000).toFixed(1)}k`;
      return String(Math.round(value));
  }
}

interface KpiCardProps { def: KpiCardDef; value: number; index: number; }

function KpiCard({ def, value, index }: KpiCardProps) {
  const navigate  = useNavigate();
  const Icon      = ICON_MAP[def.iconKey] ?? ShoppingCart;
  const formatted = formatValue(value, def.format);

  const isAlert =
    def.alertThreshold !== undefined &&
    ((def.alertAbove && value >= def.alertThreshold) ||
     (def.alertBelow && value < def.alertThreshold));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: 0.08 + index * 0.05, ease: "easeOut" }}
      onClick={def.path ? () => navigate(def.path!) : undefined}
      className={`group relative overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-200 ${
        def.path ? "cursor-pointer" : ""
      } ${isAlert ? "border-destructive/30" : "border-border"}`}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      whileHover={def.path ? { y: -3, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" } : {}}
    >
      {/* Alert stripe */}
      {isAlert && <div className="absolute top-0 inset-x-0 h-0.5 bg-destructive rounded-t-2xl" />}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-2">
            {def.label}
          </p>
          <p className={`font-display font-bold leading-none tracking-tight mb-1.5 ${
            isAlert ? "text-destructive" : "text-foreground"
          }`}
            style={{ fontSize: "clamp(1.25rem, 2vw, 1.6rem)" }}
          >
            {formatted}
          </p>
          <p className="text-[12px] text-muted-foreground leading-tight">{def.description}</p>
        </div>

        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          isAlert ? "bg-destructive/10" : "bg-primary/10"
        }`}>
          <Icon className={`h-4.5 w-4.5 ${isAlert ? "text-destructive" : "text-primary"}`}
            style={{ width: 18, height: 18 }} strokeWidth={2} />
        </div>
      </div>

      {def.path && (
        <ArrowUpRight className="absolute bottom-4 right-4 h-3.5 w-3.5 opacity-0 group-hover:opacity-30 transition-opacity text-primary" />
      )}
    </motion.div>
  );
}

interface IndustryKpiGridProps {
  kpiCards: KpiCardDef[];
  stats: DashboardStats;
  industry: IndustryVertical | null;
}

export function IndustryKpiGrid({ kpiCards, stats }: IndustryKpiGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {kpiCards.map((def, i) => {
        const raw   = (stats as any)[def.valueKey];
        const value = typeof raw === "number" ? raw : Number(raw ?? 0);
        return <KpiCard key={def.label} def={def} value={value} index={i} />;
      })}
    </div>
  );
}
