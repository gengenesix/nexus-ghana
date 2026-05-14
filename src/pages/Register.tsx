import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { Loader2, CheckCircle2, Building2, Users } from "lucide-react";
import { toast } from "sonner";

const PERKS = [
  "Point of Sale with offline mode",
  "MoMo & split payment support",
  "Full inventory & warehouse control",
  "Invoicing, CRM & HR modules",
  "Financial reporting in GHS",
];

type Mode = "owner" | "staff";

export default function Register() {
  const [mode, setMode]         = useState<Mode>("owner");
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const { signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      if (mode === "owner") {
        await signUp(email, password, fullName);
        toast.success("Account created! Check your email to confirm.");
        navigate("/login");
      } else {
        // Staff account — mark with account_type so BusinessGuard routes them
        // to /join-business (not /onboarding) after email confirmation + login.
        await signUp(email, password, fullName, { account_type: "staff" });
        toast.success("Account created! Confirm your email, then log in and enter your business code.");
        navigate("/login");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — forest brand (desktop) ── */}
      <div
        className="hidden lg:flex lg:w-[520px] xl:w-[580px] flex-shrink-0 flex-col relative overflow-hidden"
        style={{ backgroundColor: "var(--forest)" }}
      >
        {/* dot texture */}
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
          <img src="/brand/nexis-icon-green.png" alt="Nexis" style={{ width: 80, height: 80, borderRadius: 18, display: "block" }} />

          {/* Hero copy */}
          <div className="flex-1 flex flex-col justify-center">
            <span
              className="block text-xs font-bold uppercase mb-4"
              style={{ letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}
            >
              Everything your business needs
            </span>
            <h1
              className="text-white font-extrabold leading-tight mb-6"
              style={{ fontSize: "clamp(1.875rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}
            >
              Run your Ghana<br />business smarter.
            </h1>

            {/* Perks list */}
            <div className="space-y-3">
              {PERKS.map((perk) => (
                <div key={perk} className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "var(--lime)" }}
                  >
                    <CheckCircle2 className="h-3 w-3" style={{ color: "var(--forest)" }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
                    {perk}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom note */}
          <p
            className="text-xs font-medium"
            style={{ color: "rgba(255,255,255,0.28)" }}
          >
            Free to get started · No credit card required
          </p>
        </div>
      </div>

      {/* ── Right panel — form ─────────────────── */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto"
        style={{ backgroundColor: "var(--cream)" }}
      >
        <div className="w-full max-w-[400px] animate-fade-in">
          {/* Back links */}
          <div className="flex items-center justify-between mb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-70 transition-opacity"
              style={{ color: "var(--muted-foreground)", textDecoration: "none" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Back to home
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-bold transition-all hover:opacity-90 active:scale-[0.97]"
              style={{
                backgroundColor: "white",
                color: "var(--forest)",
                border: "2px solid var(--forest)",
                borderRadius: "999px",
                padding: "6px 18px",
                textDecoration: "none",
              }}
            >
              Sign In
            </Link>
          </div>

          {/* App icon — always visible at top of form */}
          <div className="mb-8">
            <img src="/brand/nexis-icon-green.png" alt="Nexis" style={{ width: 68, height: 68, borderRadius: 16, display: "block", boxShadow: "0 4px 18px rgba(26,58,34,0.15)" }} />
          </div>

          <h2
            className="text-3xl font-extrabold mb-1"
            style={{ color: "var(--forest)", letterSpacing: "-0.025em" }}
          >
            Create your account
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>
            {mode === "owner" ? "Start managing your business with Nexis" : "Join your team on Nexis"}
          </p>

          {/* Mode toggle */}
          <div
            className="flex rounded-2xl p-1 mb-6"
            style={{ backgroundColor: "white", border: "1.5px solid hsl(var(--border))" }}
          >
            {(["owner", "staff"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
                style={
                  mode === m
                    ? { backgroundColor: "var(--forest)", color: "white" }
                    : { color: "var(--muted-foreground)" }
                }
              >
                {m === "owner"
                  ? <><Building2 className="h-4 w-4" /> I own a business</>
                  : <><Users className="h-4 w-4" /> I'm joining a team</>
                }
              </button>
            ))}
          </div>

          {mode === "staff" && (
            <div
              className="rounded-2xl p-4 mb-4 text-sm"
              style={{ backgroundColor: "white", border: "1.5px solid hsl(var(--border))", color: "var(--muted-foreground)" }}
            >
              Create your account below. After confirming your email and logging in, you'll be asked for your <strong style={{ color: "var(--forest)" }}>Business Access Code</strong> — get this from your manager.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Kwame Mensah"
                required
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
                style={{
                  border: "2px solid hsl(var(--border))",
                  backgroundColor: "white",
                  color: "var(--forest)",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--forest)"; }}
                onBlur={(e)  => { e.target.style.borderColor = "hsl(var(--border))"; }}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                required
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
                style={{
                  border: "2px solid hsl(var(--border))",
                  backgroundColor: "white",
                  color: "var(--forest)",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--forest)"; }}
                onBlur={(e)  => { e.target.style.borderColor = "hsl(var(--border))"; }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-16 rounded-2xl text-sm outline-none transition-all"
                  style={{
                    border: "2px solid hsl(var(--border))",
                    backgroundColor: "white",
                    color: "var(--forest)",
                    fontFamily: "inherit",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--forest)"; }}
                  onBlur={(e)  => { e.target.style.borderColor = "hsl(var(--border))"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold px-2 py-1 rounded-lg"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full font-bold text-base transition-all duration-150 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              style={{ backgroundColor: "var(--forest)", color: "white" }}
            >
              {loading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : "Create free account"
              }
            </button>
          </form>

          {/* Sign in prompt */}
          <div
            className="flex items-center justify-center gap-3 mt-5 py-4 rounded-2xl"
            style={{ backgroundColor: "white", border: "1.5px solid hsl(var(--border))" }}
          >
            <span className="text-sm font-medium" style={{ color: "hsl(140,10%,46%)" }}>
              Already have an account?
            </span>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-bold transition-all hover:opacity-90 active:scale-[0.97]"
              style={{
                backgroundColor: "var(--forest)",
                color: "white",
                borderRadius: "999px",
                padding: "7px 20px",
                textDecoration: "none",
              }}
            >
              Sign In
            </Link>
          </div>

          <p
            className="text-center text-xs mt-5 leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            By creating an account you agree to our terms of service.
            <br />© 2026 Nexis · By GENESIS
          </p>
        </div>
      </div>
    </div>
  );
}
