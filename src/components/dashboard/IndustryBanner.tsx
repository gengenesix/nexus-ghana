/**
 * IndustryBanner — theme-safe dashboard header.
 * Uses CSS classes + Tailwind vars throughout — works in both light and dark.
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

  const today = format(new Date(), "EEE, d MMM yyyy");
  const Icon  = industry ? (ICON_MAP[industry.iconKey] ?? ShoppingBag) : null;

  return (
    <motion.div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex items-center gap-3.5">
        {/* Industry icon — always uses CSS primary color */}
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary">
            <Icon className="h-5 w-5 text-primary-foreground" strokeWidth={1.8} />
          </div>
        )}

        <div>
          <h1
            className="font-display font-bold leading-tight tracking-tight text-foreground"
            style={{ fontSize: "clamp(1.15rem, 2.2vw, 1.5rem)" }}
          >
            {greeting}{staffName ? `, ${staffName.split(" ")[0]}` : ""}
          </h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-sm font-semibold text-muted-foreground">
              {businessName}
            </span>
            {industry && (
              <>
                <span className="text-muted-foreground/30 text-xs">·</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-primary/20 bg-primary/8 text-primary"
                  style={{ backgroundColor: "hsl(var(--primary) / 0.08)" }}>
                  {industry.name}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-medium sm:text-right shrink-0">
        {today}
      </p>
    </motion.div>
  );
}
