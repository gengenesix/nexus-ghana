import { LayoutDashboard, ShoppingCart, Package, FileText, Users, MoreHorizontal } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Truck, Receipt, BarChart3, UserCog, Settings, LogOut, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "@/components/ui/separator";

const mainItems = [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard },
  { title: "POS", url: "/pos", icon: ShoppingCart },
  { title: "Stock", url: "/inventory", icon: Package },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "More", url: "#more", icon: MoreHorizontal },
];

const moreItems = [
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Suppliers", url: "/suppliers", icon: Truck },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Staff", url: "/staff", icon: UserCog },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden">
      <div className="flex items-center justify-around py-2">
        {mainItems.map((item) =>
          item.url === "#more" ? (
            <Sheet key="more" open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground">
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px]">{item.title}</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="bg-card border-border">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-5 w-5 text-primary" />
                  <span className="font-display font-bold text-lg gold-text">NexusGH</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {moreItems.map((mi) => (
                    <NavLink
                      key={mi.title}
                      to={mi.url}
                      className="flex flex-col items-center gap-2 rounded-xl p-4 text-muted-foreground hover:bg-secondary"
                      activeClassName="bg-secondary text-primary"
                      onClick={() => setOpen(false)}
                    >
                      <mi.icon className="h-6 w-6" />
                      <span className="text-xs">{mi.title}</span>
                    </NavLink>
                  ))}
                </div>
                <Separator className="my-4" />
                <button
                  onClick={() => { signOut(); setOpen(false); }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl p-3 text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="text-sm">Sign Out</span>
                </button>
              </SheetContent>
            </Sheet>
          ) : (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/dashboard"}
              className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground"
              activeClassName="text-primary"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px]">{item.title}</span>
            </NavLink>
          )
        )}
      </div>
    </nav>
  );
}
