import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { formatGHS } from "@/lib/ghana";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Download, FileText } from "lucide-react";

const COLORS = ["hsl(37, 90%, 55%)", "hsl(210, 92%, 45%)", "hsl(142, 76%, 36%)", "hsl(215, 15%, 55%)", "hsl(0, 72%, 51%)"];
const tooltipStyle = { background: "hsl(220, 35%, 12%)", border: "1px solid hsl(220, 20%, 20%)", borderRadius: 8, color: "hsl(210, 40%, 96%)" };

export default function Reports() {
  const { business } = useBusiness();

  const { data: sales = [] } = useQuery({
    queryKey: ["all-sales", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*").eq("business_id", business!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["all-expenses", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("business_id", business!.id).order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("business_id", business!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  // Monthly sales/expenses
  const monthlyMap: Record<string, { sales: number; expenses: number }> = {};
  sales.forEach((s: any) => {
    const m = new Date(s.created_at).toLocaleString("en", { month: "short" });
    if (!monthlyMap[m]) monthlyMap[m] = { sales: 0, expenses: 0 };
    monthlyMap[m].sales += Number(s.total);
  });
  expenses.forEach((e: any) => {
    const m = new Date(e.date).toLocaleString("en", { month: "short" });
    if (!monthlyMap[m]) monthlyMap[m] = { sales: 0, expenses: 0 };
    monthlyMap[m].expenses += Number(e.amount);
  });
  const monthlyData = Object.entries(monthlyMap).map(([month, data]) => ({ month, ...data }));

  // Payment method breakdown
  const paymentMap: Record<string, number> = {};
  sales.forEach((s: any) => {
    paymentMap[s.payment_method] = (paymentMap[s.payment_method] || 0) + Number(s.total);
  });
  const paymentData = Object.entries(paymentMap).map(([name, value]) => ({ name, value }));

  const totalRevenue = sales.reduce((s: number, r: any) => s + Number(r.total), 0);
  const totalExpensesAmt = expenses.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalInventoryValue = products.reduce((s: number, p: any) => s + Number(p.selling_price) * p.qty, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm">Insights into your business performance</p>
        </div>
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-display font-bold text-primary">{formatGHS(totalRevenue)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Avg. Order Value</p><p className="text-2xl font-display font-bold">{formatGHS(sales.length > 0 ? totalRevenue / sales.length : 0)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Transactions</p><p className="text-2xl font-display font-bold">{sales.length}</p></CardContent></Card>
          </div>
          {monthlyData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Sales vs Expenses</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
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
          )}
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Products</p><p className="text-2xl font-display font-bold">{products.length}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Inventory Value</p><p className="text-2xl font-display font-bold text-primary">{formatGHS(totalInventoryValue)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Low Stock</p><p className="text-2xl font-display font-bold text-destructive">{products.filter((p: any) => p.qty <= p.reorder_level).length}</p></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Expenses</p><p className="text-2xl font-display font-bold text-destructive">{formatGHS(totalExpensesAmt)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Net Profit</p><p className="text-2xl font-display font-bold text-success">{formatGHS(totalRevenue - totalExpensesAmt)}</p></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          {paymentData.length > 0 ? (
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Payment Methods</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${formatGHS(value)}`}>
                      {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatGHS(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No payment data yet. Complete your first sale!</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
