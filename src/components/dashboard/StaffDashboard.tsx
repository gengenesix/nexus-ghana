/**
 * StaffDashboard
 * ──────────────
 * Simplified dashboard shown to staff members (non-owner sessions).
 * Replaces the heavy chart / table owner view with a role-appropriate
 * quick-launch module grid + today's key numbers.
 */
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Package, FileText, Users, Building2,
  Receipt, BarChart3, UserCog, Settings, Shield, Wallet,
  Handshake, ShoppingBag, Factory, Cpu, FolderKanban, Headphones,
  Users2, ArrowRightLeft, Landmark, ClipboardList, ClipboardCheck,
  FileSearch, Banknote, Clock, UserPlus, LifeBuoy, Timer, PiggyBank,
  HardDrive, ChefHat, Pill, BedDouble, Truck, Wrench, Leaf, Coins,
  Sparkles, TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { IndustryBanner } from "./IndustryBanner";
import { IndustryQuickActions } from "./IndustryQuickActions";
import { useModules } from "@/hooks/useIndustry";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { formatGHS } from "@/lib/ghana";
import type { IndustryVertical } from "@/lib/industryConfig";
import type { DashboardStats } from "@/hooks/useIndustryDashboard";
import type { QuickAction } from "@/lib/kpiMapping";

// ── Icon map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, ShoppingCart, Package, FileText, Users, Building2,
  Receipt, BarChart3, UserCog, Settings, Shield, Wallet,
  Handshake, ShoppingBag, Factory, Cpu, FolderKanban, Headphones,
  Users2, ArrowRightLeft, Landmark, ClipboardList, ClipboardCheck,
  FileSearch, Banknote, Clock, UserPlus, LifeBuoy, Timer, PiggyBank,
  HardDrive, ChefHat, Pill, BedDouble, Truck, Wrench, Leaf, Coins,
  Sparkles, TrendingUp,
};

function getIcon(key: string): LucideIcon {
  return ICON_MAP[key] ?? Package;
}

// ── Short labels for narrow tiles ─────────────────────────────────────────────
const SHORT_LABELS: Record<string, string> = {
  pos:             "Point of Sale",
  inventory:       "Stock",
  "pharmacy-rx":   "Pharmacy",
  "hotel-mgmt":    "Hotel",
  "farm-mgmt":     "Farm",
  "petty-cash":    "Petty Cash",
  "sales-orders":  "Sales Orders",
  administration:  "Admin",
};

function tileLabel(key: string, name: string): string {
  return SHORT_LABELS[key] ?? name;
}

// ── Stat mini-card ────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, delay,
}: { label: string; value: string; icon: LucideIcon; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--forest)", color: "white" }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-lg font-bold font-display truncate">{value}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface StaffDashboardProps {
  industry:     IndustryVertical | null;
  businessName: string;
  staffName:    string;
  quickActions: QuickAction[];
  stats:        DashboardStats | null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function StaffDashboard({
  industry, businessName, staffName, quickActions, stats,
}: StaffDashboardProps) {
  const navigate = useNavigate();
  const { canAccess: staffCanAccess } = useStaffSession();
  const { navGroups } = useModules();

  // Modules this staff member can actually access
  const accessibleModules = navGroups
    .flatMap((g) => g.visibleModules)
    .filter((mod) => mod.isAvailable && staffCanAccess(mod.key));

  // Quick stats visible to staff
  const todayStr = stats ? formatGHS(stats.todayTotal) : "—";
  const txCount  = stats ? String(stats.todayCount)   : "—";

  return (
    <div className="space-y-6">
      {/* ── Greeting banner ─────────────────────────────────────────────── */}
      <IndustryBanner
        industry={industry ?? null}
        businessName={businessName}
        staffName={staffName}
      />

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <IndustryQuickActions actions={quickActions} industry={industry ?? null} />

      {/* ── Today's key numbers ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Today's Sales"   value={todayStr} icon={TrendingUp}   delay={0.1} />
        <StatCard label="Transactions"    value={txCount}  icon={ShoppingCart} delay={0.2} />
      </div>

      {/* ── Module quick-launch grid ──────────────────────────────────────── */}
      {accessibleModules.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            My Modules
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {accessibleModules.map((mod, i) => {
              const Icon = getIcon(mod.iconKey);
              return (
                <motion.button
                  key={mod.key}
                  onClick={() => navigate(mod.path)}
                  whileHover={{ y: -2, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.35 + i * 0.04 }}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                    style={{ backgroundColor: "var(--forest)", color: "white" }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-center leading-tight">
                    {tileLabel(mod.key, mod.name)}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
