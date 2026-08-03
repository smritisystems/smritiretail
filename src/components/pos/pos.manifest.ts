/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — POS Studio Manifest (co-located)
 * Standard     : SXP Constitution v1.0 / WNG-005 / SWEF v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.1.0  (SXP-CS-010 — offline sale handler)
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE (WNG-005):
 *   POS Studio metadata declared here only.
 *   AdvancedBillingEngine imports this manifest for workspace registration.
 *   Shortcut bindings declared here — KeyboardEngine reads them at runtime.
 */

import { WorkspaceManifest } from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceRegistry } from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceActionRegistry, WorkspaceActionDef } from "../../layout_engine/WorkspaceActionRegistry.js";
import { DashboardRegistry } from "../../kernel/upr/dashboard/DashboardRegistry.js";
// SXP-CS-010 — Offline sale sync handler
import { OfflineExperienceManager } from "../../layout_engine/OfflineExperienceManager.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";

// ── POS Actions ───────────────────────────────────────────────────────────────

const POS_ACTIONS: WorkspaceActionDef[] = [
  {
    id: "pos.new_bill",
    label: "New Bill",
    icon: "🧾",
    shortcut: "F2",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `New bill started by ${ctx.userId}` };
    },
  },
  {
    id: "pos.hold_bill",
    label: "Hold Bill",
    icon: "⏸️",
    shortcut: "F4",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Bill held by ${ctx.userId}` };
    },
  },
  {
    id: "pos.checkout",
    label: "Checkout",
    icon: "✅",
    shortcut: "F8",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Checkout completed by ${ctx.userId}` };
    },
  },
  {
    id: "pos.return",
    label: "Return / Exchange",
    icon: "↩️",
    shortcut: "F12",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Return initiated by ${ctx.userId}` };
    },
  },
  {
    id: "pos.scan_item",
    label: "Scan Item",
    icon: "📷",
    shortcut: "F9",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Scan initiated by ${ctx.userId}` };
    },
  },
  {
    id: "pos.end_shift",
    label: "End Shift",
    icon: "🔚",
    shortcut: "F10",
    featureKey: "raw_ledger",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      return { success: true, message: `Shift ended by ${ctx.userId}` };
    },
  },
];

// ── POS Workspaces ────────────────────────────────────────────────────────────

const POS_WORKSPACES: WorkspaceManifest[] = [
  {
    id: "pos.billing",
    title: "Billing Desk",
    icon: "🧾",
    domainId: "sales",
    adaptiveModes: ["SIMPLE", "HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "scanner",     // POS = scanner zone (zero animations during billing)
    mobileEnabled: true,
    mobileLayout: "scan_first",
    actions: ["pos.new_bill", "pos.hold_bill", "pos.checkout", "pos.return", "pos.scan_item", "pos.end_shift"],
    widgets: ["w_pos_today_revenue", "w_pos_bill_count"],
    shortcuts: {
      F2: "pos.new_bill",
      F4: "pos.hold_bill",
      F8: "pos.checkout",
      F9: "pos.scan_item",
      F10: "pos.end_shift",
      F12: "pos.return",
    },
    adaptiveOverrides: {
      // POS scanner zone: disable ALL animations (SWEF P-007)
    },
  },
  {
    id: "pos.shift_summary",
    title: "Shift Summary",
    icon: "📊",
    domainId: "sales",
    adaptiveModes: ["HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "document",
    mobileEnabled: false,
    actions: ["pos.end_shift"],
    widgets: ["w_pos_shift_total", "w_pos_payment_mix"],
  },
];

// ── POS Dashboard Widgets ─────────────────────────────────────────────────────

function registerPOSDashboard() {
  DashboardRegistry.registerDashboard({
    id: "dash.pos_operations",
    name: "POS Operations Dashboard",
    description: "Real-time billing KPIs, payment mix, and shift summary",
    domainId: "sales",
    permissionId: "sales.pos.billing",
    widgets: [
      {
        id: "w_pos_today_revenue",
        title: "Today's Revenue",
        type: "summary_card",
        gridSpan: { colSpan: 3, rowSpan: 1 },
        entityId: "sales_invoice",
        widgetGroup: "health",
        adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
        refreshIntervalMs: 30_000,
      },
      {
        id: "w_pos_bill_count",
        title: "Bills Today",
        type: "summary_card",
        gridSpan: { colSpan: 3, rowSpan: 1 },
        entityId: "sales_invoice",
        widgetGroup: "health",
        adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
        refreshIntervalMs: 30_000,
      },
    ],
  });
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerPOSStudio(): void {
  POS_ACTIONS.forEach((action) => WorkspaceActionRegistry.register(action));
  POS_WORKSPACES.forEach((workspace) => WorkspaceRegistry.register(workspace));
  registerPOSDashboard();

  // SXP-CS-010 — Register offline sale sync handler
  // Called by OfflineExperienceManager.syncAll() when network is restored.
  // AOP-001: no automatic financial action — syncs only queued user-initiated sales.
  OfflineExperienceManager.registerHandler("sale", async (operation) => {
    try {
      const response = await apiFetchV1("/api/v1/pos/bills/offline", {
        method: "POST",
        body: JSON.stringify(operation.payload),
      });
      return { success: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  });
}

// Auto-register
registerPOSStudio();

export const POS_WORKSPACE_IDS = Object.freeze({
  BILLING: "pos.billing",
  SHIFT_SUMMARY: "pos.shift_summary",
});

/** POS keyboard shortcut map — consumed by AdvancedBillingEngine useEffect */
export const POS_SHORTCUTS = Object.freeze(
  POS_WORKSPACES[0].shortcuts as Record<string, string>
);
