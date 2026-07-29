/**
 * Project      : SMRITI Retail OS
 * Module       : Workspace Templates Registry (SLP-001 v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import { WorkspaceTemplateConfig } from "../types/launchpadTypes.ts";

export const WORKSPACE_TEMPLATES: WorkspaceTemplateConfig[] = [
  {
    id: "general-retail",
    name: "General Retail & Supermarket",
    description: "Standard retail store setup for FMCG, departmental, and general stores.",
    defaultLandingTab: "launchpad",
    primaryCategories: ["Operations", "Masters", "Analytics", "Administration"],
    recommendedQuickActions: ["qa-new-sale", "qa-new-po", "qa-new-customer", "qa-print-labels"],
    kpiMetrics: ["sales_today", "bills_today", "cash_drawer", "low_stock"],
    accentColor: "emerald"
  },
  {
    id: "supermarket",
    name: "Supermarket & Grocery",
    description: "High-speed multi-counter checkout setup with barcode scanning & batch tracking.",
    defaultLandingTab: "pos",
    primaryCategories: ["Operations", "Masters", "Analytics"],
    recommendedQuickActions: ["qa-new-sale", "qa-new-item", "qa-print-labels", "qa-stock-transfer"],
    kpiMetrics: ["sales_today", "bills_today", "cash_drawer", "pending_grns"],
    accentColor: "cyan"
  },
  {
    id: "apparel-fashion",
    name: "Apparel & Fashion",
    description: "Style, Brand, Size & Color matrix variant management setup.",
    defaultLandingTab: "item-master",
    primaryCategories: ["Masters", "Operations", "Analytics"],
    recommendedQuickActions: ["qa-new-item", "qa-print-labels", "qa-new-sale", "qa-stock-transfer"],
    kpiMetrics: ["sales_today", "low_stock", "variant_count"],
    accentColor: "purple"
  },
  {
    id: "pharmacy-medical",
    name: "Pharmacy & Healthcare",
    description: "Batch expiry, FSSAI / Drug License tracking & prescription billing.",
    defaultLandingTab: "pos",
    primaryCategories: ["Operations", "Masters", "Analytics"],
    recommendedQuickActions: ["qa-new-sale", "qa-new-po", "qa-new-customer", "qa-print-labels"],
    kpiMetrics: ["sales_today", "expired_skus", "near_expiry"],
    accentColor: "rose"
  },
  {
    id: "restaurant-qsr",
    name: "Restaurant & QSR",
    description: "Table management, KOT dispatch, and quick bill settlement.",
    defaultLandingTab: "pos",
    primaryCategories: ["Operations", "Analytics"],
    recommendedQuickActions: ["qa-new-sale", "qa-ledger-entry"],
    kpiMetrics: ["sales_today", "table_occupancy", "kot_pending"],
    accentColor: "amber"
  },
  {
    id: "jewellery",
    name: "Jewellery & Metals",
    description: "Precious metal rates, custom tagging, and purity-based valuation.",
    defaultLandingTab: "sales",
    primaryCategories: ["Operations", "Finance", "Masters"],
    recommendedQuickActions: ["qa-new-sale", "qa-new-customer", "qa-print-labels"],
    kpiMetrics: ["sales_today", "gold_rate_today", "cash_balance"],
    accentColor: "yellow"
  },
  {
    id: "wholesale-distributor",
    name: "Wholesale & Distribution",
    description: "Bulk pricing, BPA contracts, GRNs, and vendor ledger reconciliation.",
    defaultLandingTab: "purchase",
    primaryCategories: ["Operations", "Finance", "Masters"],
    recommendedQuickActions: ["qa-new-po", "qa-new-supplier", "qa-stock-transfer", "qa-ledger-entry"],
    kpiMetrics: ["purchases_today", "outstanding_payables", "stock_valuation"],
    accentColor: "indigo"
  }
];

export const getWorkspaceTemplate = (id: string): WorkspaceTemplateConfig => {
  return (
    WORKSPACE_TEMPLATES.find((t) => t.id === id) || WORKSPACE_TEMPLATES[0]
  );
};
