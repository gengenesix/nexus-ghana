import { Link } from "react-router-dom";
import {
  ShoppingCart, Package, FileText, BarChart3, Users, Receipt,
  ArrowRight, Check, Shield, Globe, Smartphone,
  TrendingUp, Phone, Mail, Download, Star,
} from "lucide-react";

import heroDashboard from "@/assets/hero-dashboard.png";
import featurePos from "@/assets/feature-pos.png";
import featureInvoicing from "@/assets/feature-invoicing.png";
import featureInventory from "@/assets/feature-inventory.png";

const allFeatures = [
  { icon: ShoppingCart, label: "Point of Sale", desc: "Fast sales & MoMo payments" },
  { icon: Package, label: "Inventory", desc: "Real-time stock tracking" },
  { icon: FileText, label: "Invoicing", desc: "Tax-compliant Ghana bills" },
  { icon: Users, label: "Customers", desc: "CRM & loyalty points" },
  { icon: Receipt, label: "Expenses", desc: "Track & categorise spending" },
  { icon: BarChart3, label: "Reports", desc: "Business insights & exports" },
  { icon: Shield, label: "Staff", desc: "Roles, PINs & permissions" },
  { icon: Smartphone, label: "MoMo Pay", desc: "MTN, Vodafone & AirtelTigo" },
  { icon: Globe, label: "Ghana Tax", desc: "Auto VAT, NHIL & GETFL" },
];

const showcases = [
  {
    icon: ShoppingCart,
    title: "Point of Sale — built for speed",
    desc: "Touch-optimised POS with barcode scanning, MoMo QR codes, split payments, and instant thermal receipt printing. Works fully offline.",
    image: featurePos,
  },
  {
    icon: FileText,
    title: "Invoicing with Ghana tax",
    desc: "Auto-numbered invoices (NXG-YYYY-NNN) with VAT, NHIL, and GETFL computed automatically. Export to PDF and email in one click.",
    image: featureInvoicing,
  },
  {
    icon: Package,
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
    text: "Nexus-GH changed how I run my shop. Every cedi is tracked and my MoMo payments are sorted automatically.",
    rating: 5,
    initials: "AS",
  },
  {
    name: "Kwame Mensah",
    role: "Manager, FreshMart Supermarket — Accra",
    text: "The invoicing with automatic Ghana tax calculation saves me hours every week. No more manual VAT math!",
    rating: 5,
    initials: "KM",
  },
  {
    name: "Abena Osei",
    role: "Founder, TechHub GH — Takoradi",
    text: "Finally a business tool built for Ghana. The POS is lightning fast and my staff learned it in minutes.",
    rating: 5,
    initials: "AO",
  },
];

export default function Landing() {
  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ backgroundColor: "var(--cream)", color: "var(--forest)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* ── Navbar ─────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center"
        style={{ backgroundColor: "var(--forest)", borderBottom: "none" }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs"
              style={{ backgroundColor: "var(--lime)", color: "var(--forest)" }}
            >
              NX
            </div>
            <span
              className="text-white font-extrabold text-lg"
              style={{ letterSpacing: "-0.03em" }}
            >
              Nexus-GH
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            {["Features", "Pricing", "Reviews"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm font-medium transition-opacity hover:opacity-100"
                style={{ color: "rgba(255,255,255,0.65)", textDecoration: "none" }}
              >
                {item}
              </a>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:block text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none" }}
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-5 py-2 rounded-full text-sm font-bold transition-all hover:opacity-90"
              style={{ backgroundColor: "var(--lime)", color: "var(--forest)", textDecoration: "none" }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────── */}
      <section className="pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
            {/* Left — copy */}
            <div className="animate-fade-in">
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase mb-8"
                style={{ backgroundColor: "white", color: "var(--forest)", letterSpacing: "0.08em", border: "1px solid hsl(var(--border))" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: "var(--lime)" }}
                />
                Built for Ghana SMBs
              </div>
              <h1
                className="font-extrabold leading-[1.0] mb-6"
                style={{ fontSize: "clamp(2.5rem, 5.5vw, 4rem)", letterSpacing: "-0.04em", color: "var(--forest)" }}
              >
                Run Your Ghana<br />
                Business{" "}
                <span style={{ color: "hsl(142,60%,38%)" }}>Smarter.</span>
              </h1>
              <p
                className="text-lg leading-relaxed mb-10 max-w-[480px]"
                style={{ color: "hsl(140,15%,40%)" }}
              >
                All-in-one POS, inventory, invoicing, MoMo payments, and analytics — designed specifically for Ghanaian businesses.
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

              {/* Trust pills */}
              <div className="mt-8 flex flex-wrap gap-3">
                {[
                  { icon: Check, label: "Free forever plan" },
                  { icon: TrendingUp, label: "500+ businesses" },
                  { icon: Globe, label: "All 16 regions" },
                ].map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: "white", color: "hsl(140,20%,35%)", border: "1px solid hsl(var(--border))" }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: "hsl(142,60%,38%)" }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — hero image */}
            <div className="mt-14 lg:mt-0 animate-fade-in" style={{ animationDelay: "0.15s" }}>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ boxShadow: "0 24px 80px rgba(26,58,34,0.18)", border: "1px solid hsl(var(--border))" }}
              >
                <img
                  src={heroDashboard}
                  alt="Nexus-GH Dashboard"
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
              { value: "50+", label: "Businesses" },
              { value: "₵200k+", label: "Sales processed" },
              { value: "16", label: "Regions covered" },
              { value: "99.9%", label: "Uptime" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p
                  className="text-3xl font-extrabold font-mono mb-1"
                  style={{ color: "var(--lime)", letterSpacing: "-0.025em" }}
                >
                  {s.value}
                </p>
                <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>{s.label}</p>
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
              style={{ color: "hsl(140,20%,50%)", letterSpacing: "0.1em" }}
            >
              Everything you need
            </p>
            <h2
              className="font-extrabold leading-tight"
              style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.75rem)", letterSpacing: "-0.035em", color: "var(--forest)" }}
            >
              One platform, nine modules.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allFeatures.map((f) => (
              <div
                key={f.label}
                className="rounded-2xl p-5 flex items-start gap-4 transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: "white", border: "1px solid hsl(var(--border))", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
              >
                <div
                  className="rounded-xl p-2.5 flex-shrink-0"
                  style={{ backgroundColor: "var(--cream)" }}
                >
                  <f.icon className="h-5 w-5" style={{ color: "var(--forest)" }} />
                </div>
                <div>
                  <p className="font-bold text-sm mb-0.5" style={{ color: "var(--forest)" }}>{f.label}</p>
                  <p className="text-sm" style={{ color: "hsl(140,10%,50%)" }}>{f.desc}</p>
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
                  <s.icon className="h-6 w-6" style={{ color: "var(--forest)" }} />
                </div>
                <h3
                  className="font-extrabold leading-tight"
                  style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", letterSpacing: "-0.03em", color: "var(--forest)" }}
                >
                  {s.title}
                </h3>
                <p className="text-base leading-relaxed" style={{ color: "hsl(140,10%,44%)" }}>
                  {s.desc}
                </p>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 text-sm font-bold transition-opacity hover:opacity-70"
                  style={{ color: "hsl(142,60%,38%)", textDecoration: "none" }}
                >
                  Try it free <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="flex-1 w-full">
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ boxShadow: "0 16px 60px rgba(26,58,34,0.12)", border: "1px solid hsl(var(--border))" }}
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
              style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.5rem)", letterSpacing: "-0.035em", color: "var(--forest)" }}
            >
              Simple, transparent pricing
            </h2>
            <p className="text-base" style={{ color: "hsl(140,10%,44%)" }}>Start free, upgrade as you grow. No hidden fees.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="relative rounded-2xl p-8 flex flex-col"
                style={{
                  backgroundColor: plan.popular ? "var(--forest)" : "white",
                  border: plan.popular ? "none" : "1px solid hsl(var(--border))",
                  boxShadow: plan.popular ? "0 16px 60px rgba(26,58,34,0.2)" : "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                {plan.popular && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-5 py-1 rounded-full text-xs font-bold"
                    style={{ backgroundColor: "var(--lime)", color: "var(--forest)" }}
                  >
                    MOST POPULAR
                  </div>
                )}
                <h3
                  className="font-extrabold text-lg mb-1"
                  style={{ color: plan.popular ? "white" : "var(--forest)" }}
                >
                  {plan.name}
                </h3>
                <p
                  className="text-sm mb-6"
                  style={{ color: plan.popular ? "rgba(255,255,255,0.6)" : "hsl(140,10%,50%)" }}
                >
                  {plan.desc}
                </p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span
                    className="text-4xl font-extrabold font-mono"
                    style={{ color: plan.popular ? "var(--lime)" : "var(--forest)", letterSpacing: "-0.04em" }}
                  >
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm" style={{ color: plan.popular ? "rgba(255,255,255,0.5)" : "hsl(140,10%,50%)" }}>
                      {plan.period}
                    </span>
                  )}
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: plan.popular ? "rgba(255,255,255,0.15)" : "var(--cream)" }}
                      >
                        <Check className="h-3 w-3" style={{ color: plan.popular ? "var(--lime)" : "hsl(142,60%,38%)" }} />
                      </div>
                      <span style={{ color: plan.popular ? "rgba(255,255,255,0.8)" : "hsl(140,10%,44%)" }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className="block text-center py-3.5 rounded-full font-bold text-sm transition-all hover:opacity-90"
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
              style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.5rem)", letterSpacing: "-0.035em", color: "var(--forest)" }}
            >
              Loved by Ghana businesses
            </h2>
            <p className="text-base" style={{ color: "hsl(140,10%,44%)" }}>Real stories from real entrepreneurs.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl p-7"
                style={{ backgroundColor: "var(--cream)", border: "1px solid hsl(var(--border))" }}
              >
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" style={{ color: "hsl(38,92%,50%)" }} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "hsl(140,10%,40%)" }}>
                  "{t.text}"
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: "var(--forest)", color: "var(--lime)" }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--forest)" }}>{t.name}</p>
                    <p className="text-xs" style={{ color: "hsl(140,10%,50%)" }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ───────────────────────────────── */}
      <section style={{ backgroundColor: "var(--forest)" }} className="py-20">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <h2
            className="font-extrabold text-white leading-tight mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.04em" }}
          >
            Ready to transform<br />your business?
          </h2>
          <p className="text-base mb-10" style={{ color: "rgba(255,255,255,0.6)" }}>
            Join hundreds of Ghanaian entrepreneurs already on Nexus-GH.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-full font-bold text-base transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: "var(--lime)", color: "var(--forest)", textDecoration: "none" }}
          >
            Get Started for Free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────── */}
      <footer style={{ backgroundColor: "var(--forest)", borderTop: "1px solid rgba(255,255,255,0.08)" }} className="py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs"
                style={{ backgroundColor: "var(--lime)", color: "var(--forest)" }}
              >
                NX
              </div>
              <span className="text-white font-extrabold text-lg" style={{ letterSpacing: "-0.03em" }}>
                Nexus-GH
              </span>
            </div>

            {/* Nav links */}
            <div className="flex flex-wrap gap-6 text-sm">
              {["Features", "Pricing", "Reviews"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}
                  className="hover:opacity-100 transition-opacity"
                >
                  {item}
                </a>
              ))}
              <Link to="/login" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }} className="hover:opacity-100 transition-opacity">
                Sign In
              </Link>
            </div>

            {/* Contact */}
            <div className="flex flex-col sm:flex-row gap-4 text-sm">
              <a href="tel:+233544788852" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>
                <Phone className="h-4 w-4" /> +233 544 788 852
              </a>
              <a href="mailto:gengenesix@gmail.com" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity" style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none" }}>
                <Mail className="h-4 w-4" /> gengenesix@gmail.com
              </a>
            </div>
          </div>

          <div className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>© 2026 Nexus-GH · By GENESIS</p>
            <a
              href="/NexusGH_User_Guide.pdf"
              download
              className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}
            >
              <Download className="h-3.5 w-3.5" /> Download User Guide
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
