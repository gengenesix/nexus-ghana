import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart, Package, FileText, BarChart3, Users, Receipt,
  ArrowRight, Check, Landmark, Star, Shield, Globe, Smartphone,
  Sparkles, TrendingUp, Clock, Phone, Mail, Download,
} from "lucide-react";


import heroDashboard from "@/assets/hero-dashboard.png";
import featurePos from "@/assets/feature-pos.png";
import featureInvoicing from "@/assets/feature-invoicing.png";
import featureInventory from "@/assets/feature-inventory.png";

const features = [
  {
    icon: ShoppingCart,
    title: "Point of Sale",
    desc: "Fast, touch-friendly POS with MoMo QR payments, barcode scanning, and instant receipt printing.",
    image: featurePos,
  },
  {
    icon: FileText,
    title: "Smart Invoicing",
    desc: "Auto-numbered invoices with Ghana tax (VAT, NHIL, GETFL) computed automatically. PDF export ready.",
    image: featureInvoicing,
  },
  {
    icon: Package,
    title: "Inventory Tracking",
    desc: "Real-time stock levels, low-stock alerts, categories, and automatic deduction on every sale.",
    image: featureInventory,
  },
];

const allFeatures = [
  { icon: ShoppingCart, label: "Point of Sale", desc: "Quick sales & MoMo" },
  { icon: Package, label: "Inventory", desc: "Stock tracking" },
  { icon: FileText, label: "Invoicing", desc: "Tax-compliant bills" },
  { icon: Users, label: "Customers", desc: "CRM & loyalty" },
  { icon: Receipt, label: "Expenses", desc: "Track spending" },
  { icon: BarChart3, label: "Reports", desc: "Business insights" },
  { icon: Shield, label: "Staff", desc: "Roles & PINs" },
  { icon: Smartphone, label: "MoMo Pay", desc: "Mobile money" },
  { icon: Globe, label: "Ghana Tax", desc: "VAT, NHIL, GETFL" },
];

const plans = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    desc: "Perfect for solo traders just getting started.",
    features: ["1 User", "50 Products", "POS & Sales", "Basic Reports", "Email Support"],
    cta: "Get Started Free",
    popular: false,
  },
  {
    name: "Business",
    price: "GH₵ 99",
    period: "/month",
    desc: "For growing businesses that need full control.",
    features: ["5 Staff Members", "Unlimited Products", "Invoicing + Tax", "Full Reports & Analytics", "MoMo Integration", "Priority Support"],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "GH₵ 249",
    period: "/month",
    desc: "Multi-branch businesses with advanced needs.",
    features: ["Unlimited Staff", "Multi-Branch Support", "API Access", "Custom Branding", "Dedicated Account Manager", "SLA Guarantee"],
    cta: "Contact Sales",
    popular: false,
  },
];

const testimonials = [
  {
    name: "Ama Serwaa",
    role: "Owner, Serwaa's Cosmetics — Kumasi",
    text: "Nexus-GH changed how I run my shop. I can track every cedi and my MoMo payments are sorted automatically.",
    rating: 5,
  },
  {
    name: "Kwame Mensah",
    role: "Manager, FreshMart Supermarket — Accra",
    text: "The invoicing with automatic Ghana tax calculation saves me hours every week. No more manual VAT math!",
    rating: 5,
  },
  {
    name: "Abena Osei",
    role: "Founder, TechHub GH — Takoradi",
    text: "Finally a business tool built for Ghana. The POS is lightning fast and my staff learned it in minutes.",
    rating: 5,
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Animated background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] h-[600px] w-[600px] rounded-full bg-primary/5 blur-[150px] animate-pulse" />
        <div className="absolute top-[40%] right-[-5%] h-[500px] w-[500px] rounded-full bg-primary/4 blur-[130px]" />
        <div className="absolute bottom-[-10%] left-[-5%] h-[400px] w-[400px] rounded-full bg-info/3 blur-[120px]" />
      </div>

      {/* Nav — Glassmorphism */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl gold-gradient shadow-lg shadow-primary/25">
              <Landmark className="h-5 w-5 text-primary-foreground" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/20" />
            </div>
            <span className="font-curly text-2xl bg-gradient-to-r from-primary via-yellow-400 to-primary bg-clip-text text-transparent">
              Nexus-GH
            </span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Pricing</a>
            <a href="#testimonials" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Reviews</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button size="sm" className="gold-gradient text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow" asChild>
              <Link to="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-44 sm:pb-32">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full glass-card px-5 py-2 text-sm font-medium text-primary">
              <Landmark className="h-4 w-4" />
              Built for Ghana's Next Generation of Entrepreneurs
            </div>
            <h1 className="mx-auto max-w-5xl font-brand text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-8xl leading-[0.95]">
              Run Your Business
              <br />
              <span className="gold-text">Smarter,</span> Not Harder
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
              All-in-one POS, inventory, invoicing, and analytics platform designed specifically for Ghanaian businesses. Accept MoMo, manage stock, and grow.
            </p>
            <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="gold-gradient h-14 px-10 text-base font-bold text-primary-foreground shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all hover:scale-[1.02]" asChild>
                <Link to="/register">
                  Start Free — No Credit Card
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-14 px-10 text-base glass-card border-0 hover:bg-muted/50" asChild>
                <a href="#features">See How It Works</a>
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Free forever plan</span>
              <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-info" /> Setup in 2 minutes</span>
              <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> 500+ businesses</span>
            </div>
          </div>

          {/* Hero Image — Glass frame */}
          <div className="relative mt-20">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-sm" />
            <div className="relative rounded-2xl glass-card-strong p-2 sm:p-3 glass-glow">
              <img
                src={heroDashboard}
                alt="Nexus-GH Dashboard showing sales analytics and business metrics"
                className="w-full rounded-xl"
                loading="eager"
              />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-background/60 via-transparent to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats — Glass cards */}
      <section className="relative py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { value: "500+", label: "Businesses", icon: Users },
              { value: "₵2.4M+", label: "Sales Processed", icon: TrendingUp },
              { value: "16", label: "Regions Covered", icon: Globe },
              { value: "99.9%", label: "Uptime", icon: Shield },
            ].map((stat) => (
              <div key={stat.label} className="glass-card rounded-2xl p-6 text-center transition-all hover:scale-[1.02]">
                <stat.icon className="mx-auto mb-3 h-6 w-6 text-primary/70" />
                <div className="font-brand text-3xl font-bold gold-text">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid — Glass cards */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-brand text-3xl font-bold sm:text-4xl">Everything Your Business Needs</h2>
            <p className="mt-4 text-lg text-muted-foreground">One platform, nine powerful modules</p>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allFeatures.map((f) => (
              <div
                key={f.label}
                className="group glass-card rounded-2xl p-5 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10 cursor-default"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover:gold-gradient group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/20">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-display font-semibold block">{f.label}</span>
                    <span className="text-sm text-muted-foreground">{f.desc}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Showcases */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-32">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`flex flex-col items-center gap-12 lg:gap-16 lg:flex-row ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}
            >
              <div className="flex-1 space-y-5">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl glass-card text-primary">
                  <feature.icon className="h-7 w-7" />
                </div>
                <h3 className="font-brand text-3xl font-bold sm:text-4xl">{feature.title}</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">{feature.desc}</p>
                <Button variant="link" className="px-0 text-primary font-semibold" asChild>
                  <Link to="/register">
                    Try it free <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="flex-1">
                <div className="glass-card-strong rounded-2xl p-2 sm:p-3 glass-glow transition-transform hover:scale-[1.01]">
                  <img
                    src={feature.image}
                    alt={`${feature.title} feature screenshot`}
                    className="w-full rounded-xl"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing — Glass cards */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-brand text-3xl font-bold sm:text-4xl">Simple, Transparent Pricing</h2>
            <p className="mt-4 text-lg text-muted-foreground">Start free, upgrade as you grow. No hidden fees.</p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl transition-all ${
                  plan.popular
                    ? "glass-card-strong scale-[1.03] shadow-xl shadow-primary/20 ring-1 ring-primary/40"
                    : "glass-card hover:scale-[1.02]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 gold-gradient px-5 py-1.5 text-xs font-bold text-primary-foreground rounded-full shadow-lg">
                    MOST POPULAR
                  </div>
                )}
                <div className="p-8">
                  <h3 className="font-brand text-xl font-bold">{plan.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.desc}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="font-brand text-4xl font-extrabold">{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                  </div>
                  <Button
                    className={`mt-8 w-full font-semibold h-12 ${
                      plan.popular
                        ? "gold-gradient text-primary-foreground shadow-lg shadow-primary/25"
                        : "glass-card border-0 hover:bg-muted/50"
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                    asChild
                  >
                    <Link to="/register">{plan.cta}</Link>
                  </Button>
                  <ul className="mt-8 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-sm">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials — Glass cards */}
      <section id="testimonials" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-brand text-3xl font-bold sm:text-4xl">Loved by Ghana Businesses</h2>
            <p className="mt-4 text-lg text-muted-foreground">See what our customers are saying</p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="glass-card rounded-2xl p-7 transition-all hover:scale-[1.02]">
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground leading-relaxed">"{t.text}"</p>
                <div className="mt-6 flex items-center gap-3 border-t border-border/30 pt-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full gold-gradient text-sm font-bold text-primary-foreground">
                    {t.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — Glass card */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative glass-card-strong rounded-3xl p-12 text-center sm:p-20 overflow-hidden">
            <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/15 blur-[80px]" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-primary/10 blur-[80px]" />
            <div className="relative">
              <h2 className="font-brand text-3xl font-bold sm:text-5xl leading-tight">
                Ready to <span className="gold-text">Transform</span>
                <br />Your Business?
              </h2>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
                Join hundreds of Ghanaian entrepreneurs already using Nexus-GH to grow their business.
              </p>
              <Button size="lg" className="mt-10 h-14 px-12 text-base font-bold gold-gradient text-primary-foreground shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all hover:scale-[1.02]" asChild>
                <Link to="/register">
                  Get Started for Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="glass-nav py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl gold-gradient shadow-lg shadow-primary/20">
                  <Landmark className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-curly text-xl bg-gradient-to-r from-primary via-yellow-400 to-primary bg-clip-text text-transparent">
                  Nexus-GH
                </span>
              </div>
              <div className="flex gap-8 text-sm text-muted-foreground">
                <a href="#features" className="hover:text-foreground transition-colors">Features</a>
                <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
                <a href="#testimonials" className="hover:text-foreground transition-colors">Reviews</a>
                <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 text-sm text-muted-foreground">
              <a href="tel:+233544788852" className="flex items-center gap-2 hover:text-primary transition-colors">
                <Phone className="h-4 w-4" />
                +233 544 788 852
              </a>
              <a href="mailto:gengenesix@gmail.com" className="flex items-center gap-2 hover:text-primary transition-colors">
                <Mail className="h-4 w-4" />
                gengenesix@gmail.com
              </a>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <a
                href="/NexusGH_User_Guide.pdf"
                download="NexusGH_User_Guide.pdf"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Download className="h-4 w-4" />
                Download User Guide
              </a>
              <p className="text-sm text-muted-foreground">© 2026 Nexus-GH. By GENESIS</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
