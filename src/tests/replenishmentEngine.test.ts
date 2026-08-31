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

import { describe, it, expect } from "vitest";
import ReplenishmentEngine, { InventoryItem } from "../utils/replenishmentEngine";

describe("ReplenishmentEngine — Smart Min-Max Inventory Reorder Automation", () => {
  // ─── Fixture ───────────────────────────────────────────────────────────────
  function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
    return {
      sku: "APP-POLO-NAVY-M",
      productName: "Polo Shirt Navy M",
      category: "Apparel",
      branchCode: "BR-MUM-01",
      currentStock: 50,
      minStockLevel: 20,
      maxStockLevel: 200,
      reorderPoint: 40,
      safetyStock: 15,
      avgDailySales: 5,
      leadTimeDays: 7,
      unitCost: 600,
      preferredSupplierId: "SUP-001",
      ...overrides,
    };
  }

  // ─── Test 1: Trigger classification ──────────────────────────────────────
  it("classifies correct replenishment triggers based on stock level thresholds", () => {
    // Above all thresholds — no trigger
    expect(ReplenishmentEngine.getTrigger(makeItem({ currentStock: 100 }))).toBeNull();

    // Below reorder point but above safety stock → REORDER_POINT_HIT
    expect(ReplenishmentEngine.getTrigger(makeItem({ currentStock: 35 }))).toBe("REORDER_POINT_HIT");

    // At safety stock → SAFETY_STOCK_BREACH
    expect(ReplenishmentEngine.getTrigger(makeItem({ currentStock: 15 }))).toBe("SAFETY_STOCK_BREACH");

    // Below safety stock → SAFETY_STOCK_BREACH (highest priority)
    expect(ReplenishmentEngine.getTrigger(makeItem({ currentStock: 5 }))).toBe("SAFETY_STOCK_BREACH");

    // stock(25) < reorderPoint(30), > minStockLevel(20), > safetyStock(15) → REORDER_POINT_HIT
    // (engine priority: safetyStock > reorderPoint > minStockLevel)
    expect(ReplenishmentEngine.getTrigger(makeItem({ currentStock: 25, reorderPoint: 30 }))).toBe("REORDER_POINT_HIT");

    // stock(18) < minStockLevel(20) but reorderPoint set to 10 (lower) and safetyStock=15 → MIN_STOCK_BREACH
    expect(ReplenishmentEngine.getTrigger(makeItem({ currentStock: 18, reorderPoint: 10, safetyStock: 10 }))).toBe("MIN_STOCK_BREACH");
  });

  // ─── Test 2: Days of stock and stockout date projection ──────────────────
  it("calculates days of stock remaining and projects stockout date accurately", () => {
    const item = makeItem({ currentStock: 25, avgDailySales: 5 });
    const days = ReplenishmentEngine.daysOfStockRemaining(item);
    expect(days).toBe(5);  // 25 / 5 = 5 days

    const asOf = new Date(2026, 7, 28); // Aug 28, 2026
    const stockoutDate = ReplenishmentEngine.estimatedStockoutDate(item, asOf);
    const projected = new Date(stockoutDate);
    expect(projected.getDate()).toBe(2);       // Sep 2, 2026 (28 + 5 days)
    expect(projected.getMonth()).toBe(8);      // September (0-indexed)

    // Zero sales rate — no stockout
    const staticItem = makeItem({ avgDailySales: 0 });
    expect(ReplenishmentEngine.daysOfStockRemaining(staticItem)).toBe(999);
  });

  // ─── Test 3: Suggestion generation with order qty and PO value ───────────
  it("generates replenishment suggestion with correct order qty, PO value, and trigger", () => {
    // Item below reorder point
    const item = makeItem({ currentStock: 30 });
    const sugg = ReplenishmentEngine.generateSuggestion(item, new Date(2026, 7, 28));

    expect(sugg).not.toBeNull();
    expect(sugg!.trigger).toBe("REORDER_POINT_HIT");
    expect(sugg!.suggestedOrderQty).toBe(170);         // maxStock(200) - currentStock(30)
    expect(sugg!.estimatedPOValue).toBe(170 * 600);    // 170 × ₹600 = ₹102,000
    expect(sugg!.status).toBe("PENDING");
    expect(sugg!.preferredSupplierId).toBe("SUP-001");

    // Item well-stocked — no suggestion
    const wellStocked = makeItem({ currentStock: 150 });
    expect(ReplenishmentEngine.generateSuggestion(wellStocked)).toBeNull();
  });

  // ─── Test 4: Full inventory scan with priority sorting ───────────────────
  it("scans multiple SKUs, prioritises SAFETY_STOCK_BREACH over REORDER_POINT_HIT, and computes total PO value", () => {
    const items: InventoryItem[] = [
      makeItem({ sku: "ITEM-A", currentStock: 100 }),   // No trigger
      makeItem({ sku: "ITEM-B", currentStock: 35 }),    // REORDER_POINT_HIT
      makeItem({ sku: "ITEM-C", currentStock: 10 }),    // SAFETY_STOCK_BREACH
      makeItem({ sku: "ITEM-D", currentStock: 25, reorderPoint: 30 }), // MIN_STOCK_BREACH
    ];

    const report = ReplenishmentEngine.scanInventory(items, new Date(2026, 7, 28));

    expect(report.totalSKUs).toBe(4);
    expect(report.suggestions).toHaveLength(3);   // ITEM-A excluded

    // SAFETY_STOCK_BREACH should be first
    expect(report.suggestions[0].trigger).toBe("SAFETY_STOCK_BREACH");
    expect(report.suggestions[0].sku).toBe("ITEM-C");

    expect(report.criticalSKUs).toBe(1);
    expect(report.reorderDueSKUs).toBe(2);        // ITEM-B + ITEM-D

    // Total PO value = sum of (suggestedQty × unitCost) for 3 items
    expect(report.totalSuggestedPOValue).toBeGreaterThan(0);

    // PO raise workflow
    const updated = ReplenishmentEngine.raisePO(report.suggestions[0], "PO-AUTO-2026-001");
    expect(updated.status).toBe("PO_RAISED");
    expect(updated.raisedPONumber).toBe("PO-AUTO-2026-001");
  });
});
