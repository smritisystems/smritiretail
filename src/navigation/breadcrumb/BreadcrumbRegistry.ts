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
 * SMRITI Breadcrumb Engine v1.0 — Registry
 *
 * The BreadcrumbRegistry is the structural map of all workspace nodes and
 * their parent-child relationships. It does NOT generate trails — that is
 * the BreadcrumbResolver's responsibility.
 *
 * SSOT Rule: The registry is always seeded from registeredWorkspaces
 * (WorkspaceConfig[]) in layout_store. No breadcrumb hierarchy is defined
 * outside this registry.
 */

import type { WorkspaceConfig } from "../../layout_engine/layout_store.tsx";
import type { BreadcrumbRegistryEntry } from "./BreadcrumbTypes.ts";

// ---------------------------------------------------------------------------
// Static Parent Overrides
// ---------------------------------------------------------------------------
// Workspaces that have an explicit parent relationship not derivable from
// category alone. These are the ONLY place where parent hierarchy is defined.
// Do NOT add hierarchy inside individual page components.
const PARENT_OVERRIDES: Record<string, string> = {
  // Purchase sub-modules
  "purchase-studio": "purchase",
  "grn": "purchase",
  "supplier-mgmt": "purchase",
  "approval-matrix": "purchase",

  // Sales sub-modules
  "billing-workspace": "sales",
  "b2b-dispatch-studio": "sales",
  "tax-invoice-print": "sales",
  "sales-promotions": "sales",

  // Inventory sub-modules
  "stock-ledger": "inventory",
  "item-master": "inventory",
  "barcode": "inventory",
  "terms-engine": "inventory",

  // CRM
  "customer-master": "crm",

  // Masters sub-modules
  "item-create-grid": "masters",
  "document-series": "masters",
  "customer-master-create": "customer-master",

  // System sub-modules
  "database-manager": "system",
  "staff-management": "system",
  "dev-tracker": "system",
  "about-smriti": "system",
  "wiki": "system",

  // Reports
  "report-designer": "reports",
  "business-ledger": "reports",
  "audit-logs": "reports",
  "accounting-sync": "reports",
  "data-exchange": "reports",
};

// ---------------------------------------------------------------------------
// BreadcrumbRegistry Class
// ---------------------------------------------------------------------------

export class BreadcrumbRegistry {
  private entries: Map<string, BreadcrumbRegistryEntry> = new Map();

  constructor(workspaces: WorkspaceConfig[]) {
    this.seed(workspaces);
  }

  /**
   * Seed the registry from the authoritative WorkspaceConfig list.
   * Called once on construction and whenever registeredWorkspaces changes.
   */
  seed(workspaces: WorkspaceConfig[]): void {
    this.entries.clear();

    // Always ensure launchpad (Home) is present as root
    this.entries.set("launchpad", {
      id: "launchpad",
      label: "Home",
      icon: "home",
      parentId: undefined,
      category: "root",
    });

    for (const ws of workspaces) {
      this.entries.set(ws.id, {
        id: ws.id,
        label: ws.label,
        icon: ws.icon,
        parentId: PARENT_OVERRIDES[ws.id],
        category: ws.category,
      });
    }

    // Ensure top-level module roots exist even if not in registeredWorkspaces
    const implicitRoots: BreadcrumbRegistryEntry[] = [
      { id: "sales", label: "Sales & Billing", icon: "point_of_sale", parentId: "launchpad" },
      { id: "purchase", label: "Purchase & Procurement", icon: "shopping_cart", parentId: "launchpad" },
      { id: "inventory", label: "Inventory & Stock", icon: "warehouse", parentId: "launchpad" },
      { id: "masters", label: "Master Data", icon: "inventory_2", parentId: "launchpad" },
      { id: "reports", label: "Reports & Analytics", icon: "analytics", parentId: "launchpad" },
      { id: "system", label: "System Governance", icon: "admin_panel_settings", parentId: "launchpad" },
      { id: "crm", label: "CRM & Loyalty", icon: "badge", parentId: "launchpad" },
    ];

    for (const root of implicitRoots) {
      if (!this.entries.has(root.id)) {
        this.entries.set(root.id, root);
      } else {
        // Ensure parentId is set for existing entry
        const existing = this.entries.get(root.id)!;
        if (!existing.parentId) {
          this.entries.set(root.id, { ...existing, parentId: "launchpad" });
        }
      }
    }
  }

  /**
   * Get all ancestor entries for a given workspace id, ordered from root to parent.
   * Does NOT include the node itself.
   */
  getAncestors(id: string): BreadcrumbRegistryEntry[] {
    const ancestors: BreadcrumbRegistryEntry[] = [];
    const visited = new Set<string>();

    let current = this.entries.get(id);
    if (!current) return ancestors;

    // Walk up the parent chain
    let parentId = current.parentId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = this.entries.get(parentId);
      if (!parent) break;
      ancestors.unshift(parent); // prepend to keep root-first order
      parentId = parent.parentId;
    }

    return ancestors;
  }

  /**
   * Get the registry entry for a workspace id, or undefined if not found.
   */
  get(id: string): BreadcrumbRegistryEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Check for duplicate route entries (same id registered twice).
   * Returns any duplicate ids found.
   */
  detectDuplicates(workspaces: WorkspaceConfig[]): string[] {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const ws of workspaces) {
      if (seen.has(ws.id)) {
        duplicates.push(ws.id);
      }
      seen.add(ws.id);
    }
    return duplicates;
  }
}
