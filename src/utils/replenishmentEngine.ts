/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.92.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export type ReorderStatus = "PENDING" | "APPROVED" | "PO_RAISED" | "CANCELLED";
export type ReplenishmentTrigger = "MIN_STOCK_BREACH" | "REORDER_POINT_HIT" | "SAFETY_STOCK_BREACH" | "SEASONAL_PUSH" | "MANUAL_OVERRIDE";

export interface InventoryItem {
  sku: string;
  productName: string;
  category: string;
  branchCode: string;
  currentStock: number;
  minStockLevel: number;         // Trigger reorder below this
  maxStockLevel: number;         // Order up to this
  reorderPoint: number;          // Reorder trigger (typically: safety stock + lead-time demand)
  safetyStock: number;           // Minimum buffer
  avgDailySales: number;         // Units/day
  leadTimeDays: number;          // Supplier lead time
  unitCost: number;              // INR
  preferredSupplierId?: string;
  alternateSupplierIds?: string[];
  lastReplenishedAt?: string;
}

export interface ReplenishmentSuggestion {
  suggestionId: string;
  sku: string;
  productName: string;
  category: string;
  branchCode: string;
  trigger: ReplenishmentTrigger;
  currentStock: number;
  reorderPoint: number;
  suggestedOrderQty: number;     // maxStock - currentStock
  daysOfStockRemaining: number;  // currentStock / avgDailySales
  estimatedStockoutDate: string; // ISO
  preferredSupplierId?: string;
  estimatedPOValue: number;      // suggestedOrderQty * unitCost
  status: ReorderStatus;
  createdAt: string;
  raisedPONumber?: string;
}

export interface ReplenishmentReport {
  asOfDate: string;
  branchCode: string;
  totalSKUs: number;
  criticalSKUs: number;          // Below safety stock
  reorderDueSKUs: number;        // Below reorder point
  totalSuggestedPOValue: number;
  suggestions: ReplenishmentSuggestion[];
}

export class ReplenishmentEngine {
  /** Days of stock remaining at current sales rate */
  public static daysOfStockRemaining(item: InventoryItem): number {
    if (item.avgDailySales <= 0) return 999;
    return Math.floor(item.currentStock / item.avgDailySales);
  }

  /** Estimated stockout date */
  public static estimatedStockoutDate(item: InventoryItem, asOf: Date = new Date()): string {
    const days = this.daysOfStockRemaining(item);
    const stockoutDate = new Date(asOf);
    stockoutDate.setDate(stockoutDate.getDate() + days);
    return stockoutDate.toISOString();
  }

  /** Determine if item needs replenishment and why */
  public static getTrigger(item: InventoryItem): ReplenishmentTrigger | null {
    if (item.currentStock <= item.safetyStock) return "SAFETY_STOCK_BREACH";
    if (item.currentStock <= item.reorderPoint) return "REORDER_POINT_HIT";
    if (item.currentStock <= item.minStockLevel) return "MIN_STOCK_BREACH";
    return null;
  }

  /** Calculate suggested order quantity (order up to max) */
  public static suggestedOrderQty(item: InventoryItem): number {
    return Math.max(0, item.maxStockLevel - item.currentStock);
  }

  /** Generate a replenishment suggestion for a single SKU */
  public static generateSuggestion(item: InventoryItem, asOf: Date = new Date()): ReplenishmentSuggestion | null {
    const trigger = this.getTrigger(item);
    if (!trigger) return null;

    const qty = this.suggestedOrderQty(item);
    if (qty <= 0) return null;

    return {
      suggestionId: `SUGG-${item.sku}-${Date.now()}`,
      sku: item.sku,
      productName: item.productName,
      category: item.category,
      branchCode: item.branchCode,
      trigger,
      currentStock: item.currentStock,
      reorderPoint: item.reorderPoint,
      suggestedOrderQty: qty,
      daysOfStockRemaining: this.daysOfStockRemaining(item),
      estimatedStockoutDate: this.estimatedStockoutDate(item, asOf),
      preferredSupplierId: item.preferredSupplierId,
      estimatedPOValue: Math.round(qty * item.unitCost * 100) / 100,
      status: "PENDING",
      createdAt: asOf.toISOString(),
    };
  }

  /** Run replenishment scan across all items for a branch */
  public static scanInventory(items: InventoryItem[], asOf: Date = new Date()): ReplenishmentReport {
    const suggestions: ReplenishmentSuggestion[] = [];

    for (const item of items) {
      const sugg = this.generateSuggestion(item, asOf);
      if (sugg) suggestions.push(sugg);
    }

    // Sort: SAFETY_STOCK_BREACH first, then REORDER_POINT_HIT, then MIN_STOCK_BREACH
    const triggerPriority: Record<ReplenishmentTrigger, number> = {
      SAFETY_STOCK_BREACH: 0,
      REORDER_POINT_HIT: 1,
      MIN_STOCK_BREACH: 2,
      SEASONAL_PUSH: 3,
      MANUAL_OVERRIDE: 4,
    };
    suggestions.sort((a, b) => triggerPriority[a.trigger] - triggerPriority[b.trigger]);

    const branchCode = items[0]?.branchCode ?? "ALL";
    const criticalSKUs = suggestions.filter((s) => s.trigger === "SAFETY_STOCK_BREACH").length;
    const reorderDueSKUs = suggestions.filter((s) => s.trigger === "REORDER_POINT_HIT" || s.trigger === "MIN_STOCK_BREACH").length;
    const totalPOValue = suggestions.reduce((s, sg) => s + sg.estimatedPOValue, 0);

    return {
      asOfDate: asOf.toISOString(),
      branchCode,
      totalSKUs: items.length,
      criticalSKUs,
      reorderDueSKUs,
      totalSuggestedPOValue: Math.round(totalPOValue * 100) / 100,
      suggestions,
    };
  }

  /** Raise a PO for a suggestion (returns updated suggestion with PO number) */
  public static raisePO(suggestion: ReplenishmentSuggestion, poNumber: string): ReplenishmentSuggestion {
    return { ...suggestion, status: "PO_RAISED", raisedPONumber: poNumber };
  }

  /** Approve a pending suggestion */
  public static approve(suggestion: ReplenishmentSuggestion): ReplenishmentSuggestion {
    return { ...suggestion, status: "APPROVED" };
  }

  /** Cancel a suggestion */
  public static cancel(suggestion: ReplenishmentSuggestion): ReplenishmentSuggestion {
    return { ...suggestion, status: "CANCELLED" };
  }
}

export default ReplenishmentEngine;
