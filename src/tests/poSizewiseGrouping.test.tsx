/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.84.0
 * Created      : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PurchaseOrderPrintA4,
  PurchaseOrderPrintData,
} from "../print_engine/templates/PurchaseOrderPrintA4";
import { SizePivotMatrixA4 } from "../print_engine/templates/SizePivotMatrixA4";
import type { PurchaseOrderSizePivotRow } from "../components/purchase/types";

describe("Purchase Order Sizewise Grouping (Article No. + Color) Verification", () => {
  const basePOData: PurchaseOrderPrintData = {
    poNumber: "PO-2026-00451",
    companyName: "TATTLY THREADS",
    supplierName: "A. S. Shoes",
    paymentTerms: "120 Days",
    commonTaxPercent: 5,
    sizeColumns: ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
  };

  it("1. groups multiple single-size rows of the same Article + Color into a single consolidated row", () => {
    // 6 single-size rows for CH-25-G GOLD (simulating Excel / raw SKU import)
    const rawSizewiseItems = [
      { sNo: 1, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "36": 34 }, totalQty: 34, rate: 525, taxPercent: 5, taxAmount: 892.5, amount: 17850 },
      { sNo: 2, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "37": 34 }, totalQty: 34, rate: 525, taxPercent: 5, taxAmount: 892.5, amount: 17850 },
      { sNo: 3, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "38": 68 }, totalQty: 68, rate: 525, taxPercent: 5, taxAmount: 1785.0, amount: 35700 },
      { sNo: 4, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "39": 68 }, totalQty: 68, rate: 525, taxPercent: 5, taxAmount: 1785.0, amount: 35700 },
      { sNo: 5, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "40": 68 }, totalQty: 68, rate: 525, taxPercent: 5, taxAmount: 1785.0, amount: 35700 },
      { sNo: 6, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "41": 68 }, totalQty: 68, rate: 525, taxPercent: 5, taxAmount: 1785.0, amount: 35700 },
    ];

    const html = renderToStaticMarkup(
      <PurchaseOrderPrintA4
        data={{
          ...basePOData,
          sizewiseItems: rawSizewiseItems,
        }}
      />
    );

    // Verify CH-25-G and GOLD appear in table
    expect(html).toContain("CH-25-G");
    expect(html).toContain("GOLD");

    // All sizes 34 and 68 should appear in size columns
    expect(html).toContain(">34<");
    expect(html).toContain(">68<");

    // The total quantity for CH-25-G GOLD should sum to 340 (34+34+68+68+68+68)
    expect(html).toContain(">340<");

    // Total consolidated taxable amount: 1,78,500.00 (340 * 525)
    expect(html).toContain("1,78,500.00");

    // Total consolidated tax amount: 8,925.00
    expect(html).toContain("8,925.00");
  });

  it("2. keeps different colors of the same article on strictly separate rows", () => {
    const rawSizewiseItems = [
      { sNo: 1, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "36": 34 }, totalQty: 34, rate: 525, taxPercent: 5, taxAmount: 892.5, amount: 17850 },
      { sNo: 2, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "37": 34 }, totalQty: 34, rate: 525, taxPercent: 5, taxAmount: 892.5, amount: 17850 },
      { sNo: 3, articleNo: "CH-25-G", color: "BLACK", sizeQuantities: { "36": 20 }, totalQty: 20, rate: 525, taxPercent: 5, taxAmount: 525.0, amount: 10500 },
      { sNo: 4, articleNo: "CH-25-G", color: "BLACK", sizeQuantities: { "38": 40 }, totalQty: 40, rate: 525, taxPercent: 5, taxAmount: 1050.0, amount: 21000 },
    ];

    const html = renderToStaticMarkup(
      <PurchaseOrderPrintA4
        data={{
          ...basePOData,
          sizewiseItems: rawSizewiseItems,
        }}
      />
    );

    // Both colors must be present as distinct rows
    expect(html).toContain("GOLD");
    expect(html).toContain("BLACK");

    // GOLD total is 68 (34+34)
    expect(html).toContain(">68<");

    // BLACK total is 60 (20+40)
    expect(html).toContain(">60<");
  });

  it("3. keeps different articles on strictly separate rows", () => {
    const rawSizewiseItems = [
      { sNo: 1, articleNo: "CH-25-G", color: "GOLD", sizeQuantities: { "36": 34 }, totalQty: 34, rate: 525, taxPercent: 5, taxAmount: 892.5, amount: 17850 },
      { sNo: 2, articleNo: "SND-07-G", color: "GOLD", sizeQuantities: { "36": 50 }, totalQty: 50, rate: 650, taxPercent: 5, taxAmount: 1625.0, amount: 32500 },
    ];

    const html = renderToStaticMarkup(
      <PurchaseOrderPrintA4
        data={{
          ...basePOData,
          sizewiseItems: rawSizewiseItems,
        }}
      />
    );

    expect(html).toContain("CH-25-G");
    expect(html).toContain("SND-07-G");
    expect(html).toContain(">34<");
    expect(html).toContain(">50<");
  });

  it("4. groups rows correctly inside SizePivotMatrixA4 template", () => {
    const pivotRows: PurchaseOrderSizePivotRow[] = [
      { id: "1", sNo: 1, articleNo: "CH-25-G", product: "Shoe", color: "GOLD", sizeQuantities: { "36": 12 }, totalQty: 12, rate: 500, totalValue: 6000 },
      { id: "2", sNo: 2, articleNo: "CH-25-G", product: "Shoe", color: "GOLD", sizeQuantities: { "37": 18 }, totalQty: 18, rate: 500, totalValue: 9000 },
      { id: "3", sNo: 3, articleNo: "CH-25-G", product: "Shoe", color: "BLACK", sizeQuantities: { "36": 10 }, totalQty: 10, rate: 500, totalValue: 5000 },
    ];

    const html = renderToStaticMarkup(
      <SizePivotMatrixA4
        data={{
          header: { orderNumber: "101", prefix: "PO" },
          rows: pivotRows,
        }}
      />
    );

    // GOLD consolidated qty = 30 (12 + 18)
    // BLACK consolidated qty = 10
    expect(html).toContain("GOLD");
    expect(html).toContain("BLACK");
    expect(html).toContain(">30<");
    expect(html).toContain(">10<");
    expect(html).toContain("15000.00"); // GOLD value: 6000 + 9000
    expect(html).toContain("5000.00");  // BLACK value: 5000
  });
});
