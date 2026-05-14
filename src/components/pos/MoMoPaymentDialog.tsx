import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Smartphone, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS } from "@/lib/ghana";
import { useBusiness } from "@/hooks/useBusiness";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  paymentMethod: string;  // "mtn_momo" | "telecel_cash" | "airteltigo"
  amount: number;
  clientReference: string;
  onSuccess: () => void;
  onSkip: () => void;      // fallback: record sale without Hubtel confirmation
}

const METHOD_CONFIG: Record<string, { label: string; merchant_field: keyof ReturnType<typeof useBusiness>["business"] & string; color: string }> = {
  mtn_momo:    { label: "MTN MoMo",        merchant_field: "momo_merchant_mtn",        color: "bg-yellow-500" },
  telecel_cash: { label: "Telecel Cash",    merchant_field: "momo_merchant_telecel",    color: "bg-red-500" },
  airteltigo:  { label: "AirtelTigo Money", merchant_field: "momo_merchant_airteltigo", color: "bg-blue-500" },
};

type Status = "idle" | "sending" | "pending" | "success" | "error";

export function MoMoPaymentDialog({ open, onOpenChange, paymentMethod, amount, clientReference, onSuccess, onSkip }: Props) {
  const { business } = useBusiness();
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const config = METHOD_CONFIG[paymentMethod];
  const merchantId: string = (business as any)?.[config?.merchant_field ?? ""] ?? "";

  const handleSend = async () => {
    const cleaned = phone.replace(/\s|-/g, "");
    if (!/^0[0-9]{9}$/.test(cleaned)) {
      toast.error("Enter a valid 10-digit Ghanaian phone number (e.g. 0241234567)");
      return;
    }
    if (!merchantId) {
      toast.error(`No ${config?.label} merchant ID configured. Add it in Settings → MoMo.`);
      return;
    }

    setStatus("sending");
    setErrorMsg("");

    try {
      const { data, error } = await supabase.functions.invoke("momo-collect", {
        body: {
          merchant_account_number: merchantId,
          customer_msisdn: cleaned,
          amount,
          description: `Nexis Sale #${clientReference}`,
          client_reference: clientReference,
        },
      });

      if (error || !data?.success) {
        setStatus("error");
        setErrorMsg(data?.message ?? error?.message ?? "Payment initiation failed");
        return;
      }

      setStatus("pending");
      toast.success("Payment prompt sent! Ask the customer to approve on their phone.");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message ?? "Unexpected error");
    }
  };

  const handleConfirmManual = () => {
    setStatus("success");
    toast.success(`${config?.label} payment confirmed`);
    setTimeout(() => {
      onSuccess();
      reset();
    }, 800);
  };

  const reset = () => {
    setPhone("");
    setStatus("idle");
    setErrorMsg("");
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            {config?.label ?? "MoMo"} Payment
          </DialogTitle>
          <DialogDescription>
            Send a payment prompt of{" "}
            <span className="font-semibold text-foreground">{formatGHS(amount)}</span> to
            the customer's phone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {status === "success" && (
            <div className="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/20 p-3">
              <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Payment confirmed!</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Failed to send prompt</p>
                <p className="text-xs text-muted-foreground">{errorMsg}</p>
              </div>
            </div>
          )}

          {status === "pending" && (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  Waiting for customer approval...
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Once the customer approves on their phone, click "Confirm Received" to complete the sale.
              </p>
            </div>
          )}

          {(status === "idle" || status === "error") && (
            <div className="space-y-2">
              <Label htmlFor="momo-phone">Customer Phone Number</Label>
              <Input
                id="momo-phone"
                placeholder="0241 234 567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                maxLength={13}
              />
              {!merchantId && (
                <p className="text-xs text-destructive">
                  No merchant ID for {config?.label}. Configure it in{" "}
                  <a href="/settings" className="underline">Settings → MoMo</a>.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {status === "pending" ? (
              <>
                <Button className="flex-1 bg-[#1a3a22] text-white font-semibold hover:bg-[#152e1a]" onClick={handleConfirmManual}>
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Confirm Received
                </Button>
                <Button variant="outline" onClick={onSkip}>
                  Skip
                </Button>
              </>
            ) : status === "idle" || status === "error" ? (
              <>
                <Button
                  className="flex-1 bg-[#1a3a22] text-white font-semibold hover:bg-[#152e1a]"
                  onClick={handleSend}
                  disabled={!phone || status === "sending"}
                >
                  {status === "sending" ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sending...</>
                  ) : (
                    <><Smartphone className="h-4 w-4 mr-1.5" /> Send Prompt</>
                  )}
                </Button>
                <Button variant="outline" onClick={onSkip} title="Record sale without MoMo confirmation">
                  Skip
                </Button>
              </>
            ) : null}
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            "Skip" records the sale immediately without waiting for MoMo confirmation.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
