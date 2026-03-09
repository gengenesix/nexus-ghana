import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GHANA_REGIONS } from "@/lib/ghana";
import { Zap, Loader2 } from "lucide-react";
import { useBusiness } from "@/hooks/useBusiness";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Onboarding() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [address, setAddress] = useState("");
  const { createBusiness } = useBusiness();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Business name is required"); return; }
    try {
      await createBusiness.mutateAsync({ name: name.trim(), phone, email, region, address });
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
          <Zap className="h-10 w-10 text-primary" />
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
