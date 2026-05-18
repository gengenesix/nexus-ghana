/**
 * IndustryQuickActions
 * ─────────────────────
 * Primary CTA button + 3 secondary action tiles, driven by industry slug.
 */
import { motion } from "framer-motion";
import {
  ShoppingCart, FileText, Package, BarChart3, Truck, Factory,
  FolderKanban, Wrench, UserPlus, Receipt, Briefcase, Timer,
  AlertTriangle, HardHat, Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { QuickAction } from "@/lib/kpiMapping";
import type { IndustryVertical } from "@/lib/industryConfig";

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, FileText, Package, BarChart3, Truck, Factory,
  FolderKanban, Wrench, UserPlus, Receipt, Briefcase, Timer,
  AlertTriangle, HardHat, Sparkles,
};

function getIcon(key: string): LucideIcon {
  return ICON_MAP[key] ?? ShoppingCart;
}

interface IndustryQuickActionsProps {
  actions: QuickAction[];
  industry: IndustryVertical | null;
}

export function IndustryQuickActions({ actions, industry }: IndustryQuickActionsProps) {
  const navigate   = useNavigate();
  const primary    = actions.find((a) => a.primary);
  const secondaries = actions.filter((a) => !a.primary).slice(0, 3);
  const accentBg   = industry?.colorHex ?? "var(--forest)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 }}
      style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
    >
      {/* Primary CTA */}
      {primary && (() => {
        const PIcon = getIcon(primary.iconKey);
        return (
          <Button
            onClick={() => navigate(primary.path)}
            style={{
              backgroundColor: accentBg,
              color: "white",
              border: "none",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 13,
              paddingLeft: 20,
              paddingRight: 20,
              height: 40,
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: `0 4px 14px ${accentBg}55`,
            }}
          >
            <PIcon style={{ width: 16, height: 16 }} strokeWidth={2.2} />
            {primary.label}
          </Button>
        );
      })()}

      {/* Secondary tiles */}
      {secondaries.map((action) => {
        const SIcon = getIcon(action.iconKey);
        return (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              backgroundColor: "white",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--forest)",
              cursor: "pointer",
              height: 40,
              transition: "background-color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--cream-dark)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = accentBg;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "white";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "hsl(var(--border))";
            }}
          >
            <SIcon style={{ width: 14, height: 14, color: accentBg }} strokeWidth={2.2} />
            {action.label}
          </button>
        );
      })}
    </motion.div>
  );
}
