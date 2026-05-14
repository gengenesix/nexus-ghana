import {
  LayoutDashboard, ShoppingCart, Package, FileText, Users, Truck,
  Receipt, BarChart3, UserCog, Settings, LogOut, UserCircle,
  Shield, Wallet, Handshake, ShoppingBag, Factory, Cpu, FolderKanban,
  Headphones, Users2, ArrowRightLeft, ChevronDown, Lock, Landmark,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/hooks/useBusiness";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { useLicenseTier } from "@/hooks/useLicenseTier";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface NavItem  { title: string; url: string; icon: any; feature: string; }
interface NavGroup { label: string; items: NavItem[]; }

const navGroups: NavGroup[] = [
  {
    label: "Main",
    items: [
      { title: "Dashboard",    url: "/dashboard",   icon: LayoutDashboard, feature: "dashboard" },
      { title: "Point of Sale",url: "/pos",         icon: ShoppingCart,    feature: "pos" },
    ],
  },
  {
    label: "Sales & CRM",
    items: [
      { title: "CRM",          url: "/crm",          icon: Handshake,  feature: "crm" },
      { title: "Sales Orders", url: "/sales-orders", icon: ShoppingBag,feature: "sales" },
      { title: "Invoices",     url: "/invoices",     icon: FileText,   feature: "invoices" },
      { title: "Customers",    url: "/customers",    icon: Users,      feature: "customers" },
    ],
  },
  {
    label: "Purchasing & Inventory",
    items: [
      { title: "Purchasing",   url: "/purchasing",  icon: Truck,          feature: "purchasing" },
      { title: "Inventory",    url: "/inventory",   icon: Package,        feature: "inventory" },
      { title: "Warehouses",   url: "/warehouses",  icon: ArrowRightLeft, feature: "inventory" },
      { title: "Suppliers",    url: "/suppliers",   icon: Truck,          feature: "suppliers" },
    ],
  },
  {
    label: "Production & Planning",
    items: [
      { title: "Production",   url: "/production",  icon: Factory, feature: "production" },
      { title: "MRP",          url: "/mrp",         icon: Cpu,     feature: "mrp" },
    ],
  },
  {
    label: "Finance & Banking",
    items: [
      { title: "Financials",   url: "/financials",  icon: Wallet,   feature: "financials" },
      { title: "Banking",      url: "/banking",     icon: Landmark, feature: "banking" },
      { title: "Expenses",     url: "/expenses",    icon: Receipt,  feature: "expenses" },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Projects",     url: "/projects",    icon: FolderKanban, feature: "projects" },
      { title: "Service",      url: "/service",     icon: Headphones,   feature: "service" },
      { title: "HR",           url: "/hr",          icon: Users2,       feature: "hr" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Reports",      url: "/reports",        icon: BarChart3, feature: "reports" },
      { title: "Administration",url: "/administration",icon: Shield,    feature: "administration" },
      { title: "Staff",        url: "/staff",          icon: UserCog,   feature: "staff" },
      { title: "Settings",     url: "/settings",       icon: Settings,  feature: "settings" },
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
    "Production & Planning": false, "Finance & Banking": true,
    Operations: false, System: true,
  });

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const handleLogout     = () => { staffLogout(); signOut(); };
  const handleSwitchStaff = () => staffLogout();
  const moduleKey = (url: string) => url.replace(/^\//, "");

  const displayName = staff?.name ?? user?.email ?? "User";
  const initials = displayName.charAt(0).toUpperCase();

  const renderItem = (item: NavItem) => {
    const locked = !tierCanAccess(moduleKey(item.url));
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === "/dashboard"}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150"
            style={{ color: "var(--muted-foreground)" } as React.CSSProperties}
            activeClassName=""
            activeStyle={{ backgroundColor: "var(--forest)", color: "white" } as React.CSSProperties}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{item.title}</span>
            {locked && !collapsed && (
              <Lock className="h-3 w-3 opacity-40 shrink-0" />
            )}
            {/* lime dot on active — rendered via CSS sibling trick via activeClassName */}
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
            className="relative flex items-center justify-center rounded-xl p-2.5 transition-all duration-150"
            style={{ color: "var(--muted-foreground)" } as React.CSSProperties}
            activeClassName=""
            activeStyle={{ backgroundColor: "var(--forest)", color: "white" } as React.CSSProperties}
          >
            <item.icon className="h-4 w-4" />
            {locked && (
              <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full bg-muted-foreground/30 flex items-center justify-center">
                <Lock className="h-1.5 w-1.5" />
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar
      collapsible="icon"
      style={{ backgroundColor: "white", borderRight: "1px solid hsl(var(--border))" } as React.CSSProperties}
    >
      {/* ── Logo ─────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-5 shrink-0"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}
      >
        {collapsed ? (
          <img src="/brand/nexis-icon-green.png" alt="Nexis" style={{ height: 36, width: 36, borderRadius: 8, display: "block" }} />
        ) : (
          <img src="/brand/nexis-horizontal-light.png" alt="Nexis" style={{ height: 32 }} />
        )}
      </div>

      {/* ── Staff badge ───────────────────────────── */}
      {staff && !collapsed && (
        <div className="px-4 pb-3 pt-3">
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ backgroundColor: "var(--cream-dark)" }}
          >
            <div
              className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{ backgroundColor: "var(--forest)", color: "var(--lime)" }}
            >
              {staff.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--forest)" }}>
                {staff.name}
              </p>
              <p className="text-[10px] capitalize" style={{ color: "var(--muted-foreground)" }}>
                {staff.role}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Nav ──────────────────────────────────── */}
      <SidebarContent className="px-3 py-2">
        {navGroups.map((group) => {
          const visibleItems = isBusinessOwner
            ? group.items
            : group.items.filter((item) => canAccess(item.feature));
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label} className="mb-0.5">
              {!collapsed ? (
                <Collapsible
                  open={openGroups[group.label]}
                  onOpenChange={() => toggleGroup(group.label)}
                >
                  <CollapsibleTrigger
                    className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors duration-150 hover:opacity-70"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {group.label}
                    <ChevronDown
                      className={`h-3 w-3 transition-transform duration-200 ${
                        openGroups[group.label] ? "rotate-0" : "-rotate-90"
                      }`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu className="space-y-0.5">
                        {visibleItems.map(renderItem)}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-0.5">
                    {visibleItems.map(renderItemCollapsed)}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* ── Footer ───────────────────────────────── */}
      <SidebarFooter
        className="px-4 py-4 space-y-1"
        style={{ borderTop: "1px solid hsl(var(--border))" }}
      >
        {/* User info */}
        {!collapsed && (
          <div className="flex items-center gap-3 mb-2">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: "var(--forest)", color: "var(--lime)" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--forest)" }}>
                {staff?.name ?? business?.name ?? user?.email}
              </p>
              <p className="text-[10px] truncate" style={{ color: "var(--muted-foreground)" }}>
                {user?.email}
              </p>
            </div>
          </div>
        )}

        {staff && (
          <button
            onClick={handleSwitchStaff}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 hover:opacity-80"
            style={{ color: "var(--muted-foreground)" }}
          >
            <UserCircle className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Switch Staff</span>}
          </button>
        )}

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150"
          style={{ color: "var(--muted-foreground)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "hsl(var(--destructive))";
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "hsl(var(--destructive) / 0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-foreground)";
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
          }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
