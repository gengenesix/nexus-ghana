import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { Loader2, Building2, Users } from "lucide-react";
import { toast } from "sonner";

type Tab = "staff" | "owner";

export default function Login() {
  const [tab, setTab]           = useState<Tab>("staff");

  // Staff fields
  const [accessCode, setAccessCode] = useState("");
  const [staffId, setStaffId]       = useState("");
  const [staffPw, setStaffPw]       = useState("");
  const [showStaffPw, setShowStaffPw] = useState(false);

  // Owner fields
  const [email, setEmail]       = useState("");
  const [ownerPw, setOwnerPw]   = useState("");
  const [showOwnerPw, setShowOwnerPw] = useState(false);

  const [loading, setLoading]   = useState(false);
  const { signIn, signInStaff, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInStaff(accessCode.trim(), staffId.trim(), staffPw);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch {
      // Always generic — prevents enumeration
      toast.error("Invalid credentials. Please check your Access Code, Staff ID, and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, ownerPw);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    border: "2px solid hsl(var(--border))",
    backgroundColor: "white",
    color: "var(--forest)",
    fontFamily: "inherit",
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — forest brand (desktop) ── */}
      <div
        className="hidden lg:flex lg:w-[520px] xl:w-[580px] flex-shrink-0 flex-col relative overflow-hidden"
        style={{ backgroundColor: "var(--forest)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            opacity: 0.04,
          }}
        />
        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          <img src="/brand/nexis-icon-green.png" alt="Nexis" style={{ width: 80, height: 80, borderRadius: 18, display: "block" }} />

          <div className="flex-1 flex flex-col justify-center">
            <h1
              className="text-white font-extrabold leading-tight mb-4"
              style={{ fontSize: "clamp(1.875rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}
            >
              Your Business.<br />Fully in Control.
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-[360px]">
              POS, inventory, invoicing, MoMo payments, HR, and full financial management — built for Ghana SMBs.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
            {[
              { value: "20+", label: "Modules" },
              { value: "MoMo", label: "Payments" },
              { value: "Offline", label: "POS ready" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-xl font-extrabold tracking-tight font-mono" style={{ color: "var(--lime)" }}>
                  {s.value}
                </p>
                <p className="text-white/50 text-xs font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ─────────────────── */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto"
        style={{ backgroundColor: "var(--cream)" }}
      >
        <div className="w-full max-w-[420px] animate-fade-in">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold mb-6 hover:opacity-70 transition-opacity"
            style={{ color: "var(--muted-foreground)", textDecoration: "none" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to home
          </Link>

          <div className="mb-8">
            <img src="/brand/nexis-icon-green.png" alt="Nexis" style={{ width: 68, height: 68, borderRadius: 16, display: "block", boxShadow: "0 4px 18px rgba(26,58,34,0.15)" }} />
          </div>

          <h2
            className="text-3xl font-extrabold mb-1"
            style={{ color: "var(--forest)", letterSpacing: "-0.025em" }}
          >
            Welcome back
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>
            Sign in to your Nexis account
          </p>

          {/* Tab switcher */}
          <div
            className="flex rounded-2xl p-1 mb-7"
            style={{ backgroundColor: "white", border: "1.5px solid hsl(var(--border))" }}
          >
            {(["staff", "owner"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
                style={
                  tab === t
                    ? { backgroundColor: "var(--forest)", color: "white" }
                    : { color: "var(--muted-foreground)" }
                }
              >
                {t === "staff"
                  ? <><Users className="h-4 w-4" /> Staff login</>
                  : <><Building2 className="h-4 w-4" /> Business owner</>
                }
              </button>
            ))}
          </div>

          {/* ─── Staff login form ─── */}
          {tab === "staff" && (
            <form onSubmit={handleStaffSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                  Business Access Code
                </label>
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ACME2024"
                  required
                  autoComplete="organization"
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all tracking-widest font-mono"
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = "var(--forest)"; }}
                  onBlur={(e)  => { e.target.style.borderColor = "hsl(var(--border))"; }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                  Staff ID
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="8-digit ID (e.g. 10483726)"
                  required
                  autoComplete="username"
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all font-mono tracking-wider"
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = "var(--forest)"; }}
                  onBlur={(e)  => { e.target.style.borderColor = "hsl(var(--border))"; }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showStaffPw ? "text" : "password"}
                    value={staffPw}
                    onChange={(e) => setStaffPw(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-3 pr-16 rounded-2xl text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = "var(--forest)"; }}
                    onBlur={(e)  => { e.target.style.borderColor = "hsl(var(--border))"; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPw(!showStaffPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold px-2 py-1 rounded-lg"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {showStaffPw ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="text-xs mt-1.5" style={{ color: "var(--muted-foreground)" }}>
                  Password provided by your business owner or administrator.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-full font-bold text-base transition-all duration-150 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                style={{ backgroundColor: "var(--forest)", color: "white" }}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign in"}
              </button>
            </form>
          )}

          {/* ─── Owner login form ─── */}
          {tab === "owner" && (
            <form onSubmit={handleOwnerSubmit} className="space-y-4">
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
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = "var(--forest)"; }}
                  onBlur={(e)  => { e.target.style.borderColor = "hsl(var(--border))"; }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold" style={{ color: "var(--forest)" }}>
                    Password
                  </label>
                  <Link
                    to="/register"
                    className="text-xs font-medium hover:underline"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    No account? Sign up
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showOwnerPw ? "text" : "password"}
                    value={ownerPw}
                    onChange={(e) => setOwnerPw(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-3 pr-16 rounded-2xl text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = "var(--forest)"; }}
                    onBlur={(e)  => { e.target.style.borderColor = "hsl(var(--border))"; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOwnerPw(!showOwnerPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold px-2 py-1 rounded-lg"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {showOwnerPw ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-full font-bold text-base transition-all duration-150 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                style={{ backgroundColor: "var(--forest)", color: "white" }}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign in"}
              </button>
            </form>
          )}

          <p className="text-center text-xs mt-8" style={{ color: "var(--muted-foreground)" }}>
            © 2026 Nexis · By GENESIS
          </p>
        </div>
      </div>
    </div>
  );
}
