import { Link } from "react-router-dom";
import {
  ArrowLeft, LayoutDashboard, ShoppingCart, Package, FileText, Users,
  Truck, Receipt, BarChart2, UserCog, Settings, Moon, Smartphone,
  ChevronRight, Shield, Key, Wifi, WifiOff, Globe, Nfc, CheckCircle2,
} from "lucide-react";

const LAST_UPDATED = "14 May 2026";

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
    id: "getting-started",
    icon: Globe,
    title: "Getting Started",
    intro: "Setting up Nexis takes less than five minutes. Here is how to go from zero to your first sale.",
    steps: [
      {
        heading: "Create your account",
        body: "Go to thenexux.vercel.app and click Get Started. Choose 'I own a business', fill in your name, email, and a strong password. You will receive a verification email — confirm it before signing in.",
      },
      {
        heading: "Complete onboarding",
        body: "After your first login you are taken to the Business Setup screen. Enter your business name, choose your region, and add a phone number. These details appear on your invoices and receipts, so use the correct legal name.",
      },
      {
        heading: "Explore the dashboard",
        body: "Once setup is complete you land on your Dashboard. Every module is in the left sidebar (desktop) or the bottom nav bar (mobile). The dashboard summarises today's sales, unpaid invoices, low-stock alerts, and more.",
      },
    ],
    tips: [
      "Install Nexis as a PWA on your phone (tap 'Add to Home Screen' in your browser menu) for a native app experience with offline support.",
      "Dark mode is available — click the moon icon in the top bar to switch.",
    ],
  },
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    intro: "Your command centre. Everything important at a glance, updating in real time.",
    steps: [
      {
        heading: "Top KPI cards",
        body: "The first row shows Today's Sales (with % change vs yesterday), Unpaid Invoices, Low-Stock Items, and Total Customers. Below that is Inventory Margin, Retail Value, Month Expenses, and Bank Balance.",
      },
      {
        heading: "Weekly sales chart",
        body: "An area chart shows your last 7 days of revenue. The line colour adapts to your light/dark theme setting automatically.",
      },
      {
        heading: "Recent transactions",
        body: "The last 8 sales appear with customer name, payment method, and amount. Managers can void a sale by clicking the X icon — this reverses stock and marks the sale as voided.",
      },
      {
        heading: "Quick Actions",
        body: "The bottom panel has shortcuts to POS, Inventory, Customers, Reports, Financials, and Settings — useful on mobile where the full sidebar is hidden.",
      },
    ],
    tips: [
      "Dashboard stats update live when a new sale is made on any device in your business.",
      "The Low Stock panel shows up to 6 items — click 'View All' to go straight to Inventory filtered by low stock.",
    ],
  },
  {
    id: "pos",
    icon: ShoppingCart,
    title: "Point of Sale (POS)",
    intro: "The fastest way to record a sale. Works on any device, online or offline.",
    steps: [
      {
        heading: "Adding products",
        body: "Search by name or scan a barcode (if your device has a camera). Tap a product card to add it to the cart. Use + and − to adjust quantity. Items with no stock are shown in red and cannot be added.",
      },
      {
        heading: "Applying a discount",
        body: "In the cart panel, there is a Discount field. Enter a percentage (e.g. 10 for 10% off) or a fixed GHS amount. The total updates instantly.",
      },
      {
        heading: "Loyalty points",
        body: "If a customer is selected before checkout, Nexis shows their current loyalty balance. Points are awarded automatically based on the sale total. Customers can redeem points as a discount on future visits.",
      },
      {
        heading: "Payment & split payments",
        body: "Select a payment method: Cash, MTN MoMo, Telecel Cash, AirtelTigo Money, Card, or Bank Transfer. For split payments (e.g. part cash, part MoMo) click 'Split Payment', add each method and amount — Nexis validates that the total matches before allowing checkout.",
      },
      {
        heading: "MoMo collection",
        body: "If you have configured your Hubtel credentials in Settings → MoMo Setup, you can request a mobile money payment from the customer's phone directly from the POS. The customer receives a USSD prompt to approve the payment.",
      },
      {
        heading: "Offline mode",
        body: "If your internet goes down, the POS switches to offline mode automatically. Sales are queued locally and synced to the cloud the moment connectivity is restored. The offline indicator appears in the top bar.",
      },
    ],
    tips: [
      "Press Enter after scanning a barcode to add the item instantly without clicking.",
      "Walk-in sales do not require a customer — simply skip customer selection and proceed to payment.",
      "Receipts can be printed or shared as PDF from the sale confirmation screen.",
    ],
  },
  {
    id: "inventory",
    icon: Package,
    title: "Inventory",
    intro: "Track every product, every unit, in real time. Stock deducts automatically with every POS sale.",
    steps: [
      {
        heading: "Adding a product",
        body: "Click Add Product and fill in: Name, Category, Cost Price, Selling Price, and Opening Stock. Optionally add a barcode and set a Reorder Level (the quantity that triggers a low-stock alert). Click Save.",
      },
      {
        heading: "Adjusting stock",
        body: "Open any product and click Adjust Stock to log a manual stock-in (received goods, returned items) or stock-out (damaged, expired). A reason note is required. All adjustments are logged with timestamp and staff name.",
      },
      {
        heading: "Low-stock alerts",
        body: "When a product's quantity falls at or below its Reorder Level, it appears on the Low Stock banner at the top of every page and on the Dashboard. You also receive an in-app notification.",
      },
      {
        heading: "Barcodes",
        body: "Each product can store a barcode string. The POS camera scanner reads standard EAN-13 and QR codes. You can also type a barcode in the POS search bar.",
      },
    ],
    tips: [
      "Use categories (e.g. 'Beverages', 'Electronics', 'Cosmetics') to filter and organise large product lists.",
      "Export your full inventory list to CSV for use in Excel from the Export button.",
    ],
  },
  {
    id: "invoices",
    icon: FileText,
    title: "Invoices",
    intro: "Professional, sequentially numbered invoices with Ghana tax computed automatically.",
    steps: [
      {
        heading: "Creating an invoice",
        body: "Click New Invoice. Select or type a customer name, choose a due date, and add line items. Each item has a description, quantity, and unit price. Nexis computes subtotal, any applicable taxes, and the total.",
      },
      {
        heading: "Ghana tax (VAT, NHIL, GETFL)",
        body: "In Settings you can enable VAT (15%), NHIL (2.5%), and GETFL (2.5%). When enabled, they are computed automatically on every invoice and clearly itemised. The tax fields appear on the PDF exactly as required for GRA compliance.",
      },
      {
        heading: "Invoice numbering",
        body: "Invoices are numbered in the format NXG-YYYY-NNN (e.g. NXG-2026-001). Numbers are assigned atomically — even if two invoices are created simultaneously, they will never share a number.",
      },
      {
        heading: "Sending & exporting",
        body: "Click Send to email the invoice directly to the customer (requires email configuration). Click Export PDF to download a print-ready PDF. The PDF includes your logo, business address, and payment instructions.",
      },
      {
        heading: "Marking as paid",
        body: "Open any invoice and click Mark as Paid. Choose the payment method and date. The invoice status changes to Paid and disappears from the Unpaid count on the Dashboard.",
      },
    ],
    tips: [
      "Overdue invoices are auto-detected every morning at 07:50 UTC and trigger an in-app notification.",
      "You can apply a discount percentage to the invoice total before tax is applied.",
    ],
  },
  {
    id: "customers",
    icon: Users,
    title: "Customers",
    intro: "Your CRM. Build a real relationship with every customer — from first visit to loyal regular.",
    steps: [
      {
        heading: "Adding a customer",
        body: "Click Add Customer. Fill in their name, phone number, and optionally email and region. Every customer automatically gets a loyalty balance starting at 0 points.",
      },
      {
        heading: "Customer history",
        body: "Click any customer to see all their past sales, invoices, and loyalty transactions. You can also see their total spend and average order value.",
      },
      {
        heading: "Loyalty programme",
        body: "Points are earned with every purchase (1 point per GH₵ 1 spent by default). Customers can redeem points as a GHS discount at checkout. You can manually adjust points from the customer profile.",
      },
    ],
    tips: [
      "Searching in the POS by phone number brings up the matching customer instantly.",
      "Customer data is never shared across businesses — each account's data is fully isolated.",
    ],
  },
  {
    id: "expenses",
    icon: Receipt,
    title: "Expenses",
    intro: "Log and categorise every cedi spent. Know exactly where your money goes.",
    steps: [
      {
        heading: "Logging an expense",
        body: "Click Log Expense. Select a category (Rent, Salaries, Utilities, Transport, etc.), enter the amount, choose the payment method, and add an optional description. You can also attach a receipt photo.",
      },
      {
        heading: "Date filters & quick ranges",
        body: "The Expenses page has From / To date pickers plus quick buttons: This Month, Last Month, Last 3 Months, Last 6 Months. All charts and totals update to match the selected range.",
      },
      {
        heading: "Analytics",
        body: "The Overview tab shows a 6-month trend line and a category pie chart. The Analytics tab shows monthly bar charts, payment method breakdown, and a category ranking with spend percentage bars.",
      },
    ],
    tips: [
      "Export filtered expense data to CSV for your accountant using the Export button.",
      "Compare your period total to the previous period — Nexis shows the percentage change automatically.",
    ],
  },
  {
    id: "reports",
    icon: BarChart2,
    title: "Reports",
    intro: "Deep financial insights. Sales trends, product performance, and staff leaderboards.",
    steps: [
      {
        heading: "Sales reports",
        body: "View daily, weekly, and monthly revenue charts. Filter by date range and payment method. See your best-selling products and your busiest hours of the day.",
      },
      {
        heading: "Product performance",
        body: "A ranked list of products by quantity sold and revenue generated. Identify your heroes and dead stock in seconds.",
      },
      {
        heading: "Exporting data",
        body: "Every table in Reports has a CSV export button. Exports include all columns visible in the view, respecting the active date filter.",
      },
    ],
    tips: [
      "Reports is restricted to Manager and above roles by default. Adjust role permissions in Settings.",
    ],
  },
  {
    id: "staff",
    icon: UserCog,
    title: "Staff Management",
    intro: "Each team member has their own secure account. Roles define what they can see and do.",
    steps: [
      {
        heading: "How staff join your business",
        body: "On the Staff page, share your Business Access Code (the coloured code card at the top). Staff go to thenexux.vercel.app/register, choose 'I'm joining a team', create their own account, then sign in and enter the code when prompted. They are linked to your business automatically.",
      },
      {
        heading: "Changing a staff member's role",
        body: "In the staff table, click the ⋮ menu for any team member. Choose Change Role and select the new role from the submenu — the change is instant. You can also change the role from the staff member's profile card.",
      },
      {
        heading: "Available roles",
        body: "Administrator — full access including staff and settings.\nManager — all core modules plus reports.\nSupervisor — POS, inventory, invoices, customers, reports.\nCashier — POS and customers only.\nSales Rep — POS, customers, invoices.\nWarehouse — inventory and suppliers.\nAccountant — expenses, invoices, reports.\nStaff — POS and inventory.",
      },
      {
        heading: "Removing a staff member",
        body: "Click ⋮ → Remove Member. A confirmation dialog appears with the staff member's name. Confirm to remove them permanently. Their historical sales records are preserved — only their access is revoked.",
      },
      {
        heading: "Deactivating vs removing",
        body: "Deactivating a staff member blocks their access without deleting their account. This is useful for seasonal staff or staff on leave. Click ⋮ → Deactivate / Activate to toggle.",
      },
      {
        heading: "Kiosk / shared device mode",
        body: "If a device is shared by multiple staff (e.g. a shop counter tablet), staff can still use the legacy 6-digit PIN flow. Add a staff member with a PIN from the staff page and they can log in on the shared device by selecting their name and entering their PIN.",
      },
    ],
    tips: [
      "The Business Access Code never expires. You can share it freely with legitimate team members.",
      "Staff accounts are fully multi-tenant — a staff member's Nexis account can only see the business they joined.",
      "Owners always have full access regardless of role settings.",
    ],
  },
  {
    id: "settings",
    icon: Settings,
    title: "Settings",
    intro: "Configure your business profile, tax settings, receipt appearance, and MoMo integration.",
    steps: [
      {
        heading: "Business profile",
        body: "Update your business name, phone, email, region, and address. Upload your logo (displayed on invoices and receipts). Changes apply immediately.",
      },
      {
        heading: "Tax configuration",
        body: "Toggle VAT (15%), NHIL (2.5%), and GETFL (2.5%) on or off. When enabled, these are calculated and displayed on every invoice automatically. Always verify compliance with current GRA requirements.",
      },
      {
        heading: "Receipt customisation",
        body: "Set a custom header message (e.g. 'Thank you for shopping with us!') and footer message (e.g. 'No exchange without receipt'). Toggle whether your logo appears on receipts. Changes apply to new receipts immediately.",
      },
      {
        heading: "MoMo merchant setup",
        body: "Enter your Hubtel Client ID and Client Secret for MTN MoMo, Telecel Cash, and AirtelTigo Money independently. This enables the 'Request MoMo Payment' button in the POS. Credentials are encrypted at rest.",
      },
    ],
    tips: [
      "Settings is restricted to Administrator role by default.",
    ],
  },
  {
    id: "theme",
    icon: Moon,
    title: "Dark & Light Mode",
    intro: "Nexis fully supports both dark and light themes. Your preference is saved and applied instantly.",
    steps: [
      {
        heading: "Switching the theme",
        body: "Click the moon (🌙) icon in the top bar of any page inside the app. The theme toggles immediately — dark mode uses a deep forest/navy background with lime accents; light mode uses the cream/white palette.",
      },
      {
        heading: "Scope of the theme",
        body: "The theme only applies inside the app (dashboard and all modules). The landing page, login page, and signup page always use the light cream palette regardless of your in-app preference.",
      },
      {
        heading: "Persistence",
        body: "Your theme choice is saved to your browser's local storage. It is remembered on your next visit and applied instantly before the page renders (no flash of wrong theme).",
      },
    ],
  },
  {
    id: "pwa",
    icon: Smartphone,
    title: "Mobile App (PWA)",
    intro: "Nexis is a Progressive Web App. Install it on any phone or tablet for a full app experience with no app store required.",
    steps: [
      {
        heading: "Installing on Android",
        body: "Open thenexux.vercel.app in Chrome. Tap the three-dot menu (⋮) in the top right. Tap 'Add to Home Screen'. The Nexis icon appears on your home screen and opens in full-screen mode.",
      },
      {
        heading: "Installing on iPhone / iPad",
        body: "Open thenexux.vercel.app in Safari. Tap the Share button (the box with an arrow). Scroll down and tap 'Add to Home Screen'. Name it 'Nexis' and tap Add.",
      },
      {
        heading: "Offline POS",
        body: "Once installed, the POS works without internet. Sales made offline are queued in your phone's storage and synced automatically when you reconnect. Other modules (inventory edits, reports) require a connection.",
      },
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
  { id: "settings",        label: "Settings" },
  { id: "theme",           label: "Theme" },
  { id: "pwa",             label: "Mobile App" },
];

export default function UserGuide() {
  return (
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
              backgroundColor: "white",
              borderRadius: 10,
              padding: "4px 14px 4px 7px",
              display: "inline-flex",
              alignItems: "center",
              boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
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

      {/* ── Hero header ── */}
      <div style={{ backgroundColor: "var(--forest)" }} className="pb-20 pt-14">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          {/* Prominent logo */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
            <div style={{
              backgroundColor: "white",
              borderRadius: 24,
              padding: "18px 36px 18px 24px",
              display: "inline-flex",
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

          {/* Quick-nav pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-10">
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
              {/* Section header */}
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

              {/* Intro */}
              <p
                className="text-base font-medium mb-8 leading-relaxed"
                style={{ color: "hsl(140,12%,42%)" }}
              >
                {sec.intro}
              </p>

              {/* Steps */}
              <div className="space-y-5">
                {sec.steps.map((step, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-5"
                    style={{
                      backgroundColor: "white",
                      border: "1px solid hsl(var(--border))",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-xs font-black mt-0.5"
                        style={{ backgroundColor: "var(--forest)", color: "var(--lime)" }}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-bold text-sm mb-1.5" style={{ color: "var(--forest)" }}>
                          {step.heading}
                        </p>
                        <p className="text-sm leading-relaxed font-medium" style={{ color: "hsl(140,10%,44%)", whiteSpace: "pre-line" }}>
                          {step.body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tips */}
              {sec.tips && sec.tips.length > 0 && (
                <div
                  className="mt-5 rounded-xl p-4 space-y-2.5"
                  style={{
                    backgroundColor: "hsl(140,22%,96%)",
                    border: "1px solid hsl(140,18%,88%)",
                  }}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "hsl(140,20%,48%)" }}>
                    Tips
                  </p>
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

          {/* ── Contact section ── */}
          <section
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: "var(--forest)" }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <div style={{
                backgroundColor: "white",
                borderRadius: 14,
                padding: "10px 22px 10px 14px",
                display: "inline-flex",
                alignItems: "center",
                boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
              }}>
                <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 40, display: "block" }} />
              </div>
            </div>
            <h3
              className="font-extrabold text-white mb-3"
              style={{ fontSize: "1.5rem", letterSpacing: "-0.03em" }}
            >
              Need help?
            </h3>
            <p className="font-medium mb-6" style={{ color: "rgba(255,255,255,0.55)", fontSize: 15 }}>
              Our team is here for you. Reach out any time.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="mailto:gengenesix@gmail.com"
                className="px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90"
                style={{ backgroundColor: "var(--lime)", color: "var(--forest)", textDecoration: "none" }}
              >
                gengenesix@gmail.com
              </a>
              <a
                href="tel:+233534788852"
                className="px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-80"
                style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", textDecoration: "none", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                +233 534 788 852
              </a>
            </div>
          </section>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ backgroundColor: "var(--forest)", borderTop: "1px solid rgba(255,255,255,0.08)" }} className="py-8">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div style={{
            backgroundColor: "white",
            borderRadius: 10,
            padding: "5px 14px 5px 7px",
            display: "inline-flex",
            alignItems: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
          }}>
            <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 32, display: "block" }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>
            © 2026 Nexis · By GENESIS · User Guide v2.0
          </p>
          <Link
            to="/register"
            className="px-5 py-2 rounded-full text-sm font-bold transition-all hover:opacity-90"
            style={{ backgroundColor: "var(--lime)", color: "var(--forest)", textDecoration: "none" }}
          >
            Get Started Free
          </Link>
        </div>
      </div>
    </div>
  );
}
