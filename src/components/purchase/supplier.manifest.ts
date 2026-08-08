/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Supplier Studio Manifest (co-located)
 * Standard     : SXP Constitution v1.0 / WNG-004 / WNG-005 / SWEF v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0  (Sprint 5 Wave 2)
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE (WNG-005):
 *   Supplier Studio metadata declared here only.
 *   SXP-CS-001: auto-registers on side-effect import.
 *   SXP-CS-006: plain language — "Add Supplier" not "SUPPLIER_CREATE"
 *
 * WORKSPACES (WNG-004 — Object Page Pattern):
 *   supplier.directory  — List Report Pattern (supplier list + filter bar)
 *   supplier.object     — Object Page Pattern (fixed header + 4 tabs)
 *
 * BOUNDARY CONTRACT:
 *   This file imports ZERO of: StockLedgerService, StockTransferService,
 *   ReservationService. Supplier domain does not touch stock directly.
 */

import { WorkspaceManifest }                           from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceRegistry }                           from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceActionRegistry, WorkspaceActionDef } from "../../layout_engine/WorkspaceActionRegistry.js";
import { DashboardRegistry }                           from "../../kernel/upr/dashboard/DashboardRegistry.js";
import { SPK }                                         from "../../kernel/SPK.js";
import type { ISupplierService }                       from "../../kernel/public/ISupplierService.js";

// ── Supplier Actions ───────────────────────────────────────────────────────────

const SUPPLIER_ACTIONS: WorkspaceActionDef[] = [

  // ── 1. Add / Onboard Supplier ───────────────────────────────────────────────
  {
    id:    "supplier.create",
    label: "Add Supplier",
    icon:  "🏭",
    shortcut: "Ctrl+Alt+S",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      const payload = ctx.payload as Partial<Parameters<ISupplierService["save"]>[0]>;
      if (!payload?.name?.trim()) {
        return { success: false, message: "Supplier name is required." };
      }
      try {
        const svc = SPK.services.resolve<ISupplierService>("SUPPLIER");
        const saved = await svc.save(payload);
        return { success: true, message: `Supplier '${saved.name}' (${saved.code}) created.` };
      } catch (err: unknown) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Failed to save supplier.",
        };
      }
    },
  },

  // ── 2. Edit Supplier ────────────────────────────────────────────────────────
  {
    id:    "supplier.edit",
    label: "Edit Supplier",
    icon:  "✏️",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      const payload = ctx.payload as Partial<Parameters<ISupplierService["save"]>[0]> & { id: string };
      if (!payload?.id?.trim()) {
        return { success: false, message: "Supplier ID is required for edit." };
      }
      try {
        const svc = SPK.services.resolve<ISupplierService>("SUPPLIER");
        const updated = await svc.save(payload);
        return { success: true, message: `Supplier '${updated.name}' updated.` };
      } catch (err: unknown) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Failed to update supplier.",
        };
      }
    },
  },

  // ── 3. Block Supplier ────────────────────────────────────────────────────────
  {
    id:    "supplier.block",
    label: "Block Supplier",
    icon:  "🚫",
    adaptiveVisibility: ["ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      const payload = ctx.payload as { id: string; reason?: string };
      if (!payload?.id?.trim()) {
        return { success: false, message: "Supplier ID is required." };
      }
      try {
        const svc = SPK.services.resolve<ISupplierService>("SUPPLIER");
        await svc.save({ id: payload.id, status: "Blocked" });
        return { success: true, message: `Supplier ${payload.id} blocked.` };
      } catch (err: unknown) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Failed to block supplier.",
        };
      }
    },
  },

  // ── 4. View Supplier Ledger ──────────────────────────────────────────────────
  {
    id:    "supplier.view_ledger",
    label: "View Ledger",
    icon:  "📒",
    featureKey: "raw_ledger",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      // Read-only — UI navigates to supplier ledger tab in object page
      return { success: true, message: `Supplier ledger opened by ${ctx.userId}` };
    },
  },
];

// ── Supplier Workspaces ────────────────────────────────────────────────────────

const SUPPLIER_WORKSPACES: WorkspaceManifest[] = [
  // List Report Pattern — supplier directory (WNG-004: filter bar + data table)
  {
    id:            "supplier.directory",
    title:         "Supplier Directory",
    icon:          "🏭",
    domainId:      "purchase",
    adaptiveModes: ["SIMPLE", "HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone:          "operator",
    mobileEnabled: true,
    actions:       ["supplier.create", "supplier.edit", "supplier.block"],
    widgets:       ["w_supplier_active_count", "w_supplier_outstanding_payable"],
  },
  // Object Page Pattern — supplier record (WNG-003: fixed header + 4 tabs)
  {
    id:            "supplier.object",
    title:         "Supplier Profile",
    icon:          "🏢",
    domainId:      "purchase",
    adaptiveModes: ["HYBRID", "ADVANCED"],
    defaultLayout: "master-detail",
    zone:          "document",
    mobileEnabled: false,
    actions:       ["supplier.edit", "supplier.block", "supplier.view_ledger"],
    widgets:       [],
  },
];

// ── Supplier Dashboard Widgets ─────────────────────────────────────────────────

function registerSupplierDashboard() {
  DashboardRegistry.registerDashboard({
    id:          "dash.supplier_overview",
    name:        "Supplier Overview",
    description: "Active suppliers, outstanding payables, and sourcing KPIs",
    domainId:    "purchase",
    permissionId: "purchase.supplier.read",
    widgets: [
      {
        id:           "w_supplier_active_count",
        title:        "Active Suppliers",
        type:         "summary_card",
        gridSpan:     { colSpan: 3, rowSpan: 1 },
        entityId:     "supplier",
        widgetGroup:  "health",
        adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
        refreshIntervalMs: 300_000,
      },
      {
        id:           "w_supplier_outstanding_payable",
        title:        "Total Payables Outstanding",
        type:         "summary_card",
        gridSpan:     { colSpan: 3, rowSpan: 1 },
        entityId:     "supplier_bill",
        widgetGroup:  "health",
        adaptiveVisibility: ["HYBRID", "ADVANCED"],
        refreshIntervalMs: 60_000,
      },
    ],
  });
}

// ── Registration ───────────────────────────────────────────────────────────────

export function registerSupplierStudio(): void {
  SUPPLIER_ACTIONS.forEach((action)      => WorkspaceActionRegistry.register(action));
  SUPPLIER_WORKSPACES.forEach((workspace) => WorkspaceRegistry.register(workspace));
  registerSupplierDashboard();
}

// Auto-register on import (SXP-CS-001 side-effect pattern)
registerSupplierStudio();

export const SUPPLIER_WORKSPACE_IDS = Object.freeze({
  DIRECTORY: "supplier.directory",
  OBJECT:    "supplier.object",
});
