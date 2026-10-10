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
 * SMRITI Breadcrumb Engine v1.0 — Resolver
 *
 * The BreadcrumbResolver takes a BreadcrumbResolutionContext and produces
 * a BreadcrumbTrail by walking the BreadcrumbRegistry hierarchy.
 *
 * Policies enforced here:
 * - Trail always starts with Home (launchpad)
 * - Module node resolved from registry (no hardcoding)
 * - Dynamic record node added only when documentId is provided
 * - No URL segment parsing, no query parameters, no tab nodes
 * - Unknown module → graceful fallback terminal node
 * - Max depth enforced with left-truncation
 * - Launchpad as activeModule → single Home node (terminal)
 */

import {
  BREADCRUMB_HOME_NODE,
  BREADCRUMB_MAX_DEPTH,
  BREADCRUMB_UNKNOWN_NODE,
  type BreadcrumbNode,
  type BreadcrumbResolutionContext,
  type BreadcrumbTrail,
} from "./BreadcrumbTypes.ts";
import type { BreadcrumbRegistry } from "./BreadcrumbRegistry.ts";

export class BreadcrumbResolver {
  constructor(private readonly registry: BreadcrumbRegistry) {}

  /**
   * Resolve a full breadcrumb trail from the given context.
   *
   * Resolution order:
   * 1. Home (always first)
   * 2. Ancestor chain (from registry)
   * 3. Active module node (terminal if no documentId)
   * 4. Dynamic record node (terminal, only if documentId provided)
   *
   * Depth enforcement:
   * - If nodes.length > maxDepth, truncate from position 1 (after Home).
   * - isTruncated flag is set on the trail.
   */
  resolve(ctx: BreadcrumbResolutionContext): BreadcrumbTrail {
    const maxDepth = ctx.maxDepth ?? BREADCRUMB_MAX_DEPTH;
    const nodes: BreadcrumbNode[] = [];

    // Special case: launchpad is home — single terminal node
    if (!ctx.activeModuleId || ctx.activeModuleId === "launchpad") {
      return {
        nodes: [{ ...BREADCRUMB_HOME_NODE, isTerminal: true, href: undefined }],
        maxDepth,
        isTruncated: false,
      };
    }

    // 1. Home node (always non-terminal when not on launchpad)
    nodes.push({ ...BREADCRUMB_HOME_NODE });

    // 2. Ancestor chain
    const ancestors = this.registry.getAncestors(ctx.activeModuleId);
    for (const ancestor of ancestors) {
      if (ancestor.id === "launchpad") continue; // already added as Home
      nodes.push({
        id: ancestor.id,
        label: ancestor.label,
        icon: ancestor.icon,
        href: ancestor.id,
        isTerminal: false,
        ariaLabel: `Go to ${ancestor.label}`,
      });
    }

    // 3. Active module node
    const moduleEntry = this.registry.get(ctx.activeModuleId);
    const hasDocument = Boolean(ctx.documentId);

    if (moduleEntry) {
      nodes.push({
        id: moduleEntry.id,
        label: moduleEntry.label,
        icon: moduleEntry.icon,
        href: hasDocument ? moduleEntry.id : undefined,
        isTerminal: !hasDocument,
        ariaLabel: hasDocument
          ? `Go to ${moduleEntry.label}`
          : moduleEntry.label,
      });
    } else {
      // Unknown module — graceful fallback
      nodes.push({
        ...BREADCRUMB_UNKNOWN_NODE,
        label: ctx.activeModuleId
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        isTerminal: !hasDocument,
      });
    }

    // 4. Dynamic record node (only when documentId is provided)
    if (hasDocument && ctx.documentId) {
      nodes.push({
        id: ctx.documentId,
        label: ctx.documentLabel || ctx.documentId,
        isDynamic: true,
        isTerminal: true,
        ariaLabel: ctx.documentLabel
          ? `Current: ${ctx.documentLabel}`
          : `Current document: ${ctx.documentId}`,
      });
    }

    // Enforce max depth — truncate from position 1 (preserve Home)
    let isTruncated = false;
    if (nodes.length > maxDepth) {
      const excess = nodes.length - maxDepth;
      nodes.splice(1, excess);
      isTruncated = true;
    }

    return { nodes, maxDepth, isTruncated };
  }
}
