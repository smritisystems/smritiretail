/**
 * Project      : SMRITI Retail OS
 * Module       : Purchase Domain — PurchaseOrderRequest Event Listener
 * Standard     : SXP Constitution v1.0 / AOP-003 (Contract Boundaries)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0  (Sprint 5 — Wave 1)
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * RESPONSIBILITY:
 *   Subscribes to "PurchaseOrderRequested.v1" on the DomainEventBus and
 *   delegates to PurchaseCommandFacade.createDraftPO().
 *
 *   The purchase.manifest.ts calls register() once at startup.
 *   The manifest itself contains NO inline DomainEventBus subscription code.
 *
 * ARCHITECTURE:
 *   DomainEventBus.publish("PurchaseOrderRequested.v1")   [InventoryStudio]
 *       └──► PurchaseOrderRequestListener.register()
 *                └──► PurchaseCommandFacade.createDraftPO()
 *                         └──► IPurchaseService.savePO()   [Draft PO]
 */

import { DomainEventBus, PurchaseOrderRequestedPayload } from "../../domains/events/DomainEventBus.js";
import { purchaseCommandFacade }                         from "../../domains/purchase/PurchaseCommandFacade.js";
import logger                                            from "../../core/logging/logger.js";

// ── Listener ──────────────────────────────────────────────────────────────────

let _unsubscribe: (() => void) | null = null;

/**
 * Registers the listener for "PurchaseOrderRequested.v1".
 * Safe to call multiple times — subsequent calls are no-ops if already registered.
 */
export function register(): void {
  if (_unsubscribe !== null) return;   // already registered

  _unsubscribe = DomainEventBus.subscribe<PurchaseOrderRequestedPayload>(
    "PurchaseOrderRequested.v1",
    async (envelope) => {
      const payload = envelope.payload;
      logger.debug(
        `[PurchaseOrderRequestListener] Received reorder event for SKU: ${payload.skuId}` +
        ` warehouseId: ${payload.warehouseId}` +
        ` suggestedQty: ${payload.suggestedQty}` +
        ` requestedBy: ${payload.requestedBy}`
      );

      try {
        const result = await purchaseCommandFacade.createDraftPO(payload);
        if (result.success) {
          logger.debug(`[PurchaseOrderRequestListener] Draft PO created — ${result.message}`);
        } else {
          logger.warn(`[PurchaseOrderRequestListener] Draft PO creation failed — ${result.error}`);
        }
      } catch (err: unknown) {
        logger.error(
          "[PurchaseOrderRequestListener] Unhandled error in createDraftPO:",
          err as unknown
        );
      }
    }
  );

  logger.debug("[PurchaseOrderRequestListener] Subscribed to PurchaseOrderRequested.v1");
}

/**
 * Unregisters the listener. Primarily used in tests for teardown.
 */
export function unregister(): void {
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }
}

export const PurchaseOrderRequestListener = { register, unregister };
