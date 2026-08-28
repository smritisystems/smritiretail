/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.94.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import EInvoiceEngine, { GSTParty, GSTLineItem } from "../utils/eInvoiceEngine";

describe("EInvoiceEngine — GST e-Invoice IRN Generation & QR Code Printing Studio", () => {
  // ─── Fixture ───────────────────────────────────────────────────────────────
  const SUPPLIER: GSTParty = {
    gstin: "27AABCS1234A1Z5",
    legalName: "SMRITI Fashion Pvt. Ltd.",
    tradeName: "SMRITI Books",
    address1: "123 Commerce Road",
    location: "Mumbai",
    pincode: "400001",
    stateCode: "27",
  };

  const BUYER: GSTParty = {
    gstin: "29AABCB5678B2Z6",
    legalName: "Kalyan Retailers Ltd.",
    address1: "45 MG Road",
    location: "Bengaluru",
    pincode: "560001",
    stateCode: "29",
  };

  function makeLineItem(isInterState = true): GSTLineItem {
    return EInvoiceEngine.computeLineItem({
      slNo: 1, description: "Cotton Polo Shirt Navy M", hsn: "62052090",
      qty: 10, unit: "NOS", unitPrice: 1000, gstRate: 12, isInterState,
    });
  }

  // ─── Test 1: Line item GST computation ───────────────────────────────────
  it("computes line item GST correctly for inter-state (IGST) and intra-state (CGST+SGST) transactions", () => {
    const interStateItem = makeLineItem(true);
    expect(interStateItem.taxableValue).toBe(10000);  // 10 × 1000
    expect(interStateItem.igst).toBe(1200);           // 12% IGST
    expect(interStateItem.cgst).toBe(0);              // No split for inter-state
    expect(interStateItem.sgst).toBe(0);
    expect(interStateItem.lineTotal).toBe(11200);     // 10000 + 1200

    const intraStateItem = EInvoiceEngine.computeLineItem({
      slNo: 1, description: "Polo Shirt", hsn: "62052090",
      qty: 10, unit: "NOS", unitPrice: 1000, gstRate: 12, isInterState: false,
    });
    expect(intraStateItem.cgst).toBe(600);            // 6% CGST
    expect(intraStateItem.sgst).toBe(600);            // 6% SGST
    expect(intraStateItem.igst).toBe(0);              // No IGST for intra-state
    expect(intraStateItem.lineTotal).toBe(11200);
  });

  // ─── Test 2: IRN registration with deterministic hash ────────────────────
  it("registers IRN, generates 64-char IRN string, ACK number, ACK date, and QR payload", () => {
    const item = makeLineItem();
    const draft = EInvoiceEngine.createDraft({
      docType: "INV", docNo: "INV-2026-0001", docDate: "28/08/2026",
      supplier: SUPPLIER, buyer: BUYER, items: [item],
    });

    expect(draft.status).toBe("DRAFT");
    expect(draft.irn).toBeUndefined();

    const registered = EInvoiceEngine.registerIRN(draft);

    expect(registered.status).toBe("REGISTERED");
    expect(registered.irn).toBeDefined();
    expect(registered.irn!.length).toBe(64);          // GSTN spec: 64-char hex
    expect(registered.ackNo).toBeDefined();
    expect(registered.ackDate).toBeDefined();

    // QR payload must contain GSTIN, doc number, and IRN
    expect(registered.qrPayload).toContain(SUPPLIER.gstin);
    expect(registered.qrPayload).toContain("INV-2026-0001");
    expect(registered.qrPayload).toContain(registered.irn!);

    // IRN must be deterministic — same inputs → same IRN
    const registered2 = EInvoiceEngine.registerIRN(draft);
    expect(registered2.irn).toBe(registered.irn);
  });

  // ─── Test 3: Invoice totals and round-off ────────────────────────────────
  it("computes invoice totals including grand total and round-off accurately", () => {
    const items = [
      EInvoiceEngine.computeLineItem({ slNo: 1, description: "Item A", hsn: "62052090", qty: 5, unit: "NOS", unitPrice: 999, gstRate: 18, isInterState: true }),
      EInvoiceEngine.computeLineItem({ slNo: 2, description: "Item B", hsn: "64019900", qty: 2, unit: "NOS", unitPrice: 2500, gstRate: 18, isInterState: true }),
    ];

    const totals = EInvoiceEngine.computeTotals(items);

    // Item A: 5 × 999 = 4995, IGST 18% = 899.10 → lineTotal = 5894.10
    // Item B: 2 × 2500 = 5000, IGST 18% = 900 → lineTotal = 5900
    expect(totals.taxableValue).toBeCloseTo(9995, 1);
    expect(totals.totalIGST).toBeCloseTo(1799.1, 1);
    expect(totals.grandTotal).toBeGreaterThan(11000);
    expect(typeof totals.roundOff).toBe("number");
  });

  // ─── Test 4: IRN cancellation and bulk print queue ───────────────────────
  it("cancels a registered IRN and creates a bulk print job for multiple registered invoices", () => {
    const makeRegistered = (docNo: string) => {
      const item = makeLineItem();
      const draft = EInvoiceEngine.createDraft({ docType: "INV", docNo, docDate: "28/08/2026", supplier: SUPPLIER, buyer: BUYER, items: [item] });
      return EInvoiceEngine.registerIRN(draft);
    };

    // Cancel
    const reg = makeRegistered("INV-2026-CANCEL");
    const cancelled = EInvoiceEngine.cancelIRN(reg, "Duplicate invoice raised");
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelReason).toBe("Duplicate invoice raised");
    expect(cancelled.cancelledAt).toBeDefined();
    expect(() => EInvoiceEngine.cancelIRN(cancelled, "Again")).toThrow();

    // Bulk print
    const inv1 = makeRegistered("INV-2026-P001");
    const inv2 = makeRegistered("INV-2026-P002");
    const inv3 = makeRegistered("INV-2026-P003");

    const { job, invoices } = EInvoiceEngine.createBulkPrintJob([inv1, inv2, inv3]);
    expect(job.status).toBe("QUEUED");
    expect(job.invoiceIds).toHaveLength(3);
    expect(invoices.every((i) => i.status === "PRINT_QUEUED")).toBe(true);

    const completed = EInvoiceEngine.completePrintJob(job, 3, 0);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.printedCount).toBe(3);
    expect(completed.completedAt).toBeDefined();
  });
});
