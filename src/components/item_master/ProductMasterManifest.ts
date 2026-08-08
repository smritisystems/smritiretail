/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Standard     : SCS-WSP-001 (Workspace Presentation Standard)
 * Module       : Product Master Reference Manifest (Level-1 Baseline)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 */

import { WorkspaceManifest, WorkspaceRegistry, WorkspacePolicyRegistry } from "../../kernel/upr/workspace/WorkspaceManifest.js";
import { WorkspaceCommandRegistry } from "../../kernel/upr/workspace/WorkspaceCommandRegistry.js";
import { WorkspaceInspectorRegistry } from "../../kernel/upr/workspace/WorkspaceInspectorRegistry.js";
import { WorkspaceStatus } from "../../kernel/services/WorkspaceStatusService.js";

export const ProductMasterManifest: WorkspaceManifest = {
  id: "item-master",
  title: "Product Master",
  domainId: "inventory",
  packageId: "smriti.inventory.items",
  version: "7.0.0",

  schema: {
    id: "item-master",
    selectionModel: "multiple",
    supportsExcel: true,
    supportsImport: true,
    supportsExport: true,
    supportsCopilot: true,
    supportsTimeline: true,
    supportsBatchOperations: true,
    defaultSortField: "name",
    primaryKeyField: "id",
  },

  hooks: {
    onOpen: () => {
      WorkspaceStatus.publish({ state: "saved", message: "Product Master Loaded" });
    },
    onSelectionChanged: (ids) => {
      WorkspaceStatus.publish({
        state: ids.length > 0 ? "unsaved" : "saved",
        message: ids.length > 0 ? `${ids.length} SKUs Selected` : "Product Master Clean",
        unsavedCount: ids.length,
      });
    },
  },

  permissions: [
    "inventory.items.view",
    "inventory.items.create",
    "inventory.items.edit",
    "inventory.items.delete",
  ],
};

// Register Manifest & Policy
WorkspaceRegistry.register(ProductMasterManifest);

WorkspacePolicyRegistry.registerPolicy({
  workspaceId: "item-master",
  allowInspectorResize: true,
  allowSplitView: true,
  allowBulkEdit: true,
  allowCopilot: true,
  defaultDensity: "comfortable",
  defaultMode: "standard",
});

// Register Commands for SCS-WCM-001 Context-Aware Ribbon
WorkspaceCommandRegistry.register({
  id: "inventory.openPricingTab",
  workspaceId: "item-master",
  title: "Pricing Matrix",
  iconName: "DollarSign",
  scope: "any",
  order: 10,
  action: () => {
    WorkspaceStatus.notify("Navigated to Pricing Matrix tab", "info");
  },
});

WorkspaceCommandRegistry.register({
  id: "inventory.openMediaTab",
  workspaceId: "item-master",
  title: "Media Gallery",
  iconName: "Image",
  scope: "any",
  order: 20,
  action: () => {
    WorkspaceStatus.notify("Navigated to Media Gallery tab", "info");
  },
});

WorkspaceCommandRegistry.register({
  id: "inventory.openSupplierTab",
  workspaceId: "item-master",
  title: "Supplier Assignment",
  iconName: "Truck",
  scope: "any",
  order: 30,
  action: () => {
    WorkspaceStatus.notify("Navigated to Supplier Assignment tab", "info");
  },
});
