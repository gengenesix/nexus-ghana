import {
  LayoutDashboard, ShoppingCart, Package, FileText, Users, Truck,
  Receipt, BarChart3, UserCog, Settings, LogOut, Landmark, UserCircle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const allNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, feature: "dashboard" },
  { title: "Point of Sale", url: "/pos", icon: ShoppingCart, feature: "pos" },
  { title: "Inventory", url: "/inventory", icon: Package, feature: "inventory" },
  { title: "Invoices", url: "/invoices", icon: FileText, feature: "invoices" },
  { title: "Customers", url: "/customers", icon: Users, feature: "customers" },
  { title: "Suppliers", url: "/suppliers", icon: Truck, feature: "suppliers" },
  { title: "Expenses", url: "/expenses", icon: Receipt, feature: "expenses" },
  { title: "Reports", url: "/reports", icon: BarChart3, feature: "reports" },
  { title: "Staff", url: "/staff", icon: UserCog, feature: "staff" },
  { title: "Settings", url: "/settings", icon: Settings, feature: "settings" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const { staff, logout: staffLogout, canAccess } = useStaffSession();

  // Filter nav items based on role permissions
  const navItems = allNavItems.filter(item => canAccess(item.feature));

  const handleLogout = () => {
    staffLogout(); // Clear staff session
    signOut();     // Sign out from Supabase auth
  };

  const handleClockOut = () => {
    staffLogout();
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl gold-gradient shadow-lg shadow-primary/25 shrink-0">
          <Landmark className="h-5 w-5 text-primary-foreground" />
          <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/20" />
        </div>
        {!collapsed && (
          <span className="font-curly text-xl bg-gradient-to-r from-primary via-yellow-400 to-primary bg-clip-text text-transparent">
            Nexus-GH
          </span>
        )}
      </div>

      {/* Staff Info */}
      {staff && !collapsed && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2">
            <UserCircle className="h-5 w-5 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{staff.name}</p>
              <Badge variant="secondary" className="text-xs">{staff.role}</Badge>
            </div>
          </div>
        </div>
      )}

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        <Separator className="mb-1 bg-sidebar-border" />
        {/* Clock Out (staff session only) */}
        <button
          onClick={handleClockOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-all hover:bg-yellow-500/10 hover:text-yellow-500"
        >
          <UserCircle className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Clock Out</span>}
        </button>
        {/* Full Sign Out */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
