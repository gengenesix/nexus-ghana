import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { formatGHS } from "@/lib/ghana";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Download, FileText } from "lucide-react";

const salesData = [
  { month: "Jan", sales: 45000, expenses: 32000 },
  { month: "Feb", sales: 52000, expenses: 35000 },
  { month: "Mar", sales: 48000, expenses: 30000 },
];

const categoryData = [
  { name: "Food", value: 45 },
  { name: "Beverages", value: 25 },
  { name: "Household", value: 18 },
  { name: "Other", value: 12 },
];

const COLORS = ["hsl(37, 90%, 55%)", "hsl(210, 92%, 45%)", "hsl(142, 76%, 36%)", "hsl(215, 15%, 55%)"];

const tooltipStyle = { background: "hsl(220, 35%, 12%)", border: "1px solid hsl(220, 20%, 20%)", borderRadius: 8, color: "hsl(210, 40%, 96%)" };

export default function Reports() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm">Insights into your business performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          <Button variant="secondary" size="sm"><FileText className="h-4 w-4 mr-1" /> Export PDF</Button>
        </div>
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-display font-bold text-primary">{formatGHS(145000)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Avg. Order Value</p><p className="text-2xl font-display font-bold">{formatGHS(85.50)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Transactions</p><p className="text-2xl font-display font-bold">1,694</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Sales vs Expenses</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 20%)" />
                  <XAxis dataKey="month" stroke="hsl(215, 15%, 55%)" />
                  <YAxis stroke="hsl(215, 15%, 55%)" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatGHS(v)} />
                  <Bar dataKey="sales" fill="hsl(37, 90%, 55%)" radius={[6, 6, 0, 0]} name="Sales" />
                  <Bar dataKey="expenses" fill="hsl(0, 72%, 51%)" radius={[6, 6, 0, 0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Sales by Category</CardTitle></CardHeader>
            <CardContent className="flex justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name} ${value}%`}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers"><Card><CardContent className="py-12 text-center text-muted-foreground">Customer analytics coming soon — connect your database to see real data.</CardContent></Card></TabsContent>
        <TabsContent value="expenses"><Card><CardContent className="py-12 text-center text-muted-foreground">Expense analytics coming soon — connect your database to see real data.</CardContent></Card></TabsContent>
        <TabsContent value="staff"><Card><CardContent className="py-12 text-center text-muted-foreground">Staff analytics coming soon — connect your database to see real data.</CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
