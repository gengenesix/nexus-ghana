import { LayoutDashboard, ShoppingCart, Package, FileText, Users, MoreHorizontal } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Truck, Receipt, BarChart3, UserCog, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/hooks/useBusiness";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { Separator } from "@/components/ui/separator";

const mainItems = [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard, feature: "dashboard" },
  { title: "POS", url: "/pos", icon: ShoppingCart, feature: "pos" },
  { title: "Stock", url: "/inventory", icon: Package, feature: "inventory" },
  { title: "Invoices", url: "/invoices", icon: FileText, feature: "invoices" },
];

const moreItemDefs = [
  { title: "Customers", url: "/customers", icon: Users, feature: "customers" },
  { title: "Suppliers", url: "/suppliers", icon: Truck, feature: "suppliers" },
  { title: "Expenses", url: "/expenses", icon: Receipt, feature: "expenses" },
  { title: "Reports", url: "/reports", icon: BarChart3, feature: "reports" },
  { title: "Staff", url: "/staff", icon: UserCog, feature: "staff" },
  { title: "Settings", url: "/settings", icon: Settings, feature: "settings" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { business } = useBusiness();
  const { staff, ownerBypass, canAccess } = useStaffSession();

  const isOwner = !!user && !!business && business.owner_id === user.id;
  // Show all items only when owner bypass is active (no staff session) or there's no session at all
  const fullAccess = ownerBypass || (!staff && isOwner);
  const allowed = (feature: string) => fullAccess || canAccess(feature);

  const visibleMain = mainItems.filter(item => allowed(item.feature));
  const moreItems = moreItemDefs.filter(item => allowed(item.feature));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden">
      <div className="flex items-center justify-around py-2">
        {visibleMain.map((item) => (
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
        ))}
        {moreItems.length > 0 && (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground">
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[10px]">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-card border-border">
              <div className="flex items-center gap-2.5 mb-4">
                <img src="/brand/nexis-icon-green.png" alt="Nexis" style={{ width: 40, height: 40, borderRadius: 10, display: "block", boxShadow: "0 3px 14px rgba(26,58,34,0.15)" }} />
                <img src="/brand/nexis-wordmark-dark.png" alt="" aria-hidden style={{ height: 18, display: "block" }} />
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
        )}
      </div>
    </nav>
  );
}
