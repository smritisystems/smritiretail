/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUNEF WorkspaceRegistry (Decoupled Layouts & Tab State Preservation)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.1.0
 */

export interface WorkspaceManifest {
  workspace: string;
  title: string;
  icon: string;
  tabs: string[];
  defaultTab: string;
}

export const WORKSPACE_REGISTRY: Record<string, WorkspaceManifest> = {
  customers: {
    workspace: "customers",
    title: "Customer 360 Workspace",
    icon: "users",
    tabs: ["Overview", "Orders", "Invoices", "Payments", "Ledger", "Addresses", "Contacts", "Documents", "Timeline", "Campaigns", "Loyalty", "Support", "Audit", "Analytics"],
    defaultTab: "Overview"
  },

  "supplier-mgmt": {
    workspace: "supplier-mgmt",
    title: "Supplier Studio Workspace",
    icon: "building",
    tabs: ["Overview", "POs", "Invoices", "Ledger", "Items", "Documents", "Audit", "Analytics"],
    defaultTab: "Overview"
  },

  items: {
    workspace: "items",
    title: "Item 360 Workspace",
    icon: "package",
    tabs: ["Overview", "Variants", "Inventory", "Pricing", "Purchase History", "Sales History", "Suppliers", "Barcode", "Label Ledger", "Documents", "Audit", "Analytics"],
    defaultTab: "Overview"
  },

  "stock-ledger": {
    workspace: "stock-ledger",
    title: "Stock & Warehouse Ledger",
    icon: "warehouse",
    tabs: ["Overview", "Transfers", "Adjustments", "Batches", "Audit"],
    defaultTab: "Overview"
  }
};

/* Tab State Preservation Memory */
const tabStateMemory: Record<string, string> = {};

export const getPreservedTab = (workspace: string): string => {
  return tabStateMemory[workspace] || WORKSPACE_REGISTRY[workspace]?.defaultTab || "Overview";
};

export const setPreservedTab = (workspace: string, tab: string) => {
  tabStateMemory[workspace] = tab;
};
