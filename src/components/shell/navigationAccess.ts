/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-10-24
 * Modified     : 2026-10-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export interface NavigationNode {
  id: string;
  moduleId?: string;
  children?: NavigationNode[];
}

const MODULE_ALIASES: Record<string, string[]> = {
  grn: ["grn-studio", "goods-receipt"],
  "grn-studio": ["grn", "goods-receipt"],
  "goods-receipt": ["grn", "grn-studio"],
  "supplier-mgmt": ["vendor-360", "vendor-master", "vendors"],
  "vendor-360": ["supplier-mgmt", "vendor-master", "vendors"],
  "vendor-master": ["supplier-mgmt", "vendor-360", "vendors"],
  vendors: ["supplier-mgmt", "vendor-360", "vendor-master"],
  "b2b-dispatch-studio": ["dispatch-studio"],
  "dispatch-studio": ["b2b-dispatch-studio"],
  "billing-workspace": ["billing", "desktop-billing"],
  "desktop-billing": ["billing", "billing-workspace"],
  billing: ["desktop-billing", "billing-workspace"],
  "company-profile": ["company-setup"],
  "company-setup": ["company-profile"],
};

export function normalizeNavigationId(value: string): string {
  return value.trim().replace(/^\/+/, "").replace(/^menu-/i, "").toLowerCase();
}

export function isNavigationModuleAllowed(
  moduleId: string | undefined,
  resolvedNavigationIds: readonly string[] | null,
): boolean {
  if (!moduleId) return false;

  const normalizedId = normalizeNavigationId(moduleId);
  if (["home", "launchpad"].includes(normalizedId)) return true;
  if (!resolvedNavigationIds) return false;

  const allowedIds = new Set(resolvedNavigationIds.map(normalizeNavigationId));
  const candidates = [normalizedId, ...(MODULE_ALIASES[normalizedId] || [])];
  return candidates.some((candidate) => allowedIds.has(normalizeNavigationId(candidate)));
}

export function filterNavigationTree<T extends NavigationNode>(
  items: readonly T[],
  resolvedNavigationIds: readonly string[] | null,
): T[] {
  return items.flatMap((item) => {
    const moduleAllowed = isNavigationModuleAllowed(
      item.moduleId || (item.id === "home" ? "launchpad" : item.id),
      resolvedNavigationIds,
    );
    const children = item.children?.length
      ? filterNavigationTree(item.children, resolvedNavigationIds)
      : undefined;

    if (!moduleAllowed && !children?.length) return [];
    if (children) return [{ ...item, children } as T];
    return [item];
  });
}

export function filterContextualNavigation<T extends { id: string }>(
  items: readonly T[],
  activeModuleId: string,
  resolvedNavigationIds: readonly string[] | null,
): T[] {
  const activeModuleAllowed = isNavigationModuleAllowed(activeModuleId, resolvedNavigationIds);
  return items.filter((item) => {
    if (item.id === "launchpad") return true;
    if (item.id.startsWith("doc-")) return activeModuleAllowed;
    return isNavigationModuleAllowed(item.id, resolvedNavigationIds);
  });
}
