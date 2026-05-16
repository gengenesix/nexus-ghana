import { useState } from "react";
import { useBusiness } from "@/hooks/useBusiness";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { Lock, Loader2, ShieldAlert, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";

interface StaffPinGuardProps {
  children: React.ReactNode;
}

/**
 * Kiosk PIN guard — shown when no staff session is active.
 *
 * Security: staff are identified by Staff ID (text) + 6-digit PIN.
 * No user list is ever fetched or rendered — this prevents peer enumeration.
 * The verify_staff_pin RPC does the lookup server-side.
 */
export function StaffPinGuard({ children }: StaffPinGuardProps) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const { staff, isStaffLoggedIn, ownerBypass, setOwnerAccess, loginWithPin } = useStaffSession();

  const [staffIdInput, setStaffIdInput] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);

  const isBusinessOwner = !!user && !!business && business.owner_id === user.id;
  const isLocked = lockedUntil !== null && lockedUntil > new Date();

  const getLockoutRemaining = () => {
    if (!lockedUntil) return 0;
    return Math.ceil((lockedUntil.getTime() - Date.now()) / 1000 / 60);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || pin.length < 6 || isLocked || !staffIdInput.trim()) return;

    setIsLoading(true);
    const result = await loginWithPin(business.id, pin, staffIdInput.trim());
    setIsLoading(false);

    if (result.success) {
      setAttempts(0);
      setLockedUntil(null);
      toast.success(`Welcome, ${result.session.name}`);
    } else {
      setPin("");
      if (result.reason?.startsWith("Access restricted")) {
        toast.error(result.reason);
        return;
      }
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 5) {
        setLockedUntil(new Date(Date.now() + 15 * 60 * 1000));
        toast.error("Too many failed attempts. Locked for 15 minutes.");
      } else {
        toast.error(`Invalid credentials. ${5 - newAttempts} attempt${5 - newAttempts === 1 ? "" : "s"} remaining.`);
      }
    }
  };

  // Already authenticated — pass through
  if ((isStaffLoggedIn && staff) || ownerBypass) return <>{children}</>;

  return (
    <div
      className="flex items-center justify-center min-h-screen p-4"
      style={{ backgroundColor: "var(--cream, #f7f5f0)" }}
    >
      <div className="w-full max-w-[360px] space-y-3">

        {/* Card */}
        <div
          className="rounded-3xl p-8"
          style={{
            backgroundColor: "white",
            boxShadow: "0 8px 40px rgba(26,58,34,0.10)",
            border: "1.5px solid hsl(var(--border))",
          }}
        >
          {/* Logo + title */}
          <div className="flex flex-col items-center mb-8">
            <img
              src="/brand/nexis-icon-green.png"
              alt="Nexis"
              style={{ width: 60, height: 60, borderRadius: 16, boxShadow: "0 4px 18px rgba(26,58,34,0.20)", display: "block", marginBottom: 16 }}
            />
            <h2
              className="text-xl font-extrabold"
              style={{ color: "var(--forest, #1a3a22)", letterSpacing: "-0.02em" }}
            >
              Staff sign-in
            </h2>
            <p className="text-sm mt-1" style={{ color: "hsl(140,10%,46%)" }}>
              {business?.name || "Nexis"}
            </p>
          </div>

          {isLocked ? (
            <div
              className="rounded-2xl p-5 text-center space-y-2"
              style={{ backgroundColor: "#fef2f2", border: "1.5px solid #fca5a5" }}
            >
              <ShieldAlert className="h-8 w-8 mx-auto" style={{ color: "#ef4444" }} />
              <p className="text-sm font-bold" style={{ color: "#dc2626" }}>
                Temporarily Locked
              </p>
              <p className="text-xs" style={{ color: "#ef4444" }}>
                Too many failed attempts. Try again in ~{getLockoutRemaining()} minute{getLockoutRemaining() === 1 ? "" : "s"}.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Staff ID */}
              <div>
                <label
                  className="block text-sm font-semibold mb-1.5"
                  style={{ color: "var(--forest, #1a3a22)" }}
                >
                  Staff ID
                </label>
                <div className="relative">
                  <User
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                    style={{ color: "hsl(140,10%,55%)" }}
                  />
                  <input
                    type="text"
                    value={staffIdInput}
                    onChange={(e) => setStaffIdInput(e.target.value)}
                    placeholder="Your staff ID"
                    required
                    autoComplete="username"
                    autoFocus
                    className="w-full pl-9 pr-4 py-3 rounded-2xl text-sm outline-none transition-all"
                    style={{
                      border: "2px solid hsl(var(--border))",
                      backgroundColor: "#fafafa",
                      color: "var(--forest, #1a3a22)",
                      fontFamily: "inherit",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "var(--forest, #1a3a22)"; e.target.style.backgroundColor = "white"; }}
                    onBlur={(e)  => { e.target.style.borderColor = "hsl(var(--border))"; e.target.style.backgroundColor = "#fafafa"; }}
                  />
                </div>
              </div>

              {/* PIN */}
              <div>
                <label
                  className="block text-sm font-semibold mb-1.5"
                  style={{ color: "var(--forest, #1a3a22)" }}
                >
                  6-digit PIN
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                    style={{ color: "hsl(140,10%,55%)" }}
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => { if (e.key === "Enter" && pin.length >= 6 && staffIdInput.trim()) handleSubmit(e as any); }}
                    placeholder="••••••"
                    required
                    autoComplete="current-password"
                    className="w-full pl-9 pr-4 py-3 rounded-2xl text-xl tracking-[0.4em] text-center outline-none transition-all"
                    style={{
                      border: "2px solid hsl(var(--border))",
                      backgroundColor: "#fafafa",
                      color: "var(--forest, #1a3a22)",
                      fontFamily: "monospace",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "var(--forest, #1a3a22)"; e.target.style.backgroundColor = "white"; }}
                    onBlur={(e)  => { e.target.style.borderColor = "hsl(var(--border))"; e.target.style.backgroundColor = "#fafafa"; }}
                  />
                </div>
                {attempts > 0 && (
                  <p className="text-xs mt-1.5 text-center" style={{ color: "#ef4444" }}>
                    {5 - attempts} attempt{5 - attempts === 1 ? "" : "s"} remaining
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={pin.length < 6 || !staffIdInput.trim() || isLoading}
                className="w-full py-3.5 rounded-full font-bold text-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
                style={{ backgroundColor: "var(--forest, #1a3a22)", color: "white" }}
              >
                {isLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><Lock className="h-4 w-4" /> Sign in</>
                }
              </button>
            </form>
          )}
        </div>

        {/* Owner bypass — only shown to the authenticated business owner */}
        {isBusinessOwner && (
          <button
            onClick={setOwnerAccess}
            className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all hover:opacity-80 active:scale-[0.98]"
            style={{
              backgroundColor: "white",
              border: "1.5px solid hsl(var(--border))",
              color: "hsl(140,10%,46%)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <ShieldCheck className="h-4 w-4" style={{ color: "var(--forest, #1a3a22)" }} />
            Continue as Owner (no PIN required)
          </button>
        )}

      </div>
    </div>
  );
}
