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
 * SMRITI Breadcrumb Engine v1.0 — Type Definitions
 *
 * These types are the SSOT for the entire Breadcrumb Engine.
 * Do NOT define breadcrumb-related types elsewhere in the codebase.
 */

// ---------------------------------------------------------------------------
// Core Node & Trail Types
// ---------------------------------------------------------------------------

/**
 * A single node in a breadcrumb trail.
 * - Non-terminal nodes are navigable (href or onClick)
 * - The terminal node represents the current page (aria-current="page")
 */
export interface BreadcrumbNode {
  /** Unique workspace/module/record identifier */
  id: string;
  /** Human-readable display label */
  label: string;
  /** Material Symbols icon name (optional) */
  icon?: string;
  /**
   * Navigation target. Present on all nodes EXCEPT the terminal.
   * Must be a workspace id (resolved to a module transition) or an absolute path.
   */
  href?: string;
  /** True when this node represents the currently active page. Not clickable. */
  isTerminal: boolean;
  /** True for dynamically resolved record nodes (e.g. PO number, Customer name) */
  isDynamic?: boolean;
  /** Accessible label. Defaults to `label` if absent. */
  ariaLabel?: string;
}

/**
 * A fully resolved breadcrumb trail.
 * Always starts with the Home (Launchpad) node.
 */
export interface BreadcrumbTrail {
  /** Ordered list of breadcrumb nodes from root → current */
  nodes: BreadcrumbNode[];
  /** Configured maximum depth (default 5). Truncation applied from left if exceeded. */
  maxDepth: number;
  /** True when the trail was truncated due to exceeding maxDepth */
  isTruncated: boolean;
}

// ---------------------------------------------------------------------------
// Resolution Input Types
// ---------------------------------------------------------------------------

/**
 * Input context used by BreadcrumbResolver to build a BreadcrumbTrail.
 */
export interface BreadcrumbResolutionContext {
  /** The currently active workspace/module id */
  activeModuleId: string;
  /** Active document/record id (e.g. "PUR-ORD-00000001") — enables dynamic record node */
  documentId?: string;
  /** Active document label (e.g. "Purchase Order PUR-ORD-00000001") */
  documentLabel?: string;
  /** Current user role — used for permission-aware node filtering */
  userRole?: string;
  /** Tenant branch id — used for tenant-aware resolution */
  branchId?: string;
  /** Company id — used for workspace-aware resolution */
  companyId?: string;
  /** Maximum trail depth (default: 5) */
  maxDepth?: number;
}

// ---------------------------------------------------------------------------
// Registry Types
// ---------------------------------------------------------------------------

/**
 * An entry in the Breadcrumb Registry.
 * Each registered workspace can declare its parent workspace to build hierarchy.
 */
export interface BreadcrumbRegistryEntry {
  id: string;
  label: string;
  icon?: string;
  /** Parent workspace id — establishes hierarchy for breadcrumb resolution */
  parentId?: string;
  /** Category group (from WorkspaceConfig) */
  category?: string;
}

// ---------------------------------------------------------------------------
// Policy Constants
// ---------------------------------------------------------------------------

export const BREADCRUMB_HOME_NODE: BreadcrumbNode = {
  id: "launchpad",
  label: "Home",
  icon: "home",
  href: "launchpad",
  isTerminal: false,
  ariaLabel: "Go to SMRITI Fiori Launchpad",
};

export const BREADCRUMB_UNKNOWN_NODE: BreadcrumbNode = {
  id: "unknown",
  label: "Unknown",
  isTerminal: true,
  ariaLabel: "Unknown page",
};

export const BREADCRUMB_MAX_DEPTH = 5;

// ---------------------------------------------------------------------------
// Category → Business Context Mapping
// ---------------------------------------------------------------------------
// Maps WorkspaceConfig categories to breadcrumb-visible grouping labels.
// This drives the optional "category" ancestor node when a module has no
// explicit parentId in the registry.
export const CATEGORY_LABEL_MAP: Record<string, string> = {
  Operations: "Operations",
  Finance: "Finance",
  "Inventory & Stock": "Inventory",
  "Purchase & Procurement": "Procurement",
  "Sales & Billing": "Sales",
  "Master Data": "Master Data",
  "System & Governance": "System",
  CRM: "CRM",
};
