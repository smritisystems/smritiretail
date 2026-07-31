/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Inventory Business Domain Service (`SPK.domains.inventory`)
 * Standard     : SMAP Constitution v1.0 & Wave 1 Architecture Standard
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { SPK } from "../../kernel/SPK.js";
import { PlatformContext } from "../../kernel/context/PlatformContext.js";
import { DomainEventBus, DomainEventEnvelope, SaleCompletedPayload, StockUpdatedPayload } from "../events/DomainEventBus.js";
import { StockAdjustmentRequestDTO, StockAdjustmentResponseDTO } from "../dto/inventory.dto.js";

export class InventoryDomainService {
  private stockStore: Map<string, number> = new Map([
    ["SKU-1001", 100],
    ["SKU-1002", 20]
  ]);

  constructor() {
    this.registerEventSubscriptions();
  }

  public registerEventSubscriptions() {
    // React to SaleCompleted.v1 domain events automatically! (No direct calls from POS)
    DomainEventBus.subscribe<SaleCompletedPayload>("SaleCompleted.v1", (event: DomainEventEnvelope<SaleCompletedPayload>) => {
      event.payload.items.forEach((item) => {
        const currentQty = this.stockStore.get(item.sku) || 50;
        const newQty = Math.max(0, currentQty - item.qty);
        this.stockStore.set(item.sku, newQty);

        // Emit StockUpdated.v1 event
        const stockPayload: StockUpdatedPayload = {
          sku: item.sku,
          storeId: event.payload.storeId,
          previousQty: currentQty,
          newQty,
          reason: `POS Checkout ${event.payload.invoiceNo}`
        };
        DomainEventBus.publish("StockUpdated.v1", stockPayload, event.tenantId);
      });
    });
  }

  public getStockQuantity(sku: string): number {
    return this.stockStore.get(sku) ?? 0;
  }

  public adjustStock(
    request: StockAdjustmentRequestDTO,
    context: Readonly<PlatformContext>
  ): StockAdjustmentResponseDTO {
    const previousQty = this.getStockQuantity(request.sku);
    const newQty = Math.max(0, previousQty + request.qtyChange);
    this.stockStore.set(request.sku, newQty);

    const stockPayload: StockUpdatedPayload = {
      sku: request.sku,
      storeId: context.storeId,
      previousQty,
      newQty,
      reason: request.reason
    };
    DomainEventBus.publish("StockUpdated.v1", stockPayload, context.tenantId);

    return {
      sku: request.sku,
      previousQty,
      newQty,
      success: true,
      message: `Stock for '${request.sku}' adjusted by ${request.qtyChange}.`
    };
  }

  public renderLowStockWidget(context: Readonly<PlatformContext>) {
    // Delegate to SPK.dashboard facade
    return SPK.dashboard.renderWidget("w_low_stock", "dash.store_operations", context);
  }

  public getAIReorderAdvisory(context: Readonly<PlatformContext>) {
    // Delegate to SPK.ai facade (AOP-001 compliant)
    return SPK.ai.executeSkill("ai.reorder_recommendation", {}, context);
  }
}

export const inventoryDomainService = new InventoryDomainService();
