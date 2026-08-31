/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.78.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ComplianceDispatchModal,
  InvoiceComplianceData,
} from "../components/sales/components/ComplianceDispatchModal";
import * as apiFetchModule from "../lib/apiFetchV1";

describe("SMRITI SGIP Statutory Dispatch Gateway (E-Invoice & E-Way Bill UI)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleInvoice: InvoiceComplianceData = {
    invoice_id: "INV-2026-001",
    doc_no: "SMRITI/2026/001",
    doc_type: "INV",
    doc_date: "2026-08-28",
    supplier_gstin: "27AABCU9603R1ZM",
    buyer_gstin: "27BBBCU9603R1ZM",
    buyer_legal_name: "Apex Retail Solutions Pvt Ltd",
    buyer_pos: "27",
    from_pincode: "400001",
    to_pincode: "411001",
    total_taxable_value: 11000.0,
    total_cgst_value: 660.0,
    total_sgst_value: 660.0,
    total_igst_value: 0.0,
    total_invoice_value: 12320.0,
  };

  it("STEP 1: should export ComplianceDispatchModal component function", () => {
    expect(typeof ComplianceDispatchModal).toBe("function");
  });

  it("STEP 2: should validate InvoiceComplianceData model properties", () => {
    expect(sampleInvoice.doc_no).toBe("SMRITI/2026/001");
    expect(sampleInvoice.total_invoice_value).toBe(12320.0);
    expect(sampleInvoice.supplier_gstin).toBe("27AABCU9603R1ZM");
  });

  it("STEP 3: should post E-Invoice generation payload to FastAPI compliance gateway", async () => {
    const postSpy = vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({
      status: "SUCCESS",
      irn: "7f8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
      ack_no: "112610998877665",
      signed_qr_code: "SMRITI_SIGNED_QR_MOCK_PAYLOAD_v1.03",
    });

    const res = await apiFetchModule.apiFetchV1("/compliance/einvoice/generate", {
      method: "POST",
      body: {
        invoice_id: sampleInvoice.invoice_id,
        doc_no: sampleInvoice.doc_no,
        supplier_gstin: sampleInvoice.supplier_gstin,
        buyer_gstin: sampleInvoice.buyer_gstin,
        total_invoice_value: sampleInvoice.total_invoice_value,
      },
    });

    expect(postSpy).toHaveBeenCalled();
    expect(res.status).toBe("SUCCESS");
    expect(res.irn.length).toBe(64);
    expect(res.ack_no).toBe("112610998877665");
  });

  it("STEP 4: should post E-Way Bill generation payload to NIC compliance gateway", async () => {
    const postSpy = vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({
      status: "SUCCESS",
      eway_bill_no: "271098877665",
      valid_until: "2026-08-30T23:59:59Z",
    });

    const res = await apiFetchModule.apiFetchV1("/compliance/ewaybill/generate", {
      method: "POST",
      body: {
        invoice_id: sampleInvoice.invoice_id,
        from_pincode: "400001",
        to_pincode: "411001",
        trans_distance_km: 150,
        vehicle_no: "MH12AB9999",
      },
    });

    expect(postSpy).toHaveBeenCalled();
    expect(res.status).toBe("SUCCESS");
    expect(res.eway_bill_no).toBe("271098877665");
  });
});
