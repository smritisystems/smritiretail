/**
 * Project      : SMRITI Retail OS
 * Module       : Purchase Domain — Command Facade
 * Standard     : SXP Constitution v1.0 / AOP-003 (Contract Boundaries)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.1.0  (Sprint 5 — Wave 2: approvePO + rejectPO via WorkflowRegistry)
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * ARCHITECTURE:
 *   purchase.manifest.ts  ──►  PurchaseCommandFacade  ──►  PurchaseTransactionService
 *                                                     ──►  PurchaseReturnService
 *                                                     ──►  IPurchaseService (via SPK command bus)
 *                                                     ──►  InventoryDomainService.executeMovement()
 *                                                              └──► ITEX ──► ILGE
 *
 * WORKFLOW (UWR-002):
 *   approvePO() and rejectPO() call SPK.workflow.executeTransition()
 *   exclusively — the single transition execution entry point. No state
 *   mutation happens outside that call.
 *
 * BOUNDARY CONTRACT (PUR-017):
 *   This file MUST NOT import StockLedgerService, StockTransferService,
 *   or ReservationService. All inventory mutations route exclusively through
 *   InventoryDomainService.executeMovement() which hits the ITEX kernel endpoint.
 *
 * OFFLINE IDEMPOTENCY:
 *   Every enqueued purchase operation includes:
 *     { operationId, idempotencyKey, createdAt, retryCount, workspaceId }
 *   KernelMovementDTO.idempotency_key is set on every executeMovement() call.
 */

import { PurchaseTransactionService, PurchaseTransactionRequest } from "../../product-foundation/commerce/purchase/application/purchaseTransactionService.js";
import { PurchaseReturnService, PurchaseReturnRequest }           from "../../product-foundation/commerce/purchase-return/application/purchaseReturnService.js";
import { inventoryDomainService }                                 from "../../domains/inventory/InventoryDomainService.js";
import { SPK }                                                    from "../../kernel/SPK.js";
import { IPurchaseService, PurchaseOrderRecord }                  from "../../kernel/public/IPurchaseService.js";
import { OfflineExperienceManager }                               from "../../layout_engine/OfflineExperienceManager.js";
import { WorkspaceEventBus }                                      from "../../layout_engine/WorkspaceEventBus.js";
import { validatePoPayload, buildPoFromWizard, PoWizardPayload }  from "../../components/purchase/wizards/PoWizard.js";
import type { PurchaseOrderRequestedPayload }                     from "../../domains/events/DomainEventBus.js";
import type { PaymentLine }                                       from "../../product-foundation/finance/payment/domain/payment.js";
import { createPlatformContext }                                  from "../../kernel/context/PlatformContext.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PurchaseActionContext {
  userId:      string;
  workspaceId: string;
  tenantId?:   string;
}

export interface ReceiveGoodsPayload {
  poId:       string;
  warehouseId: string;
  lines: Array<{
    itemId:      string;
    receivedQty: number;
  }>;
}

export interface RecordBillPayload {
  purchaseId:  string;
  supplierId:  string;
  items: Array<{
    itemId:      string;
    description: string;
    quantity:    number;
    unitCost:    number;
    taxRateId:   string;
  }>;
  inventoryEntry: { itemId: string; quantity: number };
  taxRules:       Array<{ id: string; rate: number; description?: string }>;
  taxRateId:      string;
}

export interface MakePaymentPayload extends RecordBillPayload {
  paymentLines: Array<{ channel: string; amount: number }>;
}

export interface ReturnToSupplierPayload {
  returnId:       string;
  supplierId:     string;
  items: Array<{
    itemId:      string;
    description: string;
    quantity:    number;
    unitCost:    number;
    taxRateId:   string;
  }>;
  inventoryEntry: { itemId: string; quantity: number };
  taxRules:       Array<{ id: string; rate: number; description?: string }>;
  taxRateId:      string;
}

export type PurchaseFacadeResult =
  | { success: true;  data: unknown;  message: string }
  | { success: false; error: string;  offline?: boolean };

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildOfflineEnvelope(
  actionId:    string,
  ctx:         PurchaseActionContext,
  payload:     unknown,
): Record<string, unknown> {
  return {
    ...(typeof payload === "object" && payload !== null ? payload : { payload }),
    operationId:    `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    idempotencyKey: `${actionId}-${ctx.workspaceId}-${Date.now()}`,
    createdAt:      new Date().toISOString(),
    retryCount:     0,
    workspaceId:    ctx.workspaceId,
  };
}

function publishSuccess(actionId: string, ctx: PurchaseActionContext, data: unknown): void {
  WorkspaceEventBus.publish("ActionExecuted", { actionId, payload: data }, ctx.workspaceId);
}

// ── Facade ────────────────────────────────────────────────────────────────────

export class PurchaseCommandFacade {

  private readonly purchaseTxService  = new PurchaseTransactionService();
  private readonly purchaseReturnSvc  = new PurchaseReturnService();

  private get purchaseService(): IPurchaseService {
    return SPK.services.resolve<IPurchaseService>("PURCHASE");
  }

  // ── 1. Raise Purchase Order ───────────────────────────────────────────────

  async createPO(
    payload: Partial<PoWizardPayload>,
    ctx:     PurchaseActionContext,
  ): Promise<PurchaseFacadeResult> {
    // Validate via wizard
    const errors = validatePoPayload(payload);
    if (errors.length > 0) {
      return { success: false, error: errors.join(" | ") };
    }

    const record = buildPoFromWizard(payload as PoWizardPayload);

    try {
      const saved = await this.purchaseService.savePO(record);
      publishSuccess("raise_order", ctx, saved);
      return { success: true, data: saved, message: `PO ${saved.poNumber} created.` };
    } catch (err: unknown) {
      const envelope = buildOfflineEnvelope("raise_order", ctx, record);
      OfflineExperienceManager.enqueue("custom", ctx.workspaceId, envelope);
      return {
        success: false,
        error:   err instanceof Error ? err.message : "Network error",
        offline: true,
      };
    }
  }

  // ── 2. Receive Goods (GRN) ────────────────────────────────────────────────

  async receiveGoods(
    payload: ReceiveGoodsPayload,
    ctx:     PurchaseActionContext,
  ): Promise<PurchaseFacadeResult> {
    try {
      // 2a. Post GRN against the PO (updates PO status)
      const updatedPO = await this.purchaseService.postGRN(payload.poId, payload.lines);

      // 2b. Execute stock movement via InventoryDomainService → ITEX → ILGE
      //     One movement call per line for atomic idempotent tracking.
      for (const line of payload.lines) {
        if (line.receivedQty > 0) {
          await inventoryDomainService.executeMovement({
            transaction_id:      `grn-${payload.poId}-${line.itemId}-${Date.now()}`,
            to_location_id:      payload.warehouseId,
            items:               [{ product_id: line.itemId, quantity: line.receivedQty }],
            movement_type:       "purchase_receipt",
            reference_doc_type:  "PurchaseOrder",
            reference_doc_id:    payload.poId,
            idempotency_key:     `grn-${payload.poId}-${line.itemId}`,
          });
        }
      }

      publishSuccess("receive_goods", ctx, { poId: payload.poId, lines: payload.lines });
      return { success: true, data: updatedPO, message: `GRN posted for PO ${payload.poId}.` };
    } catch (err: unknown) {
      const envelope = buildOfflineEnvelope("receive_goods", ctx, payload);
      OfflineExperienceManager.enqueue("stock_receipt", ctx.workspaceId, envelope);
      return {
        success: false,
        error:   err instanceof Error ? err.message : "Network error",
        offline: true,
      };
    }
  }

  // ── 3. Record Supplier Bill ───────────────────────────────────────────────

  async recordBill(
    payload: RecordBillPayload,
    ctx:     PurchaseActionContext,
  ): Promise<PurchaseFacadeResult> {
    try {
      const req: PurchaseTransactionRequest = {
        purchaseId:     payload.purchaseId,
        supplierId:     payload.supplierId,
        items:          payload.items,
        inventoryEntry: payload.inventoryEntry,
        taxRules:       payload.taxRules,
        taxRateId:      payload.taxRateId,
      };
      const result = this.purchaseTxService.executePurchase(req);
      publishSuccess("record_bill", ctx, result);
      return {
        success: true,
        data:    result,
        message: `Supplier bill recorded. Invoice: ${result.invoice.receiptText?.slice(0, 40) ?? payload.purchaseId}`,
      };
    } catch (err: unknown) {
      const envelope = buildOfflineEnvelope("record_bill", ctx, payload);
      OfflineExperienceManager.enqueue("custom", ctx.workspaceId, envelope);
      return {
        success: false,
        error:   err instanceof Error ? err.message : "Network error",
        offline: true,
      };
    }
  }

  // ── 4. Make Payment ───────────────────────────────────────────────────────

  async makePayment(
    payload: MakePaymentPayload,
    ctx:     PurchaseActionContext,
  ): Promise<PurchaseFacadeResult> {
    try {
      const req: PurchaseTransactionRequest = {
        purchaseId:     payload.purchaseId,
        supplierId:     payload.supplierId,
        items:          payload.items,
        inventoryEntry: payload.inventoryEntry,
        taxRules:       payload.taxRules,
        taxRateId:      payload.taxRateId,
        paymentLines:   payload.paymentLines as PaymentLine[],
      };
      const result = this.purchaseTxService.executePurchase(req);
      publishSuccess("make_payment", ctx, result);
      return {
        success: true,
        data:    result,
        message: `Payment of ₹${result.outstanding >= 0 ? (result.invoice.totalAmount - result.outstanding) : result.invoice.totalAmount} posted.`,
      };
    } catch (err: unknown) {
      const envelope = buildOfflineEnvelope("make_payment", ctx, payload);
      OfflineExperienceManager.enqueue("custom", ctx.workspaceId, envelope);
      return {
        success: false,
        error:   err instanceof Error ? err.message : "Network error",
        offline: true,
      };
    }
  }

  // ── 5. Return to Supplier ─────────────────────────────────────────────────

  async returnToSupplier(
    payload: ReturnToSupplierPayload,
    ctx:     PurchaseActionContext,
  ): Promise<PurchaseFacadeResult> {
    try {
      const req: PurchaseReturnRequest = {
        returnId:       payload.returnId,
        supplierId:     payload.supplierId,
        items:          payload.items,
        inventoryEntry: payload.inventoryEntry,
        taxRules:       payload.taxRules,
        taxRateId:      payload.taxRateId,
      };
      const result = this.purchaseReturnSvc.executePurchaseReturn(req);

      // Stock reversal via ITEX (purchase_return movement)
      for (const item of payload.items) {
        if (item.quantity > 0) {
          await inventoryDomainService.executeMovement({
            transaction_id:     `ret-${payload.returnId}-${item.itemId}-${Date.now()}`,
            from_location_id:   undefined,
            items:              [{ product_id: item.itemId, quantity: item.quantity }],
            movement_type:      "purchase_return",
            reference_doc_type: "PurchaseReturn",
            reference_doc_id:   payload.returnId,
            idempotency_key:    `ret-${payload.returnId}-${item.itemId}`,
          });
        }
      }

      publishSuccess("purchase_return", ctx, result);
      return { success: true, data: result, message: `Return ${payload.returnId} posted. Debit note generated.` };
    } catch (err: unknown) {
      const envelope = buildOfflineEnvelope("purchase_return", ctx, payload);
      OfflineExperienceManager.enqueue("custom", ctx.workspaceId, envelope);
      return {
        success: false,
        error:   err instanceof Error ? err.message : "Network error",
        offline: true,
      };
    }
  }

  // ── 6. Create Draft PO from Reorder Event ─────────────────────────────────
  //      Called exclusively by PurchaseOrderRequestListener.

  async createDraftPO(
    event: PurchaseOrderRequestedPayload,
  ): Promise<PurchaseFacadeResult> {
    const wizardPayload: PoWizardPayload = {
      supplierId:   "REORDER-PENDING",   // placeholder — buyer assigns supplier at review
      supplierName: "To Be Assigned",
      warehouseId:  event.warehouseId,
      lines: [{
        skuId:       event.skuId,
        description: `Reorder: ${event.skuId}`,
        qty:         event.suggestedQty,
        unitCost:    0,     // cost filled in at review step
        hsnCode:     "",    // filled in at review step
        gstRate:     0,
      }],
      notes: `Auto-draft from Inventory Reorder (${event.source}) — Available: ${event.availableQty}, Reorder Point: ${event.reorderPoint}`,
    };

    const record = buildPoFromWizard(wizardPayload);

    try {
      const saved = await this.purchaseService.savePO({
        ...record,
        status: "Draft",
      } as Partial<PurchaseOrderRecord>);
      return { success: true, data: saved, message: `Draft PO created for reorder: ${event.skuId}` };
    } catch (err: unknown) {
      return {
        success: false,
        error:   err instanceof Error ? err.message : "Network error — draft PO not saved",
        offline: true,
      };
    }
  }
  // ── 7. Approve Purchase Order ─────────────────────────────────────────────
  //      UWR-002: single transition entry point via WorkflowRegistry.

  async approvePO(
    poId: string,
    ctx:  PurchaseActionContext,
  ): Promise<PurchaseFacadeResult> {
    try {
      // 7a. Resolve current PO to get its state
      const po = await this.purchaseService.getPOById(poId);
      if (!po) {
        return { success: false, error: `PO '${poId}' not found.` };
      }

      // Map PO status string to workflow state key (lowercase)
      const currentState = po.status.toLowerCase();

      // 7b. Build immutable PlatformContext for workflow engine (UCR-006)
      const platformCtx = createPlatformContext({
        userId:   ctx.userId,
        userRole: ctx.tenantId ?? "store_manager",
        storeId:  ctx.workspaceId,
      });

      // 7c. Execute transition via WorkflowRegistry (UWR-002 single entry point)
      const transition = SPK.workflow.executeTransition(
        "wf.purchase_order",
        currentState,
        "approve",
        platformCtx,
      );

      if (!transition.success) {
        return { success: false, error: transition.reason };
      }

      // 7d. Persist new status
      const updated = await this.purchaseService.savePO({
        id:     poId,
        status: transition.newState.charAt(0).toUpperCase() + transition.newState.slice(1),
      } as Partial<PurchaseOrderRecord>);

      publishSuccess("approve_order", ctx, { poId, newState: transition.newState });
      return {
        success: true,
        data:    updated,
        message: `PO ${poId} approved. Status: ${transition.newState}.`,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error:   err instanceof Error ? err.message : "Approval failed — network error",
      };
    }
  }

  // ── 8. Reject Purchase Order ──────────────────────────────────────────────
  //      UWR-002: single transition entry point via WorkflowRegistry.

  async rejectPO(
    poId:   string,
    reason: string,
    ctx:    PurchaseActionContext,
  ): Promise<PurchaseFacadeResult> {
    try {
      const po = await this.purchaseService.getPOById(poId);
      if (!po) {
        return { success: false, error: `PO '${poId}' not found.` };
      }

      const currentState  = po.status.toLowerCase();
      const platformCtx   = createPlatformContext({
        userId:   ctx.userId,
        userRole: ctx.tenantId ?? "store_manager",
        storeId:  ctx.workspaceId,
      });

      const transition = SPK.workflow.executeTransition(
        "wf.purchase_order",
        currentState,
        "reject",
        platformCtx,
      );

      if (!transition.success) {
        return { success: false, error: transition.reason };
      }

      const updated = await this.purchaseService.savePO({
        id:     poId,
        status: transition.newState.charAt(0).toUpperCase() + transition.newState.slice(1),
        notes:  reason || "Rejected by approver",
      } as Partial<PurchaseOrderRecord>);

      publishSuccess("reject_order", ctx, { poId, newState: transition.newState, reason });
      return {
        success: true,
        data:    updated,
        message: `PO ${poId} rejected. Reason: ${reason || "Not specified"}.`,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error:   err instanceof Error ? err.message : "Rejection failed — network error",
      };
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const purchaseCommandFacade = new PurchaseCommandFacade();
