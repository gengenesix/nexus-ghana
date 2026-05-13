import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NexisBadge, NexisWordmark } from "@/components/NexisLogo";

export default function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in");
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
            <NexisBadge size={36} />
            <NexisWordmark onDark style={{ color: "white", fontSize: 18 }} />
          </div>

          {/* Hero copy */}
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

          {/* Stats */}
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
        <div className="w-full max-w-[400px] animate-fade-in">
          {/* Back to home */}
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

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <NexisBadge size={32} />
            <NexisWordmark style={{ color: "var(--forest)", fontSize: 18 }} />
          </div>

          <h2
            className="text-3xl font-extrabold mb-1"
            style={{ color: "var(--forest)", letterSpacing: "-0.025em" }}
          >
            Welcome back
          </h2>
          <p className="text-sm mb-8" style={{ color: "var(--muted-foreground)" }}>
            Sign in to your Nexis account
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
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
                : "Sign in"
              }
            </button>
          </form>

          <p className="text-center text-xs mt-8" style={{ color: "var(--muted-foreground)" }}>
            © 2026 Nexis · By GENESIS
          </p>
        </div>
      </div>
    </div>
  );
}
