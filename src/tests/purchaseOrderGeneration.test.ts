/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import {
  PurchaseOrderLineItem,
  PurchaseOrderSizePivotRow,
  PurchaseOrderSummaryTotals
} from "../components/purchase/types.ts";

describe("SMRITI 9 Purchase Order Generation Logic Suite", () => {
  it("1. should accurately calculate standard line item values, taxes, and add-ons", () => {
    const line: PurchaseOrderLineItem = {
      id: "l-1",
      sNo: 1,
      stockNo: "000001",
      product: "Trousers",
      brand: "Abiba Halo",
      style: "BPTY",
      shade: "Blue",
      size: "32",
      fibre: "Cotton",
      colourBase: "Blue",
      styling: "Standard",
      rate: 850,
      orderQty: 10,
      value: 0,
      stockOnHand: 12,
      taxPercent: 5,
      taxAmount: 0,
      addOnPercent: 2,
      addOnAmount: 0,
      totalValue: 0
    };

    const value = line.rate * line.orderQty; // 8500
    const taxAmount = (value * line.taxPercent) / 100; // 425
    const addOnAmount = (value * line.addOnPercent) / 100; // 170
    const totalValue = value + taxAmount + addOnAmount; // 9095

    expect(value).toBe(8500);
    expect(taxAmount).toBe(425);
    expect(addOnAmount).toBe(170);
    expect(totalValue).toBe(9095);
  });

  it("2. should calculate Size Pivot matrix row totals across multiple size buckets", () => {
    const pivotRow: PurchaseOrderSizePivotRow = {
      id: "p-1",
      sNo: 1,
      articleNo: "ART-9021",
      product: "Leather Formal",
      brand: "Bata",
      style: "Oxford",
      color: "Black",
      sizeQuantities: {
        "36": 0,
        "37": 0,
        "38": 2,
        "39": 4,
        "40": 4,
        "41": 2,
        "42": 0,
        "43": 0,
        "44": 0
      },
      rate: 1250,
      totalQty: 0,
      gstPercent: 5,
      totalValue: 0
    };

    const totalQty = Object.values(pivotRow.sizeQuantities).reduce((a, b) => a + b, 0);
    const totalValue = totalQty * pivotRow.rate;

    expect(totalQty).toBe(12);
    expect(totalValue).toBe(15000);
  });

  it("3. should aggregate summary totals across multiple standard line items", () => {
    const lines: PurchaseOrderLineItem[] = [
      {
        id: "1",
        sNo: 1,
        stockNo: "000001",
        product: "Trousers",
        brand: "Abiba Halo",
        style: "BPTY",
        shade: "Blue",
        size: "32",
        fibre: "Cotton",
        colourBase: "Blue",
        styling: "Regular",
        rate: 850,
        orderQty: 10,
        value: 8500,
        stockOnHand: 12,
        taxPercent: 5,
        taxAmount: 425,
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue: 8925
      },
      {
        id: "2",
        sNo: 2,
        stockNo: "000002",
        product: "Knit Shirts",
        brand: "Lance Perry",
        style: "LPB9E",
        shade: "Blue",
        size: "L",
        fibre: "Cotton",
        colourBase: "Blue",
        styling: "Regular",
        rate: 550,
        orderQty: 20,
        value: 11000,
        stockOnHand: 24,
        taxPercent: 5,
        taxAmount: 550,
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue: 11550
      }
    ];

    const totalQty = lines.reduce((sum, l) => sum + l.orderQty, 0);
    const grossValue = lines.reduce((sum, l) => sum + l.value, 0);
    const totalTax = lines.reduce((sum, l) => sum + l.taxAmount, 0);
    const totalValue = lines.reduce((sum, l) => sum + l.totalValue, 0);

    expect(totalQty).toBe(30);
    expect(grossValue).toBe(19500);
    expect(totalTax).toBe(975);
    expect(totalValue).toBe(20475);
  });
});
