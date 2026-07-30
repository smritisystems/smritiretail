/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : WorkspaceManifestRegistry (SDK Manifest & Action Registry)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 1.0.0
 */

import { WorkspaceManifest } from "./IWorkspace.ts";

export const DEFAULT_WORKSPACE_MANIFESTS: Record<string, WorkspaceManifest> = {
  dashboard: {
    workspaceId: "dashboard",
    title: "Home Launchpad Dashboard",
    module: "Launchpad",
    icon: "home",
    description: "Central retail operational overview and telemetry dashboard",
    permissions: ["VIEW_DASHBOARD"],
    route: "/dashboard",
    capabilities: {
      supportsResume: true,
      supportsDraft: false,
      supportsTabs: true,
      supportsSearch: true,
      supportsPrint: true,
      supportsExport: true,
      supportsAudit: true,
      supportsWorkflow: false
    }
  },
  "staff-management": {
    workspaceId: "staff-management",
    title: "Identity 360 & Provisioning Studio",
    module: "Administration",
    icon: "user",
    description: "Enterprise RBAC identity management, work locations, and provisioning lifecycle",
    permissions: ["VIEW_USERS", "MANAGE_USERS"],
    route: "/identity",
    capabilities: {
      supportsResume: true,
      supportsDraft: true,
      supportsTabs: true,
      supportsSearch: true,
      supportsPrint: true,
      supportsExport: true,
      supportsAudit: true,
      supportsWorkflow: true
    }
  },
  "item-master": {
    workspaceId: "item-master",
    title: "Item Master & SKU Catalog Studio",
    module: "Inventory",
    icon: "box",
    description: "Product catalog, barcode printing, variant matrices, and pricing tiers",
    permissions: ["VIEW_INVENTORY", "MANAGE_INVENTORY"],
    route: "/items",
    capabilities: {
      supportsResume: true,
      supportsDraft: true,
      supportsTabs: true,
      supportsSearch: true,
      supportsPrint: true,
      supportsExport: true,
      supportsAudit: true,
      supportsWorkflow: false
    }
  },
  sales: {
    workspaceId: "sales",
    title: "Sales Invoicing & Orders Studio",
    module: "Sales",
    icon: "shopping-bag",
    description: "Sales billing, invoice settlement, credit notes, and customer ledger",
    permissions: ["VIEW_SALES", "MANAGE_SALES"],
    route: "/sales",
    capabilities: {
      supportsResume: true,
      supportsDraft: true,
      supportsTabs: true,
      supportsSearch: true,
      supportsPrint: true,
      supportsExport: true,
      supportsAudit: true,
      supportsWorkflow: true
    }
  },
  purchase: {
    workspaceId: "purchase",
    title: "Procurement & Purchase Orders Studio",
    module: "Purchase",
    icon: "briefcase",
    description: "Supplier procurement, purchase requisitions, GRN, and debit notes",
    permissions: ["VIEW_PURCHASE", "MANAGE_PURCHASE"],
    route: "/purchase",
    capabilities: {
      supportsResume: true,
      supportsDraft: true,
      supportsTabs: true,
      supportsSearch: true,
      supportsPrint: true,
      supportsExport: true,
      supportsAudit: true,
      supportsWorkflow: true
    }
  },
  pos: {
    workspaceId: "pos",
    title: "Point of Sale (POS) Billing Desk",
    module: "POS",
    icon: "credit-card",
    description: "High-speed retail checkout, cash drawer, and barcode scanner engine",
    permissions: ["POS_BILLING"],
    route: "/pos",
    capabilities: {
      supportsResume: true,
      supportsDraft: true,
      supportsTabs: true,
      supportsSearch: true,
      supportsPrint: true,
      supportsExport: false,
      supportsAudit: true,
      supportsWorkflow: false
    }
  }
};

export class WorkspaceManifestRegistry {
  private static manifests: Map<string, WorkspaceManifest> = new Map(
    Object.entries(DEFAULT_WORKSPACE_MANIFESTS)
  );

  public static getManifest(workspaceId: string): WorkspaceManifest {
    return (
      this.manifests.get(workspaceId) || {
        workspaceId,
        title: workspaceId,
        module: "General",
        icon: "layout",
        permissions: [],
        route: `/${workspaceId}`,
        capabilities: {
          supportsResume: true,
          supportsDraft: true,
          supportsTabs: true,
          supportsSearch: true,
          supportsPrint: true,
          supportsExport: true,
          supportsAudit: false,
          supportsWorkflow: false
        }
      }
    );
  }

  public static registerManifest(manifest: WorkspaceManifest): void {
    this.manifests.set(manifest.workspaceId, manifest);
  }

  public static getAllManifests(): WorkspaceManifest[] {
    return Array.from(this.manifests.values());
  }
}
