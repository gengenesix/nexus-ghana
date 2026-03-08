import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShoppingCart, Package, FileText, BarChart3, Users, Receipt,
  ArrowRight, Check, Zap, Star, Shield, Globe, Smartphone,
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
  { icon: ShoppingCart, label: "Point of Sale" },
  { icon: Package, label: "Inventory Management" },
  { icon: FileText, label: "Invoicing & Billing" },
  { icon: Users, label: "Customer Database" },
  { icon: Receipt, label: "Expense Tracking" },
  { icon: BarChart3, label: "Business Reports" },
  { icon: Shield, label: "Staff & Permissions" },
  { icon: Smartphone, label: "MoMo Payments" },
  { icon: Globe, label: "Ghana Tax Compliance" },
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
    text: "NexusGH changed how I run my shop. I can track every cedi and my MoMo payments are sorted automatically.",
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
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gold-gradient">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">
              <span className="gold-text">Nexus</span>
              <span className="text-foreground">GH</span>
            </span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Pricing</a>
            <a href="#testimonials" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Testimonials</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button size="sm" className="gold-gradient text-primary-foreground font-semibold shadow-lg" asChild>
              <Link to="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28">
        {/* Glow effects */}
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/8 blur-[120px]" />
        <div className="pointer-events-none absolute top-40 right-0 h-[300px] w-[400px] rounded-full bg-primary/5 blur-[100px]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Zap className="h-3.5 w-3.5" />
              Built for Ghana SMEs
            </div>
            <h1 className="mx-auto max-w-4xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-7xl">
              Run Your Business{" "}
              <span className="gold-text">Smarter</span>
              <br />
              Not Harder
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              All-in-one POS, inventory, invoicing, and analytics platform designed specifically for Ghanaian businesses. Accept MoMo, manage stock, and grow — all from one place.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" className="gold-gradient h-12 px-8 text-base font-semibold text-primary-foreground shadow-xl" asChild>
                <Link to="/register">
                  Start Free — No Credit Card
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-12 px-8 text-base" asChild>
                <a href="#features">See How It Works</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Trusted by 500+ businesses across all 16 regions</p>
          </div>

          {/* Hero Image */}
          <div className="relative mt-16">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-xl border border-border/50 bg-card/50 p-2 shadow-2xl shadow-primary/10">
              <img
                src={heroDashboard}
                alt="NexusGH Dashboard showing sales analytics and business metrics"
                className="w-full rounded-lg"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By / Stats */}
      <section className="border-y border-border/50 bg-card/30 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { value: "500+", label: "Businesses" },
              { value: "₵2.4M+", label: "Sales Processed" },
              { value: "16", label: "Regions Covered" },
              { value: "99.9%", label: "Uptime" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-display text-3xl font-bold gold-text">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Everything Your Business Needs</h2>
            <p className="mt-3 text-muted-foreground">One platform, nine powerful modules</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allFeatures.map((f) => (
              <Card key={f.label} className="group border-border/50 bg-card/50 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <span className="font-display font-semibold">{f.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Showcases */}
      <section id="features" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-24">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`flex flex-col items-center gap-12 lg:flex-row ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}
            >
              <div className="flex-1 space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-2xl font-bold sm:text-3xl">{feature.title}</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">{feature.desc}</p>
                <Button variant="link" className="px-0 text-primary" asChild>
                  <Link to="/register">
                    Try it free <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="flex-1">
                <div className="overflow-hidden rounded-xl border border-border/50 shadow-2xl shadow-primary/10">
                  <img
                    src={feature.image}
                    alt={`${feature.title} feature screenshot`}
                    className="w-full"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-24 bg-card/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Simple, Transparent Pricing</h2>
            <p className="mt-3 text-muted-foreground">Start free, upgrade as you grow. No hidden fees.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative overflow-hidden border transition-all ${
                  plan.popular
                    ? "border-primary shadow-xl shadow-primary/20 scale-[1.02]"
                    : "border-border/50 bg-card/50"
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 gold-gradient px-4 py-1 text-xs font-bold text-primary-foreground rounded-bl-lg">
                    MOST POPULAR
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.desc}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-extrabold">{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                  </div>
                  <Button
                    className={`mt-6 w-full font-semibold ${
                      plan.popular
                        ? "gold-gradient text-primary-foreground shadow-lg"
                        : ""
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                    asChild
                  >
                    <Link to="/register">{plan.cta}</Link>
                  </Button>
                  <ul className="mt-8 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-sm">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Loved by Ghana Businesses</h2>
            <p className="mt-3 text-muted-foreground">See what our customers are saying</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.name} className="border-border/50 bg-card/50">
                <CardContent className="p-6">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-muted-foreground leading-relaxed">"{t.text}"</p>
                  <div className="mt-6 border-t border-border/50 pt-4">
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-sm text-muted-foreground">{t.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-10 text-center sm:p-16">
            <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/10 blur-[80px]" />
            <h2 className="font-display text-2xl font-bold sm:text-4xl">
              Ready to <span className="gold-text">Transform</span> Your Business?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Join hundreds of Ghanaian entrepreneurs already using NexusGH to grow their business.
            </p>
            <Button size="lg" className="mt-8 h-12 px-10 text-base font-semibold gold-gradient text-primary-foreground shadow-xl" asChild>
              <Link to="/register">
                Get Started for Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gold-gradient">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-bold">
                <span className="gold-text">Nexus</span>GH
              </span>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <a href="#testimonials" className="hover:text-foreground transition-colors">Testimonials</a>
              <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 NexusGH. Made in Ghana 🇬🇭</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
