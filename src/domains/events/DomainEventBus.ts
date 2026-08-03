/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Decoupled Domain Event Bus & Typed Event Envelopes
 * Standard     : SMAP Constitution v1.0 & Wave 1 Architecture Standard
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface DomainEventEnvelope<T = any> {
  eventId: string;
  eventType: string;          // e.g. "SaleCompleted.v1", "StockUpdated.v1"
  version: "v1";
  occurredAt: string;
  tenantId: string;
  correlationId: string;
  payload: T;
}

export interface SaleCompletedPayload {
  saleId: string;
  invoiceNo: string;
  storeId: string;
  cashierId: string;
  items: Array<{ sku: string; qty: number; unitPrice: number; lineTotal: number }>;
  totalAmount: number;
  taxAmount: number;
}

export interface StockUpdatedPayload {
  sku: string;
  storeId: string;
  previousQty: number;
  newQty: number;
  reason: string;
}

export interface OrderApprovedPayload {
  orderId: string;
  approverId: string;
  roleId: string;
  approvedAt: string;
}

/**
 * PurchaseOrderRequested.v1
 * Published by: inventory.reorder workspace (InventoryStudio)
 * Consumed by:  PurchaseOrderRequestListener → PurchaseCommandFacade.createDraftPO()
 *
 * Sprint 5 — Inventory→Purchase event bridge.
 * Payload is intentionally rich so Analytics, AI, and Notifications
 * can also consume it without a schema change.
 */
export interface PurchaseOrderRequestedPayload {
  skuId:        string;
  warehouseId:  string;
  suggestedQty: number;
  reorderPoint: number;
  availableQty: number;
  requestedBy:  string;   // ctx.userId
  source:       "InventoryStudio";
  requestedAt:  string;   // ISO 8601
}

type EventListener<T = any> = (event: DomainEventEnvelope<T>) => void | Promise<void>;

import logger from "../../core/logging/logger.js";

export class DomainEventBusService {
  private listeners: Map<string, Set<EventListener>> = new Map();

  public subscribe<T = any>(eventType: string, listener: EventListener<T>): () => void {
    const key = eventType.toLowerCase();
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(listener);
      }
    };
  }

  public publish<T = any>(eventType: string, payload: T, tenantId: string = "smriti-default", correlationId?: string): DomainEventEnvelope<T> {
    const key = eventType.toLowerCase();
    const event: DomainEventEnvelope<T> = Object.freeze({
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      version: "v1",
      occurredAt: new Date().toISOString(),
      tenantId,
      correlationId: correlationId || `corr-${Date.now()}`,
      payload: Object.freeze(payload)
    });

    const set = this.listeners.get(key);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(event);
        } catch (err) {
          logger.error(`Error in domain event listener for '${eventType}':`, err as unknown);
        }
      });
    }

    return event;
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const DomainEventBus = new DomainEventBusService();
