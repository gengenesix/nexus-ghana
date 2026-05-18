/**
 * useIndustry — returns the current business's industry vertical config
 * useModules  — returns industry + tier filtered module access
 *
 * These are the primary hooks for industry-aware UI throughout the app.
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

  return {
    industry,
    slug,
    modules,
    hasIndustry: !!slug,
  };
}

// ─── useModules ───────────────────────────────────────────────────────────────

export interface UseModulesResult {
  /**
   * Returns true if the module is both:
   *   1. In the current industry's default module set (or no industry set → all)
   *   2. Accessible by the business's license tier
   */
  canAccess: (moduleKey: string) => boolean;

  /**
   * Returns true if a module is in the industry set but NOT yet built
   * (used to render "Coming Soon" badge in module settings).
   */
  isComingSoon: (moduleKey: string) => boolean;

  /** All modules visible to this industry (regardless of tier). */
  industryModules: ModuleDefinition[];

  /** Nav groups pre-filtered by industry + tier for building the sidebar. */
  navGroups: Array<NavGroup & { visibleModules: ModuleDefinition[] }>;
}

export function useModules(): UseModulesResult {
  const { modules: industryModules, slug } = useIndustry();
  const { canAccess: tierCanAccess } = useLicenseTier();

  const industryKeySet = useMemo(
    () => new Set(industryModules.map((m) => m.key)),
    [industryModules]
  );

  const canAccess = (moduleKey: string): boolean => {
    // Legacy businesses (no industry) get all available modules
    const inIndustry = !slug || industryKeySet.has(moduleKey);
    const inTier     = tierCanAccess(moduleKey);
    const module     = MODULE_MAP[moduleKey];
    const built      = module?.isAvailable ?? false;
    return inIndustry && inTier && built;
  };

  const isComingSoon = (moduleKey: string): boolean => {
    const module = MODULE_MAP[moduleKey];
    return !!module && !module.isAvailable && industryKeySet.has(moduleKey);
  };

  const navGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => {
      const visibleModules = group.moduleKeys
        .map((key) => MODULE_MAP[key])
        .filter((mod): mod is ModuleDefinition => {
          if (!mod) return false;
          const inIndustry = !slug || industryKeySet.has(mod.key);
          return inIndustry; // include even coming-soon; sidebar will badge them
        });
      return { ...group, visibleModules };
    }).filter((g) => g.visibleModules.length > 0);
  }, [slug, industryKeySet]);

  return { canAccess, isComingSoon, industryModules, navGroups };
}
