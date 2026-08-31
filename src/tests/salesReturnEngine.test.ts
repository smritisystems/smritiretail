/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.120.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import SalesReturnEngine from "../utils/salesReturnEngine";

describe("SalesReturnEngine — Sales Return & Exchange Engine", () => {

  // ─── Test 1: createReturn — line amounts and totals ──────────────────────
  it("createReturn computes totalReturnAmt correctly; refundAmt = totalReturnAmt for ORIGINAL_METHOD", () => {
    const order = SalesReturnEngine.createReturn({
      originalSaleRef: "SALE-INV-20260828-0001",
      branchCode: "BR-MUM-01",
      createdBy: "CASHIER-001",
      customerId: "CUST-001",
      refundMethod: "ORIGINAL_METHOD",
      lines: [
        { sku: "TEE-WHT-L", productName: "White Tee L", returnQty: 2, unitPrice: 499, reason: "SIZE_ISSUE",      restockDecision: "RESALEABLE" },
        { sku: "JNS-BLU-32", productName: "Blue Jeans 32", returnQty: 1, unitPrice: 1299, reason: "DEFECTIVE", restockDecision: "DAMAGED" },
      ],
    });

    expect(order.status).toBe("DRAFT");
    expect(order.orderType).toBe("RETURN");
    expect(order.returnLines[0].totalReturnAmt).toBe(998);   // 499 × 2
    expect(order.returnLines[1].totalReturnAmt).toBe(1299);  // 1299 × 1
    expect(order.totalReturnAmt).toBe(2297);
    expect(order.refundMethod).toBe("ORIGINAL_METHOD");
    expect(order.refundAmt).toBe(2297);
    expect(order.auditTrail[0].action).toBe("RETURN_CREATED");
    expect(order.returnNo).toMatch(/^RET-BR-MUM-01-/);
  });

  // ─── Test 2: approve → REFUNDED; reject guard ────────────────────────────
  it("approve transitions to REFUNDED; cannot approve already-approved; reject requires DRAFT", () => {
    let order = SalesReturnEngine.createReturn({
      originalSaleRef: "SALE-001", branchCode: "BR-DEL-01", createdBy: "MGR-001",
      refundMethod: "STORE_CREDIT",
      lines: [{ sku: "ACC-SCF-RED", productName: "Red Scarf", returnQty: 1, unitPrice: 350, reason: "CHANGE_OF_MIND", restockDecision: "RESALEABLE" }],
    });

    order = SalesReturnEngine.approve(order, "FLOOR-MGR");
    expect(order.status).toBe("REFUNDED");
    expect(order.auditTrail).toHaveLength(2);
    expect(order.auditTrail[1].note).toContain("STORE_CREDIT");

    // Cannot approve again
    expect(() => SalesReturnEngine.approve(order, "MGR")).toThrow("Cannot approve");

    // Reject on REFUNDED throws
    expect(() => SalesReturnEngine.reject(order, "MGR", "Late rejection")).toThrow("Cannot reject");
  });

  // ─── Test 3: createExchange — priceDifference and auto-refundMethod ──────
  it("createExchange computes priceDifference; EXCHANGE_CREDIT when exchangeAmt > returnAmt; STORE_CREDIT when refund due", () => {
    // Scenario: return ₹1000 shirt, exchange for ₹1500 jacket — customer pays ₹500 extra
    const exchPos = SalesReturnEngine.createExchange({
      originalSaleRef: "SALE-002", branchCode: "BR-MUM-01", createdBy: "CASHIER-002",
      returnLines:  [{ sku: "SHIRT-M", productName: "Shirt M", returnQty: 1, unitPrice: 1000, reason: "SIZE_ISSUE", restockDecision: "RESALEABLE" }],
      exchangeLines:[{ sku: "JACKET-L", productName: "Jacket L", exchangeQty: 1, unitPrice: 1500 }],
    });
    expect(exchPos.totalReturnAmt).toBe(1000);
    expect(exchPos.totalExchangeAmt).toBe(1500);
    expect(exchPos.priceDifference).toBe(500);      // Customer pays ₹500 more
    expect(exchPos.refundMethod).toBe("EXCHANGE_CREDIT");
    expect(exchPos.refundAmt).toBe(0);              // No cash back; customer tops up

    // Scenario: return ₹2000, exchange for ₹1200 — customer gets ₹800 back
    const exchNeg = SalesReturnEngine.createExchange({
      originalSaleRef: "SALE-003", branchCode: "BR-MUM-01", createdBy: "CASHIER-003",
      returnLines:  [{ sku: "COAT-XL", productName: "Coat XL", returnQty: 1, unitPrice: 2000, reason: "DEFECTIVE", restockDecision: "DAMAGED" }],
      exchangeLines:[{ sku: "COAT-L",  productName: "Coat L",  exchangeQty: 1, unitPrice: 1200 }],
    });
    expect(exchNeg.priceDifference).toBe(-800);
    expect(exchNeg.refundMethod).toBe("STORE_CREDIT");
    expect(exchNeg.refundAmt).toBe(800);
  });

  // ─── Test 4: returnSummary — restock breakdown + byStatus ────────────────
  it("returnSummary aggregates refundedAmt and restockDecisions correctly", () => {
    const r1 = SalesReturnEngine.createReturn({
      originalSaleRef: "S1", branchCode: "BR-MUM-01", createdBy: "C1", refundMethod: "ORIGINAL_METHOD",
      lines: [
        { sku: "A", productName: "A", returnQty: 3, unitPrice: 100, reason: "DEFECTIVE",     restockDecision: "DAMAGED" },
        { sku: "B", productName: "B", returnQty: 2, unitPrice: 200, reason: "SIZE_ISSUE",    restockDecision: "RESALEABLE" },
      ],
    });
    const r1a = SalesReturnEngine.approve(r1, "MGR");

    const r2 = SalesReturnEngine.createReturn({
      originalSaleRef: "S2", branchCode: "BR-MUM-01", createdBy: "C1", refundMethod: "STORE_CREDIT",
      lines: [
        { sku: "C", productName: "C", returnQty: 1, unitPrice: 500, reason: "WRONG_ITEM", restockDecision: "DISPOSE" },
      ],
    });
    const r2a = SalesReturnEngine.approve(r2, "MGR");

    const summary = SalesReturnEngine.returnSummary([r1a, r2a]);
    expect(summary.totalReturnOrders).toBe(2);
    expect(summary.totalRefundedAmt).toBe(r1a.refundAmt + r2a.refundAmt);   // 700+500=1200
    expect(summary.totalResaleableQty).toBe(2);   // B: 2
    expect(summary.totalDamagedQty).toBe(3);      // A: 3
    expect(summary.totalDisposeQty).toBe(1);      // C: 1
    expect(summary.byStatus["REFUNDED"]).toBe(2);
  });
});
