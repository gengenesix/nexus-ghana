import {
  LayoutDashboard, ShoppingCart, Package, FileText, Users, Truck,
  Receipt, BarChart3, UserCog, Settings, LogOut, Landmark, UserCircle,
  Shield, Wallet, Handshake, ShoppingBag, Factory, Cpu, FolderKanban,
  Headphones, Users2, ArrowRightLeft, ChevronDown, Lock,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/hooks/useBusiness";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { useLicenseTier } from "@/hooks/useLicenseTier";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  feature: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Main",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, feature: "dashboard" },
      { title: "Point of Sale", url: "/pos", icon: ShoppingCart, feature: "pos" },
    ],
  },
  {
    label: "Sales & CRM",
    items: [
      { title: "CRM", url: "/crm", icon: Handshake, feature: "crm" },
      { title: "Sales Orders", url: "/sales-orders", icon: ShoppingBag, feature: "sales" },
      { title: "Invoices", url: "/invoices", icon: FileText, feature: "invoices" },
      { title: "Customers", url: "/customers", icon: Users, feature: "customers" },
    ],
  },
  {
    label: "Purchasing & Inventory",
    items: [
      { title: "Purchasing", url: "/purchasing", icon: Truck, feature: "purchasing" },
      { title: "Inventory", url: "/inventory", icon: Package, feature: "inventory" },
      { title: "Warehouses", url: "/warehouses", icon: ArrowRightLeft, feature: "inventory" },
      { title: "Suppliers", url: "/suppliers", icon: Truck, feature: "suppliers" },
    ],
  },
  {
    label: "Production & Planning",
    items: [
      { title: "Production", url: "/production", icon: Factory, feature: "production" },
      { title: "MRP", url: "/mrp", icon: Cpu, feature: "mrp" },
    ],
  },
  {
    label: "Finance & Banking",
    items: [
      { title: "Financials", url: "/financials", icon: Wallet, feature: "financials" },
      { title: "Banking", url: "/banking", icon: Landmark, feature: "banking" },
      { title: "Expenses", url: "/expenses", icon: Receipt, feature: "expenses" },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Projects", url: "/projects", icon: FolderKanban, feature: "projects" },
      { title: "Service", url: "/service", icon: Headphones, feature: "service" },
      { title: "HR", url: "/hr", icon: Users2, feature: "hr" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Reports", url: "/reports", icon: BarChart3, feature: "reports" },
      { title: "Administration", url: "/administration", icon: Shield, feature: "administration" },
      { title: "Staff", url: "/staff", icon: UserCog, feature: "staff" },
      { title: "Settings", url: "/settings", icon: Settings, feature: "settings" },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { business } = useBusiness();
  const { staff, logout: staffLogout, canAccess } = useStaffSession();
  const { canAccess: tierCanAccess } = useLicenseTier();
  const isBusinessOwner = !!user && !!business && business.owner_id === user.id;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Main: true, "Sales & CRM": true, "Purchasing & Inventory": true,
    "Production & Planning": true, "Finance & Banking": true,
    Operations: true, System: true,
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLogout = () => { staffLogout(); signOut(); };
  const handleSwitchStaff = () => { staffLogout(); };

  // Derive the module key from the URL (strips leading "/")
  const moduleKey = (url: string) => url.replace(/^\//, "");

  const renderItem = (item: NavItem) => {
    const locked = !tierCanAccess(moduleKey(item.url));
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === "/dashboard"}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm"
            activeClassName="bg-sidebar-accent text-primary font-medium"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.title}</span>
            {locked && !collapsed && (
              <Lock className="h-3 w-3 text-muted-foreground/60 shrink-0" />
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderItemCollapsed = (item: NavItem) => {
    const locked = !tierCanAccess(moduleKey(item.url));
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === "/dashboard"}
            className="relative flex items-center justify-center rounded-lg p-2 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeClassName="bg-sidebar-accent text-primary"
          >
            <item.icon className="h-4 w-4" />
            {locked && (
              <span className="absolute bottom-0.5 right-0.5 block h-2 w-2 rounded-full bg-muted-foreground/40 ring-1 ring-background">
                <Lock className="h-1.5 w-1.5 text-background" />
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
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
        {navGroups.map((group) => {
          const visibleItems = isBusinessOwner
            ? group.items
            : group.items.filter((item) => canAccess(item.feature));
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              {!collapsed ? (
                <Collapsible open={openGroups[group.label]} onOpenChange={() => toggleGroup(group.label)}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                    {group.label}
                    <ChevronDown className={`h-3 w-3 transition-transform ${openGroups[group.label] ? "rotate-0" : "-rotate-90"}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {visibleItems.map(renderItem)}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleItems.map(renderItemCollapsed)}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        <Separator className="mb-1 bg-sidebar-border" />
        {staff && (
          <button
            onClick={handleSwitchStaff}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-all hover:bg-yellow-500/10 hover:text-yellow-500"
          >
            <UserCircle className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Switch Staff User</span>}
          </button>
        )}
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
