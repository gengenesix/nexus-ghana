import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBusiness } from "@/hooks/useBusiness";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, UserCircle, ShieldAlert, ChevronLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface StaffPinGuardProps {
  children: React.ReactNode;
}

export function StaffPinGuard({ children }: StaffPinGuardProps) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const { staff, isStaffLoggedIn, ownerBypass, setOwnerAccess, loginWithPin } = useStaffSession();

  const [selectedStaff, setSelectedStaff] = useState<{ id: string; name: string; role: string } | null>(null);
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);

  const isBusinessOwner = !!user && !!business && business.owner_id === user.id;
  const isLocked = lockedUntil !== null && lockedUntil > new Date();

  const { data: staffList = [], isLoading: staffLoading } = useQuery({
    queryKey: ["staff-login-list", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members")
        .select("id, name, role")
        .eq("business_id", business!.id)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; role: string }[];
    },
    enabled: !!business && !isStaffLoggedIn && !ownerBypass,
  });

  const getLockoutRemaining = () => {
    if (!lockedUntil) return 0;
    return Math.ceil((lockedUntil.getTime() - Date.now()) / 1000 / 60);
  };

  const handlePinSubmit = async () => {
    if (!business || !selectedStaff || pin.length < 6 || isLocked) return;

    setIsLoading(true);
    const result = await loginWithPin(business.id, pin, selectedStaff.id);
    setIsLoading(false);

    if (result) {
      setAttempts(0);
      setLockedUntil(null);
      toast.success(`Welcome, ${result.name}`);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin("");

      if (newAttempts >= 5) {
        setLockedUntil(new Date(Date.now() + 15 * 60 * 1000));
        toast.error("Too many failed attempts. Locked for 15 minutes.");
      } else {
        toast.error(`Invalid PIN. ${5 - newAttempts} attempt${5 - newAttempts === 1 ? "" : "s"} remaining.`);
      }
    }
  };

  const handleBack = () => {
    setSelectedStaff(null);
    setPin("");
    setAttempts(0);
    setLockedUntil(null);
  };

  // Active staff session or owner bypass → let through
  if (isStaffLoggedIn && staff) return <>{children}</>;
  if (ownerBypass) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-sm space-y-3">
        {/* Header card */}
        <Card>
          <CardHeader className="text-center space-y-4 pb-4">
            <div className="flex justify-center">
              <img
                src="/brand/nexis-icon-green.png"
                alt="Nexis"
                style={{ width: 64, height: 64, borderRadius: 18, boxShadow: "0 4px 18px rgba(26,58,34,0.25)", display: "block" }}
              />
            </div>
            <div>
              <CardTitle className="font-display text-2xl">Who's there?</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{business?.name || "Nexis"}</p>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* ── Step 1: Select who you are ── */}
            {!selectedStaff ? (
              <>
                {staffLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : staffList.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-4">
                    No active staff found. Ask your administrator.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-0.5">
                    {staffList.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStaff(s)}
                        className="flex flex-col items-center gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-center transition-all hover:border-primary/60 hover:bg-primary/5 hover:shadow-sm active:scale-95"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <UserCircle className="h-6 w-6 text-primary" />
                        </div>
                        <div className="min-w-0 w-full">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          <Badge variant="secondary" className="text-[10px] mt-0.5">{s.role}</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center pt-1">
                  Select your name then enter your 6-digit PIN
                </p>
              </>
            ) : (
              /* ── Step 2: Enter PIN ── */
              <>
                <div className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2.5">
                  <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                    <UserCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{selectedStaff.name}</p>
                    <Badge variant="secondary" className="text-[10px]">{selectedStaff.role}</Badge>
                  </div>
                </div>

                {isLocked ? (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-center space-y-2">
                    <ShieldAlert className="h-8 w-8 text-destructive mx-auto" />
                    <p className="text-sm font-semibold text-destructive">Account Temporarily Locked</p>
                    <p className="text-xs text-muted-foreground">
                      Too many failed attempts. Try again in ~{getLockoutRemaining()} minute{getLockoutRemaining() === 1 ? "" : "s"}.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="6-digit PIN"
                          maxLength={6}
                          className="pl-10 text-center text-xl tracking-widest"
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                          onKeyDown={(e) => { if (e.key === "Enter" && pin.length >= 6) handlePinSubmit(); }}
                          autoFocus
                        />
                      </div>
                      {attempts > 0 && (
                        <p className="text-xs text-destructive text-center">
                          {5 - attempts} attempt{5 - attempts === 1 ? "" : "s"} remaining before lockout
                        </p>
                      )}
                    </div>
                    <Button
                      className="w-full bg-[#1a3a22] text-white hover:bg-[#152e1a]"
                      onClick={handlePinSubmit}
                      disabled={pin.length < 6 || isLoading}
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                      {isLoading ? "Verifying..." : "Continue"}
                    </Button>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Owner access — only shown to the business owner */}
        {isBusinessOwner && !selectedStaff && (
          <button
            onClick={setOwnerAccess}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-secondary/50 transition-all"
          >
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            Continue as Owner (no PIN required)
          </button>
        )}
      </div>
    </div>
  );
}
