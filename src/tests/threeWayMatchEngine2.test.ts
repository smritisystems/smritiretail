/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.101.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import ThreeWayMatchEngine, {
  PurchaseOrder,
  GoodsReceiptNote,
  VendorInvoice,
  THREE_WAY_CONFIG,
} from "../utils/threeWayMatchEngine";

describe("ThreeWayMatchEngine — Vendor PO Approval Workflow & 3-Way Match Engine", () => {
  // ─── Fixture ──────────────────────────────────────────────────────────────
  function makePO(): PurchaseOrder {
    return ThreeWayMatchEngine.createPO({
      vendorId: "VND-001",
      vendorName: "Reliable Fabrics Ltd.",
      branchCode: "BR-MUM-01",
      lines: [
        { sku: "FAB-COTTON-WHT-1M", productName: "Cotton Fabric White 1m", orderedQty: 500, unitPrice: 120, hsn: "52081100", gstRate: 5 },
        { sku: "FAB-DENIM-BLU-1M",  productName: "Denim Fabric Blue 1m",  orderedQty: 300, unitPrice: 250, hsn: "52112090", gstRate: 5 },
      ],
      requestedBy: "PURCHASE-MGR-01",
      deliveryDate: "2026-09-05",
    });
  }

  // ─── Test 1: PO creation and approval workflow ─────────────────────────────
  it("creates PO with correct totals, submits for approval, approves, and persists approvedBy", () => {
    let po = makePO();

    expect(po.status).toBe("DRAFT");
    expect(po.lines).toHaveLength(2);
    expect(po.lines[0].lineTotal).toBe(60000);    // 500 × 120
    expect(po.lines[1].lineTotal).toBe(75000);    // 300 × 250
    expect(po.totalValue).toBe(135000);
    expect(po.taxTotal).toBe(6750);               // 5% GST on 135000
    expect(po.grandTotal).toBe(141750);

    po = ThreeWayMatchEngine.submitForApproval(po, "PURCHASE-MGR-01");
    expect(po.status).toBe("PENDING_APPROVAL");

    po = ThreeWayMatchEngine.approve(po, "GM-PURCHASE", "Budget approved");
    expect(po.status).toBe("APPROVED");
    expect(po.approvedBy).toBe("GM-PURCHASE");
    expect(po.auditTrail).toHaveLength(3);        // DRAFT + SUBMIT + APPROVE
  });

  // ─── Test 2: GRN application + full 3-way match (MATCHED) ─────────────────
  it("applies GRN and invoice, runs 3-way match — MATCHED when within tolerance", () => {
    let po = makePO();
    po = ThreeWayMatchEngine.submitForApproval(po, "PURCHASE-MGR-01");
    po = ThreeWayMatchEngine.approve(po, "GM-PURCHASE");
    po = ThreeWayMatchEngine.markSent(po, "PURCHASE-MGR-01");

    const grn: GoodsReceiptNote = {
      grnId: "GRN-001", grnNo: "GRN-2026-0001", poId: po.poId,
      vendorId: "VND-001", receivedBy: "STORE-OPR-01", receivedAt: new Date().toISOString(),
      lines: [
        { lineId: "LINE-1", receivedQty: 500, receivedUnitPrice: 120 },
        { lineId: "LINE-2", receivedQty: 300, receivedUnitPrice: 250 },
      ],
    };

    po = ThreeWayMatchEngine.applyGRN(po, grn);
    expect(po.status).toBe("RECEIVED");

    const invoice: VendorInvoice = {
      invoiceId: "INV-VND-001", invoiceNo: "RL/2026-27/1234", poId: po.poId,
      vendorId: "VND-001", invoiceDate: new Date().toISOString(), invoiceTotal: 135000,
      lines: [
        { lineId: "LINE-1", invoicedQty: 500, invoicedUnitPrice: 120 },    // Exact match
        { lineId: "LINE-2", invoicedQty: 300, invoicedUnitPrice: 251 },    // ₹1 variance (0.4% < 1% tolerance)
      ],
    };

    po = ThreeWayMatchEngine.applyInvoice(po, invoice);
    expect(po.status).toBe("INVOICED");

    const report = ThreeWayMatchEngine.runThreeWayMatch(po);
    expect(report.overallResult).toBe("MATCHED");        // 0.4% price var is within 1% tolerance
    expect(report.requiresDispute).toBe(false);
    expect(report.lines[0].matchResult).toBe("MATCHED");
    expect(report.lines[1].withinTolerance).toBe(true);  // ₹1 on ₹250 = 0.4% < 1%

    const closed = ThreeWayMatchEngine.closeOrDispute(po, report, "ACCOUNTS-MGR");
    expect(closed.status).toBe("CLOSED");
  });

  // ─── Test 3: 3-way match — PRICE_VARIANCE exceeds tolerance ──────────────
  it("flags PRICE_VARIANCE when invoice price exceeds tolerance band, triggers DISPUTED status", () => {
    let po = makePO();
    po = ThreeWayMatchEngine.submitForApproval(po, "PM-01");
    po = ThreeWayMatchEngine.approve(po, "GM-01");

    const grn: GoodsReceiptNote = {
      grnId: "GRN-002", grnNo: "GRN-2026-0002", poId: po.poId, vendorId: "VND-001",
      receivedBy: "OPR-01", receivedAt: new Date().toISOString(),
      lines: [
        { lineId: "LINE-1", receivedQty: 500, receivedUnitPrice: 120 },
        { lineId: "LINE-2", receivedQty: 300, receivedUnitPrice: 250 },
      ],
    };
    po = ThreeWayMatchEngine.applyGRN(po, grn);

    const invoice: VendorInvoice = {
      invoiceId: "INV-002", invoiceNo: "RL/2026-27/1235", poId: po.poId,
      vendorId: "VND-001", invoiceDate: new Date().toISOString(), invoiceTotal: 0,
      lines: [
        { lineId: "LINE-1", invoicedQty: 500, invoicedUnitPrice: 128 },   // ₹8 variance = 6.67% > 1% tolerance
        { lineId: "LINE-2", invoicedQty: 300, invoicedUnitPrice: 250 },
      ],
    };
    po = ThreeWayMatchEngine.applyInvoice(po, invoice);

    const report = ThreeWayMatchEngine.runThreeWayMatch(po);
    expect(report.overallResult).toBe("PRICE_VARIANCE");
    expect(report.requiresDispute).toBe(true);
    expect(report.lines[0].matchResult).toBe("PRICE_VARIANCE");
    expect(report.lines[0].priceVariancePct).toBeGreaterThan(THREE_WAY_CONFIG.priceTolerancePct);

    const disputed = ThreeWayMatchEngine.closeOrDispute(po, report, "ACCOUNTS-MGR");
    expect(disputed.status).toBe("DISPUTED");
  });

  // ─── Test 4: PO rejection workflow ────────────────────────────────────────
  it("rejects a PO with reason, persists rejectedBy and rejectionReason, sets CANCELLED status", () => {
    let po = makePO();
    po = ThreeWayMatchEngine.submitForApproval(po, "PM-01");
    po = ThreeWayMatchEngine.reject(po, "GM-FINANCE", "Budget freeze Q3 — defer to next quarter");

    expect(po.status).toBe("CANCELLED");
    expect(po.rejectedBy).toBe("GM-FINANCE");
    expect(po.rejectionReason).toContain("Budget freeze");
    expect(po.auditTrail.at(-1)?.action).toBe("REJECT");
  });
});
