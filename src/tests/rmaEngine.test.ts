/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.91.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import RMAEngine, { RMARequest } from "../utils/rmaEngine";

describe("RMAEngine — Return Merchandise Authorization & Reverse Logistics", () => {
  // ─── Fixture ───────────────────────────────────────────────────────────────
  function makeCustomerRMA(): RMARequest {
    return RMAEngine.create({
      type: "CUSTOMER_RETURN",
      originalSalesVoucher: "INV-2026-0042",
      customerId: "CUST-001",
      items: [
        { sku: "APP-POLO-NAVY-M", productName: "Polo Shirt Navy M", returnQty: 1, originalUnitPrice: 1200, condition: "DEFECTIVE", restockAction: "QUARANTINE" },
        { sku: "DNM-SLIM-BLK-32", productName: "Slim Fit Denim Black", returnQty: 1, originalUnitPrice: 1999, condition: "AS_NEW", restockAction: "RESTOCK" },
      ],
      reason: "DEFECTIVE_PRODUCT",
      resolution: "REFUND",
      notes: "Customer reported polo shirt collar tear after first wash.",
      initiatedBy: "OPR-COUNTER-01",
    });
  }

  // ─── Test 1: RMA creation with line items and audit trail ────────────────
  it("creates an RMA with correct line items, return values, and initial SUBMITTED audit entry", () => {
    const rma = makeCustomerRMA();

    expect(rma.rmaNumber).toMatch(/^RMA-\d+$/);
    expect(rma.type).toBe("CUSTOMER_RETURN");
    expect(rma.status).toBe("SUBMITTED");
    expect(rma.reason).toBe("DEFECTIVE_PRODUCT");
    expect(rma.resolution).toBe("REFUND");

    // Line items
    expect(rma.items).toHaveLength(2);
    expect(rma.items[0].lineId).toBe("LINE-1");
    expect(rma.items[0].returnValue).toBe(1200);   // 1 × 1200
    expect(rma.items[1].returnValue).toBe(1999);   // 1 × 1999

    // Audit trail
    expect(rma.auditTrail).toHaveLength(1);
    expect(rma.auditTrail[0].fromStatus).toBe("DRAFT");
    expect(rma.auditTrail[0].toStatus).toBe("SUBMITTED");
  });

  // ─── Test 2: Status transitions and audit trail growth ───────────────────
  it("transitions RMA through APPROVED → IN_TRANSIT → RECEIVED_AT_WAREHOUSE with audit entries at each step", () => {
    let rma = makeCustomerRMA();

    rma = RMAEngine.transition(rma, "APPROVED", "MGR-001", "Approved: Valid defect claim");
    expect(rma.status).toBe("APPROVED");
    expect(rma.approvedAt).toBeDefined();
    expect(rma.auditTrail).toHaveLength(2);

    rma = RMAEngine.transition(rma, "IN_TRANSIT", "LOGISTICS-001", "Pickup scheduled from customer");
    expect(rma.status).toBe("IN_TRANSIT");
    expect(rma.auditTrail).toHaveLength(3);

    rma = RMAEngine.transition(rma, "RECEIVED_AT_WAREHOUSE", "WH-001", "Package received and logged");
    expect(rma.status).toBe("RECEIVED_AT_WAREHOUSE");
    expect(rma.receivedAt).toBeDefined();
    expect(rma.auditTrail).toHaveLength(4);

    // Each audit entry must record fromStatus correctly
    expect(rma.auditTrail[1].fromStatus).toBe("SUBMITTED");
    expect(rma.auditTrail[2].fromStatus).toBe("APPROVED");
    expect(rma.auditTrail[3].fromStatus).toBe("IN_TRANSIT");
  });

  // ─── Test 3: Refund calculation with and without restocking fee ──────────
  it("calculates gross return value and applies restocking fee only for CUSTOMER_CHANGED_MIND reason", () => {
    const defectiveRMA = makeCustomerRMA();
    const defectRefund = RMAEngine.calculateRefund(defectiveRMA, 15); // 15% fee — should NOT apply
    expect(defectRefund.grossReturnValue).toBe(3199);   // 1200 + 1999
    expect(defectRefund.restockingFeeAmt).toBe(0);      // No fee for DEFECTIVE_PRODUCT
    expect(defectRefund.netRefundAmount).toBe(3199);

    // Customer changed mind — restocking fee applies
    const mindChangedRMA = RMAEngine.create({
      type: "CUSTOMER_RETURN",
      originalSalesVoucher: "INV-2026-0099",
      customerId: "CUST-002",
      items: [{ sku: "FTW-SNEAKER-WHT-8", productName: "Sneakers", returnQty: 1, originalUnitPrice: 2800, condition: "AS_NEW", restockAction: "RESTOCK" }],
      reason: "CUSTOMER_CHANGED_MIND",
      resolution: "STORE_CREDIT",
      initiatedBy: "OPR-001",
    });
    const changeRefund = RMAEngine.calculateRefund(mindChangedRMA, 10); // 10% restocking fee
    expect(changeRefund.grossReturnValue).toBe(2800);
    expect(changeRefund.restockingFeeAmt).toBe(280);    // 10% of 2800
    expect(changeRefund.netRefundAmount).toBe(2520);    // 2800 - 280
  });

  // ─── Test 4: Reverse logistics metrics aggregation ───────────────────────
  it("computes reverse logistics metrics correctly across multiple RMAs", () => {
    const rma1 = makeCustomerRMA();
    const rma2 = RMAEngine.create({
      type: "SUPPLIER_RETURN",
      originalPONumber: "PO-SUP-001-042",
      supplierId: "SUP-001",
      items: [{ sku: "APP-SHIRT-WHT-L", productName: "Formal Shirt", returnQty: 20, originalUnitPrice: 800, condition: "DEFECTIVE", restockAction: "RETURN_TO_SUPPLIER" }],
      reason: "WRONG_ITEM_SHIPPED",
      resolution: "SUPPLIER_CREDIT_NOTE",
      initiatedBy: "PURCHASE-MGR",
    });

    // Close rma1
    let closedRMA1 = RMAEngine.transition(rma1, "APPROVED", "MGR-001", "Approved");
    closedRMA1 = RMAEngine.transition(closedRMA1, "CREDIT_NOTE_ISSUED", "ACCOUNTS-001", "Credit note raised", { creditNoteNumber: "CN-2026-001", refundAmount: 3199 });
    closedRMA1 = RMAEngine.transition(closedRMA1, "CLOSED", "MGR-001", "Closed");

    const metrics = RMAEngine.computeMetrics([closedRMA1, rma2]);

    expect(metrics.totalRMAs).toBe(2);
    expect(metrics.pendingApproval).toBe(1);      // rma2 is SUBMITTED
    expect(metrics.creditNotesIssued).toBe(1);    // closedRMA1 has CN
    expect(metrics.totalReturnValue).toBe(3199 + 16000); // rma1 + rma2 (20×800)
    expect(metrics.totalCreditNoteValue).toBe(3199);
    expect(metrics.byReason["DEFECTIVE_PRODUCT"]).toBe(1);
    expect(metrics.byReason["WRONG_ITEM_SHIPPED"]).toBe(1);
  });
});
