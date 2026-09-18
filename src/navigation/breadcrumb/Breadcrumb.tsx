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
 * SMRITI Breadcrumb Engine v1.0 — Main Breadcrumb Component
 *
 * Renders the full breadcrumb trail as a semantic <nav> element.
 *
 * Usage:
 *   // Props-driven (standalone, no context required)
 *   <Breadcrumb trail={trail} onNavigate={onNavigate} />
 *
 *   // Context-driven (reads from BreadcrumbProvider)
 *   <Breadcrumb onNavigate={onNavigate} />
 *
 * Mobile policy:
 *   On screens < sm, shows the last 2 nodes with a "…" collapse indicator.
 *   On sm+ screens, shows the full trail.
 */

import React, { useMemo } from "react";
import { BreadcrumbItem } from "./BreadcrumbItem.tsx";
import { getBreadcrumbAriaLabel, getMobileTrail } from "./breadcrumbUtils.ts";
import type { BreadcrumbTrail } from "./BreadcrumbTypes.ts";

import { useOptionalBreadcrumb } from "./BreadcrumbContext.tsx";

interface BreadcrumbProps {
  /**
   * Explicit trail to render. If omitted, trail is read from BreadcrumbContext.
   * Provide this prop when using the component outside a BreadcrumbProvider.
   */
  trail?: BreadcrumbTrail;
  /**
   * Called when a navigable breadcrumb node is clicked.
   * Receives the workspace module id.
   */
  onNavigate?: (moduleId: string) => void;
  /** Additional CSS classes for the <nav> wrapper */
  className?: string;
  /** Number of nodes to show on mobile (default: 2) */
  mobileVisibleCount?: number;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  trail: trailProp,
  onNavigate,
  className = "",
  mobileVisibleCount = 2,
}) => {
  const ctx = useOptionalBreadcrumb();
  const trail = trailProp ?? ctx?.trail;

  if (!trail || trail.nodes.length === 0) return null;

  // Mobile trail (last N nodes)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const mobileTrail = useMemo(
    () => getMobileTrail(trail, mobileVisibleCount),
    [trail, mobileVisibleCount],
  );

  const ariaLabel = getBreadcrumbAriaLabel(trail);

  const renderNodes = (nodes: typeof trail.nodes, compact = false) =>
    nodes.map((node, index) => (
      <React.Fragment key={`${node.id}-${index}`}>
        {index > 0 && (
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-[12px] text-indigo-400/60 shrink-0 select-none"
          >
            chevron_right
          </span>
        )}
        <BreadcrumbItem
          node={node}
          onNavigate={onNavigate}
          compact={compact}
        />
      </React.Fragment>
    ));

  return (
    <nav
      aria-label={ariaLabel}
      className={`flex items-center ${className}`}
    >
      {/* Desktop: full trail */}
      <ol
        className="hidden sm:flex items-center gap-0.5 list-none m-0 p-0"
        aria-label={ariaLabel}
      >
        {renderNodes(trail.nodes)}
      </ol>

      {/* Mobile: truncated trail (last 2 nodes) */}
      <ol
        className="flex sm:hidden items-center gap-0.5 list-none m-0 p-0"
        aria-label={`${ariaLabel} (condensed)`}
      >
        {renderNodes(mobileTrail.nodes, false)}
      </ol>
    </nav>
  );
};

Breadcrumb.displayName = "Breadcrumb";
