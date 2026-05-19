/**
 * Nexis Industry Configuration
 * ─────────────────────────────
 * Single source of truth for all industry verticals and module definitions
 * on the frontend. Mirrors the DB seed data in migration 000022 so the
 * sidebar, onboarding, and dashboard load instantly without extra DB queries.
 *
 * Update both this file AND the SQL migration whenever adding a new industry
 * or module.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModuleCategory =
  | "sales"
  | "finance"
  | "operations"
  | "hr"
  | "system"
  | "industry";

export type LicenseTier =
  | "starter"
  | "limited_financial"
  | "limited_logistics"
  | "limited_sales_crm"
  | "professional";

export interface ModuleDefinition {
  key: string;
  name: string;
  description: string;
  category: ModuleCategory;
  isCore: boolean;
  iconKey: string;       // Lucide icon name — maps via ICON_MAP below
  path: string;
  isAvailable: boolean;  // false = not yet built (coming soon)
  minTier: LicenseTier;
}

// Nav group structure — controls sidebar organization.
// Groups are only rendered if they have at least one visible module.
export interface NavGroup {
  label: string;
  moduleKeys: string[];
  defaultOpen: boolean;
}

export interface IndustryVertical {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  iconKey: string;        // Lucide icon name for the industry card
  colorHex: string;       // Solid icon background color
  accentHex: string;      // Light tint for selected card background
  sortOrder: number;
  defaultModules: string[]; // module keys enabled by default for this industry
  // Phase 6: Per-industry sidebar structure and terminology
  navGroups: NavGroup[];                 // sidebar sections unique to this industry
  moduleAliases: Record<string, string>; // moduleKey → industry-specific display name
}

// ─── Module Registry ──────────────────────────────────────────────────────────

export const MODULE_REGISTRY: ModuleDefinition[] = [
  // ── Core ────────────────────────────────────────────────────
  {
    key: "dashboard",    name: "Dashboard",        description: "Overview of key business metrics",
    category: "system",  isCore: true,             iconKey: "LayoutDashboard",
    path: "/dashboard",  isAvailable: true,         minTier: "starter",
  },
  {
    key: "pos",          name: "Point of Sale",    description: "Sales terminal with offline & MoMo support",
    category: "sales",   isCore: false,             iconKey: "ShoppingCart",
    path: "/pos",        isAvailable: true,         minTier: "starter",
  },
  {
    key: "inventory",    name: "Inventory",         description: "Stock management, barcodes & alerts",
    category: "operations", isCore: false,          iconKey: "Package",
    path: "/inventory",  isAvailable: true,         minTier: "starter",
  },
  {
    key: "invoices",     name: "Invoices",          description: "Invoicing, recurring billing & PDFs",
    category: "sales",   isCore: false,             iconKey: "FileText",
    path: "/invoices",   isAvailable: true,         minTier: "starter",
  },
  {
    key: "customers",    name: "Customers",         description: "Customer database, history & loyalty",
    category: "sales",   isCore: false,             iconKey: "Users",
    path: "/customers",  isAvailable: true,         minTier: "starter",
  },
  {
    key: "suppliers",    name: "Suppliers",         description: "Supplier management & contacts",
    category: "operations", isCore: false,          iconKey: "Building2",
    path: "/suppliers",  isAvailable: true,         minTier: "starter",
  },
  {
    key: "expenses",     name: "Expenses",          description: "Expense tracking, categories & receipts",
    category: "finance", isCore: false,             iconKey: "Receipt",
    path: "/expenses",   isAvailable: true,         minTier: "starter",
  },
  {
    key: "reports",      name: "Reports",           description: "Analytics, charts & business insights",
    category: "system",  isCore: false,             iconKey: "BarChart3",
    path: "/reports",    isAvailable: true,         minTier: "starter",
  },
  {
    key: "staff",        name: "Staff",             description: "Staff accounts, roles & permissions",
    category: "system",  isCore: false,             iconKey: "UserCog",
    path: "/staff",      isAvailable: true,         minTier: "starter",
  },
  {
    key: "settings",     name: "Settings",          description: "Business configuration & preferences",
    category: "system",  isCore: false,             iconKey: "Settings",
    path: "/settings",   isAvailable: true,         minTier: "starter",
  },
  // ── Finance ──────────────────────────────────────────────────
  {
    key: "financials",   name: "Financials",        description: "General ledger & chart of accounts",
    category: "finance", isCore: false,             iconKey: "Wallet",
    path: "/financials", isAvailable: true,         minTier: "limited_financial",
  },
  {
    key: "banking",      name: "Banking",            description: "Bank accounts & reconciliation",
    category: "finance", isCore: false,             iconKey: "Landmark",
    path: "/banking",    isAvailable: true,         minTier: "limited_financial",
  },
  // ── Sales & CRM ──────────────────────────────────────────────
  {
    key: "crm",          name: "CRM",               description: "Leads, opportunities & sales pipeline",
    category: "sales",   isCore: false,             iconKey: "Handshake",
    path: "/crm",        isAvailable: true,         minTier: "limited_sales_crm",
  },
  {
    key: "sales-orders", name: "Sales Orders",      description: "Sales order management & quotations",
    category: "sales",   isCore: false,             iconKey: "ShoppingBag",
    path: "/sales-orders",isAvailable: true,        minTier: "limited_sales_crm",
  },
  // ── Operations ───────────────────────────────────────────────
  {
    key: "projects",     name: "Projects",          description: "Project management with Gantt charts",
    category: "operations", isCore: false,          iconKey: "FolderKanban",
    path: "/projects",   isAvailable: true,         minTier: "limited_sales_crm",
  },
  {
    key: "service",      name: "Service",            description: "Service contracts, job cards & SLAs",
    category: "operations", isCore: false,          iconKey: "Headphones",
    path: "/service",    isAvailable: true,         minTier: "limited_sales_crm",
  },
  {
    key: "purchasing",   name: "Purchasing",         description: "Purchase orders & goods receiving",
    category: "operations", isCore: false,          iconKey: "ClipboardList",
    path: "/purchasing", isAvailable: true,         minTier: "limited_logistics",
  },
  {
    key: "warehouses",   name: "Warehouses",         description: "Multi-location warehouse management",
    category: "operations", isCore: false,          iconKey: "ArrowRightLeft",
    path: "/warehouses", isAvailable: true,         minTier: "limited_logistics",
  },
  {
    key: "production",   name: "Production",         description: "Manufacturing orders & bill of materials",
    category: "operations", isCore: false,          iconKey: "Factory",
    path: "/production", isAvailable: true,         minTier: "limited_logistics",
  },
  {
    key: "mrp",          name: "MRP",                description: "Material requirements planning",
    category: "operations", isCore: false,          iconKey: "Cpu",
    path: "/mrp",        isAvailable: true,         minTier: "limited_logistics",
  },
  // ── HR & People ──────────────────────────────────────────────
  {
    key: "hr",           name: "Human Resources",   description: "Employee records, org chart & leave",
    category: "hr",      isCore: false,             iconKey: "Users2",
    path: "/hr",         isAvailable: true,         minTier: "professional",
  },
  {
    key: "administration",name: "Administration",   description: "Company settings & permission matrix",
    category: "system",  isCore: false,             iconKey: "Shield",
    path: "/administration",isAvailable: true,      minTier: "professional",
  },
  {
    key: "approvals",    name: "Approvals",          description: "Approval workflows & request inbox",
    category: "system",  isCore: false,             iconKey: "ClipboardCheck",
    path: "/approvals",  isAvailable: true,         minTier: "starter",
  },
  {
    key: "audit-log",    name: "Audit Log",          description: "Full audit trail & activity history",
    category: "system",  isCore: false,             iconKey: "FileSearch",
    path: "/audit-log",  isAvailable: true,         minTier: "professional",
  },
  // ── Phase 3: Built ───────────────────────────────────────────
  {
    key: "payroll",      name: "Payroll",            description: "Ghana SSNIT + PAYE compliant payroll",
    category: "hr",      isCore: false,             iconKey: "Banknote",
    path: "/payroll",    isAvailable: true,         minTier: "professional",
  },
  {
    key: "attendance",   name: "Attendance",         description: "Clock-in/out & daily attendance tracking",
    category: "hr",      isCore: false,             iconKey: "Clock",
    path: "/attendance", isAvailable: true,         minTier: "professional",
  },
  {
    key: "budget",       name: "Budget",             description: "Budget planning, control & variance tracking",
    category: "finance", isCore: false,             iconKey: "Target",
    path: "/budget",     isAvailable: true,         minTier: "professional",
  },
  {
    key: "assets",       name: "Assets",             description: "Fixed asset register & straight-line depreciation",
    category: "finance", isCore: false,             iconKey: "HardDrive",
    path: "/assets",     isAvailable: true,         minTier: "professional",
  },
  {
    key: "petty-cash",   name: "Petty Cash",         description: "Petty cash floats, vouchers & top-ups",
    category: "finance", isCore: false,             iconKey: "Coins",
    path: "/petty-cash", isAvailable: true,         minTier: "starter",
  },
  // ── Phase 3: Still planned ────────────────────────────────────
  {
    key: "recruitment",  name: "Recruitment",        description: "Hiring pipeline & applicant tracking",
    category: "hr",      isCore: false,             iconKey: "UserPlus",
    path: "/recruitment",isAvailable: false,        minTier: "professional",
  },
  {
    key: "helpdesk",     name: "Helpdesk",           description: "Customer support tickets & SLA tracking",
    category: "operations",isCore: false,           iconKey: "LifeBuoy",
    path: "/helpdesk",   isAvailable: false,        minTier: "professional",
  },
  {
    key: "timesheets",   name: "Timesheets",         description: "Billable hours & time logging per project",
    category: "operations",isCore: false,           iconKey: "Timer",
    path: "/timesheets", isAvailable: false,        minTier: "professional",
  },
  // ── Phase 4: Industry-specific ────────────────────────────────
  {
    key: "restaurant",   name: "Restaurant",         description: "Tables, order tabs & covers tracking",
    category: "industry",isCore: false,             iconKey: "ChefHat",
    path: "/restaurant", isAvailable: true,         minTier: "starter",
  },
  {
    key: "pharmacy-rx",  name: "Pharmacy Rx",        description: "Prescriptions & controlled drugs register",
    category: "industry",isCore: false,             iconKey: "Pill",
    path: "/pharmacy-rx",isAvailable: true,         minTier: "starter",
  },
  {
    key: "hotel-mgmt",   name: "Hotel Management",   description: "Rooms, bookings & housekeeping",
    category: "industry",isCore: false,             iconKey: "BedDouble",
    path: "/hotel-mgmt", isAvailable: true,         minTier: "starter",
  },
  {
    key: "fleet",        name: "Fleet Management",   description: "Vehicles, drivers, trips & fuel logging",
    category: "industry",isCore: false,             iconKey: "Truck",
    path: "/fleet",      isAvailable: true,         minTier: "starter",
  },
  {
    key: "garage",       name: "Job Cards / Garage", description: "Service jobs, technicians & vehicle history",
    category: "industry",isCore: false,             iconKey: "Wrench",
    path: "/garage",     isAvailable: true,         minTier: "starter",
  },
  {
    key: "farm-mgmt",    name: "Farm Management",    description: "Plots, seasons, inputs & harvest tracking",
    category: "industry",isCore: false,             iconKey: "Leaf",
    path: "/farm-mgmt",  isAvailable: true,         minTier: "starter",
  },
];

export const MODULE_MAP = Object.fromEntries(
  MODULE_REGISTRY.map((m) => [m.key, m])
) as Record<string, ModuleDefinition>;

// ─── Industry Verticals ────────────────────────────────────────────────────────

export const INDUSTRIES: IndustryVertical[] = [
  // ── 1. Retail & General Trade ─────────────────────────────────────────────
  {
    slug: "retail",
    name: "Retail & General Trade",
    tagline: "Shops, supermarkets, boutiques, provision stores",
    description: "Full retail management: POS, inventory, invoicing, CRM, and financials for any shop.",
    iconKey: "ShoppingBag",
    colorHex: "#f59e0b",
    accentHex: "#fef3c7",
    sortOrder: 1,
    defaultModules: [
      "dashboard","pos","inventory","customers","invoices","suppliers",
      "purchasing","warehouses","expenses","crm","sales-orders","financials",
      "banking","hr","payroll","attendance","budget","assets","petty-cash",
      "reports","staff","settings","approvals","administration","audit-log",
    ],
    moduleAliases: {},
    navGroups: [
      { label: "Main",              moduleKeys: ["dashboard", "pos"],                                          defaultOpen: true  },
      { label: "Selling",           moduleKeys: ["customers", "crm", "sales-orders", "invoices"],              defaultOpen: true  },
      { label: "Stock & Purchasing",moduleKeys: ["inventory", "suppliers", "purchasing", "warehouses"],        defaultOpen: true  },
      { label: "Finance",           moduleKeys: ["financials", "banking", "expenses", "budget", "assets", "petty-cash"], defaultOpen: true },
      { label: "HR & People",       moduleKeys: ["hr", "payroll", "attendance", "recruitment"],                defaultOpen: false },
      { label: "System",            moduleKeys: ["reports", "approvals", "audit-log", "administration", "staff", "settings"], defaultOpen: true },
    ],
  },

  // ── 2. Food & Beverage ────────────────────────────────────────────────────
  {
    slug: "food-beverage",
    name: "Food & Beverage",
    tagline: "Restaurants, chop bars, fast food, catering",
    description: "Table management, kitchen display, menu management, and covers tracking.",
    iconKey: "Utensils",
    colorHex: "#ef4444",
    accentHex: "#fee2e2",
    sortOrder: 2,
    defaultModules: [
      "dashboard","pos","inventory","customers","invoices","suppliers",
      "purchasing","expenses","hr","payroll","attendance","petty-cash","crm","reports","staff","settings",
      "restaurant","approvals","financials","banking","administration",
    ],
    moduleAliases: {
      "restaurant": "Tables & Orders",
      "pos":        "Cashier / Till",
      "inventory":  "Kitchen Stock",
      "customers":  "Regulars",
      "invoices":   "Bills & Receipts",
      "purchasing": "Supplier Orders",
    },
    navGroups: [
      { label: "Front of House",  moduleKeys: ["dashboard", "restaurant", "pos"],                              defaultOpen: true  },
      { label: "Kitchen & Stock", moduleKeys: ["inventory", "suppliers", "purchasing"],                        defaultOpen: true  },
      { label: "Guests & Revenue",moduleKeys: ["customers", "crm", "invoices"],                                defaultOpen: true  },
      { label: "Finance",         moduleKeys: ["financials", "banking", "expenses", "petty-cash"],             defaultOpen: true  },
      { label: "Team",            moduleKeys: ["hr", "payroll", "attendance"],                                 defaultOpen: false },
      { label: "System",          moduleKeys: ["reports", "approvals", "administration", "staff", "settings"], defaultOpen: true  },
    ],
  },

  // ── 3. Wholesale & Distribution ───────────────────────────────────────────
  {
    slug: "wholesale",
    name: "Wholesale & Distribution",
    tagline: "Distributors, importers, commodity traders",
    description: "Manage large-volume orders, supplier relationships, warehouses, and receivables.",
    iconKey: "Package2",
    colorHex: "#6366f1",
    accentHex: "#e0e7ff",
    sortOrder: 3,
    defaultModules: [
      "dashboard","pos","inventory","customers","invoices","suppliers",
      "purchasing","warehouses","expenses","crm","sales-orders","financials",
      "banking","hr","payroll","attendance","budget","assets","petty-cash",
      "reports","staff","settings","approvals","administration","audit-log",
    ],
    moduleAliases: {
      "customers":   "Trade Customers",
      "crm":         "Trade Relations",
      "sales-orders":"Trade Orders",
      "purchasing":  "Procurement",
      "warehouses":  "Distribution Centres",
    },
    navGroups: [
      { label: "Main",               moduleKeys: ["dashboard", "pos"],                                                    defaultOpen: true  },
      { label: "Trade Selling",      moduleKeys: ["customers", "crm", "sales-orders", "invoices"],                        defaultOpen: true  },
      { label: "Stock & Warehousing",moduleKeys: ["inventory", "warehouses", "suppliers", "purchasing"],                  defaultOpen: true  },
      { label: "Finance",            moduleKeys: ["financials", "banking", "expenses", "budget", "assets", "petty-cash"], defaultOpen: true  },
      { label: "HR & People",        moduleKeys: ["hr", "payroll", "attendance", "recruitment"],                          defaultOpen: false },
      { label: "System",             moduleKeys: ["reports", "approvals", "audit-log", "administration", "staff", "settings"], defaultOpen: true },
    ],
  },

  // ── 4. Manufacturing ──────────────────────────────────────────────────────
  {
    slug: "manufacturing",
    name: "Manufacturing",
    tagline: "Production, food processing, textiles, assembly",
    description: "Bill of materials, production orders, MRP planning, and supply chain management.",
    iconKey: "Factory",
    colorHex: "#64748b",
    accentHex: "#f1f5f9",
    sortOrder: 4,
    defaultModules: [
      "dashboard","inventory","production","mrp","purchasing","warehouses",
      "suppliers","invoices","customers","expenses","financials","banking",
      "hr","payroll","attendance","budget","assets","petty-cash",
      "pos","reports","staff","settings","approvals","administration","audit-log",
    ],
    moduleAliases: {
      "inventory":  "Materials & Stock",
      "suppliers":  "Vendors",
      "purchasing": "Procurement",
      "production": "Production Orders",
      "mrp":        "MRP Planning",
      "pos":        "Finished Goods Sales",
      "customers":  "Buyers",
    },
    navGroups: [
      { label: "Main",           moduleKeys: ["dashboard", "pos"],                                                    defaultOpen: true  },
      { label: "Production",     moduleKeys: ["production", "mrp"],                                                   defaultOpen: true  },
      { label: "Materials & Supply", moduleKeys: ["inventory", "warehouses", "suppliers", "purchasing"],              defaultOpen: true  },
      { label: "Sales",          moduleKeys: ["customers", "invoices"],                                               defaultOpen: true  },
      { label: "Finance",        moduleKeys: ["financials", "banking", "expenses", "budget", "assets", "petty-cash"], defaultOpen: true  },
      { label: "HR & People",    moduleKeys: ["hr", "payroll", "attendance", "recruitment"],                          defaultOpen: false },
      { label: "System",         moduleKeys: ["reports", "approvals", "audit-log", "administration", "staff", "settings"], defaultOpen: true },
    ],
  },

  // ── 5. Pharmacy & Health ──────────────────────────────────────────────────
  {
    slug: "pharmacy",
    name: "Pharmacy & Health",
    tagline: "Pharmacies, clinics, chemical shops",
    description: "Batch and expiry tracking, prescription management, and controlled drugs register.",
    iconKey: "Pill",
    colorHex: "#14b8a6",
    accentHex: "#ccfbf1",
    sortOrder: 5,
    defaultModules: [
      "dashboard","pos","inventory","customers","invoices","suppliers",
      "purchasing","expenses","crm","financials","banking","hr",
      "payroll","attendance","budget","assets","petty-cash",
      "pharmacy-rx","reports","staff","settings","approvals","administration",
    ],
    moduleAliases: {
      "pharmacy-rx": "Prescriptions",
      "inventory":   "Drug Register",
      "customers":   "Patients",
      "pos":         "Counter Sales",
      "invoices":    "Patient Billing",
      "suppliers":   "Drug Suppliers",
      "purchasing":  "Drug Procurement",
    },
    navGroups: [
      { label: "Dispensary",       moduleKeys: ["dashboard", "pharmacy-rx", "pos"],                                    defaultOpen: true  },
      { label: "Drug Stock",       moduleKeys: ["inventory", "suppliers", "purchasing"],                               defaultOpen: true  },
      { label: "Patients & Billing",moduleKeys: ["customers", "crm", "invoices"],                                     defaultOpen: true  },
      { label: "Finance",          moduleKeys: ["financials", "banking", "expenses", "budget", "assets", "petty-cash"],defaultOpen: true  },
      { label: "Team",             moduleKeys: ["hr", "payroll", "attendance"],                                        defaultOpen: false },
      { label: "System",           moduleKeys: ["reports", "approvals", "administration", "staff", "settings"],        defaultOpen: true  },
    ],
  },

  // ── 6. Professional Services ──────────────────────────────────────────────
  {
    slug: "professional",
    name: "Professional Services",
    tagline: "Consulting, legal, accounting, advisory firms",
    description: "Project management, billable timesheets, CRM pipeline, and professional invoicing.",
    iconKey: "Briefcase",
    colorHex: "#3b82f6",
    accentHex: "#dbeafe",
    sortOrder: 6,
    defaultModules: [
      "dashboard","customers","crm","invoices","projects","service",
      "expenses","financials","banking","hr","payroll","attendance","budget","petty-cash",
      "timesheets","reports","staff","settings","approvals","administration","audit-log",
    ],
    moduleAliases: {
      "customers": "Clients",
      "crm":       "Business Development",
      "invoices":  "Client Billing",
      "projects":  "Engagements",
      "service":   "Service Contracts",
      "timesheets":"Billable Hours",
    },
    navGroups: [
      { label: "Work",        moduleKeys: ["dashboard", "projects", "service", "timesheets"],                          defaultOpen: true  },
      { label: "Clients",     moduleKeys: ["customers", "crm", "invoices"],                                            defaultOpen: true  },
      { label: "Finance",     moduleKeys: ["financials", "banking", "expenses", "budget", "petty-cash"],               defaultOpen: true  },
      { label: "HR & People", moduleKeys: ["hr", "payroll", "attendance", "recruitment"],                              defaultOpen: false },
      { label: "System",      moduleKeys: ["reports", "approvals", "audit-log", "administration", "staff", "settings"],defaultOpen: true  },
    ],
  },

  // ── 7. Construction ───────────────────────────────────────────────────────
  {
    slug: "construction",
    name: "Construction",
    tagline: "Contractors, developers, civil engineering",
    description: "Project costing, BOQ, materials requisition, labour tracking, and milestone billing.",
    iconKey: "HardHat",
    colorHex: "#f97316",
    accentHex: "#ffedd5",
    sortOrder: 7,
    defaultModules: [
      "dashboard","projects","purchasing","inventory","warehouses","suppliers",
      "invoices","customers","crm","expenses","financials","banking",
      "hr","payroll","attendance","budget","assets","petty-cash",
      "reports","staff","settings","approvals","administration","audit-log",
    ],
    moduleAliases: {
      "projects":   "Construction Projects",
      "invoices":   "Progress Claims",
      "inventory":  "Site Materials",
      "suppliers":  "Contractors & Vendors",
      "purchasing": "Procurement",
      "customers":  "Clients",
      "warehouses": "Site Stores",
      "crm":        "Business Development",
    },
    navGroups: [
      { label: "Projects",      moduleKeys: ["dashboard", "projects"],                                                 defaultOpen: true  },
      { label: "Procurement",   moduleKeys: ["purchasing", "inventory", "warehouses", "suppliers"],                    defaultOpen: true  },
      { label: "Billing",       moduleKeys: ["customers", "crm", "invoices"],                                          defaultOpen: true  },
      { label: "Finance",       moduleKeys: ["financials", "banking", "expenses", "budget", "assets", "petty-cash"],  defaultOpen: true  },
      { label: "Site Labour",   moduleKeys: ["hr", "payroll", "attendance", "recruitment"],                           defaultOpen: false },
      { label: "System",        moduleKeys: ["reports", "approvals", "audit-log", "administration", "staff", "settings"], defaultOpen: true },
    ],
  },

  // ── 8. Transport & Logistics ──────────────────────────────────────────────
  {
    slug: "transport",
    name: "Transport & Logistics",
    tagline: "Freight, fleet operators, couriers, delivery",
    description: "Fleet management, trip logging, fuel tracking, driver assignment, and invoicing.",
    iconKey: "Truck",
    colorHex: "#0ea5e9",
    accentHex: "#e0f2fe",
    sortOrder: 8,
    defaultModules: [
      "dashboard","fleet","customers","invoices","purchasing","expenses",
      "financials","banking","hr","payroll","attendance","budget","assets","petty-cash",
      "crm","reports","staff","settings","approvals","administration",
    ],
    moduleAliases: {
      "fleet":     "Fleet & Trips",
      "customers": "Clients",
      "invoices":  "Trip Invoices",
      "purchasing":"Fuel & Parts",
      "crm":       "Business Development",
    },
    navGroups: [
      { label: "Operations",     moduleKeys: ["dashboard", "fleet"],                                                   defaultOpen: true  },
      { label: "Clients & Billing",moduleKeys: ["customers", "crm", "invoices"],                                      defaultOpen: true  },
      { label: "Procurement",    moduleKeys: ["purchasing", "expenses"],                                               defaultOpen: true  },
      { label: "Finance",        moduleKeys: ["financials", "banking", "budget", "assets", "petty-cash"],              defaultOpen: true  },
      { label: "HR & Drivers",   moduleKeys: ["hr", "payroll", "attendance", "recruitment"],                          defaultOpen: false },
      { label: "System",         moduleKeys: ["reports", "approvals", "administration", "staff", "settings"],         defaultOpen: true  },
    ],
  },

  // ── 9. Hospitality & Hotels ───────────────────────────────────────────────
  {
    slug: "hospitality",
    name: "Hospitality & Hotels",
    tagline: "Hotels, guesthouses, lodges, resorts",
    description: "Room management, bookings, check-in/out, housekeeping, and revenue analytics.",
    iconKey: "BedDouble",
    colorHex: "#a855f7",
    accentHex: "#f3e8ff",
    sortOrder: 9,
    defaultModules: [
      "dashboard","pos","hotel-mgmt","customers","invoices","crm",
      "inventory","purchasing","suppliers","expenses","financials","banking",
      "hr","payroll","attendance","budget","assets","petty-cash",
      "restaurant","reports","staff","settings","approvals","administration",
    ],
    moduleAliases: {
      "hotel-mgmt": "Rooms & Bookings",
      "customers":  "Guests",
      "invoices":   "Guest Folios",
      "restaurant": "F&B Orders",
      "pos":        "Front Desk POS",
      "inventory":  "Hotel Supplies",
      "purchasing": "Procurement",
    },
    navGroups: [
      { label: "Front Desk",       moduleKeys: ["dashboard", "hotel-mgmt", "pos"],                                     defaultOpen: true  },
      { label: "Food & Beverage",  moduleKeys: ["restaurant"],                                                         defaultOpen: true  },
      { label: "Stock & Supplies", moduleKeys: ["inventory", "suppliers", "purchasing"],                               defaultOpen: true  },
      { label: "Guests & Billing", moduleKeys: ["customers", "crm", "invoices"],                                       defaultOpen: true  },
      { label: "Finance",          moduleKeys: ["financials", "banking", "expenses", "budget", "assets", "petty-cash"],defaultOpen: true  },
      { label: "Team",             moduleKeys: ["hr", "payroll", "attendance"],                                        defaultOpen: false },
      { label: "System",           moduleKeys: ["reports", "approvals", "administration", "staff", "settings"],        defaultOpen: true  },
    ],
  },

  // ── 10. Auto Services & Garage ────────────────────────────────────────────
  {
    slug: "auto",
    name: "Auto Services & Garage",
    tagline: "Car repairs, spare parts, vulcanizers",
    description: "Job cards, vehicle history, technician assignment, parts tracking, and billing.",
    iconKey: "Wrench",
    colorHex: "#71717a",
    accentHex: "#f4f4f5",
    sortOrder: 10,
    defaultModules: [
      "dashboard","garage","pos","inventory","customers","invoices",
      "suppliers","purchasing","crm","expenses","hr","payroll","attendance","assets","petty-cash",
      "reports","staff","settings","approvals",
    ],
    moduleAliases: {
      "garage":    "Workshop & Job Cards",
      "inventory": "Spare Parts",
      "customers": "Vehicle Owners",
      "pos":       "Parts Counter",
      "invoices":  "Workshop Invoices",
      "purchasing":"Parts Procurement",
      "crm":       "Business Development",
    },
    navGroups: [
      { label: "Workshop",           moduleKeys: ["dashboard", "garage"],                                              defaultOpen: true  },
      { label: "Parts & Supplies",   moduleKeys: ["inventory", "suppliers", "purchasing"],                             defaultOpen: true  },
      { label: "Customers & Billing",moduleKeys: ["customers", "crm", "invoices", "pos"],                             defaultOpen: true  },
      { label: "Finance",            moduleKeys: ["expenses", "assets", "petty-cash"],                                 defaultOpen: true  },
      { label: "Team",               moduleKeys: ["hr", "payroll", "attendance"],                                     defaultOpen: false },
      { label: "System",             moduleKeys: ["reports", "approvals", "staff", "settings"],                       defaultOpen: true  },
    ],
  },

  // ── 11. Agriculture ───────────────────────────────────────────────────────
  {
    slug: "agriculture",
    name: "Agriculture",
    tagline: "Farms, agro-processing, input suppliers",
    description: "Farm and plot management, seasons, harvest tracking, and input cost analysis.",
    iconKey: "Leaf",
    colorHex: "#22c55e",
    accentHex: "#dcfce7",
    sortOrder: 11,
    defaultModules: [
      "dashboard","farm-mgmt","inventory","purchasing","warehouses","suppliers",
      "customers","invoices","expenses","financials","banking","hr",
      "payroll","attendance","assets","petty-cash",
      "reports","staff","settings","approvals",
    ],
    moduleAliases: {
      "farm-mgmt":  "Farms & Plots",
      "inventory":  "Inputs & Harvest",
      "customers":  "Buyers & Offtakers",
      "suppliers":  "Input Suppliers",
      "purchasing": "Input Procurement",
      "invoices":   "Sales Invoices",
      "warehouses": "Storage & Silos",
    },
    navGroups: [
      { label: "Farm Operations", moduleKeys: ["dashboard", "farm-mgmt"],                                              defaultOpen: true  },
      { label: "Inputs & Stock",  moduleKeys: ["inventory", "purchasing", "warehouses", "suppliers"],                  defaultOpen: true  },
      { label: "Sales",           moduleKeys: ["customers", "invoices"],                                               defaultOpen: true  },
      { label: "Finance",         moduleKeys: ["financials", "banking", "expenses", "assets", "petty-cash"],           defaultOpen: true  },
      { label: "Farm Labour",     moduleKeys: ["hr", "payroll", "attendance"],                                         defaultOpen: false },
      { label: "System",          moduleKeys: ["reports", "approvals", "staff", "settings"],                          defaultOpen: true  },
    ],
  },

  // ── 12. Beauty & Wellness ─────────────────────────────────────────────────
  {
    slug: "beauty",
    name: "Beauty & Wellness",
    tagline: "Salons, spas, barbershops, beauty shops",
    description: "Appointment booking, service menu, stylist management, and POS with loyalty.",
    iconKey: "Scissors",
    colorHex: "#ec4899",
    accentHex: "#fce7f3",
    sortOrder: 12,
    defaultModules: [
      "dashboard","pos","inventory","customers","invoices","expenses",
      "crm","hr","payroll","attendance","petty-cash","reports","staff","settings","approvals",
    ],
    moduleAliases: {
      "customers": "Clients",
      "invoices":  "Service Bills",
      "inventory": "Products & Supplies",
      "pos":       "Service Till",
      "crm":       "Client Relations",
    },
    navGroups: [
      { label: "Main",    moduleKeys: ["dashboard", "pos"],                                        defaultOpen: true  },
      { label: "Clients", moduleKeys: ["customers", "crm", "invoices"],                            defaultOpen: true  },
      { label: "Stock",   moduleKeys: ["inventory"],                                               defaultOpen: true  },
      { label: "Finance", moduleKeys: ["expenses", "petty-cash"],                                  defaultOpen: true  },
      { label: "Team",    moduleKeys: ["hr", "payroll", "attendance"],                             defaultOpen: false },
      { label: "System",  moduleKeys: ["reports", "approvals", "staff", "settings"],              defaultOpen: true  },
    ],
  },

  // ── 13. Financial Services ────────────────────────────────────────────────
  {
    slug: "financial",
    name: "Financial Services",
    tagline: "Forex bureaus, microfinance, savings groups",
    description: "Client ledger, transaction management, GL, banking, and compliance reporting.",
    iconKey: "Landmark",
    colorHex: "#10b981",
    accentHex: "#d1fae5",
    sortOrder: 13,
    defaultModules: [
      "dashboard","customers","crm","invoices","financials","banking",
      "expenses","hr","payroll","attendance","budget","assets","petty-cash",
      "reports","staff","settings","approvals","administration","audit-log",
    ],
    moduleAliases: {
      "customers":      "Clients",
      "crm":            "Client Relations",
      "invoices":       "Fee Notes",
      "administration": "Compliance & Control",
      "financials":     "General Ledger",
      "audit-log":      "Compliance Log",
    },
    navGroups: [
      { label: "Main",         moduleKeys: ["dashboard"],                                                              defaultOpen: true  },
      { label: "Clients",      moduleKeys: ["customers", "crm", "invoices"],                                          defaultOpen: true  },
      { label: "Finance & GL", moduleKeys: ["financials", "banking", "budget", "assets"],                             defaultOpen: true  },
      { label: "Costs",        moduleKeys: ["expenses", "petty-cash"],                                                 defaultOpen: true  },
      { label: "Compliance",   moduleKeys: ["audit-log", "administration", "approvals"],                              defaultOpen: true  },
      { label: "HR & People",  moduleKeys: ["hr", "payroll", "attendance"],                                           defaultOpen: false },
      { label: "System",       moduleKeys: ["reports", "staff", "settings"],                                          defaultOpen: true  },
    ],
  },
];

export const INDUSTRY_MAP = Object.fromEntries(
  INDUSTRIES.map((i) => [i.slug, i])
) as Record<string, IndustryVertical>;

// ─── Nav Group Structure (fallback for no-industry businesses) ─────────────────
// Used when business has no industry_vertical_slug set.
// Each industry now has its own navGroups defined above.

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Main",
    moduleKeys: ["dashboard", "pos"],
    defaultOpen: true,
  },
  {
    label: "Sales",
    moduleKeys: ["crm", "sales-orders", "invoices", "customers"],
    defaultOpen: true,
  },
  {
    label: "Supply Chain",
    moduleKeys: ["purchasing", "inventory", "warehouses", "suppliers"],
    defaultOpen: true,
  },
  {
    label: "Finance",
    moduleKeys: ["financials", "banking", "expenses", "budget", "assets", "petty-cash"],
    defaultOpen: true,
  },
  {
    label: "Production",
    moduleKeys: ["production", "mrp"],
    defaultOpen: false,
  },
  {
    label: "Projects & Services",
    moduleKeys: ["projects", "service", "timesheets", "helpdesk"],
    defaultOpen: false,
  },
  {
    label: "HR & People",
    moduleKeys: ["hr", "payroll", "attendance", "recruitment"],
    defaultOpen: false,
  },
  {
    label: "Industry",
    moduleKeys: ["restaurant", "pharmacy-rx", "hotel-mgmt", "fleet", "garage", "farm-mgmt"],
    defaultOpen: true,
  },
  {
    label: "System",
    moduleKeys: ["reports", "approvals", "audit-log", "administration", "staff", "settings"],
    defaultOpen: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the IndustryVertical for a given slug.
 * Falls back to 'retail' (the most common industry) if not found.
 */
export function getIndustry(slug: string | null | undefined): IndustryVertical {
  if (!slug) return INDUSTRIES[0]; // default to retail
  return INDUSTRY_MAP[slug] ?? INDUSTRIES[0];
}

/**
 * Returns the list of ModuleDefinitions enabled for a given industry slug.
 * If slug is null/undefined (legacy business), returns ALL available modules
 * to preserve existing behavior.
 */
// Modules that only make sense for a specific industry vertical.
// Hidden when no industry is explicitly selected.
const VERTICAL_ONLY_KEYS = new Set([
  "restaurant", "pharmacy-rx", "hotel-mgmt", "fleet", "garage", "farm-mgmt",
]);

export function getIndustryModules(slug: string | null | undefined): ModuleDefinition[] {
  if (!slug) {
    // No industry selected — return all available modules EXCEPT vertical-specific packs
    return MODULE_REGISTRY.filter((m) => m.isAvailable && !VERTICAL_ONLY_KEYS.has(m.key));
  }
  const industry = INDUSTRY_MAP[slug];
  if (!industry) return MODULE_REGISTRY.filter((m) => m.isAvailable && !VERTICAL_ONLY_KEYS.has(m.key));
  const keySet = new Set(industry.defaultModules);
  return MODULE_REGISTRY.filter((m) => keySet.has(m.key));
}

/**
 * Business size options for the onboarding form.
 */
export const BUSINESS_SIZES = [
  { value: "solo",   label: "Just me",           sub: "Solo operator" },
  { value: "small",  label: "2 – 10 employees",  sub: "Small team" },
  { value: "medium", label: "11 – 50 employees", sub: "Growing business" },
  { value: "large",  label: "50+ employees",      sub: "Established company" },
] as const;

export type BusinessSize = "solo" | "small" | "medium" | "large";
