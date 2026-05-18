/**
 * IndustryBanner
 * ──────────────
 * Branded top-of-dashboard identity strip.
 * Shows the industry icon + colour, business name, date, greeting.
 * Pure UI — no data fetching.
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ShoppingBag, Utensils, Package2, Factory, Pill, Briefcase,
  HardHat, Truck, BedDouble, Wrench, Leaf, Scissors, Landmark,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IndustryVertical } from "@/lib/industryConfig";

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingBag, Utensils, Package2, Factory, Pill, Briefcase,
  HardHat, Truck, BedDouble, Wrench, Leaf, Scissors, Landmark,
};

interface IndustryBannerProps {
  industry: IndustryVertical | null;
  businessName: string;
  staffName?: string;
}

export function IndustryBanner({ industry, businessName, staffName }: IndustryBannerProps) {
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const today = format(new Date(), "EEEE, d MMMM yyyy");
  const Icon  = industry ? (ICON_MAP[industry.iconKey] ?? ShoppingBag) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: greeting + business */}
        <div className="flex items-center gap-3">
          {/* Industry icon bubble */}
          {industry && Icon && (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: industry.colorHex,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: `0 4px 14px ${industry.colorHex}55`,
              }}
            >
              <Icon style={{ width: 24, height: 24, color: "white" }} strokeWidth={1.8} />
            </div>
          )}

          <div>
            <h1
              className="font-display font-bold leading-tight"
              style={{ fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)", color: "var(--forest)", letterSpacing: "-0.025em" }}
            >
              {greeting}{staffName ? `, ${staffName.split(" ")[0]}` : ""}
            </h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-sm text-muted-foreground font-medium">{businessName}</span>
              {industry && (
                <>
                  <span className="text-muted-foreground/40 text-xs">·</span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: industry.accentHex, color: "var(--forest)" }}
                  >
                    {industry.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: date */}
        <p className="text-xs text-muted-foreground sm:text-right">{today}</p>
      </div>
    </motion.div>
  );
}
