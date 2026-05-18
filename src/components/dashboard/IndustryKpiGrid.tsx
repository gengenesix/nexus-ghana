/**
 * IndustryKpiGrid — brand-aligned KPI cards.
 * Design: clean white cards, forest-green accent, no left-border rainbow.
 * Feels like Google Workspace or Notion — consistent, not per-industry colours.
 */
import { motion } from "framer-motion";
import {
  ShoppingCart, FileText, AlertTriangle, Users, TrendingUp, Landmark,
  ShoppingBag, ChefHat, Package, Truck, Factory, Briefcase,
  FolderKanban, Handshake, Receipt, Wrench, UserPlus,
  ClipboardCheck, BarChart3, Clock, HardHat, Pill, BedDouble,
  Leaf, ArrowUpRight, ArrowDownRight,
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

function getIcon(key: string): LucideIcon {
  return ICON_MAP[key] ?? ShoppingCart;
}

function formatValue(value: number, format: KpiFormat): string {
  switch (format) {
    case "ghs":     return formatGHS(value);
    case "percent": return `${value.toFixed(1)}%`;
    case "decimal": return value.toFixed(2);
    default:        return value >= 1000
      ? value >= 1_000_000
        ? `${(value / 1_000_000).toFixed(1)}M`
        : `${(value / 1000).toFixed(1)}k`
      : String(Math.round(value));
  }
}

interface KpiCardProps {
  def: KpiCardDef;
  value: number;
  index: number;
}

function KpiCard({ def, value, index }: KpiCardProps) {
  const navigate  = useNavigate();
  const Icon      = getIcon(def.iconKey);
  const formatted = formatValue(value, def.format);

  const isAlert =
    def.alertThreshold !== undefined &&
    (def.alertAbove
      ? value >= def.alertThreshold
      : def.alertBelow
      ? value < def.alertThreshold
      : false);

  const FOREST  = "#1a3a22";
  const LIME    = "#84cc16";
  const DANGER  = "hsl(var(--destructive))";

  const accentColor = isAlert ? DANGER : FOREST;
  const iconBg      = isAlert ? "rgba(239,68,68,0.08)" : "rgba(26,58,34,0.08)";
  const valueColor  = isAlert ? DANGER : FOREST;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: 0.08 + index * 0.05, ease: "easeOut" }}
      onClick={def.path ? () => navigate(def.path!) : undefined}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-200"
      style={{
        cursor: def.path ? "pointer" : "default",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)",
      }}
      whileHover={def.path ? {
        y: -3,
        boxShadow: "0 8px 24px rgba(26,58,34,0.10)",
      } : {}}
    >
      {/* Alert top stripe */}
      {isAlert && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
          style={{ backgroundColor: DANGER }}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-2">
            {def.label}
          </p>
          <p
            className="font-display font-bold leading-none tracking-tight mb-1.5"
            style={{
              fontSize: "clamp(1.3rem, 2.2vw, 1.65rem)",
              color: valueColor,
            }}
          >
            {formatted}
          </p>
          <p className="text-[12px] text-muted-foreground leading-tight">
            {def.description}
          </p>
        </div>

        {/* Icon chip */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200"
          style={{ backgroundColor: iconBg }}
        >
          <Icon style={{ width: 18, height: 18, color: accentColor }} strokeWidth={2} />
        </div>
      </div>

      {/* Clickable arrow hint */}
      {def.path && (
        <ArrowUpRight
          className="absolute bottom-4 right-4 h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity"
          style={{ color: FOREST }}
        />
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
