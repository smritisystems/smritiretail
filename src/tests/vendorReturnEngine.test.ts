/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.103.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import VendorReturnEngine from "../utils/vendorReturnEngine";

describe("VendorReturnEngine — Vendor Return & Debit Note Engine", () => {
  function makeRTV() {
    return VendorReturnEngine.createRTV({
      vendorId: "VND-001",
      vendorName: "Reliable Fabrics Ltd.",
      branchCode: "BR-MUM-01",
      originalPONo: "PO-20260815-0012",
      lines: [
        { sku: "FAB-COTTON-WHT", productName: "Cotton Fabric White 1m", returnQty: 50,  unitCost: 120, gstRate: 5, reason: "QUALITY_DEFECT" },
        { sku: "FAB-DENIM-BLU",  productName: "Denim Fabric Blue 1m",   returnQty: 20,  unitCost: 250, gstRate: 5, reason: "DAMAGED_IN_TRANSIT" },
      ],
      requestedBy: "STORE-MGR-01",
    });
  }

  // ─── Test 1: RTV creation with correct line value and GST computation ─────
  it("creates RTV with correct per-line values, GST, and totals", () => {
    const rtv = makeRTV();

    expect(rtv.status).toBe("DRAFT");
    expect(rtv.lines).toHaveLength(2);

    // Line 1: 50 × 120 = 6000; GST 5% = 300; total = 6300
    expect(rtv.lines[0].lineValue).toBe(6000);
    expect(rtv.lines[0].gstAmount).toBe(300);
    expect(rtv.lines[0].totalWithGST).toBe(6300);

    // Line 2: 20 × 250 = 5000; GST 5% = 250; total = 5250
    expect(rtv.lines[1].lineValue).toBe(5000);
    expect(rtv.lines[1].gstAmount).toBe(250);
    expect(rtv.lines[1].totalWithGST).toBe(5250);

    // Totals
    expect(rtv.totalNetValue).toBe(11000);
    expect(rtv.totalGST).toBe(550);
    expect(rtv.totalWithGST).toBe(11550);
    expect(rtv.auditTrail).toHaveLength(1);
  });

  // ─── Test 2: Full lifecycle — DRAFT → SETTLED ─────────────────────────────
  it("completes full lifecycle: submit → acknowledge → dispatch → vendor receipt → debit note → settled", () => {
    let rtv = makeRTV();

    rtv = VendorReturnEngine.submit(rtv, "STORE-MGR-01");
    expect(rtv.status).toBe("SUBMITTED");

    rtv = VendorReturnEngine.acknowledge(rtv, "VENDOR-REP-01");
    expect(rtv.status).toBe("VENDOR_ACKNOWLEDGED");
    expect(rtv.approvedBy).toBe("VENDOR-REP-01");

    rtv = VendorReturnEngine.dispatch(rtv, "DELHIVERY-9921", "WH-OPR-01");
    expect(rtv.status).toBe("GOODS_DISPATCHED");
    expect(rtv.dispatchRef).toBe("DELHIVERY-9921");

    rtv = VendorReturnEngine.confirmVendorReceipt(rtv, "VENDOR-WH-01");
    expect(rtv.status).toBe("VENDOR_RECEIVED");

    rtv = VendorReturnEngine.raiseDebitNote(rtv, "ACCOUNTS-01");
    expect(rtv.status).toBe("DEBIT_NOTE_RAISED");
    expect(rtv.debitNote).toBeDefined();
    expect(rtv.debitNote!.totalAmount).toBe(11550);
    expect(rtv.debitNote!.status).toBe("OPEN");
    expect(rtv.debitNote!.outstandingAmount).toBe(11550);
    expect(rtv.debitNote!.lines).toHaveLength(2);
    expect(rtv.auditTrail).toHaveLength(6);  // 1 create + 5 transitions
  });

  // ─── Test 3: Partial then full settlement ────────────────────────────────
  it("applies partial settlement then full settlement, tracks outstanding correctly", () => {
    let rtv = makeRTV();
    rtv = VendorReturnEngine.submit(rtv, "MGR-01");
    rtv = VendorReturnEngine.acknowledge(rtv, "VND-REP");
    rtv = VendorReturnEngine.dispatch(rtv, "LOG-001", "OPR-01");
    rtv = VendorReturnEngine.confirmVendorReceipt(rtv, "VND-WH");
    rtv = VendorReturnEngine.raiseDebitNote(rtv, "ACC-01");

    // Partial settlement: ₹6000 of ₹11550
    rtv = VendorReturnEngine.settleDebitNote(rtv, 6000, "ACC-01");
    expect(rtv.debitNote!.settledAmount).toBe(6000);
    expect(rtv.debitNote!.outstandingAmount).toBe(5550);
    expect(rtv.debitNote!.status).toBe("PARTIALLY_SETTLED");
    expect(rtv.status).toBe("DEBIT_NOTE_RAISED");  // Not yet fully settled

    // Full settlement: remaining ₹5550
    rtv = VendorReturnEngine.settleDebitNote(rtv, 5550, "ACC-01");
    expect(rtv.debitNote!.outstandingAmount).toBe(0);
    expect(rtv.debitNote!.status).toBe("SETTLED");
    expect(rtv.status).toBe("SETTLED");
  });

  // ─── Test 4: Vendor balance ledger aggregation ───────────────────────────
  it("computes vendor balance ledger with outstanding debit notes", () => {
    let rtv1 = makeRTV();
    rtv1 = VendorReturnEngine.submit(rtv1, "MGR");
    rtv1 = VendorReturnEngine.acknowledge(rtv1, "VND");
    rtv1 = VendorReturnEngine.dispatch(rtv1, "LOG-A", "OPR");
    rtv1 = VendorReturnEngine.confirmVendorReceipt(rtv1, "VND-WH");
    rtv1 = VendorReturnEngine.raiseDebitNote(rtv1, "ACC");

    let rtv2 = VendorReturnEngine.createRTV({
      vendorId: "VND-001", vendorName: "Reliable Fabrics Ltd.", branchCode: "BR-DEL-01",
      lines: [{ sku: "FAB-SILK-RED", productName: "Silk Red 1m", returnQty: 10, unitCost: 500, gstRate: 12, reason: "WRONG_ITEM" }],
      requestedBy: "MGR-DEL",
    });
    rtv2 = VendorReturnEngine.submit(rtv2, "MGR-DEL");
    rtv2 = VendorReturnEngine.acknowledge(rtv2, "VND");
    rtv2 = VendorReturnEngine.dispatch(rtv2, "LOG-B", "OPR");
    rtv2 = VendorReturnEngine.confirmVendorReceipt(rtv2, "VND-WH");
    rtv2 = VendorReturnEngine.raiseDebitNote(rtv2, "ACC");
    // Fully settle rtv2
    rtv2 = VendorReturnEngine.settleDebitNote(rtv2, rtv2.debitNote!.totalAmount, "ACC");

    const ledger = VendorReturnEngine.computeVendorBalance([rtv1, rtv2], "VND-001");
    expect(ledger.totalDebitNotes).toBe(2);
    expect(ledger.totalDebitValue).toBe(rtv1.totalWithGST + rtv2.totalWithGST);
    expect(ledger.openDebitNotes).toHaveLength(1);       // rtv1 still open
    expect(ledger.totalOutstanding).toBe(rtv1.totalWithGST);
  });
});
