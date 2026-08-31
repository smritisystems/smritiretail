/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-08-29
 * Modified     : 2026-08-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SalesReturnService } from "../services/salesReturnService";
import * as apiModule from "../lib/apiFetchV1";

describe("SalesReturnService — Authoritative Sales Return API Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getReturnContext fetches authoritative return context via apiFetchV1", async () => {
    const mockContext = {
      invoice_id: "INV-2026-001",
      invoice_no: "INV-2026-001",
      invoice_date: "2026-08-29",
      status: "Confirmed",
      customer: {
        id: "CUST-001",
        name: "Rahul Verma",
        phone: "9876543210",
        outstanding: 0,
      },
      lines: [
        {
          product_id: "PRD-001",
          code: "SKU-001",
          name: "Leather Wallet",
          original_quantity: 2,
          returned_quantity: 0,
          remaining_quantity: 2,
          unit_price: 999,
          gst_rate: 18,
          tax_amount: 359.64,
          total_amount: 2357.64,
        },
      ],
      effective_policy: {
        policy_id: "POL-SR-DEF-001",
        policy_version: 1,
        resolution_scope: "GLOBAL",
        return_window_days: 30,
        allowed_refund_modes: ["CASH", "CREDIT_NOTE", "ORIGINAL_PAYMENT"],
        allowed_return_reasons: ["Defective", "Size Mismatch"],
        supervisor_threshold: 5000,
      },
    };

    const spy = vi.spyOn(apiModule, "apiFetchV1").mockResolvedValueOnce(mockContext);

    const result = await SalesReturnService.getReturnContext("INV-2026-001");
    expect(spy).toHaveBeenCalledWith("/sales/invoices/INV-2026-001/return-context");
    expect(result.invoice_id).toBe("INV-2026-001");
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].remaining_quantity).toBe(2);
    expect(result.effective_policy.return_window_days).toBe(30);
  });

  it("createSalesReturn posts return payload with optional Idempotency-Key", async () => {
    const mockResponse = {
      id: "RET-001",
      return_no: "RET-001",
      original_invoice_id: "INV-2026-001",
      credit_note_number: "CN-RET-001",
      date: "2026-08-29",
      tax_total: 179.82,
      grand_total: 1178.82,
      status: "Completed",
      refund_mode: "CREDIT_NOTE",
      items: [],
    };

    const spy = vi.spyOn(apiModule, "apiFetchV1").mockResolvedValueOnce(mockResponse);

    const payload = {
      id: "RET-001",
      return_no: "RET-001",
      original_invoice_id: "INV-2026-001",
      refund_mode: "CREDIT_NOTE" as const,
      items: [
        {
          product_id: "PRD-001",
          code: "SKU-001",
          name: "Leather Wallet",
          quantity: 1,
          price: 999,
          gst_rate: 18,
        },
      ],
    };

    const result = await SalesReturnService.createSalesReturn(payload, "KEY-IDEM-001");
    expect(spy).toHaveBeenCalledWith("/sales/returns/", {
      method: "POST",
      headers: { "Idempotency-Key": "KEY-IDEM-001" },
      body: JSON.stringify(payload),
    });
    expect(result.id).toBe("RET-001");
    expect(result.credit_note_number).toBe("CN-RET-001");
  });

  it("listSalesReturns fetches historical returns", async () => {
    const mockList = [
      {
        id: "RET-001",
        return_no: "RET-001",
        original_invoice_id: "INV-2026-001",
        grand_total: 1178.82,
        status: "Completed",
        items: [],
      },
    ];

    const spy = vi.spyOn(apiModule, "apiFetchV1").mockResolvedValueOnce(mockList);

    const list = await SalesReturnService.listSalesReturns();
    expect(spy).toHaveBeenCalledWith("/sales/returns/");
    expect(list).toHaveLength(1);
    expect(list[0].return_no).toBe("RET-001");
  });
});
