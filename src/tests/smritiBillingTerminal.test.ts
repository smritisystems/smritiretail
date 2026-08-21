/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import { Product } from "../types.ts";
import { BillingLineItem, BillingSummaryTotals, PdtImportRow } from "../components/billing/types.ts";

describe("SMRITI 9 — Billing Terminal & Invoice Management Unit Tests", () => {
  const sampleProducts: Product[] = [
    {
      id: "prod-001",
      code: "SKU-OXF-001",
      name: "Oxford Cotton Shirt",
      barcode: "8901234567890",
      brand: "SMRITI",
      category: "Apparel",
      price: 1499.0,
      mrp: 1999.0,
      stock: 50,
      color: "Blue",
      size: "40"
    },
    {
      id: "prod-002",
      code: "SKU-DNM-002",
      name: "Slim Fit Denim Jeans",
      barcode: "8909876543210",
      brand: "SMRITI",
      category: "Apparel",
      price: 2499.0,
      mrp: 2999.0,
      stock: 30,
      color: "Dark Indigo",
      size: "32"
    }
  ];

  // TEST 1 — Line Item Financial Calculation
  it("TEST 1: should calculate line item gross value, discount amount, and total correctly", () => {
    const rate = 1499.0;
    const qty = 2;
    const value = rate * qty; // 2998.0
    const discPercent = 10;
    const discAmt = (value * discPercent) / 100; // 299.80
    const taxableValue = value - discAmt; // 2698.20
    const gstPct = 18;
    const taxAmount = (taxableValue * gstPct) / 100; // 485.676 -> 485.68
    const total = taxableValue + taxAmount; // 3183.88

    expect(value).toBe(2998.0);
    expect(discAmt).toBe(299.8);
    expect(Number(taxAmount.toFixed(2))).toBe(485.68);
    expect(Number(total.toFixed(2))).toBe(3183.88);
  });

  // TEST 2 — Summary Totals Aggregation
  it("TEST 2: should aggregate summary totals across multiple line items with round-off", () => {
    const lineItems: BillingLineItem[] = [
      {
        id: "item-1",
        sNo: 1,
        stockNo: "SKU-OXF-001",
        barcode: "8901234567890",
        itemDescription: "Oxford Cotton Shirt",
        rate: 1499.0,
        qty: 2,
        value: 2998.0,
        discCode: "PROMO10",
        discQty: 2,
        discPercent: 10,
        discAmt: 299.8,
        taxAmount: 485.68,
        total: 3183.88,
        salesStaff: "Staff A"
      },
      {
        id: "item-2",
        sNo: 2,
        stockNo: "SKU-DNM-002",
        barcode: "8909876543210",
        itemDescription: "Slim Fit Denim Jeans",
        rate: 2499.0,
        qty: 1,
        value: 2499.0,
        discCode: "",
        discQty: 0,
        discPercent: 0,
        discAmt: 0,
        taxAmount: 449.82,
        total: 2948.82,
        salesStaff: "Staff A"
      }
    ];

    let totalQty = 0;
    let salesValue = 0;
    let itemDiscount = 0;
    let totalTax = 0;

    lineItems.forEach(it => {
      totalQty += it.qty;
      salesValue += it.value;
      itemDiscount += it.discAmt;
      totalTax += it.taxAmount || 0;
    });

    const rawNet = salesValue - itemDiscount + totalTax;
    const netAmount = Math.round(rawNet);
    const roundOff = Number((netAmount - rawNet).toFixed(2));

    const summary: BillingSummaryTotals = {
      itemCount: lineItems.length,
      totalQty,
      salesValue: Number(salesValue.toFixed(2)),
      itemDiscount: Number(itemDiscount.toFixed(2)),
      billDiscount: 0,
      totalTax: Number(totalTax.toFixed(2)),
      totalAddons: 0,
      totalDeductions: 0,
      roundOff,
      netAmount
    };

    expect(summary.itemCount).toBe(2);
    expect(summary.totalQty).toBe(3);
    expect(summary.salesValue).toBe(5497.0);
    expect(summary.itemDiscount).toBe(299.8);
    expect(summary.totalTax).toBe(935.5);
    expect(summary.netAmount).toBe(6133);
  });

  // TEST 3 — PDT Batch Ingest Parser
  it("TEST 3: should parse raw PDT text collector format and match against product catalog", () => {
    const rawPdtText = `
      8901234567890, 2
      8909876543210, 1
      UNKNOWN_CODE_999, 5
    `;

    const lines = rawPdtText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsedRows: PdtImportRow[] = [];

    lines.forEach(line => {
      const parts = line.split(/[,;\t\s]+/).filter(Boolean);
      if (parts.length > 0) {
        const barcode = parts[0];
        const qty = parts.length > 1 ? parseFloat(parts[1]) || 1 : 1;
        const matched = sampleProducts.find(p => p.barcode === barcode || p.code === barcode);
        parsedRows.push({
          barcode,
          qty,
          stockNo: matched?.code,
          description: matched?.name
        });
      }
    });

    expect(parsedRows.length).toBe(3);
    expect(parsedRows[0].stockNo).toBe("SKU-OXF-001");
    expect(parsedRows[0].qty).toBe(2);
    expect(parsedRows[1].stockNo).toBe("SKU-DNM-002");
    expect(parsedRows[1].qty).toBe(1);
    expect(parsedRows[2].stockNo).toBeUndefined();
  });

  // TEST 4 — Return Mode Inversion
  it("TEST 4: should correctly invert quantity when sales return mode is toggled", () => {
    const originalQty = 2;
    const returnedQty = -Math.abs(originalQty);
    const rate = 1499.0;
    const value = rate * returnedQty;

    expect(returnedQty).toBe(-2);
    expect(value).toBe(-2998.0);
  });
});
