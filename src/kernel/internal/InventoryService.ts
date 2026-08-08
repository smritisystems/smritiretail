/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : InventoryService Core Domain Implementation
 * Standard     : SMAP Constitution v1.0 — Internal Domain Engine
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import logger from "../../core/logging/logger.js";
import {
  IInventoryService,
  StockLevelRecord,
  StockAdjustmentRecord,
  StockTransferRecord,
} from "../public/IInventoryService.js";
import { inventoryDomainService } from "../../domains/inventory/InventoryDomainService.js";
import { SPK } from "../SPK.js";
import { DomainEventBus, StockUpdatedPayload } from "../../domains/events/DomainEventBus.js";

export class InventoryService implements IInventoryService {
  private localStockLevels: Map<string, StockLevelRecord> = new Map([
    [
      "SKU-1001:wh-main",
      {
        sku: "SKU-1001",
        productId: "prod-1001",
        warehouseId: "wh-main",
        onHand: 100,
        reserved: 5,
        locked: 0,
        availableToPromise: 95,
        reorderLevel: 20,
        maxStockLevel: 200,
      },
    ],
    [
      "SKU-1002:wh-main",
      {
        sku: "SKU-1002",
        productId: "prod-1002",
        warehouseId: "wh-main",
        onHand: 20,
        reserved: 0,
        locked: 0,
        availableToPromise: 20,
        reorderLevel: 15,
        maxStockLevel: 100,
      },
    ],
  ]);

  private transfers: StockTransferRecord[] = [];

  public async getStockQuantity(sku: string, warehouseId = "wh-main"): Promise<number> {
    const key = `${sku}:${warehouseId}`;
    const record = this.localStockLevels.get(key);
    if (record) return record.onHand;
    return inventoryDomainService.getStockQuantity(sku);
  }

  public async getAvailableToPromise(productId: string, warehouseId = "wh-main"): Promise<number> {
    for (const record of this.localStockLevels.values()) {
      if (record.productId === productId && record.warehouseId === warehouseId) {
        return record.availableToPromise;
      }
    }
    return inventoryDomainService.fetchAvailableStock(productId, warehouseId);
  }

  public async adjustStock(
    sku: string,
    qtyChange: number,
    reason: string,
    warehouseId = "wh-main",
    userId = "System",
    batchNumber?: string,
    expiryDate?: string,
    binLocation?: string
  ): Promise<StockAdjustmentRecord> {
    if (!reason || reason.trim().length < 3) {
      throw new Error("[InventoryService Error] Reason for stock adjustment is mandatory and must be at least 3 characters.");
    }

    const key = `${sku}:${warehouseId}`;
    const existing = this.localStockLevels.get(key) || {
      sku,
      productId: `prod-${sku}`,
      warehouseId,
      onHand: 0,
      reserved: 0,
      locked: 0,
      availableToPromise: 0,
    };

    const previousQty = existing.onHand;
    const newQty = Math.max(0, previousQty + qtyChange);
    const updatedRecord: StockLevelRecord = {
      ...existing,
      onHand: newQty,
      availableToPromise: Math.max(0, newQty - existing.reserved - existing.locked),
    };

    this.localStockLevels.set(key, updatedRecord);

    const adjustmentRecord: StockAdjustmentRecord = {
      id: `adj-${Date.now()}`,
      sku,
      warehouseId,
      previousQty,
      changeQty: qtyChange,
      newQty,
      reason: reason.trim(),
      batchNumber: batchNumber?.trim(),
      expiryDate: expiryDate?.trim(),
      binLocation: binLocation?.trim(),
      adjustedAt: new Date().toISOString(),
      adjustedBy: userId,
      success: true,
    };

    // Emit event & notify SPK
    const eventPayload: StockUpdatedPayload = {
      sku,
      storeId: warehouseId,
      previousQty,
      newQty,
      reason: reason.trim(),
    };
    DomainEventBus.publish("StockUpdated.v1", eventPayload);
    SPK.events.emit("StockAdjusted", adjustmentRecord.id, adjustmentRecord);

    return adjustmentRecord;
  }

  public async transferStock(
    fromWarehouseId: string,
    toWarehouseId: string,
    items: Array<{ productId: string; sku?: string; qty: number }>,
    reference?: string
  ): Promise<StockTransferRecord> {
    if (!fromWarehouseId || !toWarehouseId) {
      throw new Error("[InventoryService Error] Both source and destination warehouse IDs are required for stock transfer.");
    }
    if (fromWarehouseId === toWarehouseId) {
      throw new Error("[InventoryService Error] Source and destination warehouses must be different.");
    }
    if (!items || items.length === 0) {
      throw new Error("[InventoryService Error] At least one item is required for stock transfer.");
    }

    // Deduct from source and add to destination in local SSOT
    for (const item of items) {
      const sku = item.sku || item.productId;
      const fromKey = `${sku}:${fromWarehouseId}`;
      const toKey = `${sku}:${toWarehouseId}`;

      const fromRecord = this.localStockLevels.get(fromKey);
      if (fromRecord) {
        fromRecord.onHand = Math.max(0, fromRecord.onHand - item.qty);
        fromRecord.availableToPromise = Math.max(0, fromRecord.onHand - fromRecord.reserved - fromRecord.locked);
      }

      const toRecord = this.localStockLevels.get(toKey) || {
        sku,
        productId: item.productId,
        warehouseId: toWarehouseId,
        onHand: 0,
        reserved: 0,
        locked: 0,
        availableToPromise: 0,
      };
      toRecord.onHand += item.qty;
      toRecord.availableToPromise += item.qty;
      this.localStockLevels.set(toKey, toRecord);
    }

    const transferRecord: StockTransferRecord = {
      transferId: `str-${Date.now()}`,
      fromWarehouseId,
      toWarehouseId,
      items,
      status: "Completed",
      reference: reference || `TRANSFER-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    this.transfers.push(transferRecord);
    SPK.events.emit("StockTransferred", transferRecord.transferId, transferRecord);
    return transferRecord;
  }

  public async getAllStockLevels(warehouseId?: string): Promise<StockLevelRecord[]> {
    const list = Array.from(this.localStockLevels.values());
    if (warehouseId) {
      return list.filter((r) => r.warehouseId === warehouseId);
    }
    return list;
  }

  public async checkReorderAlerts(): Promise<StockLevelRecord[]> {
    const all = await this.getAllStockLevels();
    return all.filter((r) => r.onHand <= (r.reorderLevel || 10));
  }

  public async calculateStockValuation(unitCosts: Record<string, number>, method: "FIFO" | "WEIGHTED_AVG" = "WEIGHTED_AVG"): Promise<{ totalValuation: number; itemsValuation: Record<string, number> }> {
    const all = await this.getAllStockLevels();
    const itemsValuation: Record<string, number> = {};
    let totalValuation = 0;

    for (const record of all) {
      const unitCost = unitCosts[record.sku] || unitCosts[record.productId] || 100;
      const val = record.onHand * unitCost;
      itemsValuation[record.sku] = val;
      totalValuation += val;
    }

    return { totalValuation, itemsValuation };
  }

  public async getTimeline(productId?: string, warehouseId?: string, limit = 50): Promise<any[]> {
    return inventoryDomainService.fetchTimeline(productId, warehouseId, limit);
  }
}
