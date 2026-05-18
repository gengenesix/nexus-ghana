/**
 * Welcome — Post-onboarding industry workspace reveal screen
 * ──────────────────────────────────────────────────────────
 * Shown exactly once after a new business completes onboarding.
 * Full-screen split: forest left panel (industry identity) +
 * cream right panel (3 first steps + CTA).
 *
 * On "Enter workspace" → marks welcome_shown = true → /dashboard.
 * If business.welcome_shown is already true → redirects immediately.
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Utensils, Package2, Factory, Pill, Briefcase,
  HardHat, Truck, BedDouble, Wrench, Leaf, Scissors, Landmark,
  Package, ShoppingCart, Users, FileText, FolderKanban, Receipt,
  Sparkles, ArrowRight, CheckCircle2, Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useBusiness } from "@/hooks/useBusiness";
import { useIndustry } from "@/hooks/useIndustry";
import { getFirstSteps } from "@/lib/industryFirstSteps";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Icon maps ─────────────────────────────────────────────────────────────────
const INDUSTRY_ICONS: Record<string, LucideIcon> = {
  ShoppingBag, Utensils, Package2, Factory, Pill, Briefcase,
  HardHat, Truck, BedDouble, Wrench, Leaf, Scissors, Landmark,
};
const STEP_ICONS: Record<string, LucideIcon> = {
  Package, ShoppingCart, Users, FileText, FolderKanban, Receipt,
  Sparkles, Truck, Wrench, Factory, HardHat, Landmark,
};

function getStepIcon(key: string): LucideIcon {
  return STEP_ICONS[key] ?? CheckCircle2;
}

// ── Left panel ────────────────────────────────────────────────────────────────
function LeftPanel({ industryName, industryTagline, industryIconKey, colorHex, accentHex, businessName }: {
  industryName: string;
  industryTagline: string;
  industryIconKey: string;
  colorHex: string;
  accentHex: string;
  businessName: string;
}) {
  const Icon = INDUSTRY_ICONS[industryIconKey] ?? ShoppingBag;

  return (
    <div
      className="hidden lg:flex lg:w-[440px] xl:w-[500px] flex-shrink-0 flex-col items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: "var(--forest)" }}
    >
      {/* Dot texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.04,
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-12 py-16 gap-8">
        {/* Large industry icon */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: 120,
            height: 120,
            borderRadius: 36,
            backgroundColor: colorHex,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 20px 60px ${colorHex}60`,
          }}
        >
          <Icon style={{ width: 60, height: 60, color: "white" }} strokeWidth={1.5} />
        </motion.div>

        {/* Business name */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)",
              marginBottom: 10,
            }}
          >
            {businessName}
          </p>
          <h1
            style={{
              fontSize: "clamp(1.6rem, 2.5vw, 2.1rem)",
              fontWeight: 900,
              color: "white",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              marginBottom: 10,
            }}
          >
            {industryName}
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.55 }}>
            {industryTagline}
          </p>
        </motion.div>

        {/* Industry colour accent bar */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          style={{
            width: 64,
            height: 4,
            borderRadius: 2,
            backgroundColor: accentHex,
          }}
        />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}
        >
          "Built exactly for your industry."
        </motion.p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Welcome() {
  const navigate       = useNavigate();
  const { business }   = useBusiness();
  const { industry, slug } = useIndustry();
  const [entering, setEntering] = useState(false);

  // If welcome already seen → straight to dashboard
  if (business?.welcome_shown) {
    return <Navigate to="/dashboard" replace />;
  }

  const steps    = getFirstSteps(slug);
  const accentColor = industry?.colorHex ?? "var(--forest)";

  const handleEnter = async () => {
    if (!business || entering) return;
    setEntering(true);
    try {
      await supabase
        .from("businesses")
        .update({ welcome_shown: true })
        .eq("id", business.id);
      navigate("/dashboard", { replace: true });
    } catch {
      toast.error("Something went wrong, redirecting anyway.");
      navigate("/dashboard", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "var(--cream)" }}>
      {/* ── Left: Industry identity ─────────────────────────────────────── */}
      <LeftPanel
        industryName={industry?.name ?? "Your Business"}
        industryTagline={industry?.tagline ?? "Ready to grow."}
        industryIconKey={industry?.iconKey ?? "ShoppingBag"}
        colorHex={industry?.colorHex ?? "hsl(140,28%,30%)"}
        accentHex={industry?.accentHex ?? "hsl(86,68%,68%)"}
        businessName={business?.name ?? ""}
      />

      {/* ── Right: Steps + CTA ────────────────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto"
        style={{ backgroundColor: "var(--cream)" }}
      >
        <div className="w-full max-w-[500px]">
          {/* Mobile industry icon */}
          <div className="lg:hidden mb-6 flex justify-center">
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                backgroundColor: accentColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 8px 24px ${accentColor}55`,
              }}
            >
              {(() => {
                const Icon = INDUSTRY_ICONS[industry?.iconKey ?? "ShoppingBag"] ?? ShoppingBag;
                return <Icon style={{ width: 36, height: 36, color: "white" }} strokeWidth={1.8} />;
              })()}
            </div>
          </div>

          {/* Headline */}
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mb-8"
            >
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-4"
                style={{ backgroundColor: industry?.accentHex ?? "hsl(86,68%,90%)" }}
              >
                <CheckCircle2 style={{ width: 14, height: 14, color: "var(--forest)" }} strokeWidth={2.5} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--forest)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Workspace Ready
                </span>
              </div>

              <h1
                style={{
                  fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                  fontWeight: 900,
                  color: "var(--forest)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.15,
                  marginBottom: 10,
                }}
              >
                Welcome to Nexis,<br />
                <span style={{ color: accentColor }}>{business?.name ?? "your workspace"}</span>.
              </h1>
              <p style={{ fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                Your {industry?.name ?? ""} workspace has been configured. Here are your first three steps to get up and running fast.
              </p>
            </motion.div>
          </AnimatePresence>

          {/* First steps */}
          <div className="space-y-3 mb-10">
            {steps.map((step, i) => {
              const Icon = getStepIcon(step.iconKey);
              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.38, delay: 0.15 + i * 0.1 }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                    padding: "16px 20px",
                    borderRadius: 18,
                    backgroundColor: "white",
                    border: "1.5px solid hsl(var(--border))",
                    cursor: "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  whileHover={{ y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.08)" }}
                  onClick={() => navigate(step.path)}
                >
                  {/* Step number badge */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      backgroundColor: `${accentColor}22`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon style={{ width: 18, height: 18, color: accentColor }} strokeWidth={2} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: accentColor,
                        }}
                      >
                        Step {step.number}
                      </span>
                    </div>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--forest)", marginBottom: 3 }}>
                      {step.title}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                      {step.description}
                    </p>
                  </div>

                  <ArrowRight
                    style={{ width: 14, height: 14, color: "var(--muted-foreground)", flexShrink: 0, marginTop: 2 }}
                  />
                </motion.div>
              );
            })}
          </div>

          {/* Primary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <button
              onClick={handleEnter}
              disabled={entering}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "16px 32px",
                borderRadius: 999,
                border: "none",
                backgroundColor: "var(--forest)",
                color: "white",
                fontSize: 15,
                fontWeight: 800,
                cursor: entering ? "not-allowed" : "pointer",
                letterSpacing: "-0.01em",
                boxShadow: "0 6px 24px rgba(26,58,34,0.3)",
                transition: "opacity 0.15s, transform 0.15s",
                opacity: entering ? 0.75 : 1,
              }}
            >
              {entering ? (
                <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} />
              ) : (
                <>
                  Enter My Workspace
                  <ArrowRight style={{ width: 18, height: 18 }} />
                </>
              )}
            </button>

            <p className="text-center text-xs mt-4" style={{ color: "var(--muted-foreground)" }}>
              You can change your industry settings anytime in Settings → Industry & Modules.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
