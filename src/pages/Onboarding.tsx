import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GHANA_REGIONS } from "@/lib/ghana";
import { Loader2, Building2, MapPin, Phone, Mail, Lock } from "lucide-react";
import { useBusiness } from "@/hooks/useBusiness";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const STEPS = [
  { icon: Building2, label: "Business info" },
  { icon: MapPin,    label: "Location" },
  { icon: Lock,      label: "Admin PIN" },
];

export default function Onboarding() {
  const [name, setName]             = useState("");
  const [phone, setPhone]           = useState("");
  const [email, setEmail]           = useState("");
  const [region, setRegion]         = useState("");
  const [address, setAddress]       = useState("");
  const [adminPin, setAdminPin]     = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const { createBusiness } = useBusiness();
  const { user } = useAuth();
  const navigate = useNavigate();

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 16,
    border: "2px solid hsl(var(--border))",
    backgroundColor: "white",
    color: "var(--forest)",
    fontFamily: "inherit",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.15s",
  };

  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = "var(--forest)";
  };
  const blur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = "hsl(var(--border))";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim())           { toast.error("Business name is required"); return; }
    if (adminPin.length < 6)    { toast.error("PIN must be 6 digits"); return; }
    if (adminPin !== confirmPin) { toast.error("PINs do not match"); return; }

    try {
      const biz = await createBusiness.mutateAsync({ name: name.trim(), phone, email, region, address });
      const fullName = user?.user_metadata?.full_name || user?.email || "Admin";
      const { error } = await supabase.from("staff_members").insert({
        business_id: biz.id,
        name: fullName,
        role: "Manager",
        pin: adminPin,
        email: user?.email || "",
        status: "active",
      });
      if (error) throw error;
      toast.success("Business created! Welcome to Nexus-GH 🎉");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to create business");
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "var(--cream)" }}>
      {/* ── Left panel ───────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[460px] xl:w-[520px] flex-shrink-0 flex-col relative overflow-hidden"
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
            <span className="text-white text-lg font-extrabold" style={{ letterSpacing: "-0.03em" }}>
              Nexus-GH
            </span>
          </div>

          {/* Hero copy */}
          <div className="flex-1 flex flex-col justify-center">
            <span
              className="block text-xs font-bold uppercase mb-4"
              style={{ letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}
            >
              Almost there
            </span>
            <h1
              className="text-white font-extrabold leading-tight mb-6"
              style={{ fontSize: "clamp(1.75rem, 2.5vw, 2.25rem)", letterSpacing: "-0.03em" }}
            >
              Set up your<br />business profile.
            </h1>
            <p className="text-sm leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.55)" }}>
              This takes under 2 minutes. You can always update your details later from Settings.
            </p>

            {/* Progress steps */}
            <div className="space-y-4">
              {STEPS.map((step, i) => (
                <div key={step.label} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                  >
                    <step.icon className="h-4 w-4" style={{ color: "var(--lime)" }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.28)" }}>
            Your data is encrypted and never shared.
          </p>
        </div>
      </div>

      {/* ── Right panel — form ───────────────────── */}
      <div
        className="flex-1 flex items-start justify-center px-6 py-12 overflow-y-auto"
        style={{ backgroundColor: "var(--cream)" }}
      >
        <div className="w-full max-w-[480px] animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs"
              style={{ backgroundColor: "var(--forest)", color: "var(--lime)" }}
            >
              NX
            </div>
            <span className="font-extrabold text-lg" style={{ color: "var(--forest)", letterSpacing: "-0.03em" }}>
              Nexus-GH
            </span>
          </div>

          <h2
            className="text-3xl font-extrabold mb-1"
            style={{ color: "var(--forest)", letterSpacing: "-0.025em" }}
          >
            Set up your business
          </h2>
          <p className="text-sm mb-8" style={{ color: "var(--muted-foreground)" }}>
            Fill in your business details to get started
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Business name */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                Business Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Kwame's Mini Mart"
                required
                style={inputStyle}
                onFocus={focus}
                onBlur={blur}
              />
            </div>

            {/* Phone + Email */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="024XXXXXXX"
                  style={inputStyle}
                  onFocus={focus}
                  onBlur={blur}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                  Business Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="biz@email.com"
                  style={inputStyle}
                  onFocus={focus}
                  onBlur={blur}
                />
              </div>
            </div>

            {/* Region */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                Region
              </label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger
                  className="rounded-2xl"
                  style={{ border: "2px solid hsl(var(--border))", backgroundColor: "white", height: 46 }}
                >
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {GHANA_REGIONS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                Address
              </label>
              <textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Business address"
                rows={2}
                style={{ ...inputStyle, resize: "none" }}
                onFocus={focus}
                onBlur={blur}
              />
            </div>

            {/* Divider */}
            <div className="pt-2">
              <div
                className="border-t mb-4"
                style={{ borderColor: "hsl(var(--border))" }}
              />
              <p className="text-sm font-bold mb-0.5" style={{ color: "var(--forest)" }}>
                Set Your Admin PIN
              </p>
              <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
                6-digit PIN for admin login. You won't be blocked by staff PIN screens.
              </p>
            </div>

            {/* PIN fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                  PIN (6 digits)
                </label>
                <input
                  type="password"
                  placeholder="••••••"
                  maxLength={6}
                  value={adminPin}
                  onChange={e => setAdminPin(e.target.value.replace(/\D/g, ""))}
                  required
                  style={inputStyle}
                  onFocus={focus}
                  onBlur={blur}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--forest)" }}>
                  Confirm PIN
                </label>
                <input
                  type="password"
                  placeholder="••••••"
                  maxLength={6}
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                  required
                  style={inputStyle}
                  onFocus={focus}
                  onBlur={blur}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={createBusiness.isPending}
              className="w-full py-3.5 rounded-full font-bold text-base transition-all duration-150 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              style={{ backgroundColor: "var(--forest)", color: "white" }}
            >
              {createBusiness.isPending
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : "Create Business & Continue"
              }
            </button>
          </form>

          <p className="text-center text-xs mt-6" style={{ color: "var(--muted-foreground)" }}>
            © 2026 Nexus-GH · By GENESIS
          </p>
        </div>
      </div>
    </div>
  );
}
