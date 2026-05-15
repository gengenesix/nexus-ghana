import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, LayoutDashboard, ShoppingCart, Package, FileText, Users,
  Truck, Receipt, BarChart2, UserCog, Settings, Moon, Smartphone,
  CheckCircle2, Globe, Shield, ClipboardList, FileSearch, Layers, Download,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const LAST_UPDATED = "15 May 2026";
const F = "#1a3a22";   // forest
const FM = "#2d4a35";  // forest mid – body text
const FL = "#4a6b52";  // forest light – intro text
const LM = "#c8f042";  // lime
const CR = "#faf9f4";  // cream
const WH = "#ffffff";
const BD = "#e4dfd4";  // border

interface GuideSection {
  id: string;
  icon: React.ElementType;
  title: string;
  intro: string;
  steps: { heading: string; body: string }[];
  tips?: string[];
}

const sections: GuideSection[] = [
  {
    id: "getting-started", icon: Globe, title: "Getting Started",
    intro: "Setting up Nexis takes less than five minutes. Here is how to go from zero to your first sale.",
    steps: [
      { heading: "Create your account", body: "Go to thenexux.vercel.app and click Get Started. Choose 'I own a business', fill in your name, email, and a strong password. You will receive a verification email — confirm it before signing in." },
      { heading: "Complete onboarding", body: "After your first login you are taken to the Business Setup screen. Enter your business name, choose your region, and add a phone number. These details appear on your invoices and receipts, so use the correct legal name." },
      { heading: "Explore the dashboard", body: "Once setup is complete you land on your Dashboard. Every module is in the left sidebar (desktop) or the bottom nav bar (mobile). The dashboard summarises today's sales, unpaid invoices, low-stock alerts, and more." },
    ],
    tips: [
      "Install Nexis as a PWA on your phone (tap 'Add to Home Screen' in your browser menu) for a native app experience with offline support.",
      "Dark mode is available — click the moon icon in the top bar to switch. The theme only affects the app interior, never the login or landing pages.",
    ],
  },
  {
    id: "dashboard", icon: LayoutDashboard, title: "Dashboard",
    intro: "Your command centre. Everything important at a glance, updating in real time.",
    steps: [
      { heading: "Top KPI cards", body: "The first row shows Today's Sales (with % change vs yesterday), Unpaid Invoices, Low-Stock Items, and Total Customers. Below that is Inventory Margin, Retail Value, Month Expenses, and Bank Balance." },
      { heading: "Weekly sales chart", body: "An area chart shows your last 7 days of revenue. The line colour adapts to your light/dark theme setting automatically." },
      { heading: "Recent transactions", body: "The last 8 sales appear with customer name, payment method, and amount. Managers can void a sale by clicking the X icon — this reverses stock and marks the sale as voided." },
      { heading: "Quick Actions", body: "The bottom panel has shortcuts to POS, Inventory, Customers, Reports, Financials, and Settings — useful on mobile where the full sidebar is hidden." },
    ],
    tips: [
      "Dashboard stats update live when a new sale is made on any device in your business.",
      "The Low Stock panel shows up to 6 items — click 'View All' to go straight to Inventory filtered by low stock.",
    ],
  },
  {
    id: "pos", icon: ShoppingCart, title: "Point of Sale (POS)",
    intro: "The fastest way to record a sale. Works on any device, online or offline.",
    steps: [
      { heading: "Adding products", body: "Search by name or scan a barcode (if your device has a camera). Tap a product card to add it to the cart. Use + and − to adjust quantity. Items with no stock are shown in red and cannot be added." },
      { heading: "Applying a discount", body: "In the cart panel, there is a Discount field. Enter a percentage (e.g. 10 for 10% off) or a fixed GHS amount. The total updates instantly. Discounts above 10% may trigger an approval request depending on your role settings." },
      { heading: "Loyalty points", body: "If a customer is selected before checkout, Nexis shows their current loyalty balance. Points are awarded automatically based on the sale total. Customers can redeem points as a discount on future visits." },
      { heading: "Payment & split payments", body: "Select a payment method: Cash, MTN MoMo, Telecel Cash, AirtelTigo Money, Card, or Bank Transfer. For split payments click 'Split Payment', add each method and amount — Nexis validates that the total matches before allowing checkout." },
      { heading: "MoMo collection", body: "If you have configured your Hubtel credentials in Settings → MoMo Setup, you can request a mobile money payment from the customer's phone directly from the POS. The customer receives a USSD prompt to approve the payment." },
      { heading: "Offline mode", body: "If your internet goes down, the POS switches to offline mode automatically. Sales are queued locally and synced to the cloud the moment connectivity is restored. The offline indicator appears in the top bar." },
    ],
    tips: [
      "Press Enter after scanning a barcode to add the item instantly without clicking.",
      "Walk-in sales do not require a customer — simply skip customer selection and proceed to payment.",
      "Receipts can be printed or shared as PDF from the sale confirmation screen.",
    ],
  },
  {
    id: "inventory", icon: Package, title: "Inventory",
    intro: "Track every product, every unit, in real time. Stock deducts automatically with every POS sale.",
    steps: [
      { heading: "Adding a product", body: "Click Add Product and fill in: Name, Category, Cost Price, Selling Price, and Opening Stock. Optionally add a barcode and set a Reorder Level (the quantity that triggers a low-stock alert). Click Save." },
      { heading: "Adjusting stock", body: "Open any product and click Adjust Stock to log a manual stock-in (received goods, returned items) or stock-out (damaged, expired). A reason note is required. All adjustments are logged with timestamp and staff name." },
      { heading: "Low-stock alerts", body: "When a product's quantity falls at or below its Reorder Level, it appears on the Low Stock banner at the top of every page and on the Dashboard. You also receive an in-app notification." },
      { heading: "Barcodes", body: "Each product can store a barcode string. The POS camera scanner reads standard EAN-13 and QR codes. You can also type a barcode in the POS search bar." },
    ],
    tips: [
      "Use categories (e.g. 'Beverages', 'Electronics', 'Cosmetics') to filter and organise large product lists.",
      "Export your full inventory list to CSV for use in Excel from the Export button.",
    ],
  },
  {
    id: "invoices", icon: FileText, title: "Invoices",
    intro: "Professional, sequentially numbered invoices with Ghana tax computed automatically.",
    steps: [
      { heading: "Creating an invoice", body: "Click New Invoice. Select or type a customer name, choose a due date, and add line items. Each item has a description, quantity, and unit price. Nexis computes subtotal, any applicable taxes, and the total." },
      { heading: "Ghana tax (VAT, NHIL, GETFL)", body: "In Settings you can enable VAT (15%), NHIL (2.5%), and GETFL (2.5%). When enabled, they are computed automatically on every invoice and clearly itemised — exactly as required for GRA compliance." },
      { heading: "Invoice numbering", body: "Invoices are numbered in the format NXG-YYYY-NNN (e.g. NXG-2026-001). Numbers are assigned atomically — even if two invoices are created simultaneously, they will never share a number." },
      { heading: "Sending & exporting", body: "Click Send to email the invoice directly to the customer. Click Export PDF to download a print-ready PDF that includes your logo, business address, and payment instructions." },
      { heading: "Marking as paid", body: "Open any invoice and click Mark as Paid. Choose the payment method and date. The invoice status changes to Paid and disappears from the Unpaid count on the Dashboard." },
    ],
    tips: [
      "Overdue invoices are auto-detected every morning at 07:50 UTC and trigger an in-app notification.",
      "You can apply a discount percentage to the invoice total before tax is applied.",
    ],
  },
  {
    id: "customers", icon: Users, title: "Customers",
    intro: "Your CRM. Build a real relationship with every customer — from first visit to loyal regular.",
    steps: [
      { heading: "Adding a customer", body: "Click Add Customer. Fill in their name, phone number, and optionally email and region. Every customer automatically gets a loyalty balance starting at 0 points." },
      { heading: "Customer history", body: "Click any customer to see all their past sales, invoices, and loyalty transactions. You can also see their total spend and average order value." },
      { heading: "Loyalty programme", body: "Points are earned with every purchase (1 point per GH₵ 1 spent by default). Customers can redeem points as a GHS discount at checkout. You can manually adjust points from the customer profile." },
    ],
    tips: [
      "Searching in the POS by phone number brings up the matching customer instantly.",
      "Customer data is never shared across businesses — each account's data is fully isolated.",
    ],
  },
  {
    id: "expenses", icon: Receipt, title: "Expenses",
    intro: "Log and categorise every cedi spent. Know exactly where your money goes.",
    steps: [
      { heading: "Logging an expense", body: "Click Log Expense. Select a category (Rent, Salaries, Utilities, Transport, etc.), enter the amount, choose the payment method, and add an optional description. You can also attach a receipt photo." },
      { heading: "Date filters & quick ranges", body: "The Expenses page has From / To date pickers plus quick buttons: This Month, Last Month, Last 3 Months, Last 6 Months. All charts and totals update to match the selected range." },
      { heading: "Analytics", body: "The Overview tab shows a 6-month trend line and a category pie chart. The Analytics tab shows monthly bar charts, payment method breakdown, and a category ranking with spend percentage bars." },
    ],
    tips: [
      "Export filtered expense data to CSV for your accountant using the Export button.",
      "Compare your period total to the previous period — Nexis shows the percentage change automatically.",
    ],
  },
  {
    id: "reports", icon: BarChart2, title: "Reports",
    intro: "Deep financial insights. Sales trends, product performance, and staff leaderboards.",
    steps: [
      { heading: "Sales reports", body: "View daily, weekly, and monthly revenue charts. Filter by date range and payment method. See your best-selling products and your busiest hours of the day." },
      { heading: "Product performance", body: "A ranked list of products by quantity sold and revenue generated. Identify your heroes and dead stock in seconds." },
      { heading: "Exporting data", body: "Every table in Reports has a CSV export button. Exports include all columns visible in the view, respecting the active date filter." },
    ],
    tips: ["Reports is restricted to Manager and above roles by default."],
  },
  {
    id: "staff", icon: UserCog, title: "Staff Management",
    intro: "Each team member has their own secure account. Roles define what they can see and do.",
    steps: [
      { heading: "Adding staff — email invite (recommended)", body: "Click Add Staff and fill in the staff member's name, role, and email address. When an email is provided, Nexis sends them a secure login invitation. They click the link in their email to set their own password and access Nexis from any device." },
      { heading: "Adding staff — PIN only (kiosk mode)", body: "If the staff member will only use a shared shop device, leave the email blank and set a 6-digit PIN instead. They log in by entering their PIN on the shared device. Both methods can coexist in the same team." },
      { heading: "How staff join on their own device", body: "Share your Business Access Code (shown at the top of the Staff page). Staff go to thenexux.vercel.app/register, create their account, then enter the code when prompted. They are linked to your business automatically." },
      { heading: "Changing a staff member's role", body: "In the staff table, click ⋮ → Change Role and select the new role. The change is instant. You can also change the role from the staff member's profile card." },
      { heading: "Built-in roles", body: "Administrator — full access.\nManager — all core modules plus reports.\nSupervisor — POS, inventory, invoices, customers, reports.\nCashier — POS and customers only.\nSales Rep — POS, customers, invoices.\nWarehouse — inventory and suppliers.\nAccountant — expenses, invoices, reports.\nStaff — POS and inventory." },
      { heading: "Deactivating vs removing", body: "Deactivating blocks access without deleting the account — useful for seasonal staff or staff on leave. Removing permanently revokes access; historical sales records are preserved." },
    ],
    tips: [
      "The Business Access Code never expires. Share it freely with legitimate team members.",
      "Owners always have full access regardless of role settings.",
      "Use the Roles tab to build custom roles with fine-grained CRUD permissions per module.",
    ],
  },
  {
    id: "rbac", icon: Shield, title: "Roles & Permissions (RBAC)",
    intro: "Enterprise-grade access control. Define exactly what each role can create, read, update, delete, and approve — per module.",
    steps: [
      { heading: "System roles", body: "Nexis ships with 8 built-in system roles (Administrator, Manager, Supervisor, Cashier, Sales Rep, Warehouse, Accountant, Staff). These are read-only — they cannot be edited or deleted. They appear in the Roles tab on the Staff page." },
      { heading: "Custom roles", body: "In Staff → Roles tab, click New Role. Give it a name (e.g. 'Senior Cashier') and use the permission matrix to toggle Create, Read, Update, Delete, and Approve access for each of the 18 modules independently. Click Create Role to save." },
      { heading: "Assigning a custom role", body: "When adding or editing a staff member, select your custom role from the Role dropdown. The staff member immediately inherits the exact permissions defined in that custom role." },
      { heading: "Time-based access", body: "Restrict when staff can log in by setting time windows (e.g. 08:00–18:00 Monday to Friday only). This is enforced in the Africa/Accra timezone. Staff who attempt to log in outside their allowed window see a clear 'Access restricted at this time' message." },
      { heading: "What 'Approve' permission means", body: "Certain actions require approval from a Manager or above: discounts over 10%, voiding a sale, deleting an invoice, large stock adjustments, and expenses above GH₵ 500. If a staff member lacks the Approve permission, the action is queued as a pending approval request." },
      { heading: "Owner override", body: "The business owner always has full access to everything regardless of any role or permission setting. This cannot be changed." },
    ],
    tips: [
      "Custom roles are perfect for businesses with unusual team structures — e.g. a 'Stock Counter' who can read and update inventory but cannot create or delete.",
      "The lock icon next to a sidebar item means your current role does not have access to that module.",
    ],
  },
  {
    id: "approvals", icon: ClipboardList, title: "Approval Workflows",
    intro: "Sensitive actions go through an approval queue instead of executing immediately, giving managers oversight of high-impact operations.",
    steps: [
      { heading: "What triggers an approval", body: "The following actions create a pending approval request if the staff member lacks the 'Approve' permission:\n• Discounts over 10% at POS\n• Voiding a completed sale\n• Deleting an invoice\n• Manual stock adjustments\n• Expenses above GH₵ 500\n• Issuing a refund" },
      { heading: "The approval badge", body: "Managers and Administrators see an amber number badge on 'Approvals' in the sidebar showing how many requests are pending. The badge updates every 30 seconds automatically." },
      { heading: "Reviewing a request", body: "Open the Approvals page. Each request shows who submitted it, what action they want to perform, the affected record, and a timestamp. Click Review to open the detail panel. You can Approve or Reject with an optional note." },
      { heading: "After approval", body: "Approved requests execute immediately. Rejected requests notify the staff member and no action is taken. All decisions are recorded with the approver's name and timestamp." },
    ],
    tips: [
      "Approvals protect your business from unauthorised discounts and write-offs without slowing down legitimate operations.",
      "Staff submitting a request see its status update in real time — they do not need to ask the manager manually.",
    ],
  },
  {
    id: "audit-log", icon: FileSearch, title: "Audit Log",
    intro: "A tamper-proof, append-only record of every significant action taken in your system. Know who did what, when.",
    steps: [
      { heading: "What gets logged", body: "Every create, update, delete, and approve action across all modules is recorded: sales, invoices, inventory adjustments, staff changes, expense entries, role changes, and approval decisions. Entries cannot be deleted — the log is permanent." },
      { heading: "Filtering the log", body: "Use the date range picker to narrow down entries. Filter by module using the dropdown. Use the search box to find entries by staff name, action type, or record ID." },
      { heading: "Reading an entry", body: "Each log entry shows: the timestamp (Africa/Accra timezone), the staff member who performed the action, the module and action type, the affected record ID, and the old and new values where applicable." },
      { heading: "Exporting", body: "Click Export CSV to download the current filtered view as a spreadsheet. Useful for compliance audits, accountant reviews, or investigations." },
    ],
    tips: [
      "The Audit Log is visible to Administrator role only.",
      "Nexis loads 50 entries per page. Use the date filters to narrow down to the period you need.",
      "The log is stored with row-level security — even the database administrator cannot delete entries.",
    ],
  },
  {
    id: "erp", icon: Layers, title: "ERP Modules",
    intro: "Nexis includes a full suite of ERP modules for growing businesses. Access depends on your subscription tier.",
    steps: [
      { heading: "Financials (GL & Chart of Accounts)", body: "A full general ledger with a chart of accounts. Record journal entries, view trial balances, and generate profit & loss statements. Access: Finance tier and above." },
      { heading: "Banking", body: "Manage multiple bank accounts. Record deposits, withdrawals, and transfers. Reconcile your bank statement against Nexis records to ensure accuracy. Access: Finance tier and above." },
      { heading: "CRM (Leads & Opportunities)", body: "Track sales leads through a pipeline: Lead → Qualified → Proposal → Won/Lost. Log activities against each opportunity and forecast revenue from your pipeline. Access: Sales & CRM tier." },
      { heading: "Sales Orders", body: "Create sales orders before invoicing — useful for wholesale and B2B customers who need a proforma. Convert confirmed orders to invoices in one click. Access: Sales & CRM tier." },
      { heading: "Purchasing", body: "Raise purchase orders to suppliers. When goods arrive, use the Receive Goods flow — stock is added to inventory automatically and the PO is marked as fulfilled. Access: Logistics tier." },
      { heading: "Warehouses", body: "Manage multiple storage locations. Transfer stock between warehouses. Run per-warehouse inventory reports. Ideal for businesses with multiple branches or a main store and back warehouse. Access: Logistics tier." },
      { heading: "Production & BOM", body: "Define Bills of Materials for products you manufacture. Create production orders and track raw material consumption. Finished goods are added to inventory automatically upon completion. Access: Logistics tier." },
      { heading: "MRP (Material Requirements Planning)", body: "Based on sales orders and production schedules, MRP calculates what materials you need to order and when. Prevents stock-outs on raw materials. Access: Logistics tier." },
      { heading: "Projects", body: "Plan and track projects with tasks, milestones, and a Gantt chart view. Assign tasks to staff members and track completion. Link project costs to expenses. Access: Sales & CRM tier." },
      { heading: "Service (Contracts & Equipment)", body: "Manage service contracts for customers. Track equipment under warranty or maintenance agreements. Log service visits and generate service reports. Access: Sales & CRM tier." },
      { heading: "Human Resources", body: "Maintain an employee directory with departments, job titles, and an org chart. Manage leave requests and approvals. Track leave balances per employee. Access: Professional tier." },
    ],
    tips: [
      "Locked modules show a lock icon in the sidebar. Contact us to upgrade your tier.",
      "All ERP modules share the same data — a purchase order received automatically updates inventory, which updates the dashboard and reports.",
    ],
  },
  {
    id: "settings", icon: Settings, title: "Settings",
    intro: "Configure your business profile, tax settings, receipt appearance, and MoMo integration.",
    steps: [
      { heading: "Business profile", body: "Update your business name, phone, email, region, and address. Upload your logo (displayed on invoices and receipts). Changes apply immediately." },
      { heading: "Tax configuration", body: "Toggle VAT (15%), NHIL (2.5%), and GETFL (2.5%) on or off. When enabled, these are calculated and displayed on every invoice automatically." },
      { heading: "Receipt customisation", body: "Set a custom header message (e.g. 'Thank you for shopping with us!') and footer message (e.g. 'No exchange without receipt'). Toggle whether your logo appears on receipts." },
      { heading: "MoMo merchant setup", body: "Enter your Hubtel Client ID and Client Secret for MTN MoMo, Telecel Cash, and AirtelTigo Money. This enables the 'Request MoMo Payment' button in the POS. Credentials are encrypted at rest." },
    ],
    tips: ["Settings is restricted to Administrator role by default."],
  },
  {
    id: "theme", icon: Moon, title: "Dark & Light Mode",
    intro: "Nexis fully supports both dark and light themes. Your preference is saved and applied instantly.",
    steps: [
      { heading: "Switching the theme", body: "Click the moon icon in the top bar of any page inside the app. The theme toggles immediately — dark mode uses a deep forest/navy background with lime accents; light mode uses the cream/white palette." },
      { heading: "Scope of the theme", body: "The theme only applies inside the app (dashboard and all modules). The landing page, login page, and signup page always use the light cream palette regardless of your in-app preference." },
      { heading: "Persistence", body: "Your theme choice is saved to your browser's local storage. It is remembered on your next visit and applied instantly before the page renders — no flash of wrong theme." },
    ],
  },
  {
    id: "pwa", icon: Smartphone, title: "Mobile App (PWA)",
    intro: "Nexis is a Progressive Web App. Install it on any phone or tablet for a full app experience — no app store required.",
    steps: [
      { heading: "Installing on Android", body: "Open thenexux.vercel.app in Chrome. Tap the three-dot menu in the top right. Tap 'Add to Home Screen'. The Nexis icon appears on your home screen and opens in full-screen mode." },
      { heading: "Installing on iPhone / iPad", body: "Open thenexux.vercel.app in Safari. Tap the Share button (the box with an arrow). Scroll down and tap 'Add to Home Screen'. Name it 'Nexis' and tap Add." },
      { heading: "Offline POS", body: "Once installed, the POS works without internet. Sales made offline are queued in your phone's storage and synced automatically when you reconnect. Other modules require a connection." },
    ],
    tips: [
      "The installed PWA receives the same updates as the web version — no manual app updates needed.",
      "For best results on the POS, keep the app installed rather than using the browser tab directly.",
    ],
  },
];

const navItems = [
  { id: "getting-started", label: "Getting Started" },
  { id: "dashboard",       label: "Dashboard" },
  { id: "pos",             label: "POS" },
  { id: "inventory",       label: "Inventory" },
  { id: "invoices",        label: "Invoices" },
  { id: "customers",       label: "Customers" },
  { id: "expenses",        label: "Expenses" },
  { id: "reports",         label: "Reports" },
  { id: "staff",           label: "Staff" },
  { id: "rbac",            label: "Roles & Permissions" },
  { id: "approvals",       label: "Approvals" },
  { id: "audit-log",       label: "Audit Log" },
  { id: "erp",             label: "ERP Modules" },
  { id: "settings",        label: "Settings" },
  { id: "theme",           label: "Theme" },
  { id: "pwa",             label: "Mobile App" },
];

// ─── PDF-optimised renderer (explicit colours, larger text, no CSS vars) ────
function PdfContent() {
  return (
    <div style={{ width: 860, backgroundColor: CR, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Cover */}
      <div style={{ backgroundColor: F, padding: "72px 72px 56px", textAlign: "center" }}>
        <div style={{ display: "inline-block", backgroundColor: WH, borderRadius: 20, padding: "16px 36px 16px 24px", marginBottom: 36, boxShadow: "0 8px 40px rgba(0,0,0,0.35)" }}>
          <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 60, display: "block" }} />
        </div>
        <h1 style={{ color: WH, fontSize: 42, fontWeight: 900, margin: "0 0 10px", letterSpacing: "-2px" }}>User Guide</h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 16, margin: "0 0 6px", fontWeight: 500 }}>
          Everything you need to get the most out of Nexis
        </p>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, margin: 0 }}>Updated {LAST_UPDATED} · thenexux.vercel.app</p>
      </div>

      {/* Table of contents */}
      <div style={{ backgroundColor: WH, padding: "40px 72px", borderBottom: `2px solid ${BD}` }}>
        <p style={{ fontSize: 10, fontWeight: 900, color: "#7a9b7a", textTransform: "uppercase", letterSpacing: "2px", margin: "0 0 16px" }}>Contents</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 40px" }}>
          {sections.map((s, i) => (
            <p key={s.id} style={{ margin: 0, fontSize: 14, color: FM, fontWeight: 600 }}>
              <span style={{ color: "#7a9b7a", marginRight: 8, fontWeight: 900 }}>{String(i + 1).padStart(2, "0")}</span>
              {s.title}
            </p>
          ))}
        </div>
      </div>

      {/* Sections */}
      {sections.map((sec, si) => (
        <div key={sec.id} style={{ padding: "44px 72px", borderBottom: `1px solid ${BD}`, backgroundColor: si % 2 === 0 ? CR : "#f3f0e8" }}>
          {/* Section heading */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, paddingBottom: 14, borderBottom: `2px solid ${BD}` }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: F, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: LM, fontSize: 18, fontWeight: 900, lineHeight: 1 }}>
                {String(si + 1).padStart(2, "0")}
              </span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: F, margin: 0, letterSpacing: "-0.8px" }}>
              {sec.title}
            </h2>
          </div>

          {/* Intro */}
          <p style={{ fontSize: 15, color: FL, fontWeight: 600, margin: "0 0 20px", lineHeight: 1.65 }}>
            {sec.intro}
          </p>

          {/* Steps */}
          {sec.steps.map((step, i) => (
            <div key={i} style={{
              backgroundColor: WH,
              borderRadius: 10,
              padding: "14px 18px",
              marginBottom: 10,
              border: `1px solid ${BD}`,
              display: "flex",
              gap: 14,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7,
                backgroundColor: F, color: LM,
                fontSize: 12, fontWeight: 900,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, marginTop: 1,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: F, margin: "0 0 5px" }}>{step.heading}</p>
                <p style={{ fontSize: 14, color: FM, margin: 0, lineHeight: 1.6, whiteSpace: "pre-line", fontWeight: 500 }}>{step.body}</p>
              </div>
            </div>
          ))}

          {/* Tips */}
          {sec.tips && sec.tips.length > 0 && (
            <div style={{ backgroundColor: "#e8f5e8", borderRadius: 10, padding: "14px 18px", marginTop: 12, border: "1px solid #c5dfc5" }}>
              <p style={{ fontSize: 10, fontWeight: 900, color: "#4a7a4a", textTransform: "uppercase", letterSpacing: "2px", margin: "0 0 10px" }}>Tips</p>
              {sec.tips.map((tip, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < sec.tips!.length - 1 ? 8 : 0 }}>
                  <span style={{ color: F, fontWeight: 900, fontSize: 14, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <p style={{ fontSize: 14, color: "#2d5230", margin: 0, fontWeight: 600, lineHeight: 1.55 }}>{tip}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Back cover */}
      <div style={{ backgroundColor: F, padding: "48px 72px", textAlign: "center" }}>
        <div style={{ display: "inline-block", backgroundColor: WH, borderRadius: 14, padding: "10px 28px 10px 18px", marginBottom: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
          <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 40, display: "block" }} />
        </div>
        <h3 style={{ color: WH, fontSize: 22, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.5px" }}>Need help?</h3>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, margin: "0 0 20px", fontWeight: 500 }}>Our team is here for you. Reach out any time.</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ backgroundColor: LM, color: F, padding: "10px 24px", borderRadius: 100, fontSize: 14, fontWeight: 800 }}>gengenesix@gmail.com</span>
          <span style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)", padding: "10px 24px", borderRadius: 100, fontSize: 14, fontWeight: 700, border: "1px solid rgba(255,255,255,0.2)" }}>+233 534 788 852</span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, margin: "28px 0 0", fontWeight: 500 }}>
          © 2026 Nexis · By GENESIS · User Guide v3.0
        </p>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function UserGuide() {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading || !pdfRef.current) return;
    setDownloading(true);
    const el = pdfRef.current;

    // Briefly unhide the PDF div so html2canvas can measure & render it
    el.style.left = "0px";
    el.style.zIndex = "9999";

    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: CR,
        logging: false,
        width: 860,
        windowWidth: 860,
      });

      el.style.left = "-9999px";
      el.style.zIndex = "-1";

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = 210;
      const pageH = 297;
      const imgH = (canvas.height / canvas.width) * pageW;

      pdf.addImage(imgData, "JPEG", 0, 0, pageW, imgH);

      let heightLeft = imgH - pageH;
      let offset = -pageH;
      while (heightLeft > 0) {
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, offset, pageW, imgH);
        heightLeft -= pageH;
        offset -= pageH;
      }

      pdf.save("Nexis-User-Guide.pdf");
    } catch (err) {
      console.error("PDF generation failed:", err);
      el.style.left = "-9999px";
      el.style.zIndex = "-1";
    }

    setDownloading(false);
  };

  return (
    <>
      {/* Hidden PDF content — off-screen, captured by html2canvas on demand */}
      <div
        ref={pdfRef}
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          zIndex: -1,
          pointerEvents: "none",
        }}
      >
        <PdfContent />
      </div>

      <div
        className="min-h-screen"
        style={{ backgroundColor: "var(--cream)", color: "var(--forest)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
      >
        {/* ── Top bar ── */}
        <div
          className="sticky top-0 z-10 h-14 flex items-center px-6 lg:px-8"
          style={{ backgroundColor: "var(--forest)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
            <Link to="/" style={{ textDecoration: "none" }}>
              <div style={{
                backgroundColor: "white", borderRadius: 10,
                padding: "4px 14px 4px 7px", display: "inline-flex",
                alignItems: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}>
                <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 34, display: "block" }} />
              </div>
            </Link>
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </div>
        </div>

        {/* ── Hero ── */}
        <div style={{ backgroundColor: "var(--forest)" }} className="pb-20 pt-14">
          <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
              <div style={{
                backgroundColor: "white", borderRadius: 24,
                padding: "18px 36px 18px 24px", display: "inline-flex",
                alignItems: "center",
                boxShadow: "0 12px 60px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
                border: "2px solid rgba(255,255,255,0.3)",
              }}>
                <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 64, display: "block" }} />
              </div>
            </div>

            <h1
              className="font-extrabold text-white mb-3"
              style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)", letterSpacing: "-0.04em" }}
            >
              User Guide
            </h1>
            <p style={{ color: "rgba(255,255,255,0.5)", fontWeight: 500, fontSize: 15 }}>
              Everything you need to get the most out of Nexis · Updated {LAST_UPDATED}
            </p>

            {/* Download button */}
            <div className="flex justify-center mt-6">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold transition-all active:scale-95"
                style={{
                  backgroundColor: downloading ? "rgba(200,240,66,0.6)" : "var(--lime)",
                  color: "var(--forest)",
                  cursor: downloading ? "wait" : "pointer",
                  boxShadow: "0 4px 20px rgba(200,240,66,0.3)",
                }}
              >
                <Download className="h-4 w-4" />
                {downloading ? "Generating PDF…" : "Download PDF"}
              </button>
            </div>

            {/* Quick-nav pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-8">
              {navItems.map(n => (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  className="px-4 py-1.5 rounded-full text-xs font-bold transition-all hover:opacity-90"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.75)",
                    textDecoration: "none",
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  {n.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="py-16 pb-28">
          <div className="mx-auto max-w-4xl px-6 lg:px-8 space-y-20">
            {sections.map((sec) => (
              <section key={sec.id} id={sec.id}>
                <div
                  className="flex items-center gap-3 mb-6 pb-4"
                  style={{ borderBottom: "2px solid hsl(var(--border))" }}
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
                    style={{ backgroundColor: "var(--forest)" }}
                  >
                    <sec.icon className="h-5 w-5" style={{ color: "var(--lime)" }} strokeWidth={1.8} />
                  </div>
                  <h2
                    className="font-extrabold"
                    style={{ fontSize: "clamp(1.25rem, 2.5vw, 1.625rem)", color: "var(--forest)", letterSpacing: "-0.03em" }}
                  >
                    {sec.title}
                  </h2>
                </div>

                <p className="text-base font-medium mb-8 leading-relaxed" style={{ color: "hsl(140,12%,42%)" }}>
                  {sec.intro}
                </p>

                <div className="space-y-5">
                  {sec.steps.map((step, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-5"
                      style={{ backgroundColor: "white", border: "1px solid hsl(var(--border))", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-xs font-black mt-0.5"
                          style={{ backgroundColor: "var(--forest)", color: "var(--lime)" }}
                        >
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-bold text-sm mb-1.5" style={{ color: "var(--forest)" }}>{step.heading}</p>
                          <p className="text-sm leading-relaxed font-medium" style={{ color: "hsl(140,10%,44%)", whiteSpace: "pre-line" }}>{step.body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {sec.tips && sec.tips.length > 0 && (
                  <div
                    className="mt-5 rounded-xl p-4 space-y-2.5"
                    style={{ backgroundColor: "hsl(140,22%,96%)", border: "1px solid hsl(140,18%,88%)" }}
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "hsl(140,20%,48%)" }}>Tips</p>
                    {sec.tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "var(--forest)" }} />
                        <p className="text-sm font-medium leading-relaxed" style={{ color: "hsl(140,12%,38%)" }}>{tip}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}

            {/* Contact */}
            <section className="rounded-2xl p-8 text-center" style={{ backgroundColor: "var(--forest)" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div style={{ backgroundColor: "white", borderRadius: 14, padding: "10px 22px 10px 14px", display: "inline-flex", alignItems: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
                  <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 40, display: "block" }} />
                </div>
              </div>
              <h3 className="font-extrabold text-white mb-3" style={{ fontSize: "1.5rem", letterSpacing: "-0.03em" }}>Need help?</h3>
              <p className="font-medium mb-6" style={{ color: "rgba(255,255,255,0.55)", fontSize: 15 }}>Our team is here for you. Reach out any time.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href="mailto:gengenesix@gmail.com" className="px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90" style={{ backgroundColor: "var(--lime)", color: "var(--forest)", textDecoration: "none" }}>
                  gengenesix@gmail.com
                </a>
                <a href="tel:+233534788852" className="px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-80" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", textDecoration: "none", border: "1px solid rgba(255,255,255,0.2)" }}>
                  +233 534 788 852
                </a>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div style={{ backgroundColor: "var(--forest)", borderTop: "1px solid rgba(255,255,255,0.08)" }} className="py-8">
          <div className="mx-auto max-w-4xl px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div style={{ backgroundColor: "white", borderRadius: 10, padding: "5px 14px 5px 7px", display: "inline-flex", alignItems: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
              <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 32, display: "block" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>
              © 2026 Nexis · By GENESIS · User Guide v3.0
            </p>
            <Link to="/register" className="px-5 py-2 rounded-full text-sm font-bold transition-all hover:opacity-90" style={{ backgroundColor: "var(--lime)", color: "var(--forest)", textDecoration: "none" }}>
              Get Started Free
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
