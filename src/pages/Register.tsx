import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const PERKS = [
  "Point of Sale with offline mode",
  "MoMo & split payment support",
  "Full inventory & warehouse control",
  "Invoicing, CRM & HR modules",
  "Financial reporting in GHS",
];

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await signUp(email, password, fullName);
      toast.success("Account created! Check your email to confirm.");
      navigate("/login");
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
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs"
              style={{ backgroundColor: "var(--lime)", color: "var(--forest)" }}
            >
              NX
            </div>
            <span
              className="text-white text-lg font-extrabold"
              style={{ letterSpacing: "-0.03em" }}
            >
              Nexus-GH
            </span>
          </div>

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
          {/* Back link */}
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium mb-8 hover:opacity-70 transition-opacity"
            style={{ color: "var(--muted-foreground)", textDecoration: "none" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Already have an account? Sign in
          </Link>

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs"
              style={{ backgroundColor: "var(--forest)", color: "var(--lime)" }}
            >
              NX
            </div>
            <span
              className="font-extrabold text-lg"
              style={{ color: "var(--forest)", letterSpacing: "-0.03em" }}
            >
              Nexus-GH
            </span>
          </div>

          <h2
            className="text-3xl font-extrabold mb-1"
            style={{ color: "var(--forest)", letterSpacing: "-0.025em" }}
          >
            Create your account
          </h2>
          <p className="text-sm mb-8" style={{ color: "var(--muted-foreground)" }}>
            Start managing your business with Nexus-GH
          </p>

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

          <p
            className="text-center text-xs mt-6 leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            By creating an account you agree to our terms of service.
            <br />© 2026 Nexus-GH · By GENESIS
          </p>
        </div>
      </div>
    </div>
  );
}
