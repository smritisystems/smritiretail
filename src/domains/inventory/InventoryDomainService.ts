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

export interface KernelLockDTO {
  lock_type: string;
  lock_scope: string;
  target_id: string;
  reason?: string;
  product_id?: string;
  location_id?: string;
  locked_qty?: number;
}

export interface KernelMovementDTO {
  transaction_id: string;
  from_location_id?: string;
  to_location_id?: string;
  items: Array<{ product_id: string; sku?: string; quantity: number; unit_cost?: number }>;
  movement_type?: string;
  reference_doc_type?: string;
  reference_doc_id?: string;
  idempotency_key?: string;
}

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

  // --- LOCAL FALLBACK METHODS ---

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

  // --- KERNEL FACADE REST API INTEGRATION ---

  /** Fetch Derived ATP Stock (ATP = On Hand - Reserved - Locked) from backend Kernel Query Facade */
  public async fetchAvailableStock(productId: string, locationId?: string): Promise<number> {
    try {
      const url = locationId
        ? `/api/v1/inventory/kernel/available/${productId}?location_id=${encodeURIComponent(locationId)}`
        : `/api/v1/inventory/kernel/available/${productId}`;
      const res = await fetch(url);
      if (!res.ok) return 0;
      const data = await res.json();
      return data.available_to_promise ?? 0;
    } catch {
      return 0;
    }
  }

  /** Fetch Physical On-Hand Stock from backend Kernel ILGE Balance Engine */
  public async fetchLocationBalance(productId: string, locationId?: string): Promise<number> {
    try {
      const url = locationId
        ? `/api/v1/inventory/kernel/location-balance/${productId}?location_id=${encodeURIComponent(locationId)}`
        : `/api/v1/inventory/kernel/location-balance/${productId}`;
      const res = await fetch(url);
      if (!res.ok) return 0;
      const data = await res.json();
      return data.on_hand ?? 0;
    } catch {
      return 0;
    }
  }

  /** Fetch Unified Inventory Timeline Stream */
  public async fetchTimeline(productId?: string, locationId?: string, limit = 50): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (productId) params.append("product_id", productId);
      if (locationId) params.append("location_id", locationId);
      params.append("limit", limit.toString());
      const res = await fetch(`/api/v1/inventory/kernel/timeline?${params.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.events || [];
    } catch {
      return [];
    }
  }

  /** Execute atomic inventory transaction via ITEX / Command Facade */
  public async executeMovement(movement: KernelMovementDTO): Promise<any> {
    const res = await fetch("/api/v1/inventory/kernel/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(movement),
    });
    if (!res.ok) throw new Error(`Movement execution failed: ${res.statusText}`);
    return await res.json();
  }

  /** Acquire operational stock lock via Lock Engine Facade */
  public async acquireLock(lock: KernelLockDTO): Promise<any> {
    const res = await fetch("/api/v1/inventory/kernel/locks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lock),
    });
    if (!res.ok) throw new Error(`Lock acquisition failed: ${res.statusText}`);
    return await res.json();
  }

  /** Release active stock lock */
  public async releaseLock(lockId: string, reason = "Normal Release"): Promise<any> {
    const res = await fetch(`/api/v1/inventory/kernel/locks/${lockId}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error(`Lock release failed: ${res.statusText}`);
    return await res.json();
  }

  /** Create recovery point checkpoint */
  public async createCheckpoint(checkpointName: string, description?: string): Promise<any> {
    const res = await fetch("/api/v1/inventory/kernel/checkpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkpoint_name: checkpointName, description }),
    });
    if (!res.ok) throw new Error(`Checkpoint creation failed: ${res.statusText}`);
    return await res.json();
  }

  // --- DASHBOARD & AI DELEGATION ---

  public renderLowStockWidget(context: Readonly<PlatformContext>) {
    return SPK.dashboard.renderWidget("w_low_stock", "dash.store_operations", context);
  }

  public getAIReorderAdvisory(context: Readonly<PlatformContext>) {
    return SPK.ai.executeSkill("ai.reorder_recommendation", {}, context);
  }
}

export const inventoryDomainService = new InventoryDomainService();
