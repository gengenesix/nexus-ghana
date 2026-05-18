/**
 * ModuleSettings — module management page.
 * Theme-safe: uses Tailwind classes + CSS vars only (no hardcoded hex).
 * Only shows modules relevant to the current industry.
 * Industry-vertical-only packs (Restaurant, Pharmacy, Hotel, etc.) only appear
 * for businesses that have explicitly selected that industry.
 */
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, ShoppingCart, Package, FileText, Users, Building2,
  Receipt, BarChart3, UserCog, Settings, Shield, Wallet, Handshake,
  ShoppingBag, Factory, Cpu, FolderKanban, Headphones, Users2,
  ArrowRightLeft, Landmark, ClipboardList, ClipboardCheck, FileSearch,
  Banknote, Clock, UserPlus, LifeBuoy, PiggyBank, HardDrive,
  ChefHat, Pill, BedDouble, Truck, Wrench, Leaf, Coins,
  ArrowRight, CheckCircle2, Lock, Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useIndustry, useModules } from "@/hooks/useIndustry";
import { useLicenseTier } from "@/hooks/useLicenseTier";
import { MODULE_MAP } from "@/lib/industryConfig";
import type { ModuleDefinition } from "@/lib/industryConfig";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, ShoppingCart, Package, FileText, Users, Building2,
  Receipt, BarChart3, UserCog, Settings, Shield, Wallet, Handshake,
  ShoppingBag, Factory, Cpu, FolderKanban, Headphones, Users2,
  ArrowRightLeft, Landmark, ClipboardList, ClipboardCheck, FileSearch,
  Banknote, Clock, UserPlus, LifeBuoy, PiggyBank, HardDrive,
  ChefHat, Pill, BedDouble, Truck, Wrench, Leaf, Coins, Timer,
};

const getIcon = (key: string): LucideIcon => ICON_MAP[key] ?? Settings;

// ── Module Card ───────────────────────────────────────────────────────────────
interface ModuleCardProps {
  module:       ModuleDefinition;
  accessible:   boolean;
  comingSoon:   boolean;
  locked:       boolean;
  index:        number;
}

function ModuleCard({ module, accessible, comingSoon, locked, index }: ModuleCardProps) {
  const navigate = useNavigate();
  const Icon     = getIcon(module.iconKey);
  const canClick = accessible && module.isAvailable;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.03 + index * 0.03, ease: "easeOut" }}
      onClick={canClick ? () => navigate(module.path) : undefined}
      className={`group relative flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-all duration-200 ${
        canClick ? "cursor-pointer hover:border-primary/40 hover:shadow-md" : ""
      } ${locked ? "opacity-60" : ""} ${
        accessible && !locked && !comingSoon ? "border-primary/20" : "border-border"
      }`}
    >
      {/* Lock icon overlay */}
      {(comingSoon || locked) && (
        <div className="absolute top-3 right-3">
          <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />
        </div>
      )}

      {/* Check icon for available */}
      {accessible && !locked && !comingSoon && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary opacity-50" />
        </div>
      )}

      {/* Icon */}
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
        accessible && !locked ? "bg-primary/10" : "bg-muted"
      }`}>
        <Icon
          className={accessible && !locked ? "text-primary" : "text-muted-foreground"}
          style={{ width: 18, height: 18 }}
          strokeWidth={1.8}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-5">
        <p className={`text-sm font-semibold leading-tight ${
          accessible && !locked ? "text-foreground" : "text-muted-foreground"
        }`}>
          {module.name}
        </p>
        <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">
          {module.description}
        </p>
      </div>

      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          comingSoon
            ? "bg-warning/15 text-warning-foreground"
            : locked
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary"
        }`}>
          {comingSoon ? "Coming Soon" : locked ? "Upgrade" : "Available"}
        </span>

        {canClick && (
          <ArrowRight className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-60 transition-opacity" />
        )}
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const CATEGORY_ORDER = [
  "core", "sales", "finance", "supply-chain",
  "production", "projects", "hr", "industry", "system",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  core:           "Core",
  sales:          "Sales & CRM",
  finance:        "Finance",
  "supply-chain": "Supply Chain",
  production:     "Production",
  projects:       "Projects & Service",
  hr:             "HR & People",
  industry:       "Industry-Specific",
  system:         "System",
};

export default function ModuleSettings() {
  const navigate                            = useNavigate();
  const { industry, industryModules }       = useIndustry();
  const { canAccess, isComingSoon }         = useModules();
  const { canAccess: tierCanAccess }        = useLicenseTier();

  // industryModules already filtered to this industry (or all non-vertical for no-slug)
  const allModuleKeys = industryModules.map((m) => m.key);

  const grouped = CATEGORY_ORDER.reduce<Record<string, ModuleDefinition[]>>((acc, cat) => {
    const mods = allModuleKeys
      .map((k) => MODULE_MAP[k])
      .filter((m): m is ModuleDefinition => !!m && m.category === cat);
    if (mods.length > 0) acc[cat] = mods;
    return acc;
  }, {});

  const totalModules     = allModuleKeys.length;
  const availableModules = allModuleKeys.filter((k) => canAccess(k)).length;

  // Industry icon
  const IndustryIcon = industry
    ? (ICON_MAP[industry.iconKey] ?? ShoppingBag)
    : null;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* ── Header ── */}
      <motion.div
        className="flex items-center gap-4"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {IndustryIcon && (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary">
            <IndustryIcon className="h-6 w-6 text-primary-foreground" strokeWidth={1.8} />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
            {industry ? `${industry.name} Modules` : "Your Modules"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {industry?.tagline ?? "Manage your available modules"}
          </p>
        </div>
      </motion.div>

      {/* ── Filter pills ── */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: "Available", cls: "bg-primary/10 text-primary border-primary/20 border" },
          { label: "Coming Soon", cls: "bg-warning/15 text-muted-foreground border border-border" },
          { label: "Upgrade Plan", cls: "bg-muted text-muted-foreground border border-border" },
        ].map(({ label, cls }) => (
          <span key={label} className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
            {label}
          </span>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {availableModules} of {totalModules} modules available
        </span>
      </div>

      {/* ── Module groups ── */}
      {CATEGORY_ORDER.filter((cat) => grouped[cat]).map((cat) => (
        <section key={cat} className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-0.5">
            {CATEGORY_LABELS[cat]}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {grouped[cat].map((mod, i) => (
              <ModuleCard
                key={mod.key}
                module={mod}
                accessible={canAccess(mod.key)}
                comingSoon={isComingSoon(mod.key)}
                locked={!tierCanAccess(mod.key) && !isComingSoon(mod.key)}
                index={i}
              />
            ))}
          </div>
        </section>
      ))}

      {/* ── Back button ── */}
      <div className="pt-2">
        <button
          onClick={() => navigate("/settings")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Settings
        </button>
      </div>
    </div>
  );
}
