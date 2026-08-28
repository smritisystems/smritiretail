/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.117.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import StockExpiryEngine from "../utils/stockExpiryEngine";

describe("StockExpiryEngine — Stock Expiry & Batch Tracking Engine", () => {

  const BRANCH = "BR-MUM-01";
  const asOf   = new Date("2026-09-01T00:00:00.000Z");

  function makeBatch(batchNo: string, expiryDate: string, qty: number, sku: string = "MED-PARA-500MG") {
    return StockExpiryEngine.registerBatch({
      batchNo, sku, productName: "Paracetamol 500mg",
      branchCode: BRANCH, mfgDate: "2026-01-01",
      expiryDate, receivedQty: qty, unitCost: 12,
    });
  }

  // ─── Test 1: Register batch + basic fields ──────────────────────────────
  it("registerBatch creates AVAILABLE batch with correct qty fields", () => {
    const b = makeBatch("BT-2026-001", "2027-01-01", 100);
    expect(b.status).toBe("AVAILABLE");
    expect(b.receivedQty).toBe(100);
    expect(b.availableQty).toBe(100);
    expect(b.reservedQty).toBe(0);
    expect(b.quarantinedQty).toBe(0);
    expect(b.batchId).toMatch(/^BATCH-/);
  });

  // ─── Test 2: FEFO allocation — shortest-expiry first + shortfall ────────
  it("fefoAllocation picks batches in FEFO order; returns shortfallQty if insufficient", () => {
    const b1 = makeBatch("BT-2026-001", "2026-10-01", 20);  // Expires sooner
    const b2 = makeBatch("BT-2026-002", "2026-12-31", 30);  // Expires later
    const b3 = makeBatch("BT-2026-003", "2027-06-01", 50);  // Far future

    // Request 45 units — should take all 20 from b1, then 25 from b2
    const result = StockExpiryEngine.fefoAllocation([b1, b2, b3], "MED-PARA-500MG", 45, asOf);
    expect(result.fulfilledQty).toBe(45);
    expect(result.shortfallQty).toBe(0);
    expect(result.fullyFulfilled).toBe(true);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].batchNo).toBe("BT-2026-001");  // FEFO first
    expect(result.lines[0].allocatedQty).toBe(20);
    expect(result.lines[1].batchNo).toBe("BT-2026-002");
    expect(result.lines[1].allocatedQty).toBe(25);

    // Request 120 — total available 100, shortfall 20
    const r2 = StockExpiryEngine.fefoAllocation([b1, b2, b3], "MED-PARA-500MG", 120, asOf);
    expect(r2.fullyFulfilled).toBe(false);
    expect(r2.shortfallQty).toBe(20);
    expect(r2.fulfilledQty).toBe(100);
  });

  // ─── Test 3: nearExpiryBatches + deductAllocation + expireIfDue ─────────
  it("nearExpiryBatches filters by threshold; deductAllocation reduces qty; expireIfDue idempotent", () => {
    const b1 = makeBatch("BT-A", "2026-09-15", 50);  // 14 days from asOf — near expiry
    const b2 = makeBatch("BT-B", "2026-10-30", 80);  // 59 days — not near
    const b3 = makeBatch("BT-C", "2026-09-05", 30);  // 4 days — very near

    const near = StockExpiryEngine.nearExpiryBatches([b1, b2, b3], 30, asOf);
    expect(near).toHaveLength(2);            // b1 (14d) and b3 (4d); b2 (59d) excluded
    expect(near[0].batchNo).toBe("BT-C");   // Sorted ascending: 4d first
    expect(near[0].daysToExpiry).toBe(4);
    expect(near[1].daysToExpiry).toBe(14);

    // Deduct allocation: take 20 from b1, 10 from b3
    const result = StockExpiryEngine.fefoAllocation([b3, b1, b2], "MED-PARA-500MG", 30, asOf);
    const deducted = StockExpiryEngine.deductAllocation([b1, b2, b3], result);
    const db3 = deducted.find((b) => b.batchNo === "BT-C")!;
    const db1 = deducted.find((b) => b.batchNo === "BT-A")!;
    expect(db3.availableQty).toBe(0);        // All 30 taken from BT-C first (FEFO)
    expect(db3.status).toBe("DEPLETED");
    expect(db1.availableQty).toBe(50);       // BT-A untouched (FEFO took all from BT-C)

    // expireIfDue: expired batch
    const pastExpiry = makeBatch("BT-OLD", "2026-08-01", 10);
    const expired = StockExpiryEngine.expireIfDue(pastExpiry, asOf);
    expect(expired.status).toBe("EXPIRED");

    // Idempotent — calling again doesn't change status
    const again = StockExpiryEngine.expireIfDue(expired, asOf);
    expect(again.status).toBe("EXPIRED");
  });

  // ─── Test 4: Quarantine/release + batchReport ────────────────────────────
  it("quarantine reduces availableQty; release restores it; batchReport aggregates per SKU", () => {
    const b1 = makeBatch("BT-Q1", "2027-03-01", 100);

    // Quarantine 30
    const qb = StockExpiryEngine.quarantineBatch(b1, "Packaging defect", 30, "QC-001");
    expect(qb.availableQty).toBe(70);
    expect(qb.quarantinedQty).toBe(30);
    expect(qb.status).toBe("QUARANTINED");

    // Release 30 back
    const rb = StockExpiryEngine.releaseFromQuarantine(qb, 30, "QC-001");
    expect(rb.availableQty).toBe(100);
    expect(rb.quarantinedQty).toBe(0);
    expect(rb.status).toBe("AVAILABLE");

    // Quarantine overflow throws
    expect(() => StockExpiryEngine.quarantineBatch(b1, "Test", 200, "QC-001")).toThrow("Insufficient available qty");

    // batchReport
    const b2 = makeBatch("BT-Q2", "2026-08-15", 50);
    const b2e = StockExpiryEngine.expireIfDue(b2, asOf);  // Expired
    const report = StockExpiryEngine.batchReport([b1, b2e], asOf);
    expect(report).toHaveLength(1);  // Both same SKU
    const row = report[0];
    expect(row.sku).toBe("MED-PARA-500MG");
    expect(row.totalBatches).toBe(2);
    expect(row.totalAvailable).toBe(100);  // b1 is AVAILABLE (100 units)
    // b2e was registered with receivedQty=50; expireIfDue preserves availableQty
    // batchReport sums availableQty where status===EXPIRED → 50
    expect(row.totalExpired).toBe(50);
  });
});
