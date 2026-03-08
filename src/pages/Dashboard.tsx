import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatGHS } from "@/lib/ghana";
import {
  ShoppingCart, FileText, Package, Users, Plus, TrendingUp, AlertTriangle, ArrowRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useNavigate } from "react-router-dom";

const weeklyData = [
  { day: "Mon", sales: 1250 },
  { day: "Tue", sales: 980 },
  { day: "Wed", sales: 1540 },
  { day: "Thu", sales: 2100 },
  { day: "Fri", sales: 1890 },
  { day: "Sat", sales: 2450 },
  { day: "Sun", sales: 650 },
];

const recentTransactions = [
  { id: 1, customer: "Ama Mensah", amount: 245.00, method: "MTN MoMo", time: "2 min ago" },
  { id: 2, customer: "Kofi Boateng", amount: 89.50, method: "Cash", time: "15 min ago" },
  { id: 3, customer: "Walk-in", amount: 320.00, method: "Card", time: "32 min ago" },
  { id: 4, customer: "Yaa Asantewaa", amount: 156.75, method: "Telecel Cash", time: "1 hr ago" },
  { id: 5, customer: "Kweku Annan", amount: 530.00, method: "Bank Transfer", time: "2 hrs ago" },
];

const topProducts = [
  { name: "Indomie Noodles (Carton)", sold: 48, revenue: 576 },
  { name: "Frytol Cooking Oil 5L", sold: 32, revenue: 1280 },
  { name: "Peak Milk (Tin)", sold: 65, revenue: 455 },
  { name: "Sugar 1kg", sold: 40, revenue: 360 },
  { name: "Milo 400g", sold: 28, revenue: 560 },
];

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of your business performance</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/pos")} size="sm" className="gold-gradient text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> New Sale
          </Button>
          <Button onClick={() => navigate("/invoices")} size="sm" variant="secondary">
            <FileText className="h-4 w-4 mr-1" /> New Invoice
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today's Sales" value={formatGHS(10860)} icon={ShoppingCart} trend="12% vs yesterday" trendUp />
        <StatCard title="Unpaid Invoices" value="7" icon={FileText} trend="GHS 4,230 outstanding" />
        <StatCard title="Low Stock Items" value="5" icon={AlertTriangle} trend="Needs reorder" />
        <StatCard title="Total Customers" value="142" icon={Users} trend="+8 this week" trendUp />
      </div>

      {/* Charts and tables */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Weekly Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 20%, 20%)" />
                <XAxis dataKey="day" stroke="hsl(215, 15%, 55%)" fontSize={12} />
                <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "hsl(220, 35%, 12%)", border: "1px solid hsl(220, 20%, 20%)", borderRadius: 8, color: "hsl(210, 40%, 96%)" }}
                  formatter={(value: number) => [formatGHS(value), "Sales"]}
                />
                <Bar dataKey="sales" fill="hsl(37, 90%, 55%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Top Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  <span className="truncate max-w-[130px]">{p.name}</span>
                </div>
                <span className="text-muted-foreground">{p.sold} sold</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display">Recent Transactions</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/reports")} className="text-primary">
            View All <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{tx.customer}</p>
                  <p className="text-xs text-muted-foreground">{tx.method} · {tx.time}</p>
                </div>
                <span className="font-display font-semibold text-primary">{formatGHS(tx.amount)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
