import { useState } from "react";
import { useBusiness } from "@/hooks/useBusiness";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, Lock, Loader2, UserCircle } from "lucide-react";
import { toast } from "sonner";

interface StaffPinGuardProps {
  children: React.ReactNode;
}

export function StaffPinGuard({ children }: StaffPinGuardProps) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const { staff, isStaffLoggedIn, loginWithPin } = useStaffSession();
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isBusinessOwner = !!user && !!business && business.owner_id === user.id;

  const handlePinSubmit = async () => {
    if (!business || pin.length < 4) return;

    setIsLoading(true);
    const result = await loginWithPin(business.id, pin);
    setIsLoading(false);

    if (result) {
      toast.success(`Welcome, ${result.name}`);
    } else {
      toast.error("Invalid staff PIN. Please try again.");
      setPin("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && pin.length >= 4) {
      handlePinSubmit();
    }
  };

  // Business owners/admins should never be blocked by staff PIN
  if (isBusinessOwner) {
    return <>{children}</>;
  }

  // Active staff session can access app
  if (isStaffLoggedIn && staff) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl gold-gradient shadow-xl shadow-primary/30">
              <Landmark className="h-8 w-8 text-primary-foreground" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-transparent to-white/20" />
            </div>
          </div>
          <div>
            <CardTitle className="font-display text-2xl">Staff Access</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{business?.name || "Nexus-GH"}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Enter your staff PIN"
                maxLength={6}
                className="pl-10 text-center text-xl tracking-widest"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>
          </div>
          <Button
            className="w-full gold-gradient text-primary-foreground"
            onClick={handlePinSubmit}
            disabled={pin.length < 4 || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <UserCircle className="h-4 w-4 mr-2" />
            )}
            {isLoading ? "Verifying..." : "Continue"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Staff members can continue with the PIN assigned by the administrator
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
