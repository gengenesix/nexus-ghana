/**
 * IndustryQuickActions — theme-safe action bar.
 * Uses Tailwind classes so dark/light mode work without any hardcoded hex.
 */
import { motion } from "framer-motion";
import {
  ShoppingCart, FileText, Package, BarChart3, Truck, Factory,
  FolderKanban, Wrench, UserPlus, Receipt, Briefcase, Timer,
  AlertTriangle, HardHat, Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { QuickAction } from "@/lib/kpiMapping";
import type { IndustryVertical } from "@/lib/industryConfig";

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart, FileText, Package, BarChart3, Truck, Factory,
  FolderKanban, Wrench, UserPlus, Receipt, Briefcase, Timer,
  AlertTriangle, HardHat, Plus,
};

interface IndustryQuickActionsProps {
  actions: QuickAction[];
  industry: IndustryVertical | null;
}

export function IndustryQuickActions({ actions }: IndustryQuickActionsProps) {
  const navigate    = useNavigate();
  const primary     = actions.find((a) => a.primary);
  const secondaries = actions.filter((a) => !a.primary).slice(0, 4);

  return (
    <motion.div
      className="flex flex-wrap items-center gap-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.08 }}
    >
      {primary && (() => {
        const PIcon = ICON_MAP[primary.iconKey] ?? ShoppingCart;
        return (
          <button
            onClick={() => navigate(primary.path)}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
            style={{ boxShadow: "0 2px 8px hsl(var(--primary) / 0.3)" }}
          >
            <PIcon className="h-4 w-4" strokeWidth={2.2} />
            {primary.label}
          </button>
        );
      })()}

      {secondaries.map((action) => {
        const SIcon = ICON_MAP[action.iconKey] ?? FileText;
        return (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-all duration-150 hover:border-primary/40 hover:bg-primary/5 active:scale-[0.97]"
          >
            <SIcon className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
            {action.label}
          </button>
        );
      })}
    </motion.div>
  );
}
