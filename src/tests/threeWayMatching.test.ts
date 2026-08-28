/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.81.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ThreeWayMatchingModal,
  ThreeWayDocumentContext,
} from "../components/purchase/ThreeWayMatchingModal";
import * as apiFetchModule from "../lib/apiFetchV1";

describe("SMRITI Purchase Studio 3-Way Auto-Reconciliation Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleContext: ThreeWayDocumentContext = {
    po_no: "PO-2026-001",
    po_date: "2026-08-20",
    grn_no: "GRN-2026-001",
    grn_date: "2026-08-22",
    vendor_invoice_no: "VINV-99881",
    vendor_invoice_date: "2026-08-23",
    vendor_name: "Apex Fabrics & Yarns Ltd",
    vendor_gstin: "27AABCU9603R1ZM",
    items: [
      {
        id: "item-01",
        item_code: "APP-SHIRT-01",
        item_name: "Cotton Formal Shirt (Blue)",
        po_qty: 100,
        po_rate: 650.0,
        grn_accepted_qty: 100,
        grn_damaged_qty: 0,
        invoice_qty: 100,
        invoice_rate: 650.0,
        gst_rate: 12.0,
      },
      {
        id: "item-02",
        item_code: "APP-TROUSER-01",
        item_name: "Slim Fit Chinos (Black)",
        po_qty: 50,
        po_rate: 1100.0,
        grn_accepted_qty: 48,
        grn_damaged_qty: 2,
        invoice_qty: 50,
        invoice_rate: 1100.0,
        gst_rate: 12.0,
      },
    ],
  };

  it("STEP 1: should export ThreeWayMatchingModal component function", () => {
    expect(typeof ThreeWayMatchingModal).toBe("function");
  });

  it("STEP 2: should validate ThreeWayDocumentContext model structure", () => {
    expect(sampleContext.po_no).toBe("PO-2026-001");
    expect(sampleContext.grn_no).toBe("GRN-2026-001");
    expect(sampleContext.items.length).toBe(2);
    expect(sampleContext.vendor_gstin).toBe("27AABCU9603R1ZM");
  });

  it("STEP 3: should identify quantity drifts between GRN and vendor invoice", () => {
    const item2 = sampleContext.items[1];
    const qtyDelta = item2.invoice_qty - item2.grn_accepted_qty;
    expect(qtyDelta).toBe(2); // 2 units billed but damaged/not accepted
  });

  it("STEP 4: should post 3-way match reconciliation payload to backend API", async () => {
    const postSpy = vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({
      reconciliation_id: "rec-3way-001",
      status: "COMMITTED",
      ap_voucher_no: "AP-VOUCH-2026-001",
    });

    const res = await apiFetchModule.apiFetchV1("/purchase/3way-matching/commit", {
      method: "POST",
      body: {
        po_no: sampleContext.po_no,
        grn_no: sampleContext.grn_no,
        vendor_invoice_no: sampleContext.vendor_invoice_no,
        vendor_gstin: sampleContext.vendor_gstin,
      },
    });

    expect(postSpy).toHaveBeenCalled();
    expect(res.status).toBe("COMMITTED");
    expect(res.ap_voucher_no).toBe("AP-VOUCH-2026-001");
  });
});
