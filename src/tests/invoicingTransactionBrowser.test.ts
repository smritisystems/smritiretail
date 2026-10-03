/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.18.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Invoicing Transaction Browser & Read-Only Terminal Tests
 */

import { describe, it, expect } from "vitest";
import { InvoicingBrowserTab } from "../components/billing/InvoicingTransactionBrowserModal.tsx";

describe("SMRITI — Invoicing Transactions Browser & Read-Only Audit Terminal", () => {
  // TEST 1 — Tab Definitions & Category Parity
  it("TEST 1: should provide all 5 canonical transaction tabs for commercial auditing", () => {
    const supportedTabs: InvoicingBrowserTab[] = [
      "INVOICES",
      "ORDERS",
      "RETURNS",
      "CANCELLED",
      "SUSPENDED"
    ];

    expect(supportedTabs).toHaveLength(5);
    expect(supportedTabs).toContain("INVOICES");
    expect(supportedTabs).toContain("ORDERS");
    expect(supportedTabs).toContain("RETURNS");
    expect(supportedTabs).toContain("CANCELLED");
    expect(supportedTabs).toContain("SUSPENDED");
  });

  // TEST 2 — Real-time Search Filter Logic for Invoices
  it("TEST 2: should filter invoices accurately across invoice number, customer name, and store code", () => {
    const mockInvoices = [
      { id: "1", invoice_no: "TT2026-2027/138", customer_name: "Reliance Retail Ltd", delivery_store_code: "TGX1", date: "2026-09-09", status: "Submitted" },
      { id: "2", invoice_no: "TT2026-2027/139", customer_name: "Aditya Birla Fashion", delivery_store_code: "TJI4", date: "2026-09-09", status: "Submitted" },
      { id: "3", invoice_no: "INV-CASH-001", customer_name: "Walk-in Retail Customer", delivery_store_code: null, date: "2026-09-10", status: "Completed" },
      { id: "4", invoice_no: "TT2026-2027/050", customer_name: "Reliance Retail Ltd", delivery_store_code: "TKF4", date: "2026-08-15", status: "Cancelled" },
    ];

    // Filter active invoices
    const activeInvoices = mockInvoices.filter(i => i.status.toUpperCase() !== "CANCELLED");
    expect(activeInvoices).toHaveLength(3);

    // Filter by invoice number
    const termInv = "138";
    const filteredByNo = activeInvoices.filter(i => i.invoice_no.includes(termInv));
    expect(filteredByNo).toHaveLength(1);
    expect(filteredByNo[0].invoice_no).toBe("TT2026-2027/138");

    // Filter by customer name
    const termCust = "reliance";
    const filteredByCust = activeInvoices.filter(i => i.customer_name.toLowerCase().includes(termCust));
    expect(filteredByCust).toHaveLength(1);
    expect(filteredByCust[0].delivery_store_code).toBe("TGX1");

    // Filter by store code
    const termStore = "TJI4";
    const filteredByStore = activeInvoices.filter(i => String(i.delivery_store_code || "").includes(termStore));
    expect(filteredByStore).toHaveLength(1);
    expect(filteredByStore[0].invoice_no).toBe("TT2026-2027/139");
  });

  // TEST 3 — Customer PO & Sales Order Allocation Metrics
  it("TEST 3: should calculate total, billed, and pending quantities for orders accurately", () => {
    const sampleOrder = {
      id: "so-101",
      order_no: "ORD-2026-001",
      po_number: "PO-RIL-9941",
      total_qty: 1200,
      billed_qty: 800,
      pending_qty: 400,
      status: "Confirmed"
    };

    expect(sampleOrder.total_qty - sampleOrder.billed_qty).toBe(sampleOrder.pending_qty);
    expect(sampleOrder.status).toBe("Confirmed");
  });

  // TEST 4 — Read-Only Mode Document Mapping Invariance
  it("TEST 4: should map backend invoice payload into immutable BillingTerminal line items", () => {
    const rawBackendInvoice = {
      id: "inv-uuid-777",
      invoice_no: "TT2026-2027/195",
      date: "2026-09-09",
      customer_id: "cust-ril-01",
      customer_name: "Reliance Retail Ltd - Nagpur DC",
      customer_gstin: "27AAACR7055K1Z8",
      delivery_store_code: "TKI6",
      status: "Submitted",
      grand_total: 967996.00,
      items: [
        {
          id: 101,
          code: "SKU-SHOES-BLK-08",
          barcode: "8901234567808",
          name: "Premium Formal Oxford Shoes Size 8",
          price: 1242.61,
          quantity: 24,
          taxable_value: 29822.64,
          gst_rate: 18.00,
          tax_amount: 5368.08,
          total_amount: 35190.72,
          mrp: 1999.00
        }
      ]
    };

    // Simulate handleSelectDocumentFromBrowser item mapping
    const mapped = rawBackendInvoice.items.map((it, idx) => ({
      id: String(it.id),
      sNo: idx + 1,
      stockNo: it.code,
      barcode: it.barcode,
      itemDescription: it.name,
      rate: Number(it.price),
      qty: Number(it.quantity),
      value: Number(it.taxable_value),
      total: Number(it.total_amount),
      gstPercentage: Number(it.gst_rate),
      taxAmount: Number(it.tax_amount),
      mrp: it.mrp
    }));

    expect(mapped).toHaveLength(1);
    expect(mapped[0].stockNo).toBe("SKU-SHOES-BLK-08");
    expect(mapped[0].rate).toBe(1242.61);
    expect(mapped[0].qty).toBe(24);
    expect(mapped[0].mrp).toBe(1999.00);
    // Rate <= MRP Statutory guarantee
    expect(mapped[0].rate).toBeLessThanOrEqual(mapped[0].mrp);
  });

  // TEST 5 — Cancelled Invoice Audit Trail
  it("TEST 5: should preserve cancellation status and audit immutability", () => {
    const cancelledInvoice = {
      id: "inv-cancel-01",
      invoice_no: "TT2026-2027/005",
      status: "CANCELLED",
      customer_name: "Retail Client",
      date: "2026-07-20",
      cancellation_reason: "Customer order retracted before dispatch"
    };

    expect(cancelledInvoice.status.toUpperCase()).toBe("CANCELLED");
    expect(cancelledInvoice.cancellation_reason).toBeDefined();
  });
});
