import { Link } from "react-router-dom";
import {
  ScanLine, Boxes, ReceiptText, UsersRound, Wallet, BarChart2,
  BadgeCheck, Nfc, Scale, ArrowRight, Check, TrendingUp,
  Phone, Mail, Download, Star, Sparkles,
} from "lucide-react";
import { NexisWordmark, NexisBadge } from "@/components/NexisLogo";

import heroDashboard   from "@/assets/hero-dashboard.png";
import featurePos      from "@/assets/feature-pos.png";
import featureInvoicing from "@/assets/feature-invoicing.png";
import featureInventory from "@/assets/feature-inventory.png";

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
    icon: ScanLine,
    title: "Point of Sale — built for speed",
    desc: "Touch-optimised POS with barcode scanning, MoMo QR codes, split payments, loyalty points, and instant thermal receipt printing. Works fully offline.",
    image: featurePos,
  },
  {
    icon: ReceiptText,
    title: "Invoicing with Ghana tax",
    desc: "Auto-numbered invoices (NXG-YYYY-NNN) with VAT, NHIL, and GETFL computed automatically. Export to PDF and email in one click.",
    image: featureInvoicing,
  },
  {
    icon: Boxes,
    title: "Inventory that never sleeps",
    desc: "Real-time stock levels, reorder alerts, categories, and automatic deduction on every sale. Supports barcodes and warehouse transfers.",
    image: featureInventory,
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

const testimonials = [
  {
    name: "Ama Serwaa",
    role: "Owner, Serwaa's Cosmetics — Kumasi",
    text: "Nexis changed how I run my shop. Every cedi is tracked and my MoMo payments are sorted automatically.",
    initials: "AS",
  },
  {
    name: "Kwame Mensah",
    role: "Manager, FreshMart Supermarket — Accra",
    text: "The invoicing with automatic Ghana tax calculation saves me hours every week. No more manual VAT math!",
    initials: "KM",
  },
  {
    name: "Abena Osei",
    role: "Founder, TechHub GH — Takoradi",
    text: "Finally a business tool built for Ghana. The POS is lightning fast and my staff learned it in minutes.",
    initials: "AO",
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
          <Link to="/" className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
            <NexisBadge size={32} />
            <NexisWordmark onDark style={{ color: "white", fontSize: 18 }} />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {[["Features","#features"],["Pricing","#pricing"],["Reviews","#reviews"]].map(([label,href]) => (
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
      <section className="pt-28 pb-20 sm:pt-36 sm:pb-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:items-center">

            {/* Left — copy */}
            <div className="animate-fade-in">
              {/* badge pill — no colour dot, use sparkle */}
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase mb-8"
                style={{
                  backgroundColor: "white",
                  color: "var(--forest)",
                  letterSpacing: "0.08em",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <Sparkles className="h-3.5 w-3.5" style={{ color: "hsl(142,55%,38%)" }} />
                Built for Ghana business
              </div>

              <h1
                className="font-extrabold leading-[0.95] mb-6"
                style={{
                  fontSize: "clamp(3rem, 7vw, 5.25rem)",
                  letterSpacing: "-0.05em",
                  color: "var(--forest)",
                }}
              >
                The business<br />
                platform built<br />
                <span style={{ color: "hsl(142,55%,38%)" }}>for Ghana.</span>
              </h1>

              <p
                className="text-lg leading-relaxed mb-10 max-w-[460px]"
                style={{ color: "hsl(140,15%,42%)", fontWeight: 500 }}
              >
                All-in-one POS, inventory, invoicing, MoMo payments, and analytics — engineered for Ghanaian businesses that want to grow.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold text-base transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: "var(--forest)", color: "white", textDecoration: "none" }}
                >
                  Start Free — No Credit Card
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-semibold text-base transition-all hover:opacity-80"
                  style={{ backgroundColor: "white", color: "var(--forest)", border: "1px solid hsl(var(--border))", textDecoration: "none" }}
                >
                  See How It Works
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {[
                  { icon: Check,       label: "Free forever plan" },
                  { icon: TrendingUp,  label: "500+ businesses" },
                  { icon: BadgeCheck,  label: "All 16 regions" },
                ].map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-1.5 rounded-full"
                    style={{ backgroundColor: "white", color: "hsl(140,20%,38%)", border: "1px solid hsl(var(--border))" }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: "hsl(142,55%,38%)" }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — hero image */}
            <div className="mt-14 lg:mt-0 animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  boxShadow: "0 32px 100px rgba(26,58,34,0.2), 0 4px 16px rgba(26,58,34,0.08)",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <img
                  src={heroDashboard}
                  alt="Nexis Dashboard"
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "50+",   label: "Businesses served" },
              { value: "₵200k+",label: "Sales processed" },
              { value: "16",    label: "Regions covered" },
              { value: "99.9%", label: "Platform uptime" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p
                  className="text-3xl font-extrabold font-mono mb-1"
                  style={{ color: "var(--lime)", letterSpacing: "-0.04em" }}
                >
                  {s.value}
                </p>
                <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {s.label}
                </p>
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
        <div className="mx-auto max-w-7xl px-6 lg:px-8 space-y-28">
          {showcases.map((s, i) => (
            <div
              key={s.title}
              className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-20 ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}
            >
              <div className="flex-1 space-y-5">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: "var(--cream)" }}
                >
                  <s.icon className="h-6 w-6" style={{ color: "var(--forest)" }} strokeWidth={1.7} />
                </div>
                <h3
                  className="font-extrabold leading-tight"
                  style={{ fontSize: "clamp(1.5rem, 2.5vw, 2.1rem)", letterSpacing: "-0.04em", color: "var(--forest)" }}
                >
                  {s.title}
                </h3>
                <p className="text-base leading-relaxed" style={{ color: "hsl(140,10%,46%)", fontWeight: 500 }}>
                  {s.desc}
                </p>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 text-sm font-bold transition-opacity hover:opacity-70"
                  style={{ color: "hsl(142,55%,38%)", textDecoration: "none" }}
                >
                  Try it free <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="flex-1 w-full">
                <div
                  className="rounded-2xl overflow-hidden transition-transform duration-300 hover:-translate-y-1"
                  style={{
                    boxShadow: "0 20px 70px rgba(26,58,34,0.12)",
                    border: "1px solid hsl(var(--border))",
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

      {/* ── Testimonials ───────────────────────────── */}
      <section id="reviews" className="py-20 sm:py-28" style={{ backgroundColor: "white" }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2
              className="font-extrabold mb-3"
              style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.5rem)", letterSpacing: "-0.04em", color: "var(--forest)" }}
            >
              Loved by Ghana businesses
            </h2>
            <p className="text-base font-medium" style={{ color: "hsl(140,10%,46%)" }}>
              Real stories from real entrepreneurs.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl p-7"
                style={{ backgroundColor: "var(--cream)", border: "1px solid hsl(var(--border))" }}
              >
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" style={{ color: "hsl(38,92%,50%)" }} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-6 font-medium" style={{ color: "hsl(140,10%,40%)" }}>
                  "{t.text}"
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                    style={{ backgroundColor: "var(--forest)", color: "var(--lime)" }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "var(--forest)" }}>{t.name}</p>
                    <p className="text-xs font-medium" style={{ color: "hsl(140,10%,52%)" }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ───────────────────────────────── */}
      <section style={{ backgroundColor: "var(--forest)" }} className="py-24">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <h2
            className="font-extrabold text-white leading-[1.0] mb-4"
            style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.05em" }}
          >
            Ready to transform<br />your business?
          </h2>
          <p className="text-base font-medium mb-10" style={{ color: "rgba(255,255,255,0.55)" }}>
            Join hundreds of Ghanaian entrepreneurs already on Nexis.
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
            <div className="flex items-center gap-2.5">
              <NexisBadge size={32} />
              <NexisWordmark onDark style={{ color: "white", fontSize: 18 }} />
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              {[["Features","#features"],["Pricing","#pricing"],["Reviews","#reviews"]].map(([label,href]) => (
                <a
                  key={label}
                  href={href}
                  style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }}
                  className="hover:opacity-100 transition-opacity font-medium"
                >
                  {label}
                </a>
              ))}
              <Link
                to="/login"
                style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }}
                className="hover:opacity-100 transition-opacity font-medium"
              >
                Sign In
              </Link>
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
            <a
              href="/NexisGH_User_Guide.pdf"
              download
              className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.35)", textDecoration: "none" }}
            >
              <Download className="h-3.5 w-3.5" /> Download User Guide
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
