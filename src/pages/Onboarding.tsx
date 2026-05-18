/**
 * Onboarding — 4-step business setup wizard
 * ──────────────────────────────────────────
 * Step 0: Industry selection   (NEW — the whole point of Phase 0)
 * Step 1: Business details     (name, phone, email, size)
 * Step 2: Location             (region, address)
 * Step 3: Admin PIN            (6-digit PIN for staff screen)
 *
 * Left panel: adapts content based on selected industry after step 0.
 * Right panel: the active step form.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GHANA_REGIONS } from "@/lib/ghana";
import { BUSINESS_SIZES, getIndustry, INDUSTRIES } from "@/lib/industryConfig";
import { Loader2, CheckCircle2, ArrowLeft, ArrowRight, Lock } from "lucide-react";
import {
  ShoppingBag, Utensils, Package2, Factory, Pill, Briefcase,
  HardHat, Truck, BedDouble, Wrench, Leaf, Scissors, Landmark,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useBusiness } from "@/hooks/useBusiness";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { IndustryPicker } from "@/components/onboarding/IndustryPicker";

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingBag, Utensils, Package2, Factory, Pill, Briefcase,
  HardHat, Truck, BedDouble, Wrench, Leaf, Scissors, Landmark,
};

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { label: "Your Industry",    hint: "Pick your business type" },
  { label: "Business Details", hint: "Name, contact & size" },
  { label: "Location",         hint: "Region & address" },
  { label: "Admin PIN",        hint: "Secure your account" },
];

// ── Input style helper ────────────────────────────────────────────────────────
const inputBase: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 16,
  border: "2px solid hsl(var(--border))",
  backgroundColor: "white",
  color: "var(--forest)",
  fontFamily: "inherit",
  fontSize: 14,
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const focusField = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.borderColor = "var(--forest)";
  e.target.style.boxShadow = "0 0 0 3px rgba(26,58,34,0.08)";
};
const blurField = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.target.style.borderColor = "hsl(var(--border))";
  e.target.style.boxShadow = "none";
};

// ── StepProgress ─────────────────────────────────────────────────────────────
function StepProgress({ current }: { current: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? 1 : undefined }}>
            {/* Circle */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
                transition: "all 0.2s",
                backgroundColor: i < current ? "var(--forest)" : i === current ? "var(--forest)" : "hsl(var(--border))",
                color: i <= current ? "white" : "var(--muted-foreground)",
                boxShadow: i === current ? "0 0 0 3px rgba(26,58,34,0.15)" : "none",
              }}
            >
              {i < current ? (
                <CheckCircle2 style={{ width: 16, height: 16 }} strokeWidth={2.5} />
              ) : (
                <span>{i + 1}</span>
              )}
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  margin: "0 4px",
                  borderRadius: 1,
                  backgroundColor: i < current ? "var(--forest)" : "hsl(var(--border))",
                  transition: "background-color 0.3s",
                }}
              />
            )}
          </div>
        ))}
      </div>
      {/* Step label */}
      <div className="mt-2">
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--forest)" }}>
          Step {current + 1} of {STEPS.length} — {STEPS[current].label}
        </p>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{STEPS[current].hint}</p>
      </div>
    </div>
  );
}

// ── Left panel content ────────────────────────────────────────────────────────
function LeftPanel({ step, industrySlug }: { step: number; industrySlug: string }) {
  const industry = getIndustry(industrySlug || INDUSTRIES[0].slug);
  const Icon = ICON_MAP[industry.iconKey] ?? ShoppingBag;
  const hasChosen = !!industrySlug;

  const PANEL_ITEMS = [
    "Industry-specific dashboard & KPIs",
    "Modules configured for your business",
    "Ghana VAT, MoMo & GHS built-in",
    "Offline POS — works without internet",
    "Staff accounts & role management",
  ];

  return (
    <div
      className="hidden lg:flex lg:w-[460px] xl:w-[520px] flex-shrink-0 flex-col relative overflow-hidden"
      style={{ backgroundColor: "var(--forest)" }}
    >
      {/* Dot texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.04,
        }}
      />

      <div className="relative z-10 flex flex-col h-full px-12 py-10">
        {/* Logo */}
        <img
          src="/brand/nexis-icon-green.png"
          alt="Nexis"
          style={{ width: 72, height: 72, borderRadius: 16, display: "block" }}
        />

        {/* Body */}
        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {!hasChosen || step === 0 ? (
              // Before industry is selected
              <motion.div
                key="generic"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <span
                  className="block text-xs font-bold uppercase mb-4"
                  style={{ letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}
                >
                  Ghana's Industry ERP
                </span>
                <h1
                  className="text-white font-extrabold leading-tight mb-6"
                  style={{ fontSize: "clamp(1.75rem, 2.5vw, 2.25rem)", letterSpacing: "-0.03em" }}
                >
                  Built for your<br />exact industry.
                </h1>
                <p className="text-sm leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Pick your industry and Nexis instantly configures the right modules,
                  dashboard KPIs, and workflows — no setup maze.
                </p>
                <div className="space-y-3">
                  {PANEL_ITEMS.map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "var(--lime)" }}
                      >
                        <CheckCircle2 className="h-3 w-3" style={{ color: "var(--forest)" }} />
                      </div>
                      <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              // After industry is selected — show selected industry
              <motion.div
                key={industry.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <span
                  className="block text-xs font-bold uppercase mb-5"
                  style={{ letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}
                >
                  Configuring workspace for
                </span>

                {/* Industry badge */}
                <div className="flex items-center gap-4 mb-6">
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 18,
                      backgroundColor: industry.colorHex,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: `0 6px 20px ${industry.colorHex}55`,
                    }}
                  >
                    <Icon style={{ width: 30, height: 30, color: "white" }} strokeWidth={1.8} />
                  </div>
                  <div>
                    <h1
                      className="text-white font-extrabold leading-tight"
                      style={{ fontSize: "1.4rem", letterSpacing: "-0.025em" }}
                    >
                      {industry.name}
                    </h1>
                    <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                      {industry.tagline}
                    </p>
                  </div>
                </div>

                <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {industry.description}
                </p>

                {/* Setup steps */}
                <div className="space-y-3">
                  {STEPS.slice(1).map((s, i) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          backgroundColor: step > i + 1
                            ? "var(--lime)"
                            : step === i + 1
                            ? "rgba(255,255,255,0.15)"
                            : "rgba(255,255,255,0.07)",
                          fontSize: 11,
                          fontWeight: 700,
                          color: step > i + 1 ? "var(--forest)" : "rgba(255,255,255,0.6)",
                        }}
                      >
                        {step > i + 1
                          ? <CheckCircle2 style={{ width: 14, height: 14 }} />
                          : i + 2}
                      </div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: step === i + 1 ? "white" : "rgba(255,255,255,0.55)" }}
                      >
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.25)" }}>
          Your data is encrypted and stored securely. Never shared.
        </p>
      </div>
    </div>
  );
}

// ── Main Onboarding Component ─────────────────────────────────────────────────
export default function Onboarding() {
  const [step, setStep]             = useState(0);
  const [industrySlug, setIndustry] = useState("");
  const [businessSize, setSize]     = useState("small");
  const [name, setName]             = useState("");
  const [phone, setPhone]           = useState("");
  const [email, setEmail]           = useState("");
  const [region, setRegion]         = useState("");
  const [address, setAddress]       = useState("");
  const [adminPin, setAdminPin]     = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const { business, isLoading, isFetching, createBusiness } = useBusiness();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Already has a business → go to dashboard
  if (!authLoading && !isLoading && !(isFetching && !business) && business) {
    return <Navigate to="/dashboard" replace />;
  }

  // ── Navigation helpers ──────────────────────────────────────────────────────
  const canNext = (): boolean => {
    if (step === 0) return !!industrySlug;
    if (step === 1) return !!name.trim();
    if (step === 2) return true; // region optional
    return adminPin.length === 6 && confirmPin.length === 6;
  };

  const handleNext = () => {
    if (step === 1 && !name.trim()) { toast.error("Business name is required"); return; }
    if (step === 3) { handleSubmit(); return; }
    setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  // ── Final submit ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (adminPin.length < 6)    { toast.error("PIN must be 6 digits"); return; }
    if (adminPin !== confirmPin) { toast.error("PINs do not match"); return; }
    if (business)                { navigate("/dashboard"); return; }

    try {
      const biz = await createBusiness.mutateAsync({
        name: name.trim(),
        phone: phone || undefined,
        email: email || undefined,
        region: region || undefined,
        address: address || undefined,
        industry_vertical_slug: industrySlug || undefined,
        business_size: businessSize,
      });

      const fullName = user?.user_metadata?.full_name || user?.email || "Admin";
      const { error } = await supabase.from("staff_members").insert({
        business_id: biz.id,
        name: fullName,
        role: "Manager",
        pin: adminPin,
        email: user?.email || "",
        status: "active",
      });
      if (error) throw error;

      // Mark onboarding as completed
      await supabase
        .from("businesses")
        .update({ onboarding_completed: true, onboarding_step: 4 })
        .eq("id", biz.id);

      navigate("/welcome");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create business";
      toast.error(msg);
    }
  };

  const isSubmitting = createBusiness.isPending;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "var(--cream)" }}>
      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <LeftPanel step={step} industrySlug={industrySlug} />

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex items-start justify-center px-5 py-10 overflow-y-auto"
        style={{ backgroundColor: "var(--cream)" }}
      >
        <div className="w-full max-w-[520px] animate-fade-in">
          {/* Logo — mobile only */}
          <div className="lg:hidden mb-6">
            <img
              src="/brand/nexis-icon-green.png"
              alt="Nexis"
              style={{ width: 52, height: 52, borderRadius: 14, display: "block" }}
            />
          </div>

          {/* Step progress */}
          <StepProgress current={step} />

          {/* ── Step content (animated) ──────────────────────────────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {/* ───── STEP 0: Industry Picker ───── */}
              {step === 0 && (
                <IndustryPicker value={industrySlug} onChange={setIndustry} />
              )}

              {/* ───── STEP 1: Business Details ───── */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h2
                      style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--forest)", letterSpacing: "-0.025em", marginBottom: 4 }}
                    >
                      Tell us about your business
                    </h2>
                    <p style={{ fontSize: 13.5, color: "var(--muted-foreground)" }}>
                      This is how your business appears on invoices, receipts, and reports.
                    </p>
                  </div>

                  {/* Business name */}
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                      Business Name <span style={{ color: "hsl(var(--destructive))" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Kwame's Mini Mart"
                      required
                      style={inputBase}
                      onFocus={focusField}
                      onBlur={blurField}
                    />
                  </div>

                  {/* Phone + Email */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="024XXXXXXX"
                        style={inputBase}
                        onFocus={focusField}
                        onBlur={blurField}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                        Business Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="biz@email.com"
                        style={inputBase}
                        onFocus={focusField}
                        onBlur={blurField}
                      />
                    </div>
                  </div>

                  {/* Business size */}
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: "var(--forest)" }}>
                      Business Size
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {BUSINESS_SIZES.map((sz) => (
                        <button
                          key={sz.value}
                          type="button"
                          onClick={() => setSize(sz.value)}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 14,
                            border: businessSize === sz.value
                              ? "2px solid var(--forest)"
                              : "2px solid hsl(var(--border))",
                            backgroundColor: businessSize === sz.value ? "rgba(26,58,34,0.06)" : "white",
                            textAlign: "left",
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--forest)" }}>{sz.label}</p>
                          <p style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{sz.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ───── STEP 2: Location ───── */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <h2
                      style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--forest)", letterSpacing: "-0.025em", marginBottom: 4 }}
                    >
                      Where is your business?
                    </h2>
                    <p style={{ fontSize: 13.5, color: "var(--muted-foreground)" }}>
                      Your location helps with regional tax settings and invoice formatting.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                      Region
                    </label>
                    <Select value={region} onValueChange={setRegion}>
                      <SelectTrigger
                        className="rounded-2xl"
                        style={{ border: "2px solid hsl(var(--border))", backgroundColor: "white", height: 48 }}
                      >
                        <SelectValue placeholder="Select your region" />
                      </SelectTrigger>
                      <SelectContent>
                        {GHANA_REGIONS.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                      Business Address
                    </label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street address, town, or digital address (e.g. GH-000-0000)"
                      rows={3}
                      style={{ ...inputBase, resize: "none" }}
                      onFocus={focusField}
                      onBlur={blurField}
                    />
                  </div>
                </div>
              )}

              {/* ───── STEP 3: Admin PIN ───── */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <h2
                      style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--forest)", letterSpacing: "-0.025em", marginBottom: 4 }}
                    >
                      Secure your workspace
                    </h2>
                    <p style={{ fontSize: 13.5, color: "var(--muted-foreground)" }}>
                      Set a 6-digit Admin PIN. This PIN unlocks the staff screen without signing out.
                    </p>
                  </div>

                  {/* PIN info card */}
                  <div
                    className="flex items-start gap-3 rounded-2xl p-4"
                    style={{ backgroundColor: "white", border: "1.5px solid hsl(var(--border))" }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: "var(--forest)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Lock style={{ width: 16, height: 16, color: "var(--lime)" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--forest)", marginBottom: 2 }}>
                        Admin PIN
                      </p>
                      <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                        As the business owner, you enter this PIN on the staff screen to get
                        direct dashboard access — bypassing the staff PIN gate entirely.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                        PIN (6 digits)
                      </label>
                      <input
                        type="password"
                        placeholder="••••••"
                        maxLength={6}
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ""))}
                        required
                        style={{ ...inputBase, letterSpacing: "0.3em", textAlign: "center", fontSize: 18 }}
                        onFocus={focusField}
                        onBlur={blurField}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                        Confirm PIN
                      </label>
                      <input
                        type="password"
                        placeholder="••••••"
                        maxLength={6}
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                        required
                        style={{
                          ...inputBase,
                          letterSpacing: "0.3em",
                          textAlign: "center",
                          fontSize: 18,
                          borderColor: confirmPin && confirmPin !== adminPin
                            ? "hsl(var(--destructive))"
                            : undefined,
                        }}
                        onFocus={focusField}
                        onBlur={blurField}
                      />
                    </div>
                  </div>
                  {confirmPin && confirmPin !== adminPin && (
                    <p style={{ fontSize: 12, color: "hsl(var(--destructive))", fontWeight: 500, marginTop: -8 }}>
                      PINs do not match
                    </p>
                  )}
                  {confirmPin && confirmPin === adminPin && adminPin.length === 6 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ fontSize: 12, color: "hsl(var(--success))", fontWeight: 600, marginTop: -8 }}
                    >
                      PIN confirmed — you're all set!
                    </motion.p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* ── Navigation buttons ────────────────────────────────────────── */}
          <div className={`mt-6 flex gap-3 ${step === 0 ? "justify-end" : "justify-between"}`}>
            {step > 0 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "12px 20px",
                  borderRadius: 999,
                  border: "2px solid hsl(var(--border))",
                  backgroundColor: "white",
                  color: "var(--forest)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <ArrowLeft style={{ width: 15, height: 15 }} />
                Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={!canNext() || isSubmitting}
              style={{
                flex: step === 0 ? 0 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "14px 28px",
                borderRadius: 999,
                border: "none",
                backgroundColor: canNext() ? "var(--forest)" : "hsl(var(--muted))",
                color: canNext() ? "white" : "var(--muted-foreground)",
                fontSize: 14,
                fontWeight: 700,
                cursor: canNext() ? "pointer" : "not-allowed",
                transition: "all 0.15s",
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? (
                <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />
              ) : step === 3 ? (
                <>
                  <CheckCircle2 style={{ width: 17, height: 17 }} />
                  Create My Workspace
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight style={{ width: 15, height: 15 }} />
                </>
              )}
            </button>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: "var(--muted-foreground)" }}>
            © 2026 Nexis · By GENESIS · Your data is encrypted and never shared.
          </p>
        </div>
      </div>
    </div>
  );
}
