import { ReactNode } from "react";
import { Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLicenseTier, MODULE_REQUIRED_TIER, TIER_LABELS } from "@/hooks/useLicenseTier";

interface Props {
  module: string;
  children: ReactNode;
}

export function TierGate({ module, children }: Props) {
  const { canAccess } = useLicenseTier();

  if (canAccess(module)) return <>{children}</>;

  const requiredTier = MODULE_REQUIRED_TIER[module];
  const tierLabel = requiredTier ? TIER_LABELS[requiredTier] : "higher";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center animate-fade-in">
      <div className="relative">
        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Lock className="h-9 w-9 text-primary" />
        </div>
        <Badge
          variant="secondary"
          className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0 border border-primary/20"
        >
          Upgrade
        </Badge>
      </div>

      <div className="max-w-sm space-y-2">
        <h2 className="text-xl font-display font-bold capitalize">{module.replace("-", " ")} Module</h2>
        <p className="text-sm text-muted-foreground">
          This module is included in the{" "}
          <span className="text-primary font-semibold">{tierLabel} plan</span>.
          Upgrade your subscription to unlock it.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 gap-2"
          onClick={() => window.open("mailto:sales@nexusgh.com?subject=Upgrade%20Request", "_blank")}
        >
          <Zap className="h-4 w-4" />
          Upgrade to {tierLabel}
        </Button>
        <Button variant="outline" onClick={() => history.back()}>
          Go Back
        </Button>
      </div>
    </div>
  );
}
