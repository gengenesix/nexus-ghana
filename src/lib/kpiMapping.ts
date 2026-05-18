/**
 * kpiMapping.ts
 * ─────────────
 * Maps every industry slug → array of 6 KPI card definitions.
 * Each KPI card knows:
 *   - label        : display name
 *   - valueKey     : key in the merged stats object
 *   - format       : how to format the raw number
 *   - iconKey      : Lucide icon name (string — resolved by dashboard)
 *   - description  : small sub-label
 *   - alertThreshold? : if value >= threshold → show warning colour
 */

export type KpiFormat = "ghs" | "count" | "percent" | "decimal";

export interface KpiCardDef {
  label: string;
  valueKey: string;
  format: KpiFormat;
  iconKey: string;
  description: string;
  alertThreshold?: number; // if value >= this, card turns amber/red
  alertAbove?: boolean;    // true = alert when ABOVE threshold (default)
  alertBelow?: boolean;    // true = alert when BELOW threshold
  path?: string;           // click → navigate here
}

// Default 6 KPIs every business sees regardless of industry
export const DEFAULT_KPIS: KpiCardDef[] = [
  { label: "Today's Sales",     valueKey: "todayTotal",     format: "ghs",   iconKey: "ShoppingCart", description: "Revenue today",          path: "/pos" },
  { label: "Monthly Revenue",   valueKey: "monthly_total",  format: "ghs",   iconKey: "TrendingUp",   description: "This calendar month" },
  { label: "Unpaid Invoices",   valueKey: "unpaidCount",    format: "count", iconKey: "FileText",     description: "Awaiting payment",       path: "/invoices", alertThreshold: 1, alertAbove: true },
  { label: "Total Customers",   valueKey: "customerCount",  format: "count", iconKey: "Users",        description: "All time",               path: "/customers" },
  { label: "Low Stock Items",   valueKey: "lowStockCount",  format: "count", iconKey: "AlertTriangle",description: "Below reorder level",    path: "/inventory", alertThreshold: 1, alertAbove: true },
  { label: "Bank Balance",      valueKey: "totalBankBalance", format: "ghs", iconKey: "Landmark",     description: "Across all accounts",   path: "/banking" },
];

// Per-industry KPI overrides (6 cards each)
const INDUSTRY_KPIS: Record<string, KpiCardDef[]> = {
  retail: [
    { label: "Today's Sales",    valueKey: "todayTotal",         format: "ghs",   iconKey: "ShoppingCart",  description: "POS + invoices",         path: "/pos" },
    { label: "Avg Basket Value", valueKey: "avg_basket_30d",     format: "ghs",   iconKey: "ShoppingBag",   description: "Last 30 days avg" },
    { label: "Monthly Revenue",  valueKey: "monthly_total",      format: "ghs",   iconKey: "TrendingUp",    description: "This month" },
    { label: "Low Stock Items",  valueKey: "lowStockCount",      format: "count", iconKey: "AlertTriangle", description: "Below reorder level",    path: "/inventory", alertThreshold: 1, alertAbove: true },
    { label: "New Customers",    valueKey: "new_customers_month",format: "count", iconKey: "UserPlus",      description: "Joined this month",      path: "/customers" },
    { label: "Unpaid Invoices",  valueKey: "unpaidCount",        format: "count", iconKey: "FileText",      description: "Outstanding",            path: "/invoices", alertThreshold: 3, alertAbove: true },
  ],

  "food-beverage": [
    { label: "Today's Sales",    valueKey: "todayTotal",         format: "ghs",   iconKey: "ShoppingCart",  description: "All orders today",       path: "/pos" },
    { label: "Covers Today",     valueKey: "covers_today",       format: "count", iconKey: "ChefHat",       description: "Guests served today" },
    { label: "Monthly Revenue",  valueKey: "monthly_total",      format: "ghs",   iconKey: "TrendingUp",    description: "This month" },
    { label: "Avg Ticket Size",  valueKey: "avg_basket_30d",     format: "ghs",   iconKey: "Receipt",       description: "Per transaction (30d)" },
    { label: "Low Stock Items",  valueKey: "lowStockCount",      format: "count", iconKey: "AlertTriangle", description: "Reorder needed",         path: "/inventory", alertThreshold: 1, alertAbove: true },
    { label: "Unpaid Bills",     valueKey: "unpaidCount",        format: "count", iconKey: "FileText",      description: "Open invoices",          path: "/invoices", alertThreshold: 1, alertAbove: true },
  ],

  wholesale: [
    { label: "Today's Sales",    valueKey: "todayTotal",          format: "ghs",   iconKey: "ShoppingCart",  description: "Orders dispatched",      path: "/pos" },
    { label: "Monthly Revenue",  valueKey: "monthly_total",       format: "ghs",   iconKey: "TrendingUp",    description: "This month" },
    { label: "Open Purchase Orders", valueKey: "open_purchase_orders", format: "count", iconKey: "Truck",  description: "Pending delivery",       path: "/purchasing", alertThreshold: 1, alertAbove: true },
    { label: "Unpaid Invoices",  valueKey: "unpaidCount",         format: "count", iconKey: "FileText",      description: "Outstanding",            path: "/invoices", alertThreshold: 3, alertAbove: true },
    { label: "Low Stock",        valueKey: "lowStockCount",       format: "count", iconKey: "AlertTriangle", description: "Below reorder level",    path: "/inventory", alertThreshold: 1, alertAbove: true },
    { label: "Total Customers",  valueKey: "customerCount",       format: "count", iconKey: "Users",         description: "Active accounts",        path: "/customers" },
  ],

  manufacturing: [
    { label: "Monthly Revenue",    valueKey: "monthly_total",       format: "ghs",   iconKey: "TrendingUp",  description: "This month" },
    { label: "Active Production",  valueKey: "activeProduction",    format: "count", iconKey: "Factory",     description: "Production orders open", path: "/production", alertThreshold: 1, alertAbove: true },
    { label: "Open Purchase Orders", valueKey: "open_purchase_orders", format: "count", iconKey: "Truck",   description: "Raw material POs",       path: "/purchasing" },
    { label: "Low Stock / Raw",    valueKey: "lowStockCount",       format: "count", iconKey: "AlertTriangle", description: "Components low",       path: "/inventory", alertThreshold: 1, alertAbove: true },
    { label: "Monthly Expenses",   valueKey: "monthly_expenses",    format: "ghs",   iconKey: "Receipt",     description: "COGS + overheads" },
    { label: "Today's Sales",      valueKey: "todayTotal",          format: "ghs",   iconKey: "ShoppingCart",description: "Shipped today",          path: "/pos" },
  ],

  pharmacy: [
    { label: "Today's Sales",    valueKey: "todayTotal",          format: "ghs",   iconKey: "ShoppingCart",  description: "Dispensed today",        path: "/pos" },
    { label: "Expiring (30 days)", valueKey: "expiring_30_count", format: "count", iconKey: "AlertTriangle", description: "Products expiring soon", path: "/inventory", alertThreshold: 1, alertAbove: true },
    { label: "Expiring (90 days)", valueKey: "expiring_90_count", format: "count", iconKey: "Clock",         description: "Watch list",             path: "/inventory", alertThreshold: 5, alertAbove: true },
    { label: "Monthly Revenue",  valueKey: "monthly_total",       format: "ghs",   iconKey: "TrendingUp",    description: "This month" },
    { label: "Low Stock",        valueKey: "lowStockCount",       format: "count", iconKey: "Package",       description: "Below reorder level",    path: "/inventory", alertThreshold: 1, alertAbove: true },
    { label: "Open POs",         valueKey: "open_purchase_orders",format: "count", iconKey: "Truck",         description: "Supplier orders",        path: "/purchasing" },
  ],

  professional: [
    { label: "Monthly Revenue",   valueKey: "monthly_total",        format: "ghs",   iconKey: "TrendingUp",  description: "Billed this month" },
    { label: "Active Projects",   valueKey: "active_projects_count",format: "count", iconKey: "FolderKanban",description: "In progress",            path: "/projects" },
    { label: "Pipeline Value",    valueKey: "pipelineValue",        format: "ghs",   iconKey: "Handshake",   description: "Open opportunities",     path: "/opportunities" },
    { label: "Unpaid Invoices",   valueKey: "unpaidCount",          format: "count", iconKey: "FileText",    description: "Outstanding",            path: "/invoices", alertThreshold: 1, alertAbove: true },
    { label: "New Customers",     valueKey: "new_customers_month",  format: "count", iconKey: "UserPlus",    description: "This month",             path: "/customers" },
    { label: "Pending Approvals", valueKey: "pending_approvals",    format: "count", iconKey: "ClipboardCheck", description: "Awaiting sign-off",   path: "/approvals", alertThreshold: 1, alertAbove: true },
  ],

  construction: [
    { label: "Monthly Revenue",    valueKey: "monthly_total",        format: "ghs",   iconKey: "TrendingUp",   description: "Invoiced this month" },
    { label: "Active Projects",    valueKey: "active_projects_count",format: "count", iconKey: "HardHat",      description: "On-site projects",       path: "/projects" },
    { label: "Open POs",           valueKey: "open_purchase_orders", format: "count", iconKey: "Truck",        description: "Materials on order",     path: "/purchasing" },
    { label: "Unpaid Invoices",    valueKey: "unpaidCount",          format: "count", iconKey: "FileText",     description: "Client payments due",    path: "/invoices", alertThreshold: 1, alertAbove: true },
    { label: "Monthly Expenses",   valueKey: "monthly_expenses",     format: "ghs",   iconKey: "Receipt",      description: "Labour + materials" },
    { label: "Pending Approvals",  valueKey: "pending_approvals",    format: "count", iconKey: "ClipboardCheck",description: "BOQ / variation sign-off", path: "/approvals", alertThreshold: 1, alertAbove: true },
  ],

  transport: [
    { label: "Today's Revenue",   valueKey: "todayTotal",           format: "ghs",   iconKey: "ShoppingCart",  description: "Freight income today",   path: "/pos" },
    { label: "Monthly Revenue",   valueKey: "monthly_total",        format: "ghs",   iconKey: "TrendingUp",    description: "This month" },
    { label: "Open Service Jobs", valueKey: "open_service_jobs",    format: "count", iconKey: "Wrench",        description: "Vehicle maintenance",    path: "/service", alertThreshold: 1, alertAbove: true },
    { label: "Unpaid Invoices",   valueKey: "unpaidCount",          format: "count", iconKey: "FileText",      description: "Client bills due",       path: "/invoices", alertThreshold: 1, alertAbove: true },
    { label: "Monthly Expenses",  valueKey: "monthly_expenses",     format: "ghs",   iconKey: "Receipt",       description: "Fuel, tolls, repairs" },
    { label: "Pending Approvals", valueKey: "pending_approvals",    format: "count", iconKey: "ClipboardCheck",description: "Pending sign-off",       path: "/approvals", alertThreshold: 1, alertAbove: true },
  ],

  hospitality: [
    { label: "Today's Revenue",   valueKey: "todayTotal",           format: "ghs",   iconKey: "ShoppingCart",  description: "F&B + rooms today",      path: "/pos" },
    { label: "Covers Today",      valueKey: "covers_today",         format: "count", iconKey: "ChefHat",       description: "Restaurant guests" },
    { label: "Monthly Revenue",   valueKey: "monthly_total",        format: "ghs",   iconKey: "TrendingUp",    description: "This month" },
    { label: "Low Stock",         valueKey: "lowStockCount",        format: "count", iconKey: "AlertTriangle", description: "F&B inventory",          path: "/inventory", alertThreshold: 1, alertAbove: true },
    { label: "Unpaid Invoices",   valueKey: "unpaidCount",          format: "count", iconKey: "FileText",      description: "Corporate accounts",     path: "/invoices", alertThreshold: 1, alertAbove: true },
    { label: "Monthly Expenses",  valueKey: "monthly_expenses",     format: "ghs",   iconKey: "Receipt",       description: "Operating costs" },
  ],

  auto: [
    { label: "Today's Revenue",   valueKey: "todayTotal",           format: "ghs",   iconKey: "ShoppingCart",  description: "Jobs closed today",      path: "/pos" },
    { label: "Open Service Jobs", valueKey: "open_service_jobs",    format: "count", iconKey: "Wrench",        description: "Vehicles in workshop",   path: "/service", alertThreshold: 1, alertAbove: true },
    { label: "Monthly Revenue",   valueKey: "monthly_total",        format: "ghs",   iconKey: "TrendingUp",    description: "This month" },
    { label: "Low Stock Parts",   valueKey: "lowStockCount",        format: "count", iconKey: "AlertTriangle", description: "Spare parts low",        path: "/inventory", alertThreshold: 1, alertAbove: true },
    { label: "Unpaid Invoices",   valueKey: "unpaidCount",          format: "count", iconKey: "FileText",      description: "Fleet / corporate",      path: "/invoices", alertThreshold: 1, alertAbove: true },
    { label: "New Customers",     valueKey: "new_customers_month",  format: "count", iconKey: "UserPlus",      description: "This month",             path: "/customers" },
  ],

  agriculture: [
    { label: "Monthly Revenue",   valueKey: "monthly_total",        format: "ghs",   iconKey: "TrendingUp",    description: "Produce sold this month" },
    { label: "Today's Sales",     valueKey: "todayTotal",           format: "ghs",   iconKey: "ShoppingCart",  description: "Farm gate + direct",     path: "/pos" },
    { label: "Open POs",          valueKey: "open_purchase_orders", format: "count", iconKey: "Truck",         description: "Input / supplies POs",   path: "/purchasing" },
    { label: "Low Stock Items",   valueKey: "lowStockCount",        format: "count", iconKey: "AlertTriangle", description: "Inputs running low",     path: "/inventory", alertThreshold: 1, alertAbove: true },
    { label: "Monthly Expenses",  valueKey: "monthly_expenses",     format: "ghs",   iconKey: "Receipt",       description: "Labour + inputs" },
    { label: "Unpaid Invoices",   valueKey: "unpaidCount",          format: "count", iconKey: "FileText",      description: "Buyer payments due",     path: "/invoices", alertThreshold: 1, alertAbove: true },
  ],

  beauty: [
    { label: "Today's Revenue",   valueKey: "todayTotal",           format: "ghs",   iconKey: "ShoppingCart",  description: "Services + retail",      path: "/pos" },
    { label: "Monthly Revenue",   valueKey: "monthly_total",        format: "ghs",   iconKey: "TrendingUp",    description: "This month" },
    { label: "New Clients",       valueKey: "new_customers_month",  format: "count", iconKey: "UserPlus",      description: "New this month",         path: "/customers" },
    { label: "Avg Ticket Size",   valueKey: "avg_basket_30d",       format: "ghs",   iconKey: "Sparkles",      description: "Per visit (30d)" },
    { label: "Low Stock",         valueKey: "lowStockCount",        format: "count", iconKey: "AlertTriangle", description: "Retail products low",    path: "/inventory", alertThreshold: 1, alertAbove: true },
    { label: "Unpaid Invoices",   valueKey: "unpaidCount",          format: "count", iconKey: "FileText",      description: "Corporate accounts",     path: "/invoices" },
  ],

  financial: [
    { label: "Monthly Revenue",   valueKey: "monthly_total",        format: "ghs",   iconKey: "TrendingUp",    description: "Fees & commissions" },
    { label: "Pipeline Value",    valueKey: "pipelineValue",        format: "ghs",   iconKey: "Handshake",     description: "Active opportunities",   path: "/opportunities" },
    { label: "Unpaid Invoices",   valueKey: "unpaidCount",          format: "count", iconKey: "FileText",      description: "Outstanding fees",       path: "/invoices", alertThreshold: 1, alertAbove: true },
    { label: "New Clients",       valueKey: "new_customers_month",  format: "count", iconKey: "UserPlus",      description: "Onboarded this month",   path: "/customers" },
    { label: "Pending Approvals", valueKey: "pending_approvals",    format: "count", iconKey: "ClipboardCheck",description: "Compliance sign-off",    path: "/approvals", alertThreshold: 1, alertAbove: true },
    { label: "Bank Balance",      valueKey: "totalBankBalance",     format: "ghs",   iconKey: "Landmark",      description: "Operational accounts",   path: "/banking" },
  ],
};

/**
 * Returns the 6 KPI definitions for a given industry slug.
 * Falls back to DEFAULT_KPIS if the industry is unknown or null.
 */
export function getIndustryKpis(slug: string | null): KpiCardDef[] {
  if (!slug) return DEFAULT_KPIS;
  return INDUSTRY_KPIS[slug] ?? DEFAULT_KPIS;
}

/** Industry-specific quick actions (primary CTA + 3 secondary) */
export interface QuickAction {
  label: string;
  iconKey: string;
  path: string;
  primary?: boolean;
}

export const INDUSTRY_QUICK_ACTIONS: Record<string, QuickAction[]> = {
  retail: [
    { label: "New Sale",       iconKey: "ShoppingCart",  path: "/pos",       primary: true },
    { label: "Inventory",      iconKey: "Package",       path: "/inventory" },
    { label: "New Invoice",    iconKey: "FileText",      path: "/invoices" },
    { label: "Customers",      iconKey: "Users",         path: "/customers" },
  ],
  "food-beverage": [
    { label: "Open POS",       iconKey: "ShoppingCart",  path: "/pos",       primary: true },
    { label: "Inventory",      iconKey: "Package",       path: "/inventory" },
    { label: "New Invoice",    iconKey: "FileText",      path: "/invoices" },
    { label: "Suppliers",      iconKey: "Truck",         path: "/suppliers" },
  ],
  wholesale: [
    { label: "New Sale Order", iconKey: "ShoppingCart",  path: "/sales-orders", primary: true },
    { label: "New Invoice",    iconKey: "FileText",      path: "/invoices" },
    { label: "Purchase Order", iconKey: "Truck",         path: "/purchasing" },
    { label: "Inventory",      iconKey: "Package",       path: "/inventory" },
  ],
  manufacturing: [
    { label: "New Production", iconKey: "Factory",       path: "/production",   primary: true },
    { label: "Purchase Order", iconKey: "Truck",         path: "/purchasing" },
    { label: "Inventory",      iconKey: "Package",       path: "/inventory" },
    { label: "Reports",        iconKey: "BarChart3",     path: "/reports" },
  ],
  pharmacy: [
    { label: "Dispense (POS)", iconKey: "ShoppingCart",  path: "/pos",       primary: true },
    { label: "Check Expiring", iconKey: "AlertTriangle", path: "/inventory" },
    { label: "New Invoice",    iconKey: "FileText",      path: "/invoices" },
    { label: "Purchase Order", iconKey: "Truck",         path: "/purchasing" },
  ],
  professional: [
    { label: "New Invoice",    iconKey: "FileText",      path: "/invoices",  primary: true },
    { label: "New Project",    iconKey: "FolderKanban",  path: "/projects" },
    { label: "Log Time",       iconKey: "Timer",         path: "/timesheets" },
    { label: "Leads",          iconKey: "Briefcase",     path: "/crm" },
  ],
  construction: [
    { label: "New Invoice",    iconKey: "FileText",      path: "/invoices",  primary: true },
    { label: "New Project",    iconKey: "HardHat",       path: "/projects" },
    { label: "Purchase Order", iconKey: "Truck",         path: "/purchasing" },
    { label: "Expenses",       iconKey: "Receipt",       path: "/expenses" },
  ],
  transport: [
    { label: "New Invoice",    iconKey: "FileText",      path: "/invoices",  primary: true },
    { label: "Service Job",    iconKey: "Wrench",        path: "/service" },
    { label: "Log Expense",    iconKey: "Receipt",       path: "/expenses" },
    { label: "Reports",        iconKey: "BarChart3",     path: "/reports" },
  ],
  hospitality: [
    { label: "Open POS",       iconKey: "ShoppingCart",  path: "/pos",       primary: true },
    { label: "New Invoice",    iconKey: "FileText",      path: "/invoices" },
    { label: "Inventory",      iconKey: "Package",       path: "/inventory" },
    { label: "Expenses",       iconKey: "Receipt",       path: "/expenses" },
  ],
  auto: [
    { label: "New Job Card",   iconKey: "Wrench",        path: "/service",   primary: true },
    { label: "New Invoice",    iconKey: "FileText",      path: "/invoices" },
    { label: "Parts Stock",    iconKey: "Package",       path: "/inventory" },
    { label: "New Customer",   iconKey: "UserPlus",      path: "/customers" },
  ],
  agriculture: [
    { label: "New Sale",       iconKey: "ShoppingCart",  path: "/pos",       primary: true },
    { label: "Purchase Input", iconKey: "Truck",         path: "/purchasing" },
    { label: "New Invoice",    iconKey: "FileText",      path: "/invoices" },
    { label: "Inventory",      iconKey: "Package",       path: "/inventory" },
  ],
  beauty: [
    { label: "New Appointment",iconKey: "ShoppingCart",  path: "/pos",       primary: true },
    { label: "New Client",     iconKey: "UserPlus",      path: "/customers" },
    { label: "Inventory",      iconKey: "Package",       path: "/inventory" },
    { label: "New Invoice",    iconKey: "FileText",      path: "/invoices" },
  ],
  financial: [
    { label: "New Invoice",    iconKey: "FileText",      path: "/invoices",  primary: true },
    { label: "New Lead",       iconKey: "Briefcase",     path: "/crm" },
    { label: "Expenses",       iconKey: "Receipt",       path: "/expenses" },
    { label: "Reports",        iconKey: "BarChart3",     path: "/reports" },
  ],
};

export function getQuickActions(slug: string | null): QuickAction[] {
  const defaults: QuickAction[] = [
    { label: "New Sale",    iconKey: "ShoppingCart",  path: "/pos",       primary: true },
    { label: "New Invoice", iconKey: "FileText",      path: "/invoices" },
    { label: "Inventory",   iconKey: "Package",       path: "/inventory" },
    { label: "Reports",     iconKey: "BarChart3",     path: "/reports" },
  ];
  if (!slug) return defaults;
  return INDUSTRY_QUICK_ACTIONS[slug] ?? defaults;
}
