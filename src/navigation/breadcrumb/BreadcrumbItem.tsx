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
 * SMRITI Breadcrumb Engine v1.0 — BreadcrumbItem
 *
 * Renders a single breadcrumb node:
 * - Non-terminal: navigable button/link
 * - Terminal: <span aria-current="page"> (not clickable)
 * - Ellipsis: collapsed ancestors indicator
 */

import React from "react";
import type { BreadcrumbNode } from "./BreadcrumbTypes.ts";

interface BreadcrumbItemProps {
  node: BreadcrumbNode;
  onNavigate?: (moduleId: string) => void;
  /** When true, renders in compact (icon-only) mode for mobile */
  compact?: boolean;
}

export const BreadcrumbItem: React.FC<BreadcrumbItemProps> = ({
  node,
  onNavigate,
  compact = false,
}) => {
  // Ellipsis placeholder — not navigable
  if (node.id === "__ellipsis__") {
    return (
      <span
        className="text-indigo-300/70 text-xs px-0.5 select-none"
        aria-hidden="true"
        title="Collapsed breadcrumb ancestors"
      >
        …
      </span>
    );
  }

  // Terminal node — current page, not clickable
  if (node.isTerminal) {
    return (
      <span
        aria-current="page"
        aria-label={node.ariaLabel || node.label}
        className="flex items-center gap-1 text-white font-semibold text-xs truncate max-w-[160px]"
        title={node.label}
      >
        {node.icon && !compact && (
          <span className="material-symbols-outlined text-[13px] text-indigo-200 shrink-0">
            {node.icon}
          </span>
        )}
        <span className="truncate">{node.label}</span>
      </span>
    );
  }

  // Non-terminal node — navigable
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate && node.href) {
      onNavigate(node.href);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={node.ariaLabel || `Go to ${node.label}`}
      title={node.label}
      className={
        "flex items-center gap-1 text-indigo-200 hover:text-white transition-colors " +
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-300 " +
        "rounded text-xs max-w-[120px]"
      }
    >
      {node.icon && !compact && (
        <span className="material-symbols-outlined text-[13px] shrink-0">
          {node.icon}
        </span>
      )}
      {!compact && (
        <span className="truncate hover:underline underline-offset-2">
          {node.label}
        </span>
      )}
      {compact && node.icon && (
        <span className="material-symbols-outlined text-[14px]">
          {node.icon}
        </span>
      )}
      {compact && !node.icon && (
        <span className="truncate text-xs">{node.label}</span>
      )}
    </button>
  );
};

BreadcrumbItem.displayName = "BreadcrumbItem";
