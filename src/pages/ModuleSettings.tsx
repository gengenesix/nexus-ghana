/**
 * ModuleSettings — Module management page
 * ────────────────────────────────────────
 * Shows every module in the current industry's set.
 * Status badges: Available (active), Coming Soon (amber), Locked by Plan (gray).
 * Clicking an available module navigates to it.
 * Accessible from Settings → Industry & Modules tab.
 */
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, ShoppingCart, Package, FileText, Users, Building2,
  Receipt, BarChart3, UserCog, Settings, Shield, Wallet, Handshake,
  ShoppingBag, Factory, Cpu, FolderKanban, Headphones, Users2,
  ArrowRightLeft, Landmark, ClipboardList, ClipboardCheck, FileSearch,
  Banknote, Clock, UserPlus, LifeBuoy, Timer, PiggyBank, HardDrive,
  ChefHat, Pill, BedDouble, Truck, Wrench, Leaf, Coins, Sparkles,
  ArrowRight, Lock, CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useIndustry, useModules } from "@/hooks/useIndustry";
import { useLicenseTier } from "@/hooks/useLicenseTier";
import { MODULE_MAP } from "@/lib/industryConfig";
import type { ModuleDefinition } from "@/lib/industryConfig";

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, ShoppingCart, Package, FileText, Users, Building2,
  Receipt, BarChart3, UserCog, Settings, Shield, Wallet, Handshake,
  ShoppingBag, Factory, Cpu, FolderKanban, Headphones, Users2,
  ArrowRightLeft, Landmark, ClipboardList, ClipboardCheck, FileSearch,
  Banknote, Clock, UserPlus, LifeBuoy, Timer, PiggyBank, HardDrive,
  ChefHat, Pill, BedDouble, Truck, Wrench, Leaf, Coins, Sparkles,
};

function getIcon(key: string): LucideIcon {
  return ICON_MAP[key] ?? Settings;
}

// ── Module card ───────────────────────────────────────────────────────────────
interface ModuleCardProps {
  module: ModuleDefinition;
  isAccessible: boolean;
  isComingSoon: boolean;
  isLocked: boolean;
  accentColor: string;
  index: number;
}

function ModuleCard({ module, isAccessible, isComingSoon, isLocked, accentColor, index }: ModuleCardProps) {
  const navigate = useNavigate();
  const Icon     = getIcon(module.iconKey);
  const canClick = isAccessible && module.isAvailable;

  let statusLabel = "";
  let statusBg    = "";
  let statusText  = "";

  if (isComingSoon) {
    statusLabel = "Coming Soon";
    statusBg    = "hsl(38 92% 94%)";
    statusText  = "hsl(38 80% 35%)";
  } else if (isLocked) {
    statusLabel = "Upgrade Plan";
    statusBg    = "hsl(var(--muted))";
    statusText  = "var(--muted-foreground)";
  } else if (isAccessible) {
    statusLabel = "Available";
    statusBg    = `${accentColor}1a`;
    statusText  = accentColor;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: 0.04 + index * 0.035, ease: "easeOut" }}
      onClick={canClick ? () => navigate(module.path) : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "18px 18px 16px",
        borderRadius: 18,
        backgroundColor: "white",
        border: isAccessible && !isLocked && !isComingSoon
          ? `1.5px solid ${accentColor}55`
          : "1.5px solid hsl(var(--border))",
        cursor: canClick ? "pointer" : "default",
        opacity: isLocked ? 0.65 : 1,
        transition: "box-shadow 0.18s, transform 0.18s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        position: "relative",
      }}
      whileHover={canClick ? { y: -2, boxShadow: "0 8px 22px rgba(0,0,0,0.09)" } : {}}
    >
      {/* Lock overlay icon for coming-soon / locked */}
      {(isComingSoon || isLocked) && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            opacity: 0.4,
          }}
        >
          <Lock style={{ width: 13, height: 13, color: "var(--muted-foreground)" }} />
        </div>
      )}

      {/* Available checkmark */}
      {isAccessible && !isLocked && !isComingSoon && (
        <div style={{ position: "absolute", top: 12, right: 12 }}>
          <CheckCircle2 style={{ width: 14, height: 14, color: accentColor, opacity: 0.7 }} />
        </div>
      )}

      {/* Icon */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: isAccessible && !isLocked ? `${accentColor}22` : "hsl(var(--muted))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon
          style={{
            width: 22,
            height: 22,
            color: isAccessible && !isLocked ? accentColor : "var(--muted-foreground)",
          }}
          strokeWidth={1.8}
        />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--forest)", marginBottom: 3, lineHeight: 1.3 }}>
          {module.name}
        </p>
        <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", lineHeight: 1.45 }}>
          {module.description}
        </p>
      </div>

      {/* Status chip */}
      <div className="flex items-center justify-between">
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "3px 8px",
            borderRadius: 99,
            backgroundColor: statusBg,
            color: statusText,
          }}
        >
          {statusLabel}
        </span>

        {canClick && (
          <ArrowRight style={{ width: 13, height: 13, color: "var(--muted-foreground)" }} />
        )}
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ModuleSettings() {
  const { industry, slug, industryModules } = useIndustry();
  const { canAccess, isComingSoon }          = useModules();
  const { canAccess: tierCanAccess }         = useLicenseTier();
  const accentColor = industry?.colorHex ?? "hsl(140,28%,28%)";

  // Group modules by their category for display
  const CATEGORY_ORDER = [
    "core", "sales", "finance", "supply-chain",
    "production", "projects", "hr", "industry", "system",
  ];

  const CATEGORY_LABELS: Record<string, string> = {
    core:           "Core Modules",
    sales:          "Sales & CRM",
    finance:        "Finance",
    "supply-chain": "Supply Chain",
    production:     "Production",
    projects:       "Projects & Service",
    hr:             "HR & People",
    industry:       "Industry-Specific",
    system:         "System",
  };

  // Only show modules relevant to the current industry
  const allModuleKeys = slug
    ? industryModules.map((m) => m.key)
    : Object.keys(MODULE_MAP);

  const grouped = CATEGORY_ORDER.reduce<Record<string, ModuleDefinition[]>>((acc, cat) => {
    const mods = allModuleKeys
      .map((k) => MODULE_MAP[k])
      .filter((m): m is ModuleDefinition => !!m && m.category === cat);
    if (mods.length > 0) acc[cat] = mods;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex items-center gap-4 mb-2">
          {industry && (
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
              {(() => {
                const IIcon = getIcon(industry.iconKey);
                return <IIcon style={{ width: 24, height: 24, color: "white" }} strokeWidth={1.8} />;
              })()}
            </div>
          )}
          <div>
            <h1
              className="font-display font-bold"
              style={{ fontSize: "1.5rem", color: "var(--forest)", letterSpacing: "-0.025em" }}
            >
              {industry ? `${industry.name} Modules` : "All Modules"}
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              {industry?.tagline ?? "Manage your workspace modules"}
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap mt-4">
          {[
            { label: "Available",    bg: `${accentColor}1a`, text: accentColor },
            { label: "Coming Soon",  bg: "hsl(38 92% 94%)",  text: "hsl(38 80% 35%)" },
            { label: "Upgrade Plan", bg: "hsl(var(--muted))", text: "var(--muted-foreground)" },
          ].map((l) => (
            <span
              key={l.label}
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "3px 10px",
                borderRadius: 99,
                backgroundColor: l.bg,
                color: l.text,
              }}
            >
              {l.label}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Module groups */}
      {Object.entries(grouped).map(([cat, mods]) => (
        <section key={cat}>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--muted-foreground)",
              marginBottom: 14,
            }}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {mods.map((mod, i) => {
              const accessible = canAccess(mod.key);
              const soon       = isComingSoon(mod.key);
              const locked     = mod.isAvailable && !tierCanAccess(mod.key);
              return (
                <ModuleCard
                  key={mod.key}
                  module={mod}
                  isAccessible={accessible}
                  isComingSoon={soon}
                  isLocked={locked}
                  accentColor={accentColor}
                  index={i}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
