import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GHANA_REGIONS } from "@/lib/ghana";
import { Building2, Receipt, CreditCard, Shield, Download, Zap } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [taxes, setTaxes] = useState({ vat: true, nhil: true, getfl: true });

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
                <div className="space-y-2"><Label>Business Name</Label><Input placeholder="My Business" /></div>
                <div className="space-y-2"><Label>Phone</Label><Input placeholder="024XXXXXXX" /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="hello@mybusiness.com" /></div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Select><SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                    <SelectContent>{GHANA_REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Address</Label><Textarea placeholder="Full business address" /></div>
              <Button className="gold-gradient text-primary-foreground" onClick={() => toast.success("Profile updated!")}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxes" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Ghana Tax Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div><p className="font-medium">VAT (15%)</p><p className="text-sm text-muted-foreground">Value Added Tax</p></div>
                <Switch checked={taxes.vat} onCheckedChange={v => setTaxes(t => ({ ...t, vat: v }))} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div><p className="font-medium">NHIL (2.5%)</p><p className="text-sm text-muted-foreground">National Health Insurance Levy</p></div>
                <Switch checked={taxes.nhil} onCheckedChange={v => setTaxes(t => ({ ...t, nhil: v }))} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div><p className="font-medium">GETFL (1%)</p><p className="text-sm text-muted-foreground">GETFund Levy</p></div>
                <Switch checked={taxes.getfl} onCheckedChange={v => setTaxes(t => ({ ...t, getfl: v }))} />
              </div>
              <Button className="gold-gradient text-primary-foreground" onClick={() => toast.success("Tax settings saved!")}>Save Tax Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display">Receipt Customization</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Receipt Header</Label><Input placeholder="e.g. Thank you for shopping with us!" /></div>
              <div className="space-y-2"><Label>Receipt Footer</Label><Input placeholder="e.g. Visit us again!" /></div>
              <div className="flex items-center justify-between">
                <Label>Show Business Logo on Receipt</Label>
                <Switch defaultChecked />
              </div>
              <Button className="gold-gradient text-primary-foreground" onClick={() => toast.success("Receipt settings saved!")}>Save</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Mobile Money Setup</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>MTN MoMo Merchant Number</Label><Input placeholder="e.g. 024XXXXXXX" /></div>
              <div className="space-y-2"><Label>Telecel Cash Number</Label><Input placeholder="e.g. 020XXXXXXX" /></div>
              <div className="space-y-2"><Label>AirtelTigo Money Number</Label><Input placeholder="e.g. 027XXXXXXX" /></div>
              <Button className="gold-gradient text-primary-foreground" onClick={() => toast.success("Payment settings saved!")}>Save Payment Settings</Button>
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
                <Button variant="secondary"><Download className="h-4 w-4 mr-1" /> Export as CSV</Button>
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
