import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { GHANA_REGIONS } from "@/lib/ghana";
import { Landmark, Loader2 } from "lucide-react";
import { useBusiness } from "@/hooks/useBusiness";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function Onboarding() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [address, setAddress] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const { createBusiness } = useBusiness();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Business name is required"); return; }
    if (adminPin.length < 6) { toast.error("PIN must be 6 digits"); return; }
    if (adminPin !== confirmPin) { toast.error("PINs do not match"); return; }

    try {
      const biz = await createBusiness.mutateAsync({ name: name.trim(), phone, email, region, address });

      // Auto-create the account owner as Manager for optional staff-mode handover
      const fullName = user?.user_metadata?.full_name || user?.email || "Admin";
      const { error: staffInsertError } = await supabase.from("staff_members").insert({
        business_id: biz.id,
        name: fullName,
        role: "Manager",
        pin: adminPin,
        email: user?.email || "",
        status: "active",
      });

      if (staffInsertError) {
        throw staffInsertError;
      }

      toast.success("Business created! Welcome to Nexus-GH 🎉");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to create business");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl gold-gradient shadow-lg shadow-primary/25">
            <Landmark className="h-7 w-7 text-primary-foreground" />
          </div>
          <span className="font-curly text-3xl gold-text">Nexus-GH</span>
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="font-display text-2xl">Set Up Your Business</CardTitle>
            <CardDescription>Tell us about your business to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bname">Business Name *</Label>
                <Input id="bname" placeholder="e.g. Kwame's Mini Mart" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input placeholder="024XXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="biz@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Region</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                  <SelectContent>{GHANA_REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea placeholder="Business address" value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <Separator className="my-2" />
              <p className="text-sm font-medium text-foreground">Set Your Admin PIN</p>
              <p className="text-xs text-muted-foreground">You'll use this PIN to assign/manage staff access. You won't be blocked by staff PIN as account owner.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>PIN (4-6 digits)</Label>
                  <Input type="password" placeholder="••••" maxLength={6} value={adminPin} onChange={e => setAdminPin(e.target.value.replace(/\D/g, ""))} required />
                </div>
                <div className="space-y-2">
                  <Label>Confirm PIN</Label>
                  <Input type="password" placeholder="••••" maxLength={6} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))} required />
                </div>
              </div>
              <Button type="submit" className="w-full gold-gradient text-primary-foreground font-semibold" disabled={createBusiness.isPending}>
                {createBusiness.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Business & Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
