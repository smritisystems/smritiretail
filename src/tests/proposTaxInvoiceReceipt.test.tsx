/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.15
 * Created      : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: POS Tax Invoice Receipt Print Modal Verification Suite
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SmritiProPosTaxInvoiceReceipt } from "../components/billing/propos/ProPosTaxInvoiceRc";
import type { ProPosCartItem, ProPosCustomer } from "../components/billing/propos/types";

describe("SmritiProPosTaxInvoiceReceipt Architecture Suite", () => {
  const dummyCustomer: ProPosCustomer = {
    id: "cust-001",
    name: "Vikram Singhania",
    phone: "9876543210",
    gstin: "27ABCDE1234F1Z5",
    type: "B2B",
    taxType: "GST",
  };

  const dummyItems: ProPosCartItem[] = [
    {
      id: "item-1",
      code: "SKU-COT-001",
      name: "Pure Egyptian Cotton Shirt",
      hsn: "620520",
      qty: 2,
      price: 1500,
      mrp: 1800,
      discount: 0,
      taxPercent: 5,
      taxAmount: 150,
      total: 3150,
      category: "Apparel",
    },
  ];

  it("1. renders A4 format by default with strict #root display:none suppression", () => {
    const html = renderToStaticMarkup(
      <SmritiProPosTaxInvoiceReceipt
        billNo="INV/2026-27/0042"
        billDate="2026-10-29"
        customer={dummyCustomer}
        salesStaff="Aakash Sharma"
        items={dummyItems}
        subTotal={3000}
        discountTotal={0}
        taxTotal={150}
        netPayable={3150}
        onClose={() => {}}
      />
    );

    expect(html).toContain("propos-receipt-modal-root");
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain("size: A4 portrait");
    expect(html).toContain("margin: 8mm 6mm 10mm 12mm");
    expect(html).toContain("propos-receipt-toolbar");
    expect(html).toContain("position: static !important");
    expect(html).toContain("INV/2026-27/0042");
  });

  it("2. renders 80mm thermal format with size:80mm auto when defaultFormat is thermal", () => {
    const html = renderToStaticMarkup(
      <SmritiProPosTaxInvoiceReceipt
        billNo="RCPT-80MM-9921"
        billDate="2026-10-29"
        customer={dummyCustomer}
        salesStaff="Priya Verma"
        items={dummyItems}
        subTotal={3000}
        discountTotal={0}
        taxTotal={150}
        netPayable={3150}
        defaultFormat="thermal"
        onClose={() => {}}
      />
    );

    expect(html).toContain("size: 80mm auto");
    expect(html).toContain("margin: 0");
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain("RCPT-80MM-9921");
    expect(html).toContain("Pure Egyptian Cotton Shirt");
  });

  it("3. contains static unrolling classes and toolbar print:hidden guards", () => {
    const html = renderToStaticMarkup(
      <SmritiProPosTaxInvoiceReceipt
        billNo="INV/2026-27/0043"
        billDate="2026-10-29"
        customer={dummyCustomer}
        salesStaff="Karan Patel"
        items={dummyItems}
        subTotal={3000}
        discountTotal={0}
        taxTotal={150}
        netPayable={3150}
        onClose={() => {}}
      />
    );

    expect(html).toContain("propos-receipt-sheet-wrapper");
    expect(html).toContain("propos-receipt-toolbar px-4 py-2.5");
    expect(html).toContain("print:hidden");
    expect(html).toContain("print:block");
  });
});
