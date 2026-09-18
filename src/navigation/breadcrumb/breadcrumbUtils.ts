/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-09-18
 * Modified     : 2026-09-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * SMRITI Breadcrumb Engine v1.0 — Utility Functions
 */

import type { BreadcrumbNode, BreadcrumbTrail } from "./BreadcrumbTypes.ts";

// ---------------------------------------------------------------------------
// Mobile Truncation
// ---------------------------------------------------------------------------

/**
 * Returns a mobile-optimised view of the trail showing only the last N nodes.
 * A leading ellipsis placeholder node is prepended to signal truncation.
 *
 * Policy: On small screens show the last 2 nodes (terminal + its parent).
 *
 * @param trail  Full resolved trail
 * @param visibleCount  Number of nodes to show on mobile (default: 2)
 */
export function getMobileTrail(
  trail: BreadcrumbTrail,
  visibleCount = 2,
): BreadcrumbTrail {
  const { nodes } = trail;
  if (nodes.length <= visibleCount) {
    return trail;
  }

  const visible = nodes.slice(-visibleCount);
  const ellipsis: BreadcrumbNode = {
    id: "__ellipsis__",
    label: "…",
    isTerminal: false,
    ariaLabel: "Collapsed breadcrumb ancestors",
  };

  return {
    nodes: [ellipsis, ...visible],
    maxDepth: trail.maxDepth,
    isTruncated: true,
  };
}

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

/**
 * Produce an accessible aria-label for the <nav> wrapper.
 * Format: "Breadcrumb: Home / Purchase & Procurement / PUR-ORD-00000001"
 */
export function getBreadcrumbAriaLabel(trail: BreadcrumbTrail): string {
  const path = trail.nodes
    .filter((n) => n.id !== "__ellipsis__")
    .map((n) => n.label)
    .join(" / ");
  return `Breadcrumb: ${path}`;
}

// ---------------------------------------------------------------------------
// Depth / Validation Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the trail exceeds the configured max depth.
 */
export function isOverDepth(trail: BreadcrumbTrail): boolean {
  return trail.nodes.length > trail.maxDepth;
}

/**
 * Returns the terminal node of a trail (current page), or undefined.
 */
export function getTerminalNode(
  trail: BreadcrumbTrail,
): BreadcrumbNode | undefined {
  return trail.nodes.find((n) => n.isTerminal);
}

/**
 * Returns true when the trail is exactly the home node (user is on launchpad).
 */
export function isHomePage(trail: BreadcrumbTrail): boolean {
  return (
    trail.nodes.length === 1 &&
    trail.nodes[0].id === "launchpad" &&
    trail.nodes[0].isTerminal === true
  );
}

// ---------------------------------------------------------------------------
// Legacy Compat Helper
// ---------------------------------------------------------------------------

/**
 * Convert a legacy string array breadcrumb (e.g. ["Home", "Inventory"])
 * into BreadcrumbNode[] for use with BreadcrumbCompat.
 */
export function fromLegacyStringArray(
  segments: string[],
): BreadcrumbNode[] {
  return segments.map((label, index) => ({
    id: `legacy-${index}-${label.toLowerCase().replace(/\s+/g, "-")}`,
    label,
    isTerminal: index === segments.length - 1,
    href: index < segments.length - 1 ? "#" : undefined,
  }));
}
