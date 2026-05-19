/**
 * useIndustry — returns the current business's industry vertical config
 * useModules  — returns industry + tier filtered module access
 */
import { useMemo } from "react";
import { useBusiness } from "./useBusiness";
import { useLicenseTier } from "./useLicenseTier";
import {
  getIndustry,
  getIndustryModules,
  MODULE_MAP,
  NAV_GROUPS,
  type IndustryVertical,
  type ModuleDefinition,
  type NavGroup,
} from "@/lib/industryConfig";

// Modules that only make sense when an industry is explicitly selected.
// Never show these in the sidebar for businesses without an industry slug.
const INDUSTRY_VERTICAL_ONLY = new Set([
  "restaurant", "pharmacy-rx", "hotel-mgmt",
  "fleet", "garage", "farm-mgmt",
]);

// ─── useIndustry ──────────────────────────────────────────────────────────────
export interface UseIndustryResult {
  industry: IndustryVertical;
  slug: string | null;
  modules: ModuleDefinition[];
  hasIndustry: boolean;
}

export function useIndustry(): UseIndustryResult {
  const { business } = useBusiness();
  const slug = (business?.industry_vertical_slug as string | null) ?? null;

  const industry = useMemo(() => getIndustry(slug), [slug]);
  const modules  = useMemo(() => getIndustryModules(slug), [slug]);

  return { industry, slug, modules, hasIndustry: !!slug };
}

// ─── useModules ───────────────────────────────────────────────────────────────
export interface UseModulesResult {
  canAccess:        (moduleKey: string) => boolean;
  isComingSoon:     (moduleKey: string) => boolean;
  industryModules:  ModuleDefinition[];
  navGroups:        Array<NavGroup & { visibleModules: ModuleDefinition[] }>;
}

export function useModules(): UseModulesResult {
  const { modules: industryModules, slug, industry } = useIndustry();
  const { canAccess: tierCanAccess }                 = useLicenseTier();

  const industryKeySet = useMemo(
    () => new Set(industryModules.map((m) => m.key)),
    [industryModules],
  );

  const canAccess = (moduleKey: string): boolean => {
    const inTier  = tierCanAccess(moduleKey);
    const module  = MODULE_MAP[moduleKey];
    const built   = module?.isAvailable ?? false;

    if (!slug) {
      // No industry selected — hide vertical-specific modules entirely
      if (INDUSTRY_VERTICAL_ONLY.has(moduleKey)) return false;
      return inTier && built;
    }

    // Industry selected — show only modules in this industry's set
    const inIndustry = industryKeySet.has(moduleKey);
    return inIndustry && inTier && built;
  };

  const isComingSoon = (moduleKey: string): boolean => {
    const module = MODULE_MAP[moduleKey];
    return !!module && !module.isAvailable && industryKeySet.has(moduleKey);
  };

  const navGroups = useMemo(() => {
    // Use this industry's unique nav structure; fall back to the global one
    // for businesses that haven't selected an industry yet.
    const baseGroups =
      slug && industry.navGroups?.length > 0 ? industry.navGroups : NAV_GROUPS;
    const aliases: Record<string, string> =
      slug && industry.moduleAliases ? industry.moduleAliases : {};

    return baseGroups
      .map((group) => {
        const visibleModules = group.moduleKeys
          .map((key) => {
            const mod = MODULE_MAP[key];
            if (!mod) return null;
            if (!slug && INDUSTRY_VERTICAL_ONLY.has(mod.key)) return null;
            const inIndustry = !slug || industryKeySet.has(mod.key);
            if (!inIndustry) return null;
            // Apply industry-specific terminology if an alias exists
            const alias = aliases[key];
            return alias ? { ...mod, name: alias } : mod;
          })
          .filter((mod): mod is ModuleDefinition => mod !== null);
        return { ...group, visibleModules };
      })
      .filter((g) => g.visibleModules.length > 0);
  }, [slug, industryKeySet, industry]);

  return { canAccess, isComingSoon, industryModules, navGroups };
}
