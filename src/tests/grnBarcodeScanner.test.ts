/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.122.0
 * Created      : 2026-09-20
 * Modified     : 2026-09-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";

interface GrnLineRow {
  rowId: string;
  product_id: string;
  item_id?: string;
  code: string;
  name: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_damaged: number;
  cost_price: number;
  invoice_rate: number;
  trade_discount: number;
  gst_rate: number;
  mrp?: number;
}

// Logic replicate for unit testing the barcode resolution & quantity update
function resolveAndIncrementBarcode(
  barcode: string,
  lines: GrnLineRow[],
  options: { continuousMode: boolean; incrementQty?: number }
): { updatedLines: GrnLineRow[]; matchedIndex: number; isNew: boolean } {
  const cleanCode = barcode.trim().toLowerCase();
  const inc = options.incrementQty ?? 1;

  const idx = lines.findIndex(
    (l) =>
      l.code.toLowerCase() === cleanCode ||
      l.product_id.toLowerCase() === cleanCode ||
      (l.item_id && l.item_id.toLowerCase() === cleanCode)
  );

  if (idx >= 0) {
    const nextLines = lines.map((line, i) => {
      if (i === idx) {
        return {
          ...line,
          quantity_received: options.continuousMode
            ? line.quantity_received + inc
            : inc,
        };
      }
      return line;
    });
    return { updatedLines: nextLines, matchedIndex: idx, isNew: false };
  }

  // Create new line if unmatched
  const newLine: GrnLineRow = {
    rowId: `row-scan-${Date.now()}`,
    product_id: barcode.trim(),
    code: barcode.trim(),
    name: `Ad-Hoc Scanned Item (${barcode.trim()})`,
    quantity_ordered: 0,
    quantity_received: inc,
    quantity_damaged: 0,
    cost_price: 100,
    invoice_rate: 100,
    trade_discount: 0,
    gst_rate: 18,
    mrp: 150,
  };

  return {
    updatedLines: [...lines, newLine],
    matchedIndex: lines.length,
    isNew: true,
  };
}

describe("GRN Barcode Scanner Suite", () => {
  const INITIAL_LINES: GrnLineRow[] = [
    {
      rowId: "row-1",
      product_id: "prd-sh-001",
      item_id: "item-sh-001",
      code: "SH-001",
      name: "Runner Pro (Men's Running Shoes)",
      quantity_ordered: 200,
      quantity_received: 200,
      quantity_damaged: 0,
      cost_price: 1450.0,
      invoice_rate: 1450.0,
      trade_discount: 0,
      gst_rate: 18,
      mrp: 3129.5,
    },
    {
      rowId: "row-2",
      product_id: "prd-sh-002",
      item_id: "item-sh-002",
      code: "SH-002",
      name: "City Walk (Men's Casual Shoes)",
      quantity_ordered: 300,
      quantity_received: 298,
      quantity_damaged: 2,
      cost_price: 1250.0,
      invoice_rate: 1300.0, // +50 PPV
      trade_discount: 0,
      gst_rate: 18,
      mrp: 2549.0,
    },
  ];

  it("should match existing line by exact SKU and increment received quantity in continuous +1 mode", () => {
    const result = resolveAndIncrementBarcode("SH-001", INITIAL_LINES, {
      continuousMode: true,
      incrementQty: 1,
    });

    expect(result.isNew).toBe(false);
    expect(result.matchedIndex).toBe(0);
    expect(result.updatedLines[0].quantity_received).toBe(201);
    expect(result.updatedLines[1].quantity_received).toBe(298);
  });

  it("should match existing line case-insensitively by item_id", () => {
    const result = resolveAndIncrementBarcode("ITEM-SH-002", INITIAL_LINES, {
      continuousMode: true,
      incrementQty: 5,
    });

    expect(result.isNew).toBe(false);
    expect(result.matchedIndex).toBe(1);
    expect(result.updatedLines[1].quantity_received).toBe(303);
  });

  it("should set exact quantity when continuous mode is false", () => {
    const result = resolveAndIncrementBarcode("SH-002", INITIAL_LINES, {
      continuousMode: false,
      incrementQty: 150,
    });

    expect(result.isNew).toBe(false);
    expect(result.matchedIndex).toBe(1);
    expect(result.updatedLines[1].quantity_received).toBe(150);
  });

  it("should create a new line item when barcode is not found in existing inward lines", () => {
    const result = resolveAndIncrementBarcode("8901234567890", INITIAL_LINES, {
      continuousMode: true,
      incrementQty: 1,
    });

    expect(result.isNew).toBe(true);
    expect(result.updatedLines.length).toBe(3);
    const newLine = result.updatedLines[2];
    expect(newLine.code).toBe("8901234567890");
    expect(newLine.quantity_received).toBe(1);
    expect(newLine.quantity_ordered).toBe(0);
  });

  it("should correctly compute PPV (Purchase Price Variance) for items with invoice discrepancy", () => {
    const ppvRows = INITIAL_LINES.map((row) => {
      const variancePerUnit = row.invoice_rate - row.cost_price;
      const accepted = Math.max(0, row.quantity_received - row.quantity_damaged);
      const totalPpv = variancePerUnit * accepted;
      return { row, variancePerUnit, totalPpv, accepted, hasVariance: Math.abs(variancePerUnit) > 0.001 };
    }).filter((x) => x.hasVariance);

    expect(ppvRows.length).toBe(1);
    expect(ppvRows[0].row.code).toBe("SH-002");
    expect(ppvRows[0].variancePerUnit).toBe(50.0);
    expect(ppvRows[0].accepted).toBe(296);
    expect(ppvRows[0].totalPpv).toBe(14800.0);
  });
});
