import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusiness } from "@/hooks/useBusiness";

export default function CompanySettings() {
  const { business } = useBusiness();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Profile</CardTitle>
        <CardDescription>General business configuration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input value={business?.name || ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Input value="GHS (Ghana Cedi)" disabled />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input value="Africa/Accra (GMT+0)" disabled />
          </div>
          <div className="space-y-2">
            <Label>Region</Label>
            <Input value={business?.region || "Not set"} disabled />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Edit company details in Settings → Business Profile</p>
      </CardContent>
    </Card>
  );
}
