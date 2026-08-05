/**
 * Project      : SMRITI Retail OS
 * Test Suite   : Inventory Phase A — Contract Hardening Tests
 * Standard     : AUD-005 / INV-A01 to INV-A11
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 *
 * Covers:
 *   INV-A01  InventoryService implements IInventoryService contract
 *   INV-A02  getStockQuantity: returns physical on-hand stock for SKU
 *   INV-A03  getAvailableToPromise: returns ATP (onHand - reserved - locked)
 *   INV-A04  adjustStock: rejects empty or short reason (<3 chars)
 *   INV-A05  adjustStock: updates onHand and ATP, emits StockUpdated.v1 and StockAdjusted
 *   INV-A06  transferStock: rejects missing warehouse IDs
 *   INV-A07  transferStock: rejects identical source and destination warehouse
 *   INV-A08  transferStock: rejects empty items array
 *   INV-A09  transferStock: deducts from source, adds to destination, emits StockTransferred
 *   INV-A10  getAllStockLevels: returns stock levels (filterable by warehouseId)
 *   INV-A11  SPK.services.resolve<IInventoryService>("INVENTORY") returns registered instance
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { InventoryService } from "../kernel/internal/InventoryService.js";
import { IInventoryService } from "../kernel/public/IInventoryService.js";
import { SPK } from "../kernel/SPK.js";
import { DomainEventBus } from "../domains/events/DomainEventBus.js";

describe("Inventory Phase A — Contract Hardening Tests (INV-A01 to INV-A11)", () => {
  let svc: InventoryService;

  beforeEach(() => {
    svc = new InventoryService();
    SPK.services.register("INVENTORY", svc);
  });

  it("INV-A01: InventoryService implements IInventoryService contract and registers with SPK", () => {
    const resolved = SPK.services.resolve<IInventoryService>("INVENTORY");
    expect(resolved).toBeDefined();
    expect(resolved.getStockQuantity).toBeTypeOf("function");
    expect(resolved.getAvailableToPromise).toBeTypeOf("function");
    expect(resolved.adjustStock).toBeTypeOf("function");
    expect(resolved.transferStock).toBeTypeOf("function");
  });

  it("INV-A02: getStockQuantity returns on-hand physical stock for SKU", async () => {
    const qty = await svc.getStockQuantity("SKU-1001", "wh-main");
    expect(qty).toBe(100);
  });

  it("INV-A03: getAvailableToPromise returns derived ATP (onHand - reserved - locked)", async () => {
    const atp = await svc.getAvailableToPromise("prod-1001", "wh-main");
    expect(atp).toBe(95); // 100 - 5 - 0
  });

  it("INV-A04: adjustStock rejects empty or short reason (<3 chars)", async () => {
    await expect(svc.adjustStock("SKU-1001", 10, "")).rejects.toThrow("mandatory");
    await expect(svc.adjustStock("SKU-1001", 10, "AB")).rejects.toThrow("mandatory");
  });

  it("INV-A05: adjustStock updates onHand/ATP and emits events", async () => {
    const eventSpy = vi.fn();
    const unsub = SPK.events.on("StockAdjusted", eventSpy);

    const result = await svc.adjustStock("SKU-1001", 15, "Damage Audit Adjustment", "wh-main", "auditor-01");
    expect(result.success).toBe(true);
    expect(result.previousQty).toBe(100);
    expect(result.changeQty).toBe(15);
    expect(result.newQty).toBe(115);
    expect(result.reason).toBe("Damage Audit Adjustment");

    const newQty = await svc.getStockQuantity("SKU-1001", "wh-main");
    expect(newQty).toBe(115);

    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "StockAdjusted",
        entityId: result.id,
        payload: result,
      })
    );
    unsub?.();
  });

  it("INV-A06: transferStock rejects missing warehouse IDs", async () => {
    await expect(svc.transferStock("", "wh-dest", [{ productId: "prod-1", qty: 5 }])).rejects.toThrow(
      "Both source and destination"
    );
  });

  it("INV-A07: transferStock rejects identical source and destination warehouse", async () => {
    await expect(svc.transferStock("wh-main", "wh-main", [{ productId: "prod-1", qty: 5 }])).rejects.toThrow(
      "must be different"
    );
  });

  it("INV-A08: transferStock rejects empty items array", async () => {
    await expect(svc.transferStock("wh-main", "wh-branch-1", [])).rejects.toThrow("At least one item");
  });

  it("INV-A09: transferStock moves stock from source to destination and emits StockTransferred", async () => {
    const transferSpy = vi.fn();
    const unsub = SPK.events.on("StockTransferred", transferSpy);

    const result = await svc.transferStock(
      "wh-main",
      "wh-branch-1",
      [{ productId: "prod-1001", sku: "SKU-1001", qty: 10 }],
      "REF-TR-001"
    );

    expect(result.transferId).toBeDefined();
    expect(result.status).toBe("Completed");
    expect(result.reference).toBe("REF-TR-001");

    // Source warehouse should decrease by 10
    const sourceQty = await svc.getStockQuantity("SKU-1001", "wh-main");
    expect(sourceQty).toBe(90);

    // Destination warehouse should increase by 10
    const destQty = await svc.getStockQuantity("SKU-1001", "wh-branch-1");
    expect(destQty).toBe(10);

    expect(transferSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "StockTransferred",
        entityId: result.transferId,
        payload: result,
      })
    );
    unsub?.();
  });

  it("INV-A10: getAllStockLevels returns stock levels (filterable by warehouseId)", async () => {
    const all = await svc.getAllStockLevels();
    expect(all.length).toBeGreaterThanOrEqual(2);

    const whMainOnly = await svc.getAllStockLevels("wh-main");
    whMainOnly.forEach((r) => expect(r.warehouseId).toBe("wh-main"));
  });

  it("INV-A11: SPK.services.resolve<IInventoryService>('INVENTORY') returns active instance", () => {
    const resolved = SPK.services.resolve<IInventoryService>("INVENTORY");
    expect(resolved).toBe(svc);
  });
});
