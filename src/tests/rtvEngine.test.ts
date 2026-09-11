/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CanonicalRTVDomainEngine, canonicalRtvEngine } from "../utils/rtvEngine";

describe("CanonicalRTVDomainEngine — 6-Stage Procurement Return Lifecycle", () => {
  let engine: CanonicalRTVDomainEngine;

  beforeEach(() => {
    engine = new CanonicalRTVDomainEngine();
  });

  it("executes the full canonical 6-stage lifecycle: Request -> Approval -> Dispatch -> Vendor Receipt -> Debit Note -> Settle", () => {
    // Stage 1: Return Request
    const order = engine.createReturnRequest({
      vendorId: "VND-APEX-001",
      vendorName: "Apex Fabrics & Textiles Pvt Ltd",
      branchCode: "MAIN",
      originalPONo: "PO-2026-0911-0042",
      requestedBy: "STORE-MGR-01",
      lines: [
        {
          sku: "FAB-SILK-01",
          productName: "Pure Mulberry Silk 1m",
          returnQty: 20,
          unitCost: 450,
          gstRate: 5,
          reason: "QUALITY_DEFECT",
          reasonNote: "Weave defect across warp yarn",
        },
        {
          sku: "FAB-COTTON-02",
          productName: "Egyptian Cotton 1m",
          returnQty: 10,
          unitCost: 200,
          gstRate: 5,
          reason: "SHORT_EXPIRY",
        },
      ],
    });

    expect(order.status).toBe("REQUESTED");
    expect(order.totalNetValue).toBe(11000); // (20*450=9000) + (10*200=2000)
    expect(order.totalGST).toBe(550);       // 5% of 11000 = 550
    expect(order.totalWithGST).toBe(11550);
    expect(order.auditTrail).toHaveLength(1);
    expect(order.auditTrail[0].action).toBe("RETURN_REQUESTED");

    // Stage 2: Approval
    const approved = engine.approveReturn(order.rtvId, "PURCHASE-HEAD-01", "Approved for return");
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedBy).toBe("PURCHASE-HEAD-01");
    expect(approved.auditTrail).toHaveLength(2);

    // Stage 3: Dispatch
    const dispatched = engine.dispatchReturn(
      order.rtvId,
      {
        courier: "Blue Dart Express",
        trackingNo: "BD-982341234",
        dispatchedBy: "LOGISTICS-EXEC-01",
      },
      "Dispatched via surface cargo"
    );
    expect(dispatched.status).toBe("GOODS_DISPATCHED");
    expect(dispatched.dispatchInfo?.trackingNo).toBe("BD-982341234");
    expect(dispatched.auditTrail).toHaveLength(3);

    // Stage 4: Vendor Receipt
    const received = engine.recordVendorReceipt(
      order.rtvId,
      "APEX-WH-RECEIVER",
      "2026-09-25",
      "Received in good outer packaging"
    );
    expect(received.status).toBe("VENDOR_RECEIVED");
    expect(received.expectedCreditDate).toBe("2026-09-25");
    expect(received.auditTrail).toHaveLength(4);

    // Stage 5: Debit Note Generation & Reversal
    const debitNote = engine.raiseDebitNote(order.rtvId, "ACCOUNTS-MGR-01");
    expect(debitNote.debitNoteNo).toMatch(/^DN-2026-\d{5}$/);
    expect(debitNote.totalDebitAmount).toBe(11550);
    expect(debitNote.netGoodsValue).toBe(11000);
    expect(debitNote.gstReversalAmount).toBe(550);
    expect(debitNote.settled).toBe(false);

    const afterDN = engine.getOrder(order.rtvId)!;
    expect(afterDN.status).toBe("DEBIT_NOTE_RAISED");
    expect(afterDN.debitNote).toBeDefined();

    // Stage 6: Settlement & Closure
    const settled = engine.closeAndSettle(order.rtvId, "FINANCE-CONTROLLER-01", "Matched against AP voucher 104");
    expect(settled.status).toBe("SETTLED");
    expect(settled.debitNote?.settled).toBe(true);
    expect(settled.debitNote?.settledBy).toBe("FINANCE-CONTROLLER-01");
    expect(settled.auditTrail).toHaveLength(6);
  });

  it("prevents illegal transition skipping (e.g. dispatch before approve)", () => {
    const order = engine.createReturnRequest({
      vendorId: "VND-002",
      vendorName: "Beta Weaves",
      branchCode: "MAIN",
      requestedBy: "STORE-MGR",
      lines: [{ sku: "SKU-1", productName: "Item 1", returnQty: 5, unitCost: 100, reason: "OTHER" }],
    });

    expect(() => {
      engine.dispatchReturn(order.rtvId, { courier: "DHL", trackingNo: "123", dispatchedBy: "LOG" });
    }).toThrow(/Cannot dispatch RTV in status 'REQUESTED'/);
  });
});
