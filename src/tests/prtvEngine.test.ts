/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.115.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import PRTVEngine from "../utils/prtvEngine";

describe("PRTVEngine — Purchase Return to Vendor Engine", () => {

  const BASE_LINES = [
    { sku: "FAB-DENIM-BLU", productName: "Denim Blue 1m", returnQty: 10, unitCost: 180, taxPct: 5, reason: "DEFECTIVE" as const },
    { sku: "FAB-LINEN-WHT", productName: "Linen White 1m", returnQty: 5, unitCost: 200, taxPct: 12, reason: "QUALITY_REJECTION" as const },
  ];

  // ─── Test 1: Create PRTV order — line-level cost + tax computation ─────────
  it("creates PRTV with correct line-level costs, tax amounts and net return total", () => {
    const order = PRTVEngine.createReturn({
      vendorId: "VNDR-001", vendorName: "Textile Exports Ltd",
      branchCode: "BR-MUM-01", createdBy: "STORE-MGR-001",
      lines: BASE_LINES,
    });

    expect(order.status).toBe("DRAFT");
    expect(order.lines).toHaveLength(2);

    // Line 1: 10 × 180 = 1800; tax 5% = 90; net = 1890
    const l1 = order.lines[0];
    expect(l1.totalCost).toBe(1800);
    expect(l1.taxAmt).toBe(90);
    expect(l1.netReturnAmt).toBe(1890);

    // Line 2: 5 × 200 = 1000; tax 12% = 120; net = 1120
    const l2 = order.lines[1];
    expect(l2.totalCost).toBe(1000);
    expect(l2.taxAmt).toBe(120);
    expect(l2.netReturnAmt).toBe(1120);

    // Order totals
    expect(order.subTotal).toBe(2800);      // 1800 + 1000
    expect(order.totalTax).toBe(210);       // 90 + 120
    expect(order.netReturnAmt).toBe(3010);  // 1890 + 1120
    expect(order.auditTrail).toHaveLength(1);
    expect(order.auditTrail[0].action).toBe("PRTV_CREATED");
  });

  // ─── Test 2: Approve → Debit Note generated ───────────────────────────────
  it("approve() generates a debit note with correct amounts; rejects double-approve", () => {
    let order = PRTVEngine.createReturn({
      vendorId: "VNDR-001", vendorName: "Textile Exports Ltd",
      branchCode: "BR-MUM-01", createdBy: "MGR-001",
      lines: BASE_LINES,
    });

    order = PRTVEngine.approve(order, "PURCHASE-MGR-001");
    expect(order.status).toBe("APPROVED");
    expect(order.debitNote).toBeDefined();
    expect(order.debitNote!.netDebitAmt).toBe(3010);
    expect(order.debitNote!.subTotal).toBe(2800);
    expect(order.debitNote!.totalTax).toBe(210);
    expect(order.debitNote!.debitNoteNo).toMatch(/^DN-/);
    expect(order.auditTrail).toHaveLength(2);

    // Double approve should throw
    expect(() => PRTVEngine.approve(order, "MGR-001")).toThrow("Cannot approve");
  });

  // ─── Test 3: Full lifecycle — APPROVED → DISPATCHED → ACKNOWLEDGED → SETTLED
  it("full lifecycle: dispatch → acknowledge → settle with payable reference", () => {
    let order = PRTVEngine.createReturn({
      vendorId: "VNDR-002", vendorName: "Craft Weaves",
      branchCode: "BR-MUM-01", createdBy: "MGR-002",
      lines: [{ sku: "ACC-BELT-BRN", productName: "Leather Belt", returnQty: 3, unitCost: 300, taxPct: 18, reason: "EXCESS_STOCK" }],
    });
    order = PRTVEngine.approve(order, "MGR-002");
    order = PRTVEngine.markDispatched(order, "BlueDart", "BD-9812345678", "DISPATCH-001");

    expect(order.status).toBe("DISPATCHED");
    expect(order.dispatch!.courier).toBe("BlueDart");
    expect(order.dispatch!.trackingNo).toBe("BD-9812345678");

    order = PRTVEngine.acknowledge(order, "VENDOR-PORTAL");
    expect(order.status).toBe("ACKNOWLEDGED");
    expect(order.acknowledgedAt).toBeDefined();

    // 3 × 300 = 900; 18% = 162; net = 1062
    order = PRTVEngine.settle(order, "ACCOUNTS-001", "PAYABLE-REF-088", 1062);
    expect(order.status).toBe("SETTLED");
    expect(order.settlement!.settledAmt).toBe(1062);
    expect(order.settlement!.payableRef).toBe("PAYABLE-REF-088");
    expect(order.auditTrail).toHaveLength(5); // CREATE + APPROVE + DISPATCH + ACK + SETTLE
  });

  // ─── Test 4: Reject from DRAFT; lifecycle guard errors ────────────────────
  it("reject() transitions to REJECTED; out-of-sequence status transitions throw", () => {
    let order = PRTVEngine.createReturn({
      vendorId: "VNDR-003", vendorName: "Fabric House",
      branchCode: "BR-MUM-01", createdBy: "MGR-003",
      lines: [{ sku: "FAB-SILK-RED", productName: "Red Silk 1m", returnQty: 2, unitCost: 500, taxPct: 5, reason: "WRONG_ITEM" }],
    });

    order = PRTVEngine.reject(order, "QC-001", "Wrong item — vendor dispute");
    expect(order.status).toBe("REJECTED");
    expect(order.auditTrail.at(-1)!.action).toBe("REJECTED");

    // Cannot approve a rejected order
    expect(() => PRTVEngine.approve(order, "MGR-001")).toThrow("Cannot approve");

    // Cannot dispatch without prior approval
    const draft = PRTVEngine.createReturn({
      vendorId: "VNDR-001", vendorName: "TE", branchCode: "BR-MUM-01",
      createdBy: "MGR-001",
      lines: [{ sku: "FAB-X", productName: "X", returnQty: 1, unitCost: 100, taxPct: 0, reason: "OTHER" }],
    });
    expect(() => PRTVEngine.markDispatched(draft, "Courier", "TRK-001", "BY-001")).toThrow("Cannot dispatch");
  });
});
