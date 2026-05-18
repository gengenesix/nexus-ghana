/**
 * AppSidebar — Industry-aware, dynamic navigation sidebar
 * ────────────────────────────────────────────────────────
 * Nav groups and items are computed from the current business's industry vertical.
 * New businesses see only the modules relevant to their industry.
 * Legacy businesses (no industry set) see all available modules.
 *
 * Professional SVG icons via Lucide — no emojis anywhere.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, ShoppingCart, Package, FileText, Users, Building2,
  Receipt, BarChart3, UserCog, Settings, LogOut, Shield, Wallet,
  Handshake, ShoppingBag, Factory, Cpu, FolderKanban, Headphones,
  Users2, ArrowRightLeft, ChevronDown, Lock, Landmark, ClipboardList,
  ClipboardCheck, FileSearch, Banknote, Clock, UserPlus, LifeBuoy,
  Timer, Target, HardDrive, ChefHat, Pill, BedDouble, Truck,
  Wrench, Leaf, Coins, Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/hooks/useBusiness";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { useModules } from "@/hooks/useIndustry";
import { useLicenseTier } from "@/hooks/useLicenseTier";
import { isApproverRole } from "@/lib/rbac";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ModuleDefinition } from "@/lib/industryConfig";

// ── Icon map: iconKey (string from module registry) → Lucide component ────────
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, ShoppingCart, Package, FileText, Users, Building2,
  Receipt, BarChart3, UserCog, Settings, Shield, Wallet,
  Handshake, ShoppingBag, Factory, Cpu, FolderKanban, Headphones,
  Users2, ArrowRightLeft, Landmark, ClipboardList, ClipboardCheck,
  FileSearch, Banknote, Clock, UserPlus, LifeBuoy, Timer, Target,
  HardDrive, ChefHat, Pill, BedDouble, Truck, Wrench, Leaf, Coins,
  Sparkles,
};

function getIcon(iconKey: string): LucideIcon {
  return ICON_MAP[iconKey] ?? Settings;
}

// ── NavItem ───────────────────────────────────────────────────────────────────
interface NavItemProps {
  module: ModuleDefinition;
  collapsed: boolean;
  pendingBadge?: number;
  isLocked: boolean;
  isComingSoon: boolean;
}

function NavItem({ module, collapsed, pendingBadge, isLocked, isComingSoon }: NavItemProps) {
  const Icon = getIcon(module.iconKey);

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <NavLink
            to={module.path}
            end={module.path === "/dashboard"}
            className="relative flex items-center justify-center rounded-xl p-2.5 transition-all duration-150"
            style={{ color: "var(--muted-foreground)" } as React.CSSProperties}
            activeClassName=""
            activeStyle={{ backgroundColor: "var(--forest)", color: "white" } as React.CSSProperties}
          >
            <Icon className="h-4 w-4" />
            {(isLocked || isComingSoon) && (
              <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full bg-muted-foreground/25 flex items-center justify-center">
                <Lock className="h-1.5 w-1.5" />
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={module.path}
          end={module.path === "/dashboard"}
          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150"
          style={{ color: "var(--muted-foreground)" } as React.CSSProperties}
          activeClassName=""
          activeStyle={{ backgroundColor: "var(--forest)", color: "white" } as React.CSSProperties}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{module.name}</span>

          {/* Pending approval count badge */}
          {module.key === "approvals" && pendingBadge! > 0 && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white leading-none shrink-0"
              style={{ backgroundColor: "var(--forest)" }}
            >
              {pendingBadge}
            </span>
          )}

          {/* Coming soon badge */}
          {isComingSoon && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none shrink-0 uppercase tracking-wide"
              style={{ backgroundColor: "hsl(var(--muted))", color: "var(--muted-foreground)" }}
            >
              Soon
            </span>
          )}

          {/* Tier lock indicator */}
          {isLocked && !isComingSoon && (
            <Lock className="h-3 w-3 opacity-35 shrink-0" />
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ── NavGroupSection ───────────────────────────────────────────────────────────
interface NavGroupSectionProps {
  label: string;
  modules: ModuleDefinition[];
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  canAccess: (key: string) => boolean;
  isComingSoon: (key: string) => boolean;
  pendingApprovalCount: number;
}

function NavGroupSection({
  label, modules, collapsed, isOpen, onToggle,
  canAccess, isComingSoon, pendingApprovalCount,
}: NavGroupSectionProps) {
  if (modules.length === 0) return null;

  if (collapsed) {
    return (
      <SidebarGroup className="mb-0.5">
        <SidebarGroupContent>
          <SidebarMenu className="space-y-0.5">
            {modules.map((mod) => (
              <NavItem
                key={mod.key}
                module={mod}
                collapsed
                isLocked={!canAccess(mod.key) && mod.isAvailable}
                isComingSoon={isComingSoon(mod.key)}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup className="mb-0.5">
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CollapsibleTrigger
          className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors duration-150 hover:opacity-70"
          style={{ color: "var(--muted-foreground)" }}
        >
          {label}
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-200 ${isOpen ? "rotate-0" : "-rotate-90"}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {modules.map((mod) => (
                <NavItem
                  key={mod.key}
                  module={mod}
                  collapsed={false}
                  pendingBadge={mod.key === "approvals" ? pendingApprovalCount : 0}
                  isLocked={!canAccess(mod.key) && mod.isAvailable}
                  isComingSoon={isComingSoon(mod.key)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}

// ── AppSidebar ────────────────────────────────────────────────────────────────
export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { business } = useBusiness();
  const { staff, ownerBypass, logout: staffLogout, canAccess: roleCanAccess } = useStaffSession();
  const { navGroups, canAccess, isComingSoon } = useModules();
  const { canAccess: tierCanAccess } = useLicenseTier();
  const isBusinessOwner = !!user && !!business && business.owner_id === user.id;
  const canSeeApprovals = isBusinessOwner || ownerBypass || (staff && isApproverRole(staff.role));

  // Pending approval count — shown as badge on Approvals nav item
  const { data: pendingApprovalCount = 0 } = useQuery({
    queryKey: ["sidebar-approval-count", business?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("approval_requests")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business!.id)
        .eq("status", "pending");
      return count ?? 0;
    },
    enabled: !!business && !!canSeeApprovals,
    refetchInterval: 30_000,
  });

  // Open/collapsed state per nav group
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    navGroups.forEach((g) => { defaults[g.label] = g.defaultOpen; });
    return defaults;
  });

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  const handleLogout = () => { staffLogout(); signOut(); };

  // User display info
  const activeUser = staff ?? (ownerBypass ? { name: business?.name ?? "Owner", role: "Owner" } : null);
  const displayName = activeUser?.name ?? user?.email ?? "User";
  const initials = displayName.charAt(0).toUpperCase();

  // Module access: owners bypass role check; staff filtered by role
  const resolveCanAccess = (moduleKey: string): boolean => {
    if (isBusinessOwner || ownerBypass) return canAccess(moduleKey);
    return canAccess(moduleKey) && roleCanAccess(moduleKey);
  };

  return (
    <Sidebar
      collapsible="icon"
      style={{ backgroundColor: "white", borderRight: "1px solid hsl(var(--border))" } as React.CSSProperties}
    >
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-5 shrink-0"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}
      >
        {collapsed ? (
          <img
            src="/brand/nexis-icon-green.png"
            alt="Nexis"
            style={{ height: 36, width: 36, borderRadius: 8, display: "block", boxShadow: "0 3px 10px rgba(26,58,34,0.13)" }}
          />
        ) : (
          <>
            <img
              src="/brand/nexis-icon-green.png"
              alt="Nexis"
              style={{ width: 40, height: 40, borderRadius: 10, display: "block", flexShrink: 0, boxShadow: "0 3px 14px rgba(26,58,34,0.15)" }}
            />
            <img
              src="/brand/nexis-wordmark-dark.png"
              alt=""
              aria-hidden
              style={{ height: 18, display: "block" }}
            />
          </>
        )}
      </div>

      {/* ── Staff badge (when a staff member is logged in) ─────────────────── */}
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

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <SidebarContent className="px-3 py-2">
        {navGroups.map((group) => {
          // Filter by role (owners see all, staff filtered)
          const visibleModules = isBusinessOwner || ownerBypass
            ? group.visibleModules
            : group.visibleModules.filter((mod) => roleCanAccess(mod.key));

          if (visibleModules.length === 0) return null;

          return (
            <NavGroupSection
              key={group.label}
              label={group.label}
              modules={visibleModules}
              collapsed={collapsed}
              isOpen={openGroups[group.label] ?? group.defaultOpen}
              onToggle={() => toggleGroup(group.label)}
              canAccess={resolveCanAccess}
              isComingSoon={isComingSoon}
              pendingApprovalCount={pendingApprovalCount}
            />
          );
        })}
      </SidebarContent>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <SidebarFooter
        className="px-4 py-4 space-y-1"
        style={{ borderTop: "1px solid hsl(var(--border))" }}
      >
        {/* Current user info */}
        {!collapsed && (
          <div className="flex items-center gap-3 mb-2">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: "var(--forest)", color: "var(--lime)" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-foreground">
                {activeUser?.name ?? user?.email ?? "User"}
              </p>
              <p className="text-[10px] truncate text-muted-foreground">
                {activeUser?.role ?? (isBusinessOwner ? "Business Owner" : user?.email)}
              </p>
            </div>
          </div>
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
