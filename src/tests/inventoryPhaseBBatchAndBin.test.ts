/**
 * Project      : SMRITI Retail OS
 * Test Suite   : Inventory Phase B — Batch & Bin Tracking Tests
 * Standard     : AUD-005 / INV-B01 to INV-B05
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 *
 * Covers:
 *   INV-B01  adjustStock accepts batchNumber, expiryDate, and binLocation
 *   INV-B02  adjustStock stores batch, expiry, and bin location on StockAdjustmentRecord
 *   INV-B03  validateAdjPayload validates adjustment payload structure correctly
 *   INV-B04  adjustStock trims whitespace from batch, expiry, and bin fields
 *   INV-B05  StockAdjusted event includes batch, expiry, and bin payload metadata
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { InventoryService } from "../kernel/internal/InventoryService.js";
import { SPK } from "../kernel/SPK.js";
import { validateAdjPayload, AdjustmentPayload } from "../components/inventory/wizards/AdjustmentWizard.js";

describe("Inventory Phase B — Batch & Bin Tracking Tests (INV-B01 to INV-B05)", () => {
  let svc: InventoryService;

  beforeEach(() => {
    svc = new InventoryService();
    SPK.services.register("INVENTORY", svc);
  });

  it("INV-B01: adjustStock accepts batchNumber, expiryDate, and binLocation parameters", async () => {
    const result = await svc.adjustStock(
      "SKU-1001",
      10,
      "Batch arrival audit",
      "wh-main",
      "auditor-01",
      "BATCH-2026-08",
      "2027-12-31",
      "BIN-A-12"
    );

    expect(result.success).toBe(true);
    expect(result.batchNumber).toBe("BATCH-2026-08");
    expect(result.expiryDate).toBe("2027-12-31");
    expect(result.binLocation).toBe("BIN-A-12");
  });

  it("INV-B02: adjustStock works without optional batch/expiry/bin fields", async () => {
    const result = await svc.adjustStock("SKU-1001", -5, "Damage correction", "wh-main", "auditor-01");
    expect(result.success).toBe(true);
    expect(result.batchNumber).toBeUndefined();
    expect(result.expiryDate).toBeUndefined();
    expect(result.binLocation).toBeUndefined();
  });

  it("INV-B03: validateAdjPayload validates adjustment payload correctly", () => {
    const valid: AdjustmentPayload = {
      itemId: "SKU-1001",
      itemName: "Nike Air Zoom",
      currentQty: 50,
      adjustmentQty: 10,
      reason: "count_correction",
      batchNumber: "LOT-9988",
      expiryDate: "2028-06-30",
      binLocation: "BIN-C-04",
    };
    expect(validateAdjPayload(valid)).toBe(true);

    const invalid: Partial<AdjustmentPayload> = {
      itemId: "SKU-1001",
      adjustmentQty: 0,
    };
    expect(validateAdjPayload(invalid)).toBe(false);
  });

  it("INV-B04: adjustStock trims whitespace from batch, expiry, and bin location strings", async () => {
    const result = await svc.adjustStock(
      "SKU-1002",
      5,
      "Regular adjustment",
      "wh-main",
      "user-01",
      "  BATCH-TRIM-01  ",
      "  2026-11-30  ",
      "  BIN-B-02  "
    );

    expect(result.batchNumber).toBe("BATCH-TRIM-01");
    expect(result.expiryDate).toBe("2026-11-30");
    expect(result.binLocation).toBe("BIN-B-02");
  });

  it("INV-B05: StockAdjusted event payload contains batch, expiry, and bin metadata", async () => {
    const eventSpy = vi.fn();
    const unsub = SPK.events.on("StockAdjusted", eventSpy);

    const result = await svc.adjustStock(
      "SKU-1001",
      20,
      "Stock intake",
      "wh-main",
      "user-02",
      "LOT-ABC-123",
      "2027-01-15",
      "BIN-SHELF-4"
    );

    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "StockAdjusted",
        entityId: result.id,
        payload: expect.objectContaining({
          batchNumber: "LOT-ABC-123",
          expiryDate: "2027-01-15",
          binLocation: "BIN-SHELF-4",
        }),
      })
    );

    unsub?.();
  });
});
