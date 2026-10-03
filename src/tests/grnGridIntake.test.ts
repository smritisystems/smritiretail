/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.62.0
 * Created      : 2026-10-03
 * Modified     : 2026-10-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import { GridInputEngine } from "../services/gridInput/gridInputEngine";
import { GRID_PROFILES } from "../services/gridInput/gridProfiles";
import { ParsedGridRow } from "../services/gridInput/types";
import {
  GrnLineRow,
  mapParsedGridRowsToGrnLines,
  mergeGrnLines,
} from "../components/purchase/GrnReceiptTab";

describe("GRN Inward Grid Intake & Line Transformation", () => {
  it("parses tab-delimited vendor packing list text with quotation protection", () => {
    const rawTsv = `Barcode\tSKU\tProduct Name\tReceived Qty\tDamaged Qty\tInvoice Rate\tMRP\tGST %\n890123456001\t"ART-101"\t"Classic Oxford Shoe, Black"\t50\t2\t1450\t2999\t18\n890123456002\tART-102\t"Casual Loafer, Tan"\t30\t0\t1800\t3499\t18`;
    const parseResult = GridInputEngine.parseDelimitedText(rawTsv);
    expect(parseResult.delimiter).toBe("\t");
    expect(parseResult.matrix).toHaveLength(3);
    expect(parseResult.matrix[1][1]).toBe("ART-101");
    expect(parseResult.matrix[1][2]).toBe("Classic Oxford Shoe, Black");
    expect(parseResult.matrix[2][2]).toBe("Casual Loafer, Tan");
  });

  it("maps parsed grid rows and matches against loaded PO lines with contract cost preservation", () => {
    const activePoLines: GrnLineRow[] = [
      {
        rowId: "po-line-1",
        product_id: "prod-uuid-101",
        item_id: "item-uuid-101",
        code: "ART-101",
        name: "Classic Oxford Shoe, Black",
        size: "8",
        color: "Black",
        quantity_ordered: 60,
        quantity_received: 0,
        quantity_damaged: 0,
        cost_price: 1400, // Contract rate in PO
        invoice_rate: 1400,
        trade_discount: 0,
        gst_rate: 18,
        mrp: 2999,
      },
    ];

    const parsedRows: ParsedGridRow[] = [
      {
        rowNumber: 1,
        rawValues: {},
        identifier: "ART-101",
        identifierType: "SKU",
        quantity: 50,
        resolutionStatus: "VALID",
        mappedValues: {
          barcode: "890123456001",
          sku: "ART-101",
          name: "Classic Oxford Shoe, Black",
          quantity: "50",
          damagedQty: "2",
          costPrice: "1450", // Vendor billed rate higher than PO contract rate (+50 PPV)
          mrp: "2999",
          taxRate: "18",
          size: "8",
          color: "Black",
        },
        resolvedProduct: {
          productId: "prod-uuid-101",
          sku: "ART-101",
          name: "Classic Oxford Shoe, Black",
          barcode: "890123456001",
          costPrice: 1400,
          sellingPrice: 2499,
          mrp: 2999,
          taxRate: 18,
          isActive: true,
        },
      },
    ];

    const grnLines = mapParsedGridRowsToGrnLines(parsedRows, activePoLines);
    expect(grnLines).toHaveLength(1);
    const line = grnLines[0];

    // Preserves PostgreSQL UUID identity — never dummy ITEM- or PROD-
    expect(line.product_id).toBe("prod-uuid-101");
    expect(line.code).toBe("ART-101");
    expect(line.quantity_ordered).toBe(60); // Retained from PO contract
    expect(line.quantity_received).toBe(50);
    expect(line.quantity_damaged).toBe(2);
    expect(line.cost_price).toBe(1400); // Contract PO rate
    expect(line.invoice_rate).toBe(1450); // Vendor invoice rate (50 PPV variance)
    expect(line.gst_rate).toBe(18);
    expect(line.mrp).toBe(2999);
  });

  it("maps ad-hoc inward items with zero ordered quantity when not part of active PO", () => {
    const activePoLines: GrnLineRow[] = [];

    const parsedRows: ParsedGridRow[] = [
      {
        rowNumber: 1,
        rawValues: {},
        identifier: "ART-999",
        identifierType: "SKU",
        quantity: 10,
        resolutionStatus: "VALID",
        mappedValues: {
          barcode: "890123456999",
          sku: "ART-999",
          name: "Ad-hoc Sample Shoes",
          quantity: "10",
          damagedQty: "0",
          costPrice: "900",
          mrp: "1999",
          taxRate: "18",
        },
        resolvedProduct: {
          productId: "prod-uuid-999",
          sku: "ART-999",
          name: "Ad-hoc Sample Shoes",
          barcode: "890123456999",
          costPrice: 900,
          sellingPrice: 1599,
          mrp: 1999,
          taxRate: 18,
          isActive: true,
        },
      },
    ];

    const grnLines = mapParsedGridRowsToGrnLines(parsedRows, activePoLines);
    expect(grnLines).toHaveLength(1);
    const line = grnLines[0];

    expect(line.product_id).toBe("prod-uuid-999");
    expect(line.quantity_ordered).toBe(0);
    expect(line.quantity_received).toBe(10);
    expect(line.quantity_damaged).toBe(0);
    expect(line.cost_price).toBe(900);
    expect(line.invoice_rate).toBe(900);
  });

  it("merges GRN inward lines correctly in APPEND, MERGE, and REPLACE modes", () => {
    const existing: GrnLineRow[] = [
      {
        rowId: "existing-1",
        product_id: "prod-1",
        item_id: "item-1",
        code: "SKU-A",
        name: "Item A",
        size: "M",
        color: "Blue",
        quantity_ordered: 20,
        quantity_received: 10,
        quantity_damaged: 0,
        cost_price: 500,
        invoice_rate: 500,
        trade_discount: 0,
        gst_rate: 18,
        mrp: 1000,
      },
    ];

    const incoming: GrnLineRow[] = [
      {
        rowId: "incoming-1",
        product_id: "prod-1",
        item_id: "item-1",
        code: "SKU-A",
        name: "Item A",
        size: "M",
        color: "Blue",
        quantity_ordered: 0,
        quantity_received: 5,
        quantity_damaged: 1,
        cost_price: 500,
        invoice_rate: 520, // Updated invoice rate
        trade_discount: 0,
        gst_rate: 18,
        mrp: 1000,
      },
      {
        rowId: "incoming-2",
        product_id: "prod-2",
        item_id: "item-2",
        code: "SKU-B",
        name: "Item B",
        size: "L",
        color: "Red",
        quantity_ordered: 0,
        quantity_received: 15,
        quantity_damaged: 0,
        cost_price: 800,
        invoice_rate: 800,
        trade_discount: 0,
        gst_rate: 18,
        mrp: 1600,
      },
    ];

    // 1. REPLACE mode
    const replaced = mergeGrnLines(existing, incoming, "REPLACE");
    expect(replaced).toHaveLength(2);
    expect(replaced[0].code).toBe("SKU-A");
    expect(replaced[0].quantity_received).toBe(5);

    // 2. APPEND mode
    const appended = mergeGrnLines(existing, incoming, "APPEND");
    expect(appended).toHaveLength(3);

    // 3. MERGE mode
    const merged = mergeGrnLines(existing, incoming, "MERGE");
    expect(merged).toHaveLength(2); // SKU-A merged + SKU-B appended
    const mergedA = merged.find((l) => l.code === "SKU-A")!;
    expect(mergedA.quantity_received).toBe(15); // 10 + 5
    expect(mergedA.quantity_damaged).toBe(1); // 0 + 1
    expect(mergedA.invoice_rate).toBe(520); // Updated invoice rate
    expect(mergedA.quantity_ordered).toBe(20); // Preserved PO ordered qty
  });
});
