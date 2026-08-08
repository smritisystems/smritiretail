/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Sales Studio Manifest (co-located)
 * Standard     : SXP Constitution v1.0 / WNG-005 / SWEF v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE (WNG-005):
 *   Sales Studio metadata declared here only.
 *   SXP-CS-001: auto-registers on side-effect import.
 *   SXP-CS-006: plain language labels — "New Order" not "SO_CREATE"
 */

import { WorkspaceManifest } from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceRegistry } from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceActionRegistry, WorkspaceActionDef } from "../../layout_engine/WorkspaceActionRegistry.js";
import { DashboardRegistry } from "../../kernel/upr/dashboard/DashboardRegistry.js";
import { OfflineExperienceManager } from "../../layout_engine/OfflineExperienceManager.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";

// ── Sales Actions ─────────────────────────────────────────────────────────────

const SALES_ACTIONS: WorkspaceActionDef[] = [
  {
    id: "sales.new_order",
    label: "New Order",
    icon: "📋",
    shortcut: "Alt+N",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `New sales order started by ${ctx.userId}` };
    },
  },
  {
    id: "sales.confirm_order",
    label: "Confirm Order",
    icon: "✅",
    shortcut: "Alt+C",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Order confirmed by ${ctx.userId}` };
    },
  },
  {
    id: "sales.create_invoice",
    label: "Create Invoice",
    icon: "🧾",
    shortcut: "Alt+I",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Invoice created by ${ctx.userId}` };
    },
  },
  {
    id: "sales.record_payment",
    label: "Record Payment",
    icon: "💳",
    shortcut: "Alt+P",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Payment recorded by ${ctx.userId}` };
    },
  },
  {
    id: "sales.sales_return",
    label: "Sales Return",
    icon: "↩️",
    shortcut: "Alt+R",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Sales return initiated by ${ctx.userId}` };
    },
  },
  {
    id: "sales.view_ledger",
    label: "Customer Ledger",
    icon: "📒",
    featureKey: "raw_ledger",
    adaptiveVisibility: ["ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Ledger opened by ${ctx.userId}` };
    },
  },
];

// ── Sales Workspaces ──────────────────────────────────────────────────────────

const SALES_WORKSPACES: WorkspaceManifest[] = [
  {
    id: "sales.orders",
    title: "Sales Orders",
    icon: "📋",
    domainId: "sales",
    adaptiveModes: ["SIMPLE", "HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "operator",
    mobileEnabled: true,
    actions: ["sales.new_order", "sales.confirm_order", "sales.create_invoice", "sales.record_payment", "sales.sales_return"],
    widgets: ["w_sales_today_orders", "w_sales_pending_delivery"],
  },
  {
    id: "sales.invoices",
    title: "Invoices",
    icon: "🧾",
    domainId: "sales",
    adaptiveModes: ["SIMPLE", "HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "document",
    mobileEnabled: true,
    actions: ["sales.create_invoice", "sales.record_payment"],
    widgets: ["w_sales_outstanding", "w_sales_collected_today"],
  },
  {
    id: "sales.dashboard",
    title: "Sales Dashboard",
    icon: "📊",
    domainId: "sales",
    adaptiveModes: ["SIMPLE", "HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "dashboard",
    mobileEnabled: false,
    actions: ["sales.new_order"],
    widgets: ["w_sales_revenue_7d", "w_sales_top_products"],
  },
  {
    id: "sales.ledger",
    title: "Customer Ledger",
    icon: "📒",
    domainId: "sales",
    adaptiveModes: ["ADVANCED"],
    defaultLayout: "scroll",
    zone: "executive",
    mobileEnabled: false,
    actions: ["sales.view_ledger"],
    widgets: [],
  },
];

// ── Sales Dashboard Widgets ───────────────────────────────────────────────────

function registerSalesDashboard() {
  DashboardRegistry.registerDashboard({
    id: "dash.sales_overview",
    name: "Sales Dashboard",
    description: "Revenue, orders, outstanding and delivery KPIs",
    domainId: "sales",
    permissionId: "sales.read",
    widgets: [
      {
        id: "w_sales_today_orders",
        title: "Orders Today",
        type: "summary_card",
        gridSpan: { colSpan: 3, rowSpan: 1 },
        entityId: "sales_order",
        widgetGroup: "health",
        adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
        refreshIntervalMs: 60_000,
      },
      {
        id: "w_sales_pending_delivery",
        title: "Pending Delivery",
        type: "alert_card",
        gridSpan: { colSpan: 3, rowSpan: 1 },
        entityId: "sales_order",
        widgetGroup: "alerts",
        adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
        refreshIntervalMs: 120_000,
      },
      {
        id: "w_sales_outstanding",
        title: "Outstanding (Receivable)",
        type: "summary_card",
        gridSpan: { colSpan: 3, rowSpan: 1 },
        entityId: "sales_invoice",
        widgetGroup: "health",
        adaptiveVisibility: ["HYBRID", "ADVANCED"],
        refreshIntervalMs: 60_000,
      },
      {
        id: "w_sales_collected_today",
        title: "Collected Today",
        type: "summary_card",
        gridSpan: { colSpan: 3, rowSpan: 1 },
        entityId: "sales_payment",
        widgetGroup: "health",
        adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
        refreshIntervalMs: 30_000,
      },
      {
        id: "w_sales_revenue_7d",
        title: "Revenue (7 Days)",
        type: "trend_card",
        gridSpan: { colSpan: 6, rowSpan: 1 },
        entityId: "sales_invoice",
        widgetGroup: "operations",
        adaptiveVisibility: ["HYBRID", "ADVANCED"],
        refreshIntervalMs: 300_000,
      },
      {
        id: "w_sales_top_products",
        title: "Top Selling Products",
        type: "summary_card",
        gridSpan: { colSpan: 6, rowSpan: 1 },
        entityId: "sales_order_item",
        widgetGroup: "operations",
        adaptiveVisibility: ["ADVANCED"],
        refreshIntervalMs: 300_000,
      },
    ],
  });
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerSalesStudio(): void {
  SALES_ACTIONS.forEach((action) => WorkspaceActionRegistry.register(action));
  SALES_WORKSPACES.forEach((workspace) => WorkspaceRegistry.register(workspace));
  registerSalesDashboard();

  // SXP-CS-010 — Offline sales order handler
  // AOP-001: syncs only user-initiated, queued orders — no automatic execution
  OfflineExperienceManager.registerHandler("custom", async (operation) => {
    if (!String(operation.workspaceId).startsWith("sales.")) {
      return { success: false, error: "Not a sales operation" };
    }
    try {
      const response = await apiFetchV1("/api/v1/sales/orders/offline", {
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
registerSalesStudio();

export const SALES_WORKSPACE_IDS = Object.freeze({
  ORDERS: "sales.orders",
  INVOICES: "sales.invoices",
  DASHBOARD: "sales.dashboard",
  LEDGER: "sales.ledger",
});
