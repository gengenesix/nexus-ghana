import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ShieldCheck, X } from "lucide-react";

interface ReAuthModalProps {
  open: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Requires the user to re-enter their password before a privileged operation.
 * On success, Supabase issues a fresh JWT (iat = now) which satisfies the
 * require_fresh_auth_for_role_change() DB trigger (checks iat < 10 min ago).
 */
export default function ReAuthModal({ open, onSuccess, onCancel }: ReAuthModalProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) { setError("No authenticated user found."); return; }
    setLoading(true);
    setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (authError) {
        setError("Incorrect password. Please try again.");
        return;
      }
      // Fresh JWT is now in the session — trigger will accept role changes
      setPassword("");
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-[380px] rounded-3xl p-8 relative"
        style={{ backgroundColor: "var(--cream, white)", boxShadow: "0 24px 60px rgba(0,0,0,0.22)" }}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-5 right-5 rounded-xl p-1.5 transition-opacity hover:opacity-60"
          style={{ color: "hsl(140,10%,46%)" }}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
          style={{ backgroundColor: "var(--forest, #1a3a22)" }}
        >
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>

        <h2
          className="text-xl font-extrabold mb-1"
          style={{ color: "var(--forest, #1a3a22)", letterSpacing: "-0.02em" }}
        >
          Confirm your identity
        </h2>
        <p className="text-sm mb-6" style={{ color: "hsl(140,10%,46%)" }}>
          Role changes require your password to proceed.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-sm font-semibold mb-1.5"
              style={{ color: "var(--forest, #1a3a22)" }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Enter your password"
                required
                autoFocus
                className="w-full px-4 py-3 pr-16 rounded-2xl text-sm outline-none transition-all"
                style={{
                  border: `2px solid ${error ? "#ef4444" : "hsl(var(--border, 140 10% 88%))"}`,
                  backgroundColor: "white",
                  color: "var(--forest, #1a3a22)",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => { if (!error) e.target.style.borderColor = "var(--forest, #1a3a22)"; }}
                onBlur={(e)  => { if (!error) e.target.style.borderColor = "hsl(var(--border, 140 10% 88%))"; }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold px-2 py-1 rounded-lg"
                style={{ color: "hsl(140,10%,46%)" }}
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            {error && (
              <p className="text-xs font-medium mt-1.5" style={{ color: "#ef4444" }}>
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-full font-bold text-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: "var(--forest, #1a3a22)", color: "white" }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
