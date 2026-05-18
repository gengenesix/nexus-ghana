/**
 * IndustryAlerts
 * ──────────────
 * Smart alert strip below the KPI grid.
 * Renders only relevant alerts based on industry slug + live data.
 * - Pharmacy: expiring stock warnings (30d / 90d)
 * - All: overdue invoices, out-of-stock
 * - Retail / F&B / Wholesale: low stock
 */
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Clock, Package, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatGHS } from "@/lib/ghana";
import type { DashboardStats } from "@/hooks/useIndustryDashboard";

interface Alert {
  id: string;
  icon: React.ElementType;
  text: string;
  sub?: string;
  color: "amber" | "red";
  path: string;
}

function buildAlerts(slug: string | null, stats: DashboardStats): Alert[] {
  const alerts: Alert[] = [];

  // Overdue invoices — every industry
  if (stats.overdueCount > 0) {
    alerts.push({
      id: "overdue",
      icon: Clock,
      text: `${stats.overdueCount} overdue invoice${stats.overdueCount > 1 ? "s" : ""}`,
      sub: `${formatGHS(stats.overdueTotal)} outstanding`,
      color: "red",
      path: "/invoices",
    });
  }

  // Pharmacy: expiring soon
  if (slug === "pharmacy-health") {
    if (stats.expiring_30_count > 0) {
      alerts.push({
        id: "expiring30",
        icon: AlertTriangle,
        text: `${stats.expiring_30_count} product${stats.expiring_30_count > 1 ? "s" : ""} expiring within 30 days`,
        sub: "Check batch details",
        color: "red",
        path: "/inventory",
      });
    } else if (stats.expiring_90_count > 0) {
      alerts.push({
        id: "expiring90",
        icon: AlertTriangle,
        text: `${stats.expiring_90_count} product${stats.expiring_90_count > 1 ? "s" : ""} expiring within 90 days`,
        sub: "Plan restock / clearance",
        color: "amber",
        path: "/inventory",
      });
    }
  }

  // Food & Beverage + Hospitality: low stock on ingredients
  if (
    (slug === "food-beverage" || slug === "hospitality-hotels") &&
    stats.lowStockCount > 0
  ) {
    alerts.push({
      id: "lowstock-fb",
      icon: Package,
      text: `${stats.lowStockCount} ingredient${stats.lowStockCount > 1 ? "s" : ""} running low`,
      sub: "Reorder before service",
      color: "amber",
      path: "/inventory",
    });
  }

  // Retail / Wholesale: out of stock
  if (
    (slug === "retail" || slug === "wholesale-distribution") &&
    stats.outOfStock > 0
  ) {
    alerts.push({
      id: "oos",
      icon: XCircle,
      text: `${stats.outOfStock} product${stats.outOfStock > 1 ? "s" : ""} out of stock`,
      sub: "Lost sales risk",
      color: "red",
      path: "/inventory",
    });
  }

  return alerts;
}

// ── Colour maps ───────────────────────────────────────────────────────────────
const BG:   Record<string, string> = { red: "hsl(var(--destructive) / 0.06)", amber: "hsl(38 92% 95%)" };
const BORDER: Record<string, string> = { red: "hsl(var(--destructive) / 0.3)", amber: "hsl(38 92% 70%)" };
const ICON_COLOR: Record<string, string> = { red: "hsl(var(--destructive))", amber: "hsl(38 80% 40%)" };
const TEXT_COLOR: Record<string, string> = { red: "hsl(var(--destructive))", amber: "hsl(38 80% 30%)" };

// ── Component ─────────────────────────────────────────────────────────────────
interface IndustryAlertsProps {
  slug: string | null;
  stats: DashboardStats;
}

export function IndustryAlerts({ slug, stats }: IndustryAlertsProps) {
  const navigate = useNavigate();
  const alerts   = buildAlerts(slug, stats);

  if (alerts.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        {alerts.map((alert, i) => {
          const Icon = alert.icon;
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              onClick={() => navigate(alert.path)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 12,
                border: `1px solid ${BORDER[alert.color]}`,
                backgroundColor: BG[alert.color],
                cursor: "pointer",
              }}
            >
              <Icon
                style={{ width: 18, height: 18, color: ICON_COLOR[alert.color], flexShrink: 0 }}
                strokeWidth={2.2}
              />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: TEXT_COLOR[alert.color], lineHeight: 1.3 }}>
                  {alert.text}
                </p>
                {alert.sub && (
                  <p style={{ fontSize: 11, color: TEXT_COLOR[alert.color], opacity: 0.75, marginTop: 2 }}>
                    {alert.sub}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}
