import { useBusiness } from "./useBusiness";

export type LicenseTier =
  | "starter"
  | "professional"
  | "limited_financial"
  | "limited_logistics"
  | "limited_sales_crm";

// ── Industry-specific modules (gated by INDUSTRY, not tier) ───────────────────
// These modules appear only for businesses whose industry needs them.
// They must not be tier-blocked — grant to all tiers.
const INDUSTRY_MODULES = [
  // Phase 3 operational modules
  "payroll", "attendance", "budget", "assets", "petty-cash",
  // Phase 4 vertical-specific modules
  "restaurant", "pharmacy-rx", "hotel-mgmt", "fleet", "garage", "farm-mgmt",
  // Always-on utility modules
  "approvals", "audit-log",
];

// ── Core modules per billing tier ─────────────────────────────────────────────
const CORE_MODULES: Record<LicenseTier, string[]> = {
  starter: [
    "dashboard", "pos", "inventory", "invoices",
    "customers", "suppliers", "expenses", "reports",
    "staff", "settings",
  ],
  limited_financial: [
    "dashboard", "pos", "inventory", "invoices",
    "customers", "suppliers", "expenses", "reports",
    "staff", "settings",
    "financials", "banking",
  ],
  limited_logistics: [
    "dashboard", "pos", "inventory", "invoices",
    "customers", "suppliers", "expenses", "reports",
    "staff", "settings",
    "purchasing", "warehouses", "production", "mrp",
  ],
  limited_sales_crm: [
    "dashboard", "pos", "inventory", "invoices",
    "customers", "suppliers", "expenses", "reports",
    "staff", "settings",
    "crm", "sales-orders", "projects", "service",
  ],
  professional: [
    "dashboard", "pos", "inventory", "invoices",
    "customers", "suppliers", "expenses", "reports",
    "staff", "settings",
    "financials", "banking",
    "crm", "sales-orders", "projects", "service",
    "purchasing", "warehouses", "production", "mrp",
    "hr", "administration",
  ],
};

// Build final TIER_MODULES by merging core + industry modules for every tier
const TIER_MODULES: Record<LicenseTier, string[]> = Object.fromEntries(
  Object.entries(CORE_MODULES).map(([tier, mods]) => [
    tier,
    [...mods, ...INDUSTRY_MODULES],
  ])
) as Record<LicenseTier, string[]>;

export const TIER_LABELS: Record<LicenseTier, string> = {
  starter: "Starter",
  limited_financial: "Finance",
  limited_logistics: "Logistics",
  limited_sales_crm: "Sales & CRM",
  professional: "Professional",
};

export const MODULE_REQUIRED_TIER: Record<string, LicenseTier> = {
  financials: "limited_financial",
  banking: "limited_financial",
  crm: "limited_sales_crm",
  "sales-orders": "limited_sales_crm",
  projects: "limited_sales_crm",
  service: "limited_sales_crm",
  purchasing: "limited_logistics",
  warehouses: "limited_logistics",
  production: "limited_logistics",
  mrp: "limited_logistics",
  hr: "professional",
  administration: "professional",
};

export function useLicenseTier() {
  const { business } = useBusiness();
  const tier = (business as any)?.license_tier as LicenseTier | undefined;

  // Default to "professional" if no tier set (legacy / unconfigured businesses)
  const effectiveTier: LicenseTier = tier ?? "professional";
  const allowedModules = TIER_MODULES[effectiveTier] ?? TIER_MODULES.professional;

  const canAccess = (module: string): boolean => allowedModules.includes(module);

  return { tier: effectiveTier, canAccess, allowedModules };
}
