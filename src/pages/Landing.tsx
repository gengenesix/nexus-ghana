import { Link } from "react-router-dom";
import {
  ScanLine, Boxes, ReceiptText, UsersRound, Wallet, BarChart2,
  BadgeCheck, Nfc, Scale, ArrowRight, Check, WifiOff,
  Phone, Mail, Download, TrendingUp, ShoppingCart, Users, Package,
  Zap, Globe2, BookOpen,
} from "lucide-react";

import heroDashboard    from "@/assets/hero-dashboard.jpg";
import featureAnalytics from "@/assets/feature-analytics.jpg";
import featureInvoicing from "@/assets/feature-invoicing.jpg";
import featureInventory from "@/assets/feature-inventory.jpg";

const allFeatures = [
  { icon: ScanLine,    label: "Point of Sale",    desc: "Fast sales & MoMo QR payments" },
  { icon: Boxes,       label: "Inventory",         desc: "Real-time stock & reorder alerts" },
  { icon: ReceiptText, label: "Invoicing",          desc: "Tax-compliant Ghana bills (VAT+NHIL+GETFL)" },
  { icon: UsersRound,  label: "Customers",          desc: "CRM, loyalty & customer history" },
  { icon: Wallet,      label: "Expenses",           desc: "Track, categorise & analyse spending" },
  { icon: BarChart2,   label: "Reports",            desc: "Deep insights & CSV exports" },
  { icon: BadgeCheck,  label: "Staff",              desc: "Roles, PIN auth & permissions" },
  { icon: Nfc,         label: "MoMo Pay",           desc: "MTN, Vodafone & AirtelTigo" },
  { icon: Scale,       label: "Ghana Tax",          desc: "Auto VAT, NHIL & GETFL" },
];

const showcases = [
  {
    icon: BarChart2,
    tag: "Analytics",
    title: "Know your numbers in real time",
    desc: "Sales performance charts, product statistics, customer growth by region, and month-over-month comparisons — all in one clean dashboard. See Accra vs Kumasi vs Takoradi at a glance.",
    image: featureAnalytics,
    stats: [
      { label: "Total Sales", value: "GH₵ 120,540" },
      { label: "Orders", value: "1,250" },
      { label: "Customers", value: "980" },
    ],
  },
  {
    icon: ReceiptText,
    tag: "Invoicing",
    title: "Professional invoices with Ghana tax built in",
    desc: "Auto-numbered invoices (NXG-YYYY-NNN) with VAT (15%), NHIL (2.5%), and GETFL (2.5%) computed automatically. Export to PDF and email directly from the app — GCB Bank payment details included.",
    image: featureInvoicing,
    stats: [
      { label: "Auto VAT calc", value: "15%" },
      { label: "NHIL + GETFL", value: "5%" },
      { label: "Export", value: "PDF" },
    ],
  },
  {
    icon: Boxes,
    tag: "Inventory",
    title: "Inventory that never lets you run out",
    desc: "Real-time stock levels, low-stock alerts, reorder thresholds, categories, and automatic deduction on every sale. Works on desktop and mobile simultaneously — see the same live data everywhere.",
    image: featureInventory,
    stats: [
      { label: "Products tracked", value: "1,240" },
      { label: "Low stock alerts", value: "12" },
      { label: "Revenue risk", value: "GH₵ 4,200" },
    ],
  },
];

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    desc: "Solo traders just getting started.",
    features: ["1 User", "50 Products", "POS & Sales", "Basic Reports", "Email Support"],
    cta: "Get Started Free",
    popular: false,
  },
  {
    name: "Business",
    price: "GH₵ 99",
    period: "/month",
    desc: "Growing businesses that need full control.",
    features: ["5 Staff Members", "Unlimited Products", "Invoicing + Tax", "Full Analytics", "MoMo Integration", "Priority Support"],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "GH₵ 249",
    period: "/month",
    desc: "Multi-branch businesses with advanced needs.",
    features: ["Unlimited Staff", "Multi-Branch", "API Access", "Custom Branding", "Dedicated Manager", "SLA Guarantee"],
    cta: "Contact Sales",
    popular: false,
  },
];

const promises = [
  {
    icon: UsersRound,
    title: "Built for your whole team.",
    body: "From the cashier at the counter to the manager reviewing reports — everyone gets exactly what they need. Role-based access, staff PINs, and one system that keeps your entire operation in sync.",
  },
  {
    icon: Zap,
    title: "Built for the real Ghana market.",
    body: "VAT, NHIL, GETFL, MTN MoMo, Telecel Cash, AirtelTigo Money, GHS currency, GRA invoice formatting — all of it baked in, not bolted on. This is not a generic SaaS re-skinned for Africa.",
  },
  {
    icon: Globe2,
    title: "Your data is yours. Always.",
    body: "Every product, sale, customer, and invoice you create belongs to you. Export everything to CSV any time. We run on enterprise-grade infrastructure with row-level security — your business data is never shared.",
  },
  {
    icon: WifiOff,
    title: "Works when the internet doesn't.",
    body: "Erratic connectivity is a real problem in Ghana. The Nexis POS runs fully offline — sales queue locally and sync the moment you reconnect. Your checkout never stops because the WiFi did.",
  },
];

/* ─────────────────────────────────────────────────────────────── */

export default function Landing() {
  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ backgroundColor: "var(--cream)", color: "var(--forest)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >

      {/* ── Navbar ─────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center"
        style={{ backgroundColor: "var(--forest)" }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link to="/" style={{ textDecoration: "none" }}>
            <div style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: "5px 16px 5px 8px",
              display: "inline-flex",
              alignItems: "center",
              border: "1.5px solid rgba(255,255,255,0.22)",
              boxShadow: "0 2px 16px rgba(0,0,0,0.28)",
            }}>
              <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 40, display: "block" }} />
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {[["Features","#features"],["Pricing","#pricing"],["Why Nexis","#why"]].map(([label,href]) => (
              <a
                key={label}
                href={href}
                className="text-sm font-semibold transition-opacity hover:opacity-100"
                style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none" }}
              >
                {label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:block text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none" }}
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-5 py-2 rounded-full text-sm font-bold transition-all hover:opacity-90 active:scale-[0.97]"
              style={{ backgroundColor: "var(--lime)", color: "var(--forest)", textDecoration: "none" }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────── */}
      <section className="pt-28 pb-0 sm:pt-36 overflow-hidden" style={{ backgroundColor: "var(--cream)" }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

            {/* ── Left: copy — left-aligned ── */}
            <div className="flex-1 lg:max-w-[520px] w-full">
              {/* badge */}
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase mb-7"
                style={{
                  backgroundColor: "white",
                  color: "var(--forest)",
                  letterSpacing: "0.08em",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <span style={{ fontSize: "14px" }}>🇬🇭</span>
                Built for Ghana business
              </div>

              <h1
                className="font-extrabold leading-[0.93] mb-6"
                style={{
                  fontSize: "clamp(2.6rem, 5.5vw, 4.75rem)",
                  letterSpacing: "-0.05em",
                  color: "var(--forest)",
                }}
              >
                The business platform<br />
                <span style={{ color: "var(--lime)", WebkitTextStroke: "1px var(--forest)" }}>built for Ghana.</span>
              </h1>

              <p
                className="text-lg leading-relaxed mb-9"
                style={{ color: "hsl(140,15%,42%)", fontWeight: 500, maxWidth: "460px" }}
              >
                All-in-one POS, inventory, invoicing, MoMo payments, and analytics — engineered for Ghanaian businesses that want to grow.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-7">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-bold text-base transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: "var(--forest)", color: "white", textDecoration: "none" }}
                >
                  Start Free — No Credit Card
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold text-base transition-all hover:opacity-80"
                  style={{ backgroundColor: "white", color: "var(--forest)", border: "1px solid hsl(var(--border))", textDecoration: "none" }}
                >
                  See How It Works
                </a>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {[
                  { icon: Check,   label: "Free forever plan" },
                  { icon: WifiOff, label: "Works offline" },
                  { icon: Nfc,     label: "MoMo built-in" },
                ].map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-1.5 rounded-full"
                    style={{ backgroundColor: "white", color: "hsl(140,20%,38%)", border: "1px solid hsl(var(--border))" }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: "var(--forest)" }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Right: hero image with floating cards ── */}
            <div className="flex-1 w-full relative" style={{ minWidth: 0 }}>
              {/* Floating live-stats card — top left */}
              <div
                className="absolute hidden sm:flex flex-col gap-1 z-10"
                style={{
                  top: "10%",
                  left: "-18px",
                  backgroundColor: "white",
                  borderRadius: "14px",
                  padding: "14px 18px",
                  boxShadow: "0 8px 40px rgba(26,58,34,0.18)",
                  border: "1px solid hsl(var(--border))",
                  minWidth: "148px",
                }}
              >
                <span className="text-xs font-bold uppercase" style={{ color: "hsl(140,15%,58%)", letterSpacing: "0.08em" }}>Today's Sales</span>
                <span className="font-extrabold" style={{ fontSize: "1.5rem", color: "var(--forest)", letterSpacing: "-0.04em" }}>GH₵ 2,450</span>
                <span className="text-xs font-semibold flex items-center gap-1" style={{ color: "hsl(142,55%,38%)" }}>
                  <TrendingUp className="h-3 w-3" />+15.6% vs yesterday
                </span>
              </div>

              {/* Floating orders card — top right */}
              <div
                className="absolute hidden sm:flex flex-col gap-1 z-10"
                style={{
                  top: "6%",
                  right: "-16px",
                  backgroundColor: "var(--forest)",
                  borderRadius: "14px",
                  padding: "14px 18px",
                  boxShadow: "0 8px 40px rgba(26,58,34,0.3)",
                  minWidth: "138px",
                }}
              >
                <span className="text-xs font-bold uppercase" style={{ color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em" }}>Total Orders</span>
                <span className="font-extrabold" style={{ fontSize: "1.5rem", color: "var(--lime)", letterSpacing: "-0.04em" }}>320</span>
                <span className="text-xs font-semibold flex items-center gap-1" style={{ color: "rgba(255,255,255,0.55)" }}>
                  <TrendingUp className="h-3 w-3" style={{ color: "var(--lime)" }} />+8.4% this month
                </span>
              </div>

              {/* Floating low-stock alert — bottom right */}
              <div
                className="absolute hidden md:flex items-center gap-3 z-10"
                style={{
                  bottom: "14%",
                  right: "-16px",
                  backgroundColor: "white",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  boxShadow: "0 8px 32px rgba(26,58,34,0.16)",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#f59e0b", flexShrink: 0 }} />
                <div>
                  <p className="text-xs font-bold" style={{ color: "var(--forest)" }}>Low Stock Alert</p>
                  <p className="text-xs" style={{ color: "hsl(140,10%,52%)" }}>Royal Umbrella Rice — 8 left</p>
                </div>
              </div>

              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  boxShadow: "0 40px 120px rgba(26,58,34,0.22), 0 8px 24px rgba(26,58,34,0.1)",
                  border: "1px solid rgba(26,58,34,0.1)",
                }}
              >
                <img
                  src={heroDashboard}
                  alt="Nexis Dashboard on iPad in a real Ghana store"
                  className="w-full block"
                  loading="eager"
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Stats band ─────────────────────────────── */}
      <section style={{ backgroundColor: "var(--forest)" }} className="py-14">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "16px", overflow: "hidden" }}>
            {[
              { icon: TrendingUp,   headline: "GH₵ 120,540",  sub: "Monthly revenue tracked" },
              { icon: ShoppingCart, headline: "1,250+",        sub: "Orders processed" },
              { icon: Users,        headline: "980+",          sub: "Customers managed" },
              { icon: Package,      headline: "3,470",         sub: "Products sold this month" },
            ].map(({ icon: Icon, headline, sub }) => (
              <div
                key={headline}
                className="flex flex-col items-center text-center px-6 py-8 gap-3"
                style={{ backgroundColor: "transparent" }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  <Icon className="h-5 w-5" style={{ color: "var(--lime)" }} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="font-extrabold text-xl" style={{ color: "var(--lime)", letterSpacing: "-0.03em" }}>{headline}</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature grid ───────────────────────────── */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-14">
            <p
              className="text-xs font-bold uppercase mb-3"
              style={{ color: "hsl(140,20%,52%)", letterSpacing: "0.12em" }}
            >
              Everything you need
            </p>
            <h2
              className="font-extrabold leading-tight max-w-lg"
              style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.75rem)", letterSpacing: "-0.04em", color: "var(--forest)" }}
            >
              One platform.<br />Nine powerful modules.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allFeatures.map((f) => (
              <div
                key={f.label}
                className="rounded-2xl p-5 flex items-start gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  backgroundColor: "white",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  className="rounded-xl p-2.5 flex-shrink-0"
                  style={{ backgroundColor: "var(--cream)" }}
                >
                  <f.icon className="h-5 w-5" style={{ color: "var(--forest)" }} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="font-bold text-sm mb-0.5" style={{ color: "var(--forest)" }}>{f.label}</p>
                  <p className="text-xs leading-relaxed" style={{ color: "hsl(140,10%,50%)" }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature showcases ──────────────────────── */}
      <section className="py-20 sm:py-28" style={{ backgroundColor: "white" }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8 space-y-32">
          {showcases.map((s, i) => (
            <div
              key={s.title}
              className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-20 ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}
            >
              {/* Copy side */}
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center gap-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "var(--cream)" }}
                  >
                    <s.icon className="h-5 w-5" style={{ color: "var(--forest)" }} strokeWidth={1.7} />
                  </div>
                  <span
                    className="text-xs font-black uppercase"
                    style={{ color: "hsl(140,20%,52%)", letterSpacing: "0.12em" }}
                  >
                    {s.tag}
                  </span>
                </div>

                <h3
                  className="font-extrabold leading-tight"
                  style={{ fontSize: "clamp(1.6rem, 2.8vw, 2.25rem)", letterSpacing: "-0.04em", color: "var(--forest)" }}
                >
                  {s.title}
                </h3>

                <p className="text-base leading-relaxed" style={{ color: "hsl(140,10%,46%)", fontWeight: 500 }}>
                  {s.desc}
                </p>

                {/* Mini stat pills */}
                <div className="flex flex-wrap gap-3">
                  {s.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl px-4 py-2.5"
                      style={{ backgroundColor: "var(--cream)", border: "1px solid hsl(var(--border))" }}
                    >
                      <p className="text-xs font-medium" style={{ color: "hsl(140,10%,52%)" }}>{stat.label}</p>
                      <p className="font-extrabold text-sm" style={{ color: "var(--forest)", letterSpacing: "-0.02em" }}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 text-sm font-bold transition-opacity hover:opacity-70"
                  style={{ color: "var(--forest)", textDecoration: "none" }}
                >
                  Try it free <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Image side */}
              <div className="flex-1 w-full">
                <div
                  className="rounded-2xl overflow-hidden transition-transform duration-300 hover:-translate-y-1"
                  style={{
                    boxShadow: "0 24px 80px rgba(26,58,34,0.15), 0 4px 16px rgba(26,58,34,0.06)",
                    border: "1px solid rgba(26,58,34,0.08)",
                  }}
                >
                  <img
                    src={s.image}
                    alt={`${s.title} screenshot`}
                    className="w-full block"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────── */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-14">
            <p
              className="text-xs font-bold uppercase mb-3"
              style={{ color: "hsl(140,20%,52%)", letterSpacing: "0.12em" }}
            >
              Pricing
            </p>
            <h2
              className="font-extrabold mb-3"
              style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.5rem)", letterSpacing: "-0.04em", color: "var(--forest)" }}
            >
              Simple, transparent pricing
            </h2>
            <p className="text-base font-medium" style={{ color: "hsl(140,10%,46%)" }}>
              Start free, upgrade as you grow. No hidden fees.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="relative rounded-2xl p-8 flex flex-col"
                style={{
                  backgroundColor: plan.popular ? "var(--forest)" : "white",
                  border: plan.popular ? "none" : "1px solid hsl(var(--border))",
                  boxShadow: plan.popular
                    ? "0 20px 80px rgba(26,58,34,0.25)"
                    : "0 1px 4px rgba(0,0,0,0.04)",
                  transform: plan.popular ? "translateY(-8px)" : undefined,
                }}
              >
                {plan.popular && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1 rounded-full text-[11px] font-black uppercase"
                    style={{ backgroundColor: "var(--lime)", color: "var(--forest)", letterSpacing: "0.06em" }}
                  >
                    Most Popular
                  </div>
                )}

                <h3
                  className="font-extrabold text-xl mb-1"
                  style={{ color: plan.popular ? "white" : "var(--forest)", letterSpacing: "-0.03em" }}
                >
                  {plan.name}
                </h3>
                <p
                  className="text-sm mb-6 font-medium"
                  style={{ color: plan.popular ? "rgba(255,255,255,0.55)" : "hsl(140,10%,50%)" }}
                >
                  {plan.desc}
                </p>

                <div className="flex items-baseline gap-1 mb-8">
                  <span
                    className="font-extrabold font-mono"
                    style={{
                      fontSize: "clamp(2rem, 3vw, 2.75rem)",
                      color: plan.popular ? "var(--lime)" : "var(--forest)",
                      letterSpacing: "-0.05em",
                    }}
                  >
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span
                      className="text-sm font-medium"
                      style={{ color: plan.popular ? "rgba(255,255,255,0.45)" : "hsl(140,10%,52%)" }}
                    >
                      {plan.period}
                    </span>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm font-medium">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: plan.popular ? "rgba(255,255,255,0.12)" : "var(--cream)" }}
                      >
                        <Check
                          className="h-3 w-3"
                          style={{ color: plan.popular ? "var(--lime)" : "hsl(142,55%,38%)" }}
                        />
                      </div>
                      <span style={{ color: plan.popular ? "rgba(255,255,255,0.8)" : "hsl(140,10%,44%)" }}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/register"
                  className="block text-center py-3.5 rounded-full font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{
                    backgroundColor: plan.popular ? "var(--lime)" : "var(--forest)",
                    color: plan.popular ? "var(--forest)" : "white",
                    textDecoration: "none",
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Nexis (honest section) ─────────────── */}
      <section id="why" className="py-20 sm:py-28" style={{ backgroundColor: "white" }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">

          {/* Heading */}
          <div className="mb-14 max-w-2xl">
            <p
              className="text-xs font-bold uppercase mb-3"
              style={{ color: "hsl(140,20%,52%)", letterSpacing: "0.12em" }}
            >
              Why Nexis
            </p>
            <h2
              className="font-extrabold mb-4 leading-tight"
              style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.75rem)", letterSpacing: "-0.04em", color: "var(--forest)" }}
            >
              We're new.<br />And we built it right.
            </h2>
            <p className="text-base font-medium leading-relaxed" style={{ color: "hsl(140,10%,46%)", maxWidth: 520 }}>
              Four things that set Nexis apart — built into the product from day one,
              not added as an afterthought.
            </p>
          </div>

          {/* Promise cards */}
          <div className="grid sm:grid-cols-2 gap-5 mb-16">
            {promises.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl p-7 flex flex-col gap-4"
                style={{
                  backgroundColor: "var(--cream)",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "var(--forest)" }}
                >
                  <p.icon className="h-5 w-5" style={{ color: "var(--lime)" }} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="font-extrabold text-base mb-2" style={{ color: "var(--forest)", letterSpacing: "-0.02em" }}>
                    {p.title}
                  </p>
                  <p className="text-sm leading-relaxed font-medium" style={{ color: "hsl(140,10%,44%)" }}>
                    {p.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Founder statement */}
          <div
            className="rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-start gap-8"
            style={{ backgroundColor: "var(--forest)" }}
          >
            <div
              className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "var(--lime)" }}
            >
              <img src="/brand/nexis-icon-green.png" alt="Nexis" style={{ width: 40, height: 40, borderRadius: 8 }} />
            </div>
            <div>
              <p
                className="font-extrabold text-white mb-3 leading-snug"
                style={{ fontSize: "clamp(1.1rem, 2vw, 1.375rem)", letterSpacing: "-0.025em" }}
              >
                "We built Nexis because we got tired of watching Ghanaian business owners
                manage growing companies on WhatsApp, exercise books, and spreadsheets.
                They deserve better tools."
              </p>
              <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                — GENESIS, Founders of Nexis
              </p>
              <div className="mt-5 flex gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm transition-all hover:opacity-90"
                  style={{ backgroundColor: "var(--lime)", color: "var(--forest)", textDecoration: "none" }}
                >
                  Start Free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/user-guide"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm transition-all hover:opacity-80"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", textDecoration: "none", border: "1px solid rgba(255,255,255,0.18)" }}
                >
                  <BookOpen className="h-4 w-4" /> Read the Guide
                </Link>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── CTA band ───────────────────────────────── */}
      <section style={{ backgroundColor: "var(--forest)" }} className="py-24">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <div style={{
              backgroundColor: "white",
              borderRadius: 14,
              padding: "7px 20px 7px 10px",
              display: "inline-flex",
              alignItems: "center",
              border: "1.5px solid rgba(255,255,255,0.22)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}>
              <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 44, display: "block" }} />
            </div>
          </div>
          <h2
            className="font-extrabold text-white leading-[1.0] mb-4"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.05em" }}
          >
            Ready to transform<br />your business?
          </h2>
          <p className="text-base font-medium mb-10" style={{ color: "rgba(255,255,255,0.55)" }}>
            Start free. No credit card. Built for every Ghanaian business.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2.5 px-10 py-4 rounded-full font-bold text-base transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: "var(--lime)", color: "var(--forest)", textDecoration: "none" }}
          >
            Get Started for Free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────── */}
      <footer
        className="py-12"
        style={{ backgroundColor: "var(--forest)", borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div style={{
              backgroundColor: "white",
              borderRadius: 12,
              padding: "5px 16px 5px 8px",
              display: "inline-flex",
              alignItems: "center",
              border: "1.5px solid rgba(255,255,255,0.22)",
              boxShadow: "0 2px 16px rgba(0,0,0,0.28)",
            }}>
              <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 38, display: "block" }} />
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              {[["Features","#features"],["Pricing","#pricing"],["Why Nexis","#why"]].map(([label,href]) => (
                <a
                  key={label}
                  href={href}
                  style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }}
                  className="hover:opacity-100 transition-opacity font-medium"
                >
                  {label}
                </a>
              ))}
              <Link to="/user-guide" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }} className="hover:opacity-100 transition-opacity font-medium">User Guide</Link>
              <Link to="/terms" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }} className="hover:opacity-100 transition-opacity font-medium">Terms</Link>
              <Link to="/login" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }} className="hover:opacity-100 transition-opacity font-medium">Sign In</Link>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 text-sm">
              <a
                href="tel:+233534788852"
                className="flex items-center gap-1.5 font-medium transition-opacity hover:opacity-80"
                style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}
              >
                <Phone className="h-4 w-4" /> +233 534 788 852
              </a>
              <a
                href="mailto:gengenesix@gmail.com"
                className="flex items-center gap-1.5 font-medium transition-opacity hover:opacity-80"
                style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}
              >
                <Mail className="h-4 w-4" /> gengenesix@gmail.com
              </a>
            </div>
          </div>

          <div
            className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
          >
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.28)" }}>
              © 2026 Nexis · By GENESIS
            </p>
            <div className="flex items-center gap-5">
              <Link
                to="/user-guide"
                className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}
              >
                <BookOpen className="h-3.5 w-3.5" /> User Guide
              </Link>
              <Link
                to="/terms"
                className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
