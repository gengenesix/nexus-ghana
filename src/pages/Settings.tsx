import { useState, useEffect } from "react";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { GHANA_REGIONS } from "@/lib/ghana";
import { Building2, Receipt, CreditCard, Download, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { business, updateBusiness } = useBusiness();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [address, setAddress] = useState("");
  const [momoMtn, setMomoMtn] = useState("");
  const [momoTelecel, setMomoTelecel] = useState("");
  const [momoAirteltigo, setMomoAirteltigo] = useState("");
  const [taxVat, setTaxVat] = useState(true);
  const [taxNhil, setTaxNhil] = useState(true);
  const [taxGetfl, setTaxGetfl] = useState(true);
  const [receiptHeader, setReceiptHeader] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [receiptShowLogo, setReceiptShowLogo] = useState(true);

  useEffect(() => {
    if (business) {
      setName(business.name || ""); setPhone(business.phone || ""); setEmail(business.email || ""); setRegion(business.region || ""); setAddress(business.address || "");
      setMomoMtn(business.momo_merchant_mtn || ""); setMomoTelecel(business.momo_merchant_telecel || ""); setMomoAirteltigo(business.momo_merchant_airteltigo || "");
      setTaxVat(business.tax_vat); setTaxNhil(business.tax_nhil); setTaxGetfl(business.tax_getfl);
      setReceiptHeader(business.receipt_header || ""); setReceiptFooter(business.receipt_footer || ""); setReceiptShowLogo(business.receipt_show_logo);
    }
  }, [business]);

  const saveProfile = async () => {
    try {
      await updateBusiness.mutateAsync({ name, phone, email, region, address });
      toast.success("Profile updated!");
    } catch (err: any) { toast.error(err.message); }
  };

  const saveTaxes = async () => {
    try {
      await updateBusiness.mutateAsync({ tax_vat: taxVat, tax_nhil: taxNhil, tax_getfl: taxGetfl });
      toast.success("Tax settings saved!");
    } catch (err: any) { toast.error(err.message); }
  };

  const saveReceipts = async () => {
    try {
      await updateBusiness.mutateAsync({ receipt_header: receiptHeader, receipt_footer: receiptFooter, receipt_show_logo: receiptShowLogo });
      toast.success("Receipt settings saved!");
    } catch (err: any) { toast.error(err.message); }
  };

  const savePayments = async () => {
    try {
      await updateBusiness.mutateAsync({ momo_merchant_mtn: momoMtn, momo_merchant_telecel: momoTelecel, momo_merchant_airteltigo: momoAirteltigo });
      toast.success("Payment settings saved!");
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your business configuration</p>
      </div>

      <Tabs defaultValue="business">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Business Profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Business Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                    <SelectContent>{GHANA_REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Address</Label><Textarea value={address} onChange={e => setAddress(e.target.value)} /></div>
              <Button className="gold-gradient text-primary-foreground" onClick={saveProfile} disabled={updateBusiness.isPending}>
                {updateBusiness.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxes" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Ghana Tax Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div><p className="font-medium">VAT (15%)</p><p className="text-sm text-muted-foreground">Value Added Tax</p></div>
                <Switch checked={taxVat} onCheckedChange={setTaxVat} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div><p className="font-medium">NHIL (2.5%)</p><p className="text-sm text-muted-foreground">National Health Insurance Levy</p></div>
                <Switch checked={taxNhil} onCheckedChange={setTaxNhil} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div><p className="font-medium">GETFL (1%)</p><p className="text-sm text-muted-foreground">GETFund Levy</p></div>
                <Switch checked={taxGetfl} onCheckedChange={setTaxGetfl} />
              </div>
              <Button className="gold-gradient text-primary-foreground" onClick={saveTaxes} disabled={updateBusiness.isPending}>Save Tax Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display">Receipt Customization</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Receipt Header</Label><Input value={receiptHeader} onChange={e => setReceiptHeader(e.target.value)} placeholder="e.g. Thank you for shopping with us!" /></div>
              <div className="space-y-2"><Label>Receipt Footer</Label><Input value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} placeholder="e.g. Visit us again!" /></div>
              <div className="flex items-center justify-between">
                <Label>Show Business Logo on Receipt</Label>
                <Switch checked={receiptShowLogo} onCheckedChange={setReceiptShowLogo} />
              </div>
              <Button className="gold-gradient text-primary-foreground" onClick={saveReceipts} disabled={updateBusiness.isPending}>Save</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Mobile Money Setup</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>MTN MoMo Merchant Number</Label><Input value={momoMtn} onChange={e => setMomoMtn(e.target.value)} placeholder="e.g. 024XXXXXXX" /></div>
              <div className="space-y-2"><Label>Telecel Cash Number</Label><Input value={momoTelecel} onChange={e => setMomoTelecel(e.target.value)} placeholder="e.g. 020XXXXXXX" /></div>
              <div className="space-y-2"><Label>AirtelTigo Money Number</Label><Input value={momoAirteltigo} onChange={e => setMomoAirteltigo(e.target.value)} placeholder="e.g. 027XXXXXXX" /></div>
              <Button className="gold-gradient text-primary-foreground" onClick={savePayments} disabled={updateBusiness.isPending}>Save Payment Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><Download className="h-5 w-5 text-primary" /> Data & Backup</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Export your business data for backup or migration.</p>
              <div className="flex gap-2">
                <Button variant="secondary"><Download className="h-4 w-4 mr-1" /> Export All Data (JSON)</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> Subscription</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg gold-gradient text-primary-foreground">
                <div>
                  <p className="font-bold text-lg">NexusGH Pro</p>
                  <p className="text-sm opacity-90">Unlimited features · Priority support</p>
                </div>
                <Badge className="bg-primary-foreground/20 text-primary-foreground">Active</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
