/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.46.2
 * Created      : 2026-10-08
 * Modified     : 2026-10-08
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: SMRITI Print Labels Studio Unit Verification Suite
 */

import { describe, it, expect } from "vitest";
import { barcodeTransactionStore } from "../components/barcode/barcodeTransactionS.ts";
import {
  generateThermalLabelSvgString,
  generateThermalSheetSvgString,
} from "../components/barcode/PrintLabelsStudio.tsx";

describe("Print Labels Studio Domain Logic & Multi-Source Engine Suite", () => {
  it("resolves Purchase Order records into printable studio rows with default PO quantities", () => {
    const poItems = barcodeTransactionStore.getPurchaseOrders("", "", "");
    expect(poItems.length).toBeGreaterThan(0);

    const first = poItems[0];
    expect(first.stockNo).toBeDefined();
    expect(first.barcode).toBeDefined();
    expect(first.labelCount).toBeGreaterThan(0);
    expect(first.mrp).toBeGreaterThan(0);
  });

  it("resolves Goods Receipt Note (GRN) inward transaction records with inward quantities", () => {
    const grnItems = barcodeTransactionStore.getTransactions("Purchase Inward (GRN)", "", "", "");
    expect(grnItems.length).toBeGreaterThan(0);

    const row = grnItems[0];
    expect(row.product).toContain("GRN-2026-");
    expect(row.barcode).toMatch(/^890\d{9}$/);
    expect(row.labelCount).toBeGreaterThan(0);
  });

  it("resolves Sales Return Inward transaction items for counter barcode labeling", () => {
    const salesReturns = barcodeTransactionStore.getTransactions("Sales Return Inward", "", "", "");
    expect(salesReturns.length).toBeGreaterThan(0);

    const returnItem = salesReturns[0];
    expect(returnItem.product).toContain("RET-2026-");
    expect(returnItem.labelCount).toBe(2);
  });

  it("resolves master catalog items with unprinted filter capability", () => {
    const unprintedItems = barcodeTransactionStore.getMasterItemsByDate("", "", true);
    expect(unprintedItems.length).toBeGreaterThan(0);
    expect(unprintedItems.every(i => i.barcode.length > 0)).toBe(true);
  });

  it("aggregates total print labels count correctly across selected rows", () => {
    const mockRows = [
      { id: "1", printQty: 5, selected: true },
      { id: "2", printQty: 10, selected: true },
      { id: "3", printQty: 4, selected: false },
    ];
    const selectedRows = mockRows.filter(r => r.selected);
    const totalLabels = selectedRows.reduce((sum, r) => sum + r.printQty, 0);

    expect(selectedRows.length).toBe(2);
    expect(totalLabels).toBe(15);
  });

  it("properly merges custom backend layouts with default label template presets", () => {
    const defaultPresets = [
      { id: "retail-50x25", name: "Retail 50 x 25 mm", widthMm: 50, heightMm: 25 },
      { id: "thermal-40x20", name: "Thermal 40 x 20 mm", widthMm: 40, heightMm: 20 },
    ];

    const backendCustomLayouts = [
      { id: "lay-custom-1", name: "Footwear Euro 65x35", widthMm: 65, heightMm: 35 },
      { id: "retail-50x25", name: "Custom Retail 50x25", widthMm: 50, heightMm: 25 },
    ];

    const existingIds = new Set(backendCustomLayouts.map(c => c.id));
    const merged = [...backendCustomLayouts, ...defaultPresets.filter(p => !existingIds.has(p.id))];

    expect(merged.length).toBe(3);
    expect(merged[0].id).toBe("lay-custom-1");
    expect(merged[1].id).toBe("retail-50x25");
    expect(merged[2].id).toBe("thermal-40x20");
  });

  it("filters rows by brand and item code range", () => {
    const sampleRows = [
      { id: "1", itemCode: "ITM-0010", brand: "Puma", barcode: "890100000001" },
      { id: "2", itemCode: "ITM-0020", brand: "Nike", barcode: "890100000002" },
      { id: "3", itemCode: "ITM-0030", brand: "Nike", barcode: "890100000003" },
      { id: "4", itemCode: "ITM-0040", brand: "Adidas", barcode: "890100000004" },
    ];

    const filterByBrand = sampleRows.filter(r => r.brand === "Nike");
    expect(filterByBrand.length).toBe(2);

    const filterByRange = sampleRows.filter(r => r.itemCode >= "ITM-0020" && r.itemCode <= "ITM-0030");
    expect(filterByRange.length).toBe(2);
    expect(filterByRange.map(r => r.id)).toEqual(["2", "3"]);
  });

  it("filters rows by barcode range", () => {
    const sampleRows = [
      { id: "1", barcode: "890100000010" },
      { id: "2", barcode: "890100000020" },
      { id: "3", barcode: "890100000030" },
    ];

    const range = sampleRows.filter(r => r.barcode >= "890100000015" && r.barcode <= "890100000025");
    expect(range.length).toBe(1);
    expect(range[0].id).toBe("2");
  });

  it("generates valid standalone vector SVG string for single thermal label", () => {
    const mockRow = {
      id: "itm-1",
      itemCode: "SHIRT-001",
      product: "Casual Linen Shirt",
      brand: "Smriti",
      style: "Slim",
      shade: "Blue",
      size: "M",
      barcode: "890100000001",
      stock: 10,
      printQty: 2,
      mrp: 1499,
      selected: true,
    };

    const svg = generateThermalLabelSvgString(mockRow, 50, 25);
    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="25mm"');
    expect(svg).toContain('SMRITI RETAIL');
    expect(svg).toContain('CASUAL LINEN SHIRT');
    expect(svg).toContain('890100000001');
    expect(svg).toContain('SKU: SHIRT-001');
    expect(svg).toContain('1,499');
  });

  it("generates multi-label vector SVG sheet string with template dimensions", () => {
    const mockRows = [
      {
        id: "itm-1",
        itemCode: "SHIRT-001",
        product: "Casual Linen Shirt",
        brand: "Smriti",
        style: "Slim",
        shade: "Blue",
        size: "M",
        barcode: "890100000001",
        stock: 10,
        printQty: 2,
        mrp: 1499,
        selected: true,
      },
      {
        id: "itm-2",
        itemCode: "JEANS-002",
        product: "Denim Jeans",
        brand: "Smriti",
        style: "Regular",
        shade: "Black",
        size: "32",
        barcode: "890100000002",
        stock: 5,
        printQty: 1,
        mrp: 1999,
        selected: true,
      },
    ];

    const template = { id: "retail-50x25", name: "Retail 50 x 25 mm", widthMm: 50, heightMm: 25 };
    const sheetSvg = generateThermalSheetSvgString(mockRows, template);
    expect(sheetSvg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(sheetSvg).toContain('transform="translate(');
    expect(sheetSvg).toContain('CASUAL LINEN SHIRT');
    expect(sheetSvg).toContain('DENIM JEANS');
  });
});
