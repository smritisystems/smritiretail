/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Purchase Studio Manifest (co-located)
 * Standard     : SXP Constitution v1.0 / WNG-005 / SWEF v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE (WNG-005):
 *   Purchase Studio metadata declared here only.
 *   SXP-CS-001: auto-registers on side-effect import.
 *   SXP-CS-006: plain language — "Raise Order" not "PO_CREATE"
 */

import { WorkspaceManifest } from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceRegistry } from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceActionRegistry, WorkspaceActionDef } from "../../layout_engine/WorkspaceActionRegistry.js";
import { DashboardRegistry } from "../../kernel/upr/dashboard/DashboardRegistry.js";
import { OfflineExperienceManager } from "../../layout_engine/OfflineExperienceManager.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";

// ── Purchase Actions ──────────────────────────────────────────────────────────

const PURCHASE_ACTIONS: WorkspaceActionDef[] = [
  {
    id: "purchase.raise_order",
    label: "Raise Order",
    icon: "📦",
    shortcut: "Ctrl+Alt+N",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Purchase order raised by ${ctx.userId}` };
    },
  },
  {
    id: "purchase.receive_goods",
    label: "Receive Goods",
    icon: "🏭",
    shortcut: "Ctrl+Alt+R",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Goods receipt confirmed by ${ctx.userId}` };
    },
  },
  {
    id: "purchase.record_bill",
    label: "Record Supplier Bill",
    icon: "🧾",
    shortcut: "Ctrl+Alt+B",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Supplier bill recorded by ${ctx.userId}` };
    },
  },
  {
    id: "purchase.make_payment",
    label: "Make Payment",
    icon: "💸",
    shortcut: "Ctrl+Alt+P",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Payment made by ${ctx.userId}` };
    },
  },
  {
    id: "purchase.purchase_return",
    label: "Return to Supplier",
    icon: "↩️",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Supplier return initiated by ${ctx.userId}` };
    },
  },
  {
    id: "purchase.view_payables",
    label: "Payables Ledger",
    icon: "📒",
    featureKey: "raw_ledger",
    adaptiveVisibility: ["ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Payables ledger opened by ${ctx.userId}` };
    },
  },
];

// ── Purchase Workspaces ───────────────────────────────────────────────────────

const PURCHASE_WORKSPACES: WorkspaceManifest[] = [
  {
    id: "purchase.orders",
    title: "Purchase Orders",
    icon: "📦",
    domainId: "purchase",
    adaptiveModes: ["SIMPLE", "HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "operator",
    mobileEnabled: true,
    actions: ["purchase.raise_order", "purchase.receive_goods", "purchase.record_bill", "purchase.make_payment", "purchase.purchase_return"],
    widgets: ["w_purchase_open_orders", "w_purchase_pending_grn"],
  },
  {
    id: "purchase.receipts",
    title: "Goods Receipts",
    icon: "🏭",
    domainId: "purchase",
    adaptiveModes: ["SIMPLE", "HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "document",
    mobileEnabled: true,
    actions: ["purchase.receive_goods"],
    widgets: ["w_purchase_grn_today"],
  },
  {
    id: "purchase.bills",
    title: "Supplier Bills",
    icon: "🧾",
    domainId: "purchase",
    adaptiveModes: ["HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "document",
    mobileEnabled: false,
    actions: ["purchase.record_bill", "purchase.make_payment"],
    widgets: ["w_purchase_outstanding_payable", "w_purchase_overdue"],
  },
  {
    id: "purchase.dashboard",
    title: "Purchase Dashboard",
    icon: "📊",
    domainId: "purchase",
    adaptiveModes: ["HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "dashboard",
    mobileEnabled: false,
    actions: ["purchase.raise_order"],
    widgets: ["w_purchase_spend_7d", "w_purchase_top_suppliers"],
  },
];

// ── Purchase Dashboard Widgets ────────────────────────────────────────────────

function registerPurchaseDashboard() {
  DashboardRegistry.registerDashboard({
    id: "dash.purchase_overview",
    name: "Purchase Dashboard",
    description: "Open orders, GRN status, payables and supplier KPIs",
    domainId: "purchase",
    permissionId: "purchase.read",
    widgets: [
      {
        id: "w_purchase_open_orders",
        title: "Open Purchase Orders",
        type: "summary_card",
        gridSpan: { colSpan: 3, rowSpan: 1 },
        entityId: "purchase_order",
        widgetGroup: "health",
        adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
        refreshIntervalMs: 60_000,
      },
      {
        id: "w_purchase_pending_grn",
        title: "Pending Goods Receipt",
        type: "alert_card",
        gridSpan: { colSpan: 3, rowSpan: 1 },
        entityId: "purchase_order",
        widgetGroup: "alerts",
        adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
        refreshIntervalMs: 120_000,
      },
      {
        id: "w_purchase_grn_today",
        title: "Receipts Today",
        type: "summary_card",
        gridSpan: { colSpan: 3, rowSpan: 1 },
        entityId: "goods_receipt",
        widgetGroup: "operations",
        adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
        refreshIntervalMs: 60_000,
      },
      {
        id: "w_purchase_outstanding_payable",
        title: "Outstanding Payable",
        type: "summary_card",
        gridSpan: { colSpan: 3, rowSpan: 1 },
        entityId: "supplier_bill",
        widgetGroup: "health",
        adaptiveVisibility: ["HYBRID", "ADVANCED"],
        refreshIntervalMs: 60_000,
      },
      {
        id: "w_purchase_overdue",
        title: "Overdue Payments",
        type: "alert_card",
        gridSpan: { colSpan: 3, rowSpan: 1 },
        entityId: "supplier_bill",
        widgetGroup: "alerts",
        adaptiveVisibility: ["HYBRID", "ADVANCED"],
        refreshIntervalMs: 300_000,
      },
      {
        id: "w_purchase_spend_7d",
        title: "Purchase Spend (7 Days)",
        type: "trend_card",
        gridSpan: { colSpan: 6, rowSpan: 1 },
        entityId: "supplier_bill",
        widgetGroup: "planning",
        adaptiveVisibility: ["ADVANCED"],
        refreshIntervalMs: 300_000,
      },
      {
        id: "w_purchase_top_suppliers",
        title: "Top Suppliers",
        type: "summary_card",
        gridSpan: { colSpan: 6, rowSpan: 1 },
        entityId: "supplier",
        widgetGroup: "planning",
        adaptiveVisibility: ["ADVANCED"],
        refreshIntervalMs: 300_000,
      },
    ],
  });
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerPurchaseStudio(): void {
  PURCHASE_ACTIONS.forEach((action) => WorkspaceActionRegistry.register(action));
  PURCHASE_WORKSPACES.forEach((workspace) => WorkspaceRegistry.register(workspace));
  registerPurchaseDashboard();

  // SXP-CS-010 — Offline goods receipt handler
  // AOP-001: syncs only user-initiated queued receipts — no automatic execution
  OfflineExperienceManager.registerHandler("stock_receipt", async (operation) => {
    if (!String(operation.workspaceId).startsWith("purchase.")) {
      return { success: false, error: "Not a purchase operation" };
    }
    try {
      const response = await apiFetchV1("/api/v1/purchase/receipts/offline", {
        method: "POST",
        body: JSON.stringify(operation.payload),
      });
      return { success: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  });
}

// Auto-register on import (SXP-CS-001 side-effect pattern)
registerPurchaseStudio();

export const PURCHASE_WORKSPACE_IDS = Object.freeze({
  ORDERS: "purchase.orders",
  RECEIPTS: "purchase.receipts",
  BILLS: "purchase.bills",
  DASHBOARD: "purchase.dashboard",
});
