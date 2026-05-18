/**
 * IndustryKpiGrid
 * ───────────────
 * 6-card grid of industry-specific KPIs.
 * Each card has a left-colour accent border keyed to the industry colour.
 * Cards are Framer Motion stagger-animated on mount.
 */
import { motion } from "framer-motion";
import {
  ShoppingCart, FileText, AlertTriangle, Users, TrendingUp, Landmark,
  ShoppingBag, ChefHat, Package, Truck, Factory, Briefcase,
  FolderKanban, Handshake, Receipt, Wrench, UserPlus, Sparkles,
  ClipboardCheck, BarChart3, Timer, Clock, HardHat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatGHS } from "@/lib/ghana";
import type { KpiCardDef, KpiFormat } from "@/lib/kpiMapping";
import type { DashboardStats } from "@/hooks/useIndustryDashboard";
import type { IndustryVertical } from "@/lib/industryConfig";

// ── Icon map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, FileText, AlertTriangle, Users, TrendingUp, Landmark,
  ShoppingBag, ChefHat, Package, Truck, Factory, Briefcase,
  FolderKanban, Handshake, Receipt, Wrench, UserPlus, Sparkles,
  ClipboardCheck, BarChart3, Timer, Clock, HardHat,
};

function getIcon(key: string): LucideIcon {
  return ICON_MAP[key] ?? ShoppingCart;
}

// ── Value formatter ───────────────────────────────────────────────────────────
function formatValue(value: number, format: KpiFormat): string {
  switch (format) {
    case "ghs":     return formatGHS(value);
    case "percent": return `${value.toFixed(1)}%`;
    case "decimal": return value.toFixed(2);
    default:        return String(Math.round(value));
  }
}

// ── Single KPI Card ───────────────────────────────────────────────────────────
interface KpiCardProps {
  def: KpiCardDef;
  value: number;
  accentColor: string;
  index: number;
}

function KpiCard({ def, value, accentColor, index }: KpiCardProps) {
  const navigate  = useNavigate();
  const Icon      = getIcon(def.iconKey);
  const formatted = formatValue(value, def.format);

  const isAlert =
    def.alertThreshold !== undefined &&
    (def.alertAbove ? value >= def.alertThreshold : def.alertBelow ? value < def.alertThreshold : false);

  const alertColor = "hsl(var(--destructive))";
  const borderColor = isAlert ? alertColor : accentColor;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 + index * 0.06, ease: "easeOut" }}
      onClick={def.path ? () => navigate(def.path!) : undefined}
      style={{
        backgroundColor: "white",
        borderRadius: 16,
        border: "1px solid hsl(var(--border))",
        borderLeft: `3.5px solid ${borderColor}`,
        padding: "16px 18px",
        cursor: def.path ? "pointer" : "default",
        transition: "box-shadow 0.18s, transform 0.18s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
      whileHover={def.path ? { y: -2, boxShadow: "0 6px 18px rgba(0,0,0,0.09)" } : {}}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--muted-foreground)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            {def.label}
          </p>
          <p
            style={{
              fontSize: "clamp(1.25rem, 2vw, 1.6rem)",
              fontWeight: 800,
              color: isAlert ? alertColor : "var(--forest)",
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              marginBottom: 4,
            }}
          >
            {formatted}
          </p>
          <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{def.description}</p>
        </div>

        {/* Icon chip */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: isAlert ? `${alertColor}18` : `${accentColor}22`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon
            style={{
              width: 18,
              height: 18,
              color: isAlert ? alertColor : accentColor,
            }}
            strokeWidth={2}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ── Grid ──────────────────────────────────────────────────────────────────────
interface IndustryKpiGridProps {
  kpiCards: KpiCardDef[];
  stats: DashboardStats;
  industry: IndustryVertical | null;
}

export function IndustryKpiGrid({ kpiCards, stats, industry }: IndustryKpiGridProps) {
  const accentColor = industry?.colorHex ?? "var(--forest)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 14,
      }}
    >
      {kpiCards.map((def, i) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = (stats as any)[def.valueKey];
        const value = typeof raw === "number" ? raw : Number(raw ?? 0);
        return (
          <KpiCard
            key={def.label}
            def={def}
            value={value}
            accentColor={accentColor}
            index={i}
          />
        );
      })}
    </div>
  );
}
