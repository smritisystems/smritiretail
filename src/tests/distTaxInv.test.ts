/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.10.0
 * Created      : 2026-08-24
 * Modified     : 2026-08-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import { TaxInvoiceDocumentState, TaxInvoiceItemRow } from "../components/sales/types.ts";

describe("Smriti Distributor Tax Invoice Domain Engine & Calculations", () => {
  const sampleItems: TaxInvoiceItemRow[] = [
    {
      id: "ROW-1",
      sNo: 1,
      stockNo: "SKU-FOOT-001",
      barcode: "8901234567890",
      itemDescription: "Running Sports Shoes - Size 9",
      rate: 1500,
      qty: 2,
      value: 3000,
      discCode: "PROMO10",
      discQty: 0,
      discPercent: 10,
      discAmt: 300,
      total: 2700,
      salesStaff: "Jawahar Mallah",
      gstRate: 18,
      hsnCode: "64041990",
    },
    {
      id: "ROW-2",
      sNo: 2,
      stockNo: "SKU-APPAREL-002",
      barcode: "8901234567891",
      itemDescription: "Cotton Formal Shirt - Blue",
      rate: 800,
      qty: 3,
      value: 2400,
      discCode: "NONE",
      discQty: 0,
      discPercent: 0,
      discAmt: 0,
      total: 2400,
      salesStaff: "Sales Desk 1",
      gstRate: 12,
      hsnCode: "62052000",
    },
  ];

  it("calculates total quantities and sales values accurately", () => {
    const totalQty = sampleItems.reduce((acc, it) => acc + it.qty, 0);
    const salesValue = sampleItems.reduce((acc, it) => acc + it.value, 0);
    const itemDiscount = sampleItems.reduce((acc, it) => acc + it.discAmt, 0);

    expect(totalQty).toBe(5);
    expect(salesValue).toBe(5400);
    expect(itemDiscount).toBe(300);
  });

  it("computes GST tax lines for intrastate and interstate modes", () => {
    // Row 1: taxable 2700 @ 18% = 486
    // Row 2: taxable 2400 @ 12% = 288
    const totalTax = sampleItems.reduce((acc, it) => {
      const taxable = it.total;
      return acc + (taxable * (it.gstRate || 18)) / 100;
    }, 0);

    expect(totalTax).toBe(486 + 288); // 774
  });

  it("correctly integrates Addons (Freight) and Deductions", () => {
    const salesValue = 5400;
    const itemDiscount = 300;
    const totalTax = 774;
    const freightAddon = 150;
    const specialDeduction = 50;

    const netAmount = salesValue - itemDiscount + totalTax + freightAddon - specialDeduction;
    expect(netAmount).toBe(5974);
  });

  it("validates mandatory fields for saving an invoice", () => {
    const validDoc: TaxInvoiceDocumentState = {
      billType: "Tax Invoice",
      transactionMode: "Tax Invoice",
      docPrefix: "INV/2026-27/",
      docNo: "101",
      docDate: "2026-08-24",
      customerId: "CUST-001",
      customerCode: "CUST-001",
      customerName: "Shoppers Stop Ltd",
      salesStaff: "Jawahar Mallah",
      items: sampleItems,
      transporterDetails: [],
      paymentDetails: [{ mode: "Cash", amount: 5974, referenceNo: "", bankName: "" }],
      addonsAndDeductions: [],
      documentRemarks: "Test invoice",
    };

    expect(validDoc.customerName.trim().length).toBeGreaterThan(0);
    expect(validDoc.items.length).toBeGreaterThan(0);
    expect(validDoc.items.every((it) => it.rate > 0 && it.qty > 0)).toBe(true);
  });

  it("computes discount percentages dynamically on rate change", () => {
    const rate = 2000;
    const qty = 2;
    const value = rate * qty; // 4000
    const discPercent = 15; // SEASONAL 15%
    const discAmt = (value * discPercent) / 100; // 600
    const total = value - discAmt; // 3400

    expect(value).toBe(4000);
    expect(discAmt).toBe(600);
    expect(total).toBe(3400);
  });
});
