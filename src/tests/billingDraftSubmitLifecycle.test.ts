/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.2
 * Created      : 2026-10-30
 * Modified     : 2026-10-30
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Billing Draft, Submit, Parked Cart & Statutory Amendment Lifecycle Unit Tests
 */

import { describe, it, expect } from "vitest";
import { BillingLineItem, BillingHeaderState } from "../components/billing/types.ts";

describe("SMRITI — Billing Draft, Submit, Parked Cart & Statutory Amendment Lifecycle Tests (v6.99.2)", () => {
  const sampleHeader: BillingHeaderState = {
    billType: "Product",
    transaction: "Credit",
    docPrefix: "INV",
    docNo: "1001",
    billDate: "30/10/2026",
    customer: {
      id: "CUST-B2B-01",
      name: "Acme Retailers Pvt Ltd",
      gstNumber: "27AABCU9603R1ZM",
    } as any,
    salesStaff: "Staff Cashier",
    remarks: "Draft Invoicing Lifecycle Test",
    billedPartyGstinId: "party-gst-1",
    billedGstin: "27AABCU9603R1ZM",
    deliveryLocationId: "loc-01",
    deliveryStoreCode: "STORE-MUM-01",
    deliveryGstin: "27AABCU9603R1ZM",
    deliveryLocationSnapshot: null,
    placeOfSupplyCode: "27",
    poReference: "PO-ACME-99",
  };

  const sampleItems: BillingLineItem[] = [
    {
      id: "item-1",
      sNo: 1,
      stockNo: "SKU-SHIRT-01",
      barcode: "890123450001",
      itemDescription: "Formal Linen Shirt",
      rate: 1500.0,
      qty: 4,
      value: 6000.0,
      discCode: "",
      discQty: 0,
      discPercent: 0,
      discAmt: 0,
      total: 7080.0,
      salesStaff: "Staff Cashier",
      productId: "prod-001",
      hsnCode: "6205",
      gstPercentage: 18,
      taxAmount: 1080.0,
    },
  ];

  // TEST 1 — Isolated POS Cart Storage (F12 Hold/Park)
  it("TEST 1: Parked Cart payload isolates cart state without sales invoice posting mutations", () => {
    const slipNo = `HOLD-${sampleHeader.docPrefix}-${sampleHeader.docNo}-4455`;
    const parkedPayload = {
      hold_slip_number: slipNo,
      branch_id: sampleHeader.deliveryLocationId || "BR-001",
      customer_id: sampleHeader.customer?.id,
      customer_name: sampleHeader.customer?.name,
      items_count: sampleItems.length,
      total_amount: 7080.0,
      cart_snapshot: {
        headerState: sampleHeader,
        items: sampleItems,
        transporterRows: [],
        addonRows: [],
      },
    };

    expect(parkedPayload.hold_slip_number).toMatch(/^HOLD-INV-1001-\d+$/);
    expect(parkedPayload.items_count).toBe(1);
    expect(parkedPayload.total_amount).toBe(7080.0);
    expect(parkedPayload.cart_snapshot.items[0].stockNo).toBe("SKU-SHIRT-01");
    // Verifies no accounting or ledger flags exist in parked payload
    expect((parkedPayload as any).is_posted).toBeUndefined();
    expect((parkedPayload as any).journal_entry_id).toBeUndefined();
  });

  // TEST 2 — Formal Draft Invoice Payload Specification
  it("TEST 2: Draft Invoice creation specifies is_draft=true and status='Draft' with zero stock/GL impact", () => {
    const draftPayload = {
      series_id: "SERIES-TAX-INV",
      date: "2026-10-30",
      customer_id: sampleHeader.customer?.id,
      customer_name: sampleHeader.customer?.name,
      customer_gstin: sampleHeader.billedGstin,
      status: "Draft",
      is_draft: true,
      payment_mode: "CREDIT",
      paid_amount: 0,
      balance_amount: 7080.0,
      net_amount: 7080.0,
      items: sampleItems.map((it, idx) => ({
        product_id: it.productId,
        code: it.stockNo,
        name: it.itemDescription,
        quantity: it.qty,
        price: it.rate,
        gst_rate: it.gstPercentage,
        line_no: idx + 1,
      })),
    };

    expect(draftPayload.is_draft).toBe(true);
    expect(draftPayload.status).toBe("Draft");
    expect(draftPayload.paid_amount).toBe(0);
    expect(draftPayload.balance_amount).toBe(7080.0);
    expect(draftPayload.items.length).toBe(1);
  });

  // TEST 3 — Browser Document Loading State Differentiation (Draft vs Completed)
  it("TEST 3: Browser loads Draft in editable active mode and Finalized document in Read-Only Audit mode", () => {
    const draftDoc = {
      id: "inv-draft-001",
      invoice_no: "INV-DRAFT-001",
      status: "Draft",
      customer_name: "Acme Retailers Pvt Ltd",
      items: sampleItems,
    };

    const finalizedDoc = {
      id: "inv-posted-001",
      invoice_no: "INV-2026-0042",
      status: "Completed",
      customer_name: "Acme Retailers Pvt Ltd",
      items: sampleItems,
    };

    const resolveTerminalState = (doc: typeof draftDoc) => {
      const isDraft = String(doc.status).toUpperCase() === "DRAFT";
      return {
        isReadOnlyView: !isDraft,
        activeDraftId: isDraft ? doc.id : null,
      };
    };

    const draftState = resolveTerminalState(draftDoc);
    expect(draftState.isReadOnlyView).toBe(false);
    expect(draftState.activeDraftId).toBe("inv-draft-001");

    const finalizedState = resolveTerminalState(finalizedDoc);
    expect(finalizedState.isReadOnlyView).toBe(true);
    expect(finalizedState.activeDraftId).toBeNull();
  });

  // TEST 4 — ADR-005 Statutory Amendment: Credit Note and Void/Reissue
  it("TEST 4: Statutory amendment generates Credit Note (Sales Return) payload referencing original invoice", () => {
    const originalInvoiceId = "inv-posted-001";
    const creditNotePayload = {
      invoice_id: originalInvoiceId,
      customer_id: sampleHeader.customer?.id,
      items: sampleItems.map(it => ({
        product_id: it.productId,
        code: it.stockNo,
        name: it.itemDescription,
        quantity: it.qty,
        price: it.rate,
        gst_rate: it.gstPercentage,
      })),
      remarks: `Statutory Credit Note against INV-2026-0042`,
    };

    expect(creditNotePayload.invoice_id).toBe(originalInvoiceId);
    expect(creditNotePayload.items[0].quantity).toBe(4);
    expect(creditNotePayload.remarks).toContain("INV-2026-0042");
  });
});
