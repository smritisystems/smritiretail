/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Inventory Studio Manifest (co-located)
 * Standard     : SXP Constitution v1.0 / WNG-005 / SWEF v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE (WNG-005):
 *   This file is the ONLY place where Inventory Studio declares its metadata.
 *   Navigation, shell, actions, widgets are all derived from this manifest.
 *   No hardcoded workspace routes in UI component code.
 */

import { WorkspaceManifest } from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceRegistry } from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceActionRegistry, WorkspaceActionDef } from "../../layout_engine/WorkspaceActionRegistry.js";
import { DashboardRegistry } from "../../kernel/upr/dashboard/DashboardRegistry.js";

// ── Inventory Domain Actions ──────────────────────────────────────────────────

const INVENTORY_ACTIONS: WorkspaceActionDef[] = [
  {
    id: "receive_stock",
    label: "Receive Stock",
    icon: "📦",
    shortcut: "F5",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Stock receipt initiated by ${ctx.userId}` };
    },
  },
  {
    id: "transfer_stock",
    label: "Transfer Stock",
    icon: "🚚",
    shortcut: "F6",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Transfer initiated by ${ctx.userId}` };
    },
  },
  {
    id: "adjust_stock",
    label: "Adjust Quantity",
    icon: "✏️",
    shortcut: "F7",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Adjustment logged by ${ctx.userId}` };
    },
  },
  {
    id: "write_off_stock",
    label: "Write Off",
    icon: "🗑️",
    featureKey: "cost_layers",
    adaptiveVisibility: ["ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Write-off recorded by ${ctx.userId}` };
    },
  },
  {
    id: "reserve_stock",
    label: "Reserve Stock",
    icon: "🔒",
    featureKey: "reservations",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Reservation created by ${ctx.userId}` };
    },
  },
  {
    id: "scan_item",
    label: "Scan Item",
    icon: "📷",
    shortcut: "F8",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Scan initiated by ${ctx.userId}` };
    },
  },
];

// ── Inventory Workspaces ──────────────────────────────────────────────────────

const INVENTORY_WORKSPACES: WorkspaceManifest[] = [
  {
    id: "inventory.dashboard",
    title: "Stock Overview",
    icon: "📊",
    domainId: "inventory",
    adaptiveModes: ["SIMPLE", "HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "dashboard",
    mobileEnabled: true,
    actions: ["receive_stock", "scan_item"],
    widgets: [
      "w_total_stock_value",
      "w_low_stock_alerts",
      "w_stock_health",
      "w_recent_movements",
      "w_reservation_status",
    ],
    timelineAdapterId: "inventory",
    shortcuts: { F5: "receive_stock", F8: "scan_item" },
  },
  {
    id: "inventory.operations",
    title: "Stock Operations",
    icon: "⚙️",
    domainId: "inventory",
    adaptiveModes: ["SIMPLE", "HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "operator",
    mobileEnabled: true,
    actions: ["receive_stock", "transfer_stock", "adjust_stock", "write_off_stock", "reserve_stock", "scan_item"],
    widgets: [],
    shortcuts: { F5: "receive_stock", F6: "transfer_stock", F7: "adjust_stock", F8: "scan_item" },
  },
  {
    id: "inventory.scan",
    title: "Warehouse Scanner",
    icon: "📷",
    domainId: "inventory",
    adaptiveModes: ["SIMPLE", "HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "scanner",
    mobileEnabled: true,
    mobileLayout: "scan_first",
    actions: ["scan_item", "receive_stock"],
    widgets: [],
  },
];

// ── Dashboard Widgets ─────────────────────────────────────────────────────────

function registerInventoryDashboard() {
  DashboardRegistry.registerDashboard({
    id: "dash.inventory_overview",
    name: "Stock Overview Dashboard",
    description: "Real-time inventory health, alerts, operations, and movement timeline",
    domainId: "inventory",
    permissionId: "inventory.stock.read",
    widgets: [
      // ── Health Group ──
      {
        id: "w_total_stock_value",
        title: "Total Stock Value",
        type: "summary_card",
        gridSpan: { colSpan: 3, rowSpan: 1 },
        entityId: "product",
        widgetGroup: "health",
        adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
      },
      {
        id: "w_stock_health",
        title: "Stock Health Score",
        type: "progress_card",
        gridSpan: { colSpan: 3, rowSpan: 1 },
        entityId: "product",
        widgetGroup: "health",
        adaptiveVisibility: ["HYBRID", "ADVANCED"],
      },
      // ── Alerts Group ──
      {
        id: "w_low_stock_alerts",
        title: "Reorder Alerts",
        type: "alert_card",
        gridSpan: { colSpan: 6, rowSpan: 2 },
        entityId: "product",
        widgetGroup: "alerts",
        adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
        refreshIntervalMs: 60_000,
      },
      // ── Operations Group ──
      {
        id: "w_recent_movements",
        title: "Recent Movements",
        type: "timeline_card",
        gridSpan: { colSpan: 6, rowSpan: 2 },
        entityId: "product",
        widgetGroup: "operations",
        adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
      },
      // ── Planning Group (HYBRID+) ──
      {
        id: "w_reservation_status",
        title: "Active Reservations",
        type: "summary_card",
        gridSpan: { colSpan: 3, rowSpan: 1 },
        entityId: "product",
        widgetGroup: "planning",
        adaptiveVisibility: ["HYBRID", "ADVANCED"],
      },
    ],
  });
}

// ── Registration (called on module load) ─────────────────────────────────────

export function registerInventoryStudio(): void {
  // Register actions
  INVENTORY_ACTIONS.forEach((action) => WorkspaceActionRegistry.register(action));

  // Register workspaces
  INVENTORY_WORKSPACES.forEach((workspace) => WorkspaceRegistry.register(workspace));

  // Register dashboard
  registerInventoryDashboard();
}

// Auto-register when this module is imported
registerInventoryStudio();

// Export workspace IDs for use in InventoryDashboardWorkspace
export const INVENTORY_WORKSPACE_IDS = Object.freeze({
  DASHBOARD: "inventory.dashboard",
  OPERATIONS: "inventory.operations",
  SCAN: "inventory.scan",
});
