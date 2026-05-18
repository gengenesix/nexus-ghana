import { useState, useMemo } from "react";
import {
  LayoutDashboard, ShoppingCart, Package, FileText, Users, Building2,
  Receipt, BarChart3, UserCog, Settings, LogOut, Shield, Wallet,
  Handshake, ShoppingBag, Factory, Cpu, FolderKanban, Headphones,
  Users2, ArrowRightLeft, Landmark, ClipboardList, ClipboardCheck,
  FileSearch, Banknote, Clock, UserPlus, LifeBuoy, Timer, Target,
  HardDrive, ChefHat, Pill, BedDouble, Truck, Wrench, Leaf, Coins,
  Sparkles, MoreHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/hooks/useBusiness";
import { useStaffSession } from "@/contexts/StaffSessionContext";
import { useModules, useIndustry } from "@/hooks/useIndustry";
import { MODULE_MAP } from "@/lib/industryConfig";
import type { ModuleDefinition } from "@/lib/industryConfig";

// ── Icon map (mirrors AppSidebar) ─────────────────────────────────────────────
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

// Short display labels for narrow mobile bar
const SHORT_LABELS: Record<string, string> = {
  dashboard:           "Home",
  pos:                 "POS",
  inventory:           "Stock",
  "pharmacy-rx":       "Pharmacy",
  "hotel-mgmt":        "Hotel",
  "farm-mgmt":         "Farm",
  "petty-cash":        "Cash",
  "sales-orders":      "Orders",
  "human-resources":   "HR",
  administration:      "Admin",
  financials:          "Finance",
};

function shortLabel(mod: ModuleDefinition): string {
  return SHORT_LABELS[mod.key] ?? mod.name;
}

// ── Industry → preferred top-bar module keys (excl. dashboard, always slot 0) ─
const INDUSTRY_PRIORITY: Record<string, [string, string, string]> = {
  "retail":                 ["pos",        "inventory",  "invoices"],
  "food-beverage":          ["restaurant", "pos",        "inventory"],
  "agriculture":            ["farm-mgmt",  "inventory",  "expenses"],
  "health-beauty":          ["pos",        "inventory",  "customers"],
  "professional-services":  ["projects",   "invoices",   "crm"],
  "education":              ["invoices",   "customers",  "expenses"],
  "hospitality":            ["hotel-mgmt", "pos",        "invoices"],
  "automotive":             ["garage",     "fleet",      "inventory"],
  "manufacturing":          ["production", "mrp",        "purchasing"],
  "construction":           ["projects",   "purchasing", "expenses"],
  "financial-services":     ["financials", "banking",    "crm"],
  "ngo-nonprofit":          ["expenses",   "reports",    "projects"],
  "transport-logistics":    ["fleet",      "purchasing", "warehouses"],
};
const DEFAULT_PRIORITY: [string, string, string] = ["pos", "inventory", "invoices"];

// ── MobileNav ─────────────────────────────────────────────────────────────────
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { business } = useBusiness();
  const { staff, ownerBypass, canAccess: staffCanAccess } = useStaffSession();
  const { canAccess: moduleCanAccess, navGroups } = useModules();
  const { slug } = useIndustry();

  const isOwner = !!user && !!business && business.owner_id === user.id;
  const fullAccess = ownerBypass || (!staff && isOwner);

  // Combined: module must be built + in industry + in tier + allowed by staff role
  const canShow = useMemo(() => (key: string): boolean => {
    if (!moduleCanAccess(key)) return false;
    return fullAccess || staffCanAccess(key);
  }, [moduleCanAccess, fullAccess, staffCanAccess]);

  // Determine top bar slots: dashboard + up to 3 industry-priority modules
  const priorityKeys: string[] = [
    "dashboard",
    ...(INDUSTRY_PRIORITY[slug ?? ""] ?? DEFAULT_PRIORITY),
  ];

  const topItems = useMemo((): ModuleDefinition[] => {
    return priorityKeys
      .map((key) => MODULE_MAP[key])
      .filter((mod): mod is ModuleDefinition => !!mod && canShow(mod.key));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, canShow]);

  // More sheet: all accessible modules not already in the top bar
  const topKeySet = useMemo(() => new Set(topItems.map((m) => m.key)), [topItems]);

  const moreGroups = useMemo(() => {
    return navGroups
      .map((group) => ({
        label: group.label,
        modules: group.visibleModules.filter(
          (mod) => !topKeySet.has(mod.key) && canShow(mod.key)
        ),
      }))
      .filter((g) => g.modules.length > 0);
  }, [navGroups, topKeySet, canShow]);

  const hasMores = moreGroups.some((g) => g.modules.length > 0);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden">
      <div className="flex items-center justify-around py-2">
        {topItems.map((mod) => {
          const Icon = getIcon(mod.iconKey);
          return (
            <NavLink
              key={mod.key}
              to={mod.path}
              end={mod.path === "/dashboard"}
              className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground"
              activeClassName="text-primary"
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px]">{shortLabel(mod)}</span>
            </NavLink>
          );
        })}

        {hasMores && (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground">
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[10px]">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-card border-border max-h-[80vh] overflow-y-auto">
              <div className="flex items-center gap-2.5 mb-4">
                <img
                  src="/brand/nexis-icon-green.png"
                  alt="Nexis"
                  style={{ width: 40, height: 40, borderRadius: 10, display: "block", boxShadow: "0 3px 14px rgba(26,58,34,0.15)" }}
                />
                <img src="/brand/nexis-wordmark-dark.png" alt="" aria-hidden style={{ height: 18, display: "block" }} />
              </div>

              {moreGroups.map((group) => (
                <div key={group.label} className="mb-4">
                  <p className="px-1 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {group.modules.map((mod) => {
                      const Icon = getIcon(mod.iconKey);
                      return (
                        <NavLink
                          key={mod.key}
                          to={mod.path}
                          className="flex flex-col items-center gap-2 rounded-xl p-4 text-muted-foreground hover:bg-secondary"
                          activeClassName="bg-secondary text-primary"
                          onClick={() => setOpen(false)}
                        >
                          <Icon className="h-6 w-6" />
                          <span className="text-xs text-center leading-tight">{shortLabel(mod)}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}

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
