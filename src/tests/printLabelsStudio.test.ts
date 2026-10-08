/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.49.0
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
  runPrePrintSanitizer,
  compilePrnString,
  generateFootwearVariantMatrix,
  parseBarcodeCsvOrText,
  DEFAULT_PRINT_PRESETS,
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

  it("generates authentic 3-zone footwear box & counter label SVG when template width is 100x50mm", () => {
    const mockRow = {
      id: "itm-ch30k",
      itemCode: "CH-30-K",
      product: "CH-30-K Heel (Black 37)",
      brand: "Tattly Threads",
      style: "CH-30-K",
      shade: "Black",
      size: "37",
      barcode: "8904551005335",
      stock: 12,
      printQty: 1,
      mrp: 1199,
      selected: true,
    };

    const svg = generateThermalLabelSvgString(mockRow, 100, 50.7);
    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('viewBox="0 0 804 405"');
    expect(svg).toContain('TATTLY THREADS');
    expect(svg).toContain('CH-30-K');
    expect(svg).toContain('BLACK');
    expect(svg).toContain('>37<');
    expect(svg).toContain('MRP:1199/-');
    expect(svg).toContain('8904551005335');
    expect(svg).toContain('MKTD.By:Tattly Threads');
    expect(svg).toContain('NET CONTENTS:1 Pair Footwear');
  });

  it("detects pre-print sanitizer issues: duplicate barcodes, missing sizes, missing colors, and zero prices", () => {
    const dirtyRows = [
      {
        id: "1",
        itemCode: "CH-30-K-1",
        product: "Footwear 1",
        brand: "Tattly Threads",
        style: "CH-30-K",
        shade: "Black",
        size: "37",
        barcode: "8904551005335",
        stock: 10,
        printQty: 1,
        mrp: 1199,
        selected: true,
      },
      {
        id: "2",
        itemCode: "CH-30-K-2",
        product: "Footwear 2",
        brand: "Tattly Threads",
        style: "CH-30-K",
        shade: "", // Missing color
        size: "38",
        barcode: "8904551005335", // Duplicate barcode
        stock: 5,
        printQty: 1,
        mrp: 1199,
        selected: true,
      },
      {
        id: "3",
        itemCode: "CH-30-K-3",
        product: "Footwear 3",
        brand: "Tattly Threads",
        style: "CH-30-K",
        shade: "Taupe",
        size: "", // Missing size
        barcode: "8904551005342",
        stock: 8,
        printQty: 1,
        mrp: 0, // Zero price
        selected: true,
      },
    ];

    const report = runPrePrintSanitizer(dirtyRows as any);
    expect(report.isClean).toBe(false);
    expect(report.totalIssues).toBeGreaterThanOrEqual(4);
    expect(report.duplicateBarcodes).toContain("8904551005335");
    expect(report.missingColors).toContain("CH-30-K-2");
    expect(report.missingSizes).toContain("CH-30-K-3");
    expect(report.invalidMrp).toContain("CH-30-K-3");
  });

  it("verifies clean status from pre-print sanitizer when all items are valid", () => {
    const cleanRows = [
      {
        id: "1",
        itemCode: "CH-30-K-1",
        product: "Footwear 1",
        brand: "Tattly Threads",
        style: "CH-30-K",
        shade: "Black",
        size: "37",
        barcode: "8904551005335",
        stock: 10,
        printQty: 1,
        mrp: 1199,
        selected: true,
      },
      {
        id: "2",
        itemCode: "CH-30-K-2",
        product: "Footwear 2",
        brand: "Tattly Threads",
        style: "CH-30-K",
        shade: "Black",
        size: "38",
        barcode: "8904551005342",
        stock: 5,
        printQty: 1,
        mrp: 1199,
        selected: true,
      },
    ];

    const report = runPrePrintSanitizer(cleanRows as any);
    expect(report.isClean).toBe(true);
    expect(report.totalIssues).toBe(0);
    expect(report.duplicateBarcodes.length).toBe(0);
  });

  it("generates footwear variant matrix with complete size curve 37-42 and valid EAN-13 barcodes", () => {
    const matrix = generateFootwearVariantMatrix("CH-30-K", "TOUPE", 1299);
    expect(matrix.length).toBe(6);
    expect(matrix.map(m => m.size)).toEqual(["37", "38", "39", "40", "41", "42"]);
    expect(matrix.every(m => m.style === "CH-30-K")).toBe(true);
    expect(matrix.every(m => m.shade === "TOUPE")).toBe(true);
    expect(matrix.every(m => m.mrp === 1299)).toBe(true);
    expect(matrix.every(m => m.barcode.startsWith("890455100"))).toBe(true);
    // Distinct barcodes across all sizes
    const barcodesSet = new Set(matrix.map(m => m.barcode));
    expect(barcodesSet.size).toBe(6);
  });

  it("compiles raw ZPL PRN string for footwear 3-stub label preserving stubs and reverse boxes", () => {
    const items = [
      {
        id: "var-1",
        itemCode: "CH-30-K-BLK-37",
        product: "CH-30-K Heel (Black 37)",
        brand: "Tattly Threads",
        style: "CH-30-K",
        shade: "Black",
        size: "37",
        barcode: "8904551005335",
        stock: 12,
        printQty: 2,
        mrp: 1199,
        selected: true,
      },
    ];

    const template = { id: "lay-footwear-100x50-3stub", name: "Footwear 3-Stub 100 x 50 mm", widthMm: 100, heightMm: 50.7 };
    const prn = compilePrnString(items as any, template);

    expect(prn).toContain("<xpml><page></page></xpml>^XA");
    expect(prn).toContain("^LL405");
    expect(prn).toContain("^FT424,44^A0N,30,28^FR^FDCH-30-K     ^FS");
    expect(prn).toContain("^FT661,110^A0N,50,47^FR^FD37^FS");
    expect(prn).toContain("^FT346,371^BY2^BCN,66,N,N,N^FD>:8904551005335^FS");
    expect(prn).toContain("^FT410,175^A0N,38,36^FD1199/-^FS");
    expect(prn).toContain("^PQ2,0,1,Y");
    expect(prn).toContain("^XZ");
  });

  it("compiles standard retail ZPL PRN string for smaller label formats", () => {
    const items = [
      {
        id: "itm-101",
        itemCode: "TEE-01",
        product: "Cotton T-Shirt",
        brand: "Smriti",
        style: "Crew",
        shade: "White",
        size: "L",
        barcode: "890100000099",
        stock: 20,
        printQty: 5,
        mrp: 499,
        selected: true,
      },
    ];

    const template = { id: "retail-50x25", name: "Retail 50 x 25 mm", widthMm: 50, heightMm: 25 };
    const prn = compilePrnString(items as any, template);

    expect(prn).toContain("^XA");
    expect(prn).toContain("^PW400");
    expect(prn).toContain("^LL200");
    expect(prn).toContain("^FDCotton T-Shirt^FS");
    expect(prn).toContain("^BY2^BCN,50,Y,N,N^FD890100000099^FS");
    expect(prn).toContain("^FDMRP: Rs. 499/-^FS");
    expect(prn).toContain("^PQ5,0,1,Y");
    expect(prn).toContain("^XZ");
  });

  it("parses CSV/text manifest and aggregates duplicate scanned barcodes into combined print quantities", () => {
    const rawPastedText = `
      8904551002686,1
      8904551002686,1
      8904551002693,1
      8904551002693,2
      8904551002709,1
      8904551002716,1
    `;

    const entries = parseBarcodeCsvOrText(rawPastedText, { delimiter: "auto", barcodeCol: 0, qtyCol: 1 });
    expect(entries.length).toBe(4);

    const b1 = entries.find(e => e.barcode === "8904551002686");
    expect(b1).toBeDefined();
    expect(b1?.qty).toBe(2); // Aggregated 1 + 1

    const b2 = entries.find(e => e.barcode === "8904551002693");
    expect(b2).toBeDefined();
    expect(b2?.qty).toBe(3); // Aggregated 1 + 2

    const b3 = entries.find(e => e.barcode === "8904551002709");
    expect(b3?.qty).toBe(1);

    const b4 = entries.find(e => e.barcode === "8904551002716");
    expect(b4?.qty).toBe(1);
  });

  it("auto-detects tab, semicolon, and space delimiters when parsing barcode manifests", () => {
    const tabText = "8904551001001\t5\n8904551001002\t10";
    const semiText = "8904551002001;3\n8904551002002;7";
    const spaceText = "8904551003001 4\n8904551003002 6";

    const tabEntries = parseBarcodeCsvOrText(tabText, { delimiter: "auto", barcodeCol: 0, qtyCol: 1 });
    expect(tabEntries.length).toBe(2);
    expect(tabEntries[0].qty).toBe(5);

    const semiEntries = parseBarcodeCsvOrText(semiText, { delimiter: "auto", barcodeCol: 0, qtyCol: 1 });
    expect(semiEntries.length).toBe(2);
    expect(semiEntries[1].qty).toBe(7);

    const spaceEntries = parseBarcodeCsvOrText(spaceText, { delimiter: "auto", barcodeCol: 0, qtyCol: 1 });
    expect(spaceEntries.length).toBe(2);
    expect(spaceEntries[0].qty).toBe(4);
  });

  it("skips header rows and correctly maps alternate column indices with default qty fallback", () => {
    const rawWithHeader = `
      Barcode No,Item Description,Print Qty
      8904551005001,Heel Shoe,4
      8904551005002,Sandal Party,
    `;

    // Map Barcode Col = 0, Qty Col = 2
    const entries = parseBarcodeCsvOrText(rawWithHeader, { delimiter: ",", barcodeCol: 0, qtyCol: 2 });
    expect(entries.length).toBe(2);
    expect(entries[0].barcode).toBe("8904551005001");
    expect(entries[0].qty).toBe(4);
    expect(entries[1].barcode).toBe("8904551005002");
    expect(entries[1].qty).toBe(1); // Fallback to 1 for empty qty column

    // Test default qty (-1) option
    const noQtyColEntries = parseBarcodeCsvOrText("8904551009999", { delimiter: ",", barcodeCol: 0, qtyCol: -1 });
    expect(noQtyColEntries[0].qty).toBe(1);
  });

  it("verifies default print profile presets contain valid Zebra LAN and USB configurations", () => {
    expect(DEFAULT_PRINT_PRESETS.length).toBeGreaterThanOrEqual(2);
    const lanPreset = DEFAULT_PRINT_PRESETS.find(p => p.printerInterface.includes("LAN"));
    expect(lanPreset).toBeDefined();
    expect(lanPreset?.networkPrinterPort).toBe(9100);
    expect(lanPreset?.templateId).toBe("lay-footwear-100x50-3stub");

    const usbPreset = DEFAULT_PRINT_PRESETS.find(p => p.printerInterface.includes("USB"));
    expect(usbPreset).toBeDefined();
    expect(usbPreset?.templateId).toBe("retail-50x25");
  });
});

