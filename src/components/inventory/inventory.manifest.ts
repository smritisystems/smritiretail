/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Inventory Studio Manifest (co-located)
 * Standard     : SXP Constitution v1.0 / WNG-005 / SWEF v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 2.1.0  (Sprint 5 — Inventory→Purchase event bridge)
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE (WNG-005):
 *   This file is the ONLY place where Inventory Studio declares its metadata.
 *   No hardcoded workspace routes in UI component code.
 *
 * Sprint 4 kernel wiring:
 *   receive_stock   → StockLedgerService.applyMovement({ type:'in' })
 *   transfer_stock  → StockTransferService.executeTransfer()
 *   adjust_stock    → StockLedgerService.applyMovement({ type:'in'|'out' })
 *   write_off_stock → StockLedgerService.applyMovement({ type:'out' })
 *   reserve_stock   → ReservationService.reserve()
 *   scan_item       → apiFetchV1 read-only barcode lookup
 *   inventory_inquiry → barcode → stock + timeline (read-only, SIMPLE+)
 *
 * Sprint 5 event bridge:
 *   raise_reorder_po → DomainEventBus.publish("PurchaseOrderRequested.v1")
 *                    → PurchaseOrderRequestListener → PurchaseCommandFacade.createDraftPO()
 *
 * Workspaces:
 *   inventory.count   — Physical Stock Count (HYBRID+)
 *   inventory.reorder — Reorder Suggestions (SIMPLE+) [Sprint 5: event bridge active]
 *
 * Pattern: Every mutating action:
 *   1. Fetches current ledger entry from API
 *   2. Applies movement via kernel service (pure domain logic)
 *   3. PUTs updated entry back via API
 *   4. Publishes ActionExecuted on EventBus
 *   On failure: enqueues to OfflineExperienceManager and returns success:false
 */

import { WorkspaceManifest } from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceRegistry } from "../../layout_engine/WorkspaceRegistry.js";
import { WorkspaceActionRegistry, WorkspaceActionDef } from "../../layout_engine/WorkspaceActionRegistry.js";
import { WorkspaceEventBus } from "../../layout_engine/WorkspaceEventBus.js";
import { OfflineExperienceManager } from "../../layout_engine/OfflineExperienceManager.js";
import { DashboardRegistry } from "../../kernel/upr/dashboard/DashboardRegistry.js";
import { StockLedgerService } from "../../product-foundation/inventory/stock-ledger/application/stockLedgerService.js";
import { ReservationService } from "../../product-foundation/inventory/reservation/application/reservationService.js";
import { StockTransferService } from "../../product-foundation/inventory/stock-transfer/application/stockTransferService.js";
import { apiFetchV1 }                                  from "../../lib/apiFetchV1.js";
import type { StockLedgerEntry }                        from "../../product-foundation/inventory/stock-ledger/domain/stockLedger.js";
import { DomainEventBus }                               from "../../domains/events/DomainEventBus.js";
import type { PurchaseOrderRequestedPayload }           from "../../domains/events/DomainEventBus.js";

// ── Kernel service singletons ─────────────────────────────────────────────────

const stockLedger   = new StockLedgerService();
const reservation   = new ReservationService();
const stockTransfer = new StockTransferService();

// ── Helpers ───────────────────────────────────────────────────────────────────

function publishSuccess(actionId: string, workspaceId: string, payload: unknown): void {
  WorkspaceEventBus.publish("ActionExecuted", { actionId, payload }, workspaceId);
}

const ACTION_TO_OFFLINE_TYPE: Record<string, import("../../layout_engine/OfflineExperienceManager.js").OfflineOperationType> = {
  receive_stock:   "stock_receipt",
  transfer_stock:  "stock_transfer",
  adjust_stock:    "stock_adjustment",
  write_off_stock: "stock_adjustment",
  reserve_stock:   "custom",
};

function enqueueOffline(actionId: string, workspaceId: string, payload: unknown): void {
  const type = ACTION_TO_OFFLINE_TYPE[actionId] ?? "custom";
  OfflineExperienceManager.enqueue(type, workspaceId, payload);
}

async function fetchLedgerEntry(itemId: string, warehouseId?: string): Promise<StockLedgerEntry> {
  const qs = warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : "";
  return apiFetchV1<StockLedgerEntry>(`/api/v1/inventory/ledger/${itemId}${qs}`);
}

async function putLedgerEntry(itemId: string, entry: StockLedgerEntry): Promise<void> {
  await apiFetchV1(`/api/v1/inventory/ledger/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(entry),
  });
}

// ── Inventory Domain Actions ──────────────────────────────────────────────────

const INVENTORY_ACTIONS: WorkspaceActionDef[] = [

  // ── Receive Stock (GRN) — barcode-first, 3 wizard steps ───────────────────
  {
    id: "receive_stock",
    label: "Receive Stock",
    icon: "📦",
    shortcut: "F5",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      const p = ctx.payload as {
        itemId: string;
        quantity: number;
        unitCost: number;
        supplierId: string;
        warehouseId: string;
        batchId?: string;
        expiryDate?: string;
      };
      try {
        const entry = await fetchLedgerEntry(p.itemId, p.warehouseId);
        const updated = stockLedger.applyMovement(entry, {
          id: `grn-${ctx.workspaceId}-${Date.now()}`,
          type: "in",
          quantity: p.quantity,
          unitCost: p.unitCost,
          warehouseId: p.warehouseId,
          batchId: p.batchId,
          expiryDate: p.expiryDate,
        });
        await putLedgerEntry(p.itemId, {
          ...updated,
          _meta: { supplierId: p.supplierId, userId: ctx.userId },
        } as StockLedgerEntry);
        publishSuccess("receive_stock", ctx.workspaceId, { itemId: p.itemId, quantity: p.quantity });
        return {
          success: true,
          message: `Received ${p.quantity} units of ${p.itemId} from ${p.supplierId}`,
        };
      } catch (err) {
        enqueueOffline("receive_stock", ctx.workspaceId, p);
        return { success: false, message: `Queued offline — ${(err as Error).message}` };
      }
    },
  },

  // ── Transfer Stock — kernel pipeline: workflow → movement → posting ────────
  {
    id: "transfer_stock",
    label: "Transfer Stock",
    icon: "🚚",
    shortcut: "F6",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      const p = ctx.payload as {
        fromItemId: string;
        toItemId: string;
        quantity: number;
        amount: number;
        fromWarehouseId?: string;
        toWarehouseId?: string;
      };
      try {
        const result = stockTransfer.executeTransfer({
          transferId: `trf-${ctx.workspaceId}-${Date.now()}`,
          fromEntry: { itemId: p.fromItemId, quantity: p.quantity },
          toEntry:   { itemId: p.toItemId,   quantity: p.quantity },
          amount:    p.amount,
        });
        await Promise.all([
          putLedgerEntry(p.fromItemId, result.fromEntry),
          putLedgerEntry(p.toItemId,   result.toEntry),
        ]);
        publishSuccess("transfer_stock", ctx.workspaceId, p);
        return {
          success: true,
          message: `Transferred ${p.quantity} units: ${p.fromItemId} → ${p.toItemId}`,
        };
      } catch (err) {
        enqueueOffline("transfer_stock", ctx.workspaceId, p);
        return { success: false, message: `Queued offline — ${(err as Error).message}` };
      }
    },
  },

  // ── Adjust Stock — +/- with reason code ───────────────────────────────────
  {
    id: "adjust_stock",
    label: "Adjust Quantity",
    icon: "✏️",
    shortcut: "F7",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      const p = ctx.payload as {
        itemId: string;
        adjustmentQty: number;
        reason: string;
        notes?: string;
        warehouseId?: string;
      };
      try {
        const entry  = await fetchLedgerEntry(p.itemId, p.warehouseId);
        const isAdd  = p.adjustmentQty >= 0;
        const updated = stockLedger.applyMovement(entry, {
          id: `adj-${ctx.workspaceId}-${Date.now()}`,
          type: isAdd ? "in" : "out",
          quantity: Math.abs(p.adjustmentQty),
          warehouseId: p.warehouseId,
        });
        await putLedgerEntry(p.itemId, {
          ...updated,
          _meta: { reason: p.reason, notes: p.notes, userId: ctx.userId },
        } as StockLedgerEntry);
        publishSuccess("adjust_stock", ctx.workspaceId, p);
        return {
          success: true,
          message: `Adjusted ${p.itemId} by ${p.adjustmentQty > 0 ? "+" : ""}${p.adjustmentQty} (${p.reason})`,
        };
      } catch (err) {
        enqueueOffline("adjust_stock", ctx.workspaceId, p);
        return { success: false, message: `Queued offline — ${(err as Error).message}` };
      }
    },
  },

  // ── Write-Off Stock — ADVANCED only ───────────────────────────────────────
  {
    id: "write_off_stock",
    label: "Write Off",
    icon: "🗑️",
    featureKey: "cost_layers",
    adaptiveVisibility: ["ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      const p = ctx.payload as {
        itemId: string;
        quantity: number;
        reason: string;
        warehouseId?: string;
      };
      try {
        const entry   = await fetchLedgerEntry(p.itemId, p.warehouseId);
        const updated = stockLedger.applyMovement(entry, {
          id: `woff-${ctx.workspaceId}-${Date.now()}`,
          type: "out",
          quantity: p.quantity,
          warehouseId: p.warehouseId,
        });
        await putLedgerEntry(p.itemId, {
          ...updated,
          _meta: { reason: p.reason, writeOff: true, userId: ctx.userId },
        } as StockLedgerEntry);
        publishSuccess("write_off_stock", ctx.workspaceId, p);
        return { success: true, message: `Wrote off ${p.quantity} units of ${p.itemId} (${p.reason})` };
      } catch (err) {
        enqueueOffline("write_off_stock", ctx.workspaceId, p);
        return { success: false, message: `Queued offline — ${(err as Error).message}` };
      }
    },
  },

  // ── Reserve Stock ──────────────────────────────────────────────────────────
  {
    id: "reserve_stock",
    label: "Reserve Stock",
    icon: "🔒",
    featureKey: "reservations",
    adaptiveVisibility: ["HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      const p = ctx.payload as {
        itemId: string;
        quantity: number;
        referenceId?: string;
      };
      try {
        const entry   = await fetchLedgerEntry(p.itemId);
        const updated = reservation.reserve(entry, p.quantity);
        await putLedgerEntry(p.itemId, {
          ...updated,
          _meta: { referenceId: p.referenceId, userId: ctx.userId },
        } as StockLedgerEntry);
        publishSuccess("reserve_stock", ctx.workspaceId, p);
        return {
          success: true,
          message: `Reserved ${p.quantity} units of ${p.itemId}${p.referenceId ? ` for ${p.referenceId}` : ""}`,
        };
      } catch (err) {
        // Reservation errors (insufficient stock) must NOT be queued offline —
        // they are business rule violations, not network failures.
        const msg = (err as Error).message;
        return { success: false, message: msg };
      }
    },
  },

  // ── Scan Item — barcode → item lookup (read-only) ─────────────────────────
  {
    id: "scan_item",
    label: "Scan Item",
    icon: "📷",
    shortcut: "F8",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      const p = ctx.payload as { barcode: string };
      const result = await apiFetchV1<{ itemId: string; name: string; available: number }>(
        `/api/v1/inventory/item-by-barcode?barcode=${encodeURIComponent(p.barcode ?? "")}`
      ).catch(() => null);
      if (!result) return { success: false, message: "Item not found" };
      publishSuccess("scan_item", ctx.workspaceId, result);
      return { success: true, message: `${result.name} — ${result.available} available` };
    },
  },

  // ── Inventory Inquiry — barcode → stock + timeline (SIMPLE+, read-only) ───
  // Added per Sprint 4 user direction: warehouse staff check stock frequently.
  {
    id: "inventory_inquiry",
    label: "Check Stock",
    icon: "🔍",
    shortcut: "F9",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      const p = ctx.payload as { barcode?: string; itemId?: string };
      const url = p.barcode
        ? `/api/v1/inventory/item-by-barcode?barcode=${encodeURIComponent(p.barcode)}`
        : `/api/v1/inventory/ledger/${p.itemId}`;
      const result = await apiFetchV1<{
        itemId: string; name: string;
        available: number; onHand: number; reserved: number;
      }>(url).catch(() => null);
      if (!result) return { success: false, message: "Item not found" };
      publishSuccess("inventory_inquiry", ctx.workspaceId, result);
      return {
        success: true,
        message: `${result.name}: ${result.available} available (${result.onHand} on hand, ${result.reserved} reserved)`,
      };
    },
  },

  // ── Raise Reorder PO — Sprint 5 Inventory→Purchase event bridge ───────────
  // Publishes PurchaseOrderRequested.v1 to DomainEventBus.
  // Consumed by: PurchaseOrderRequestListener → PurchaseCommandFacade.createDraftPO()
  // This action contains ZERO purchase business logic — it only publishes an event.
  {
    id: "raise_reorder_po",
    label: "Raise Purchase Order",
    icon: "📦",
    shortcut: "Ctrl+Alt+P",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute(ctx) {
      const p = ctx.payload as {
        skuId:        string;
        warehouseId:  string;
        suggestedQty: number;
        reorderPoint: number;
        availableQty: number;
      };

      if (!p.skuId?.trim())       return { success: false, message: "SKU is required." };
      if (!(p.suggestedQty > 0))  return { success: false, message: "Suggested quantity must be > 0." };
      if (!p.warehouseId?.trim()) return { success: false, message: "Warehouse is required." };

      const eventPayload: PurchaseOrderRequestedPayload = {
        skuId:        p.skuId,
        warehouseId:  p.warehouseId,
        suggestedQty: p.suggestedQty,
        reorderPoint: p.reorderPoint ?? 0,
        availableQty: p.availableQty ?? 0,
        requestedBy:  ctx.userId,
        source:       "InventoryStudio",
        requestedAt:  new Date().toISOString(),
      };

      DomainEventBus.publish<PurchaseOrderRequestedPayload>(
        "PurchaseOrderRequested.v1",
        eventPayload,
        "smriti-default",
      );

      publishSuccess("raise_reorder_po", ctx.workspaceId, eventPayload);
      return {
        success: true,
        message: `Reorder request raised for ${p.skuId} — qty ${p.suggestedQty}. Purchase Studio notified.`,
      };
    },
  },
];

// ── Inventory Workspaces ──────────────────────────────────────────────────────

const INVENTORY_WORKSPACES: WorkspaceManifest[] = [
  {
    id: "inventory.dashboard",
    title: "Today's Stock",
    icon: "📊",
    domainId: "inventory",
    adaptiveModes: ["SIMPLE", "HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "dashboard",
    mobileEnabled: true,
    actions: ["receive_stock", "scan_item", "inventory_inquiry"],
    widgets: [
      "w_total_stock_value",
      "w_low_stock_alerts",
      "w_stock_health",
      "w_recent_movements",
      "w_reservation_status",
    ],
    timelineAdapterId: "inventory",
    shortcuts: { F5: "receive_stock", F8: "scan_item", F9: "inventory_inquiry" },
  },
  {
    id: "inventory.operations",
    title: "What would you like to do?",
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
    actions: ["scan_item", "inventory_inquiry", "receive_stock"],
    widgets: [],
    shortcuts: { F8: "scan_item", F9: "inventory_inquiry" },
  },
  // Sprint 4: Physical Stock Count — warehouse + optional bin scope
  {
    id: "inventory.count",
    title: "Stock Count",
    icon: "🔢",
    domainId: "inventory",
    adaptiveModes: ["HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "operator",
    mobileEnabled: true,
    actions: ["scan_item", "adjust_stock"],
    widgets: [],
    shortcuts: { F8: "scan_item" },
  },
  // Sprint 5: Reorder Suggestions — raise_reorder_po publishes PurchaseOrderRequested.v1
  //           PurchaseOrderRequestListener receives → PurchaseCommandFacade.createDraftPO()
  {
    id: "inventory.reorder",
    title: "What to Order",
    icon: "📋",
    domainId: "inventory",
    adaptiveModes: ["SIMPLE", "HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "operator",
    mobileEnabled: true,
    actions: ["raise_reorder_po"],
    widgets: ["w_low_stock_alerts"],
    shortcuts: { "Ctrl+Alt+P": "raise_reorder_po" },
  },
];

// ── Dashboard Widgets ─────────────────────────────────────────────────────────

function registerInventoryDashboard(): void {
  DashboardRegistry.registerDashboard({
    id: "dash.inventory_overview",
    name: "Stock Overview Dashboard",
    description: "Real-time inventory health, alerts, operations, and movement timeline",
    domainId: "inventory",
    permissionId: "inventory.stock.read",
    widgets: [
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
      {
        id: "w_recent_movements",
        title: "Recent Movements",
        type: "timeline_card",
        gridSpan: { colSpan: 6, rowSpan: 2 },
        entityId: "product",
        widgetGroup: "operations",
        adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
      },
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

// ── Registration ──────────────────────────────────────────────────────────────

export function registerInventoryStudio(): void {
  INVENTORY_ACTIONS.forEach((action)    => WorkspaceActionRegistry.register(action));
  INVENTORY_WORKSPACES.forEach((ws)     => WorkspaceRegistry.register(ws));
  registerInventoryDashboard();
}

registerInventoryStudio();

export const INVENTORY_WORKSPACE_IDS = Object.freeze({
  DASHBOARD:  "inventory.dashboard",
  OPERATIONS: "inventory.operations",
  SCAN:       "inventory.scan",
  COUNT:      "inventory.count",
  REORDER:    "inventory.reorder",
});
