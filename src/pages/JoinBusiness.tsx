import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/hooks/useBusiness";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Building2, ArrowRight, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function JoinBusiness() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { business, status } = useBusiness();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [code, setCode]         = useState("");
  const [loading, setLoading]   = useState(false);

  // Already has a business → go to dashboard
  if (!authLoading && status === "success" && business) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { toast.error("Please enter your business code"); return; }
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("join_business_as_staff", {
        p_access_code: trimmed,
        p_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Staff",
        p_role: "Staff",
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      toast.success("Joined! Welcome to your team.");
      // Invalidate so useBusiness re-fetches and finds the new staff record
      await queryClient.invalidateQueries({ queryKey: ["business", user.id] });
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to join business");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "14px 16px", borderRadius: 16,
    border: "2px solid hsl(var(--border))", backgroundColor: "white",
    color: "var(--forest)", fontFamily: "inherit", fontSize: 18,
    fontWeight: 700, outline: "none", letterSpacing: "0.08em",
    textAlign: "center" as const, textTransform: "uppercase" as const,
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "var(--cream)" }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-[460px] flex-shrink-0 flex-col relative overflow-hidden"
        style={{ backgroundColor: "var(--forest)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "24px 24px", opacity: 0.04,
          }}
        />
        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          <img src="/brand/nexis-icon-green.png" alt="Nexis" style={{ width: 72, height: 72, borderRadius: 16 }} />
          <div className="flex-1 flex flex-col justify-center">
            <span className="block text-xs font-bold uppercase mb-4" style={{ letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}>
              Joining your team
            </span>
            <h1 className="text-white font-extrabold leading-tight mb-6" style={{ fontSize: "clamp(1.75rem, 2.5vw, 2.25rem)", letterSpacing: "-0.03em" }}>
              Your manager<br />shared a code<br />with you.
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              Ask your manager or business owner for your Business Access Code. Enter it on the right to join your team on Nexis.
            </p>
          </div>
          <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.28)" }}>© 2026 Nexis · By GENESIS</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <img src="/brand/nexis-icon-green.png" alt="Nexis" style={{ width: 60, height: 60, borderRadius: 14, display: "block" }} />
          </div>

          <h2 className="text-3xl font-extrabold mb-1" style={{ color: "var(--forest)", letterSpacing: "-0.025em" }}>
            Enter your business code
          </h2>
          <p className="text-sm mb-8" style={{ color: "var(--muted-foreground)" }}>
            Logged in as <strong>{user?.email}</strong>
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "var(--forest)" }}>
                Business Access Code
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. KWM-4829"
                maxLength={10}
                autoFocus
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "var(--forest)")}
                onBlur={e => (e.target.style.borderColor = "hsl(var(--border))")}
              />
              <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>
                This code is given to you by your manager or business owner.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full py-3.5 rounded-full font-bold text-base transition-all duration-150 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              style={{ backgroundColor: "var(--forest)", color: "white" }}
            >
              {loading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <><ArrowRight className="h-5 w-5" /> Join Business</>
              }
            </button>
          </form>

          <div className="mt-8 pt-6 border-t" style={{ borderColor: "hsl(var(--border))" }}>
            <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
              Wrong account? Sign out and log in with the correct email.
            </p>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 text-sm font-medium"
              style={{ color: "var(--forest)" }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
