/**
 * industryFirstSteps.ts
 * ──────────────────────
 * Maps each industry slug → 3 personalised "get started" steps
 * shown on the post-onboarding Welcome screen.
 */

export interface FirstStep {
  number: number;
  title: string;
  description: string;
  iconKey: string;
  path: string;
}

const STEPS: Record<string, [FirstStep, FirstStep, FirstStep]> = {
  retail: [
    { number: 1, title: "Add your products",      description: "Build your product catalog with prices, barcodes, and reorder levels.",        iconKey: "Package",       path: "/inventory" },
    { number: 2, title: "Make your first sale",   description: "Open the POS, scan products, and collect payment — cash, MoMo, or card.",     iconKey: "ShoppingCart",  path: "/pos" },
    { number: 3, title: "Import your customers",  description: "Add regular customers to track loyalty points and purchase history.",          iconKey: "Users",         path: "/customers" },
  ],
  "food-beverage": [
    { number: 1, title: "Set up your menu",       description: "Add food and beverage items with categories, prices, and stock levels.",       iconKey: "Package",       path: "/inventory" },
    { number: 2, title: "Open the POS",           description: "Take your first order — table service, takeaway, or delivery.",                iconKey: "ShoppingCart",  path: "/pos" },
    { number: 3, title: "Add your suppliers",     description: "Connect your food and ingredient suppliers for easy purchase orders.",         iconKey: "Truck",         path: "/suppliers" },
  ],
  wholesale: [
    { number: 1, title: "Build your catalog",     description: "Add products with bulk pricing tiers and reorder points.",                     iconKey: "Package",       path: "/inventory" },
    { number: 2, title: "Create a sales order",   description: "Generate your first client order and track dispatch.",                        iconKey: "ShoppingCart",  path: "/sales-orders" },
    { number: 3, title: "Add your suppliers",     description: "Set up suppliers and create purchase orders for stock replenishment.",         iconKey: "Truck",         path: "/suppliers" },
  ],
  manufacturing: [
    { number: 1, title: "Add raw materials",      description: "Load your material and component inventory with cost prices.",                 iconKey: "Package",       path: "/inventory" },
    { number: 2, title: "Create a production order", description: "Start your first manufacturing run and track work-in-progress.",           iconKey: "Factory",       path: "/production" },
    { number: 3, title: "Add your suppliers",     description: "Set up raw material suppliers and automate reorder with purchase orders.",     iconKey: "Truck",         path: "/suppliers" },
  ],
  pharmacy: [
    { number: 1, title: "Add your medications",   description: "Import your drug register with batch numbers and expiry dates.",               iconKey: "Package",       path: "/inventory" },
    { number: 2, title: "Process a dispensing",   description: "Dispense your first prescription or OTC sale through the POS.",               iconKey: "ShoppingCart",  path: "/pos" },
    { number: 3, title: "Order from your supplier", description: "Create a purchase order and track incoming stock deliveries.",              iconKey: "Truck",         path: "/purchasing" },
  ],
  professional: [
    { number: 1, title: "Create your first invoice", description: "Bill a client with your professional invoice — branded and Ghana-compliant.", iconKey: "FileText",   path: "/invoices" },
    { number: 2, title: "Start a project",        description: "Track milestones, tasks, and time spent on your active engagements.",          iconKey: "FolderKanban",  path: "/projects" },
    { number: 3, title: "Add your team",          description: "Invite staff members and assign roles and module access.",                    iconKey: "Users",         path: "/staff" },
  ],
  construction: [
    { number: 1, title: "Open a project",         description: "Create a project, define scope, and track costs vs. budget.",                 iconKey: "HardHat",       path: "/projects" },
    { number: 2, title: "Create a client invoice", description: "Issue a progress billing invoice — with retention and VAT.",                 iconKey: "FileText",      path: "/invoices" },
    { number: 3, title: "Add your suppliers",     description: "Set up material suppliers and issue purchase orders for your first project.",  iconKey: "Truck",         path: "/suppliers" },
  ],
  transport: [
    { number: 1, title: "Create a freight invoice", description: "Bill your first customer for haulage, delivery, or charter services.",      iconKey: "FileText",      path: "/invoices" },
    { number: 2, title: "Log a vehicle job",      description: "Record maintenance or repair work on your fleet vehicles.",                   iconKey: "Wrench",        path: "/service" },
    { number: 3, title: "Track your expenses",    description: "Log fuel, tolls, and operational costs per trip or vehicle.",                 iconKey: "Receipt",       path: "/expenses" },
  ],
  hospitality: [
    { number: 1, title: "Set up your offerings",  description: "Add rooms, meals, and services with pricing to your inventory.",              iconKey: "Package",       path: "/inventory" },
    { number: 2, title: "Open the POS",           description: "Take your first food, beverage, or room service order.",                      iconKey: "ShoppingCart",  path: "/pos" },
    { number: 3, title: "Create a guest invoice", description: "Issue a consolidated bill for a guest's stay and services.",                  iconKey: "FileText",      path: "/invoices" },
  ],
  auto: [
    { number: 1, title: "Create your first job card", description: "Log a vehicle in with customer details, issue, and estimated cost.",      iconKey: "Wrench",        path: "/service" },
    { number: 2, title: "Add spare parts",        description: "Stock your parts inventory with codes, prices, and reorder levels.",          iconKey: "Package",       path: "/inventory" },
    { number: 3, title: "Invoice the vehicle job", description: "Generate an itemised invoice for labour and parts used.",                   iconKey: "FileText",      path: "/invoices" },
  ],
  agriculture: [
    { number: 1, title: "Add your produce",       description: "List your crops, livestock, or agri products with pricing.",                 iconKey: "Package",       path: "/inventory" },
    { number: 2, title: "Record your first sale", description: "Sell produce at farm gate, market, or to buyers — log it in seconds.",       iconKey: "ShoppingCart",  path: "/pos" },
    { number: 3, title: "Order your inputs",      description: "Create purchase orders for seeds, fertiliser, and other inputs.",            iconKey: "Truck",         path: "/purchasing" },
  ],
  beauty: [
    { number: 1, title: "Add your services",      description: "List treatments, sessions, and retail products with prices.",                 iconKey: "Sparkles",      path: "/inventory" },
    { number: 2, title: "Book your first client", description: "Open the POS and record a service or product sale.",                         iconKey: "ShoppingCart",  path: "/pos" },
    { number: 3, title: "Build your client book", description: "Add existing clients to track visits, preferences, and loyalty.",            iconKey: "Users",         path: "/customers" },
  ],
  financial: [
    { number: 1, title: "Add your first client",  description: "Create a client record with contact details and engagement notes.",           iconKey: "Users",         path: "/customers" },
    { number: 2, title: "Create an invoice",      description: "Issue a professional services fee invoice with your branding.",              iconKey: "FileText",      path: "/invoices" },
    { number: 3, title: "Set up banking",         description: "Connect your operational bank accounts to track cash flow.",                 iconKey: "Landmark",      path: "/banking" },
  ],
};

const DEFAULT_STEPS: [FirstStep, FirstStep, FirstStep] = [
  { number: 1, title: "Add your products",     description: "Build your inventory catalog with prices, stock levels, and barcodes.", iconKey: "Package",      path: "/inventory" },
  { number: 2, title: "Make your first sale",  description: "Open the POS and record your first transaction in seconds.",           iconKey: "ShoppingCart", path: "/pos" },
  { number: 3, title: "Invite your team",      description: "Add staff members and assign their roles and access levels.",          iconKey: "Users",        path: "/staff" },
];

export function getFirstSteps(slug: string | null): [FirstStep, FirstStep, FirstStep] {
  if (!slug) return DEFAULT_STEPS;
  return STEPS[slug] ?? DEFAULT_STEPS;
}
