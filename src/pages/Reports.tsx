import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/hooks/useBusiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { formatGHS } from "@/lib/ghana";
import { exportSalesCsv, exportInventoryCsv, exportExpensesCsv, exportProfitLossCsv } from "@/lib/export";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Download, TrendingUp, TrendingDown, Award } from "lucide-react";
import { toast } from "sonner";

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

  const { data: saleItems = [] } = useQuery({
    queryKey: ["all-sale-items", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select("product_name, qty, unit_price, sale_id, sales!inner(business_id)")
        .eq("sales.business_id", business!.id);
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
    queryKey: ["products-report", business?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("business_id", business!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!business,
  });

  // Monthly P&L data
  const monthlyMap: Record<string, { revenue: number; expenses: number }> = {};
  const monthOrder: string[] = [];
  
  sales.forEach((s: any) => {
    const d = new Date(s.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en", { month: "short", year: "2-digit" });
    if (!monthlyMap[key]) { monthlyMap[key] = { revenue: 0, expenses: 0 }; monthOrder.push(key); }
    monthlyMap[key].revenue += Number(s.total);
  });
  expenses.forEach((e: any) => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[key]) { monthlyMap[key] = { revenue: 0, expenses: 0 }; monthOrder.push(key); }
    monthlyMap[key].expenses += Number(e.amount);
  });

  const sortedMonths = [...new Set(monthOrder)].sort();
  const monthlyData = sortedMonths.map(key => {
    const d = new Date(key + "-01");
    return {
      month: d.toLocaleString("en", { month: "short", year: "2-digit" }),
      revenue: monthlyMap[key].revenue,
      expenses: monthlyMap[key].expenses,
      profit: monthlyMap[key].revenue - monthlyMap[key].expenses,
    };
  });

  // Top-selling products
  const productSalesMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  saleItems.forEach((item: any) => {
    const name = item.product_name;
    if (!productSalesMap[name]) productSalesMap[name] = { name, qty: 0, revenue: 0 };
    productSalesMap[name].qty += item.qty;
    productSalesMap[name].revenue += item.qty * Number(item.unit_price);
  });
  const topProducts = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Payment method breakdown
  const paymentMap: Record<string, number> = {};
  sales.forEach((s: any) => { paymentMap[s.payment_method] = (paymentMap[s.payment_method] || 0) + Number(s.total); });
  const paymentData = Object.entries(paymentMap).map(([name, value]) => ({ name, value }));

  // Expense category breakdown
  const expCatMap: Record<string, number> = {};
  expenses.forEach((e: any) => { expCatMap[e.category] = (expCatMap[e.category] || 0) + Number(e.amount); });
  const expenseCatData = Object.entries(expCatMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const totalRevenue = sales.reduce((s: number, r: any) => s + Number(r.total), 0);
  const totalExpensesAmt = expenses.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const netProfit = totalRevenue - totalExpensesAmt;
  const totalInventoryValue = products.reduce((s: number, p: any) => s + Number(p.selling_price) * p.qty, 0);
  const totalCostValue = products.reduce((s: number, p: any) => s + Number(p.cost_price) * p.qty, 0);
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCostValue) / totalRevenue * 100) : 0;

  const handleExportSales = () => { exportSalesCsv(sales); toast.success("Sales exported!"); };
  const handleExportInventory = () => { exportInventoryCsv(products); toast.success("Inventory exported!"); };
  const handleExportExpenses = () => { exportExpensesCsv(expenses); toast.success("Expenses exported!"); };
  const handleExportPL = () => { exportProfitLossCsv(monthlyData); toast.success("P&L report exported!"); };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm">Insights into your business performance</p>
        </div>
      </div>

      <Tabs defaultValue="pnl">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="top-products">Top Products</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        {/* Profit & Loss */}
        <TabsContent value="pnl" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportPL}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          </div>
          <div className="grid sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-2xl font-display font-bold text-primary">{formatGHS(totalRevenue)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Expenses</p><p className="text-2xl font-display font-bold text-destructive">{formatGHS(totalExpensesAmt)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground flex items-center justify-center gap-1">{netProfit >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-destructive" />} Net Profit</p><p className={`text-2xl font-display font-bold ${netProfit >= 0 ? "text-green-500" : "text-destructive"}`}>{formatGHS(netProfit)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Gross Margin</p><p className="text-2xl font-display font-bold">{grossMargin.toFixed(1)}%</p></CardContent></Card>
          </div>
          {monthlyData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Monthly Trends</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 20%)" />
                    <XAxis dataKey="month" stroke="hsl(215, 15%, 55%)" fontSize={12} />
                    <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatGHS(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(37, 90%, 55%)" strokeWidth={2} dot={{ r: 4 }} name="Revenue" />
                    <Line type="monotone" dataKey="expenses" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ r: 4 }} name="Expenses" />
                    <Line type="monotone" dataKey="profit" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={{ r: 4 }} name="Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Sales */}
        <TabsContent value="sales" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportSales}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          </div>
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
                    <Bar dataKey="revenue" fill="hsl(37, 90%, 55%)" radius={[6, 6, 0, 0]} name="Sales" />
                    <Bar dataKey="expenses" fill="hsl(0, 72%, 51%)" radius={[6, 6, 0, 0]} name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {paymentData.length > 0 && (
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
          )}
        </TabsContent>

        {/* Top Products */}
        <TabsContent value="top-products" className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> Top Selling Products</CardTitle></CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No sales data yet</p>
                ) : (
                  <div className="space-y-3">
                    {topProducts.map((p, i) => (
                      <div key={p.name} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                        <div className="flex items-center gap-3">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.qty} units sold</p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-primary">{formatGHS(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            {topProducts.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="font-display text-base">Revenue by Product</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topProducts.slice(0, 7)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 20%)" />
                      <XAxis type="number" stroke="hsl(215, 15%, 55%)" fontSize={11} tickFormatter={(v) => `₵${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" width={100} stroke="hsl(215, 15%, 55%)" fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatGHS(v)} />
                      <Bar dataKey="revenue" fill="hsl(37, 90%, 55%)" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Inventory */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportInventory}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          </div>
          <div className="grid sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Products</p><p className="text-2xl font-display font-bold">{products.length}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Retail Value</p><p className="text-2xl font-display font-bold text-primary">{formatGHS(totalInventoryValue)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Cost Value</p><p className="text-2xl font-display font-bold">{formatGHS(totalCostValue)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Low Stock</p><p className="text-2xl font-display font-bold text-destructive">{products.filter((p: any) => p.qty <= p.reorder_level).length}</p></CardContent></Card>
          </div>
        </TabsContent>

        {/* Expenses */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportExpenses}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Expenses</p><p className="text-2xl font-display font-bold text-destructive">{formatGHS(totalExpensesAmt)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Net Profit</p><p className={`text-2xl font-display font-bold ${netProfit >= 0 ? "text-green-500" : "text-destructive"}`}>{formatGHS(netProfit)}</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Expense Categories</p><p className="text-2xl font-display font-bold">{expenseCatData.length}</p></CardContent></Card>
          </div>
          {expenseCatData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Expenses by Category</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={expenseCatData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${formatGHS(value)}`}>
                      {expenseCatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatGHS(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
