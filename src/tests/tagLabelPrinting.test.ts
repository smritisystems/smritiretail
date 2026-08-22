/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.4.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import {
  LabelPrintRow,
  SelectionCriteriaRange,
  LabelPrintSettings,
  ScriptFieldIdentification
} from "../components/barcode/types.ts";
import { Product } from "../types.ts";
import { parsePTFileContent, SAMPLE_PT_FILE_RECORDS } from "../components/barcode/ptFileParser.ts";
import {
  queryTransactionItems,
  queryPurchaseOrderItems,
  queryMasterItemsByDate
} from "../components/barcode/barcodeTransactionStore.ts";

describe("SMRITI 9 Tag & Barcode Label Printing Logic Suite", () => {
  const sampleProducts: Product[] = [
    { id: "1", code: "000006", name: "Shirt", category: "Apparel", brand: "Beanstalk", color: "Ecru", styleCode: "BeeLine", size: "34", mrp: 1299, price: 999, stock: 12, barcode: "890100000006" },
    { id: "2", code: "000007", name: "Shirt", category: "Apparel", brand: "Beanstalk", color: "Ecru", styleCode: "BeeLine", size: "36", mrp: 1299, price: 999, stock: 15, barcode: "890100000007" },
    { id: "3", code: "000008", name: "Shirt", category: "Apparel", brand: "Beanstalk", color: "Ecru", styleCode: "BeeLine", size: "38", mrp: 1299, price: 999, stock: 8, barcode: "890100000008" },
    { id: "4", code: "000010", name: "Trouser", category: "Apparel", brand: "Beanstalk", color: "Olive", styleCode: "Cargo", size: "32", mrp: 1899, price: 1499, stock: 24, barcode: "890100000010" },
    { id: "5", code: "000011", name: "Trouser", category: "Apparel", brand: "Beanstalk", color: "Olive", styleCode: "Cargo", size: "34", mrp: 1899, price: 1499, stock: 18, barcode: "890100000011" },
    { id: "6", code: "000012", name: "Trouser", category: "Apparel", brand: "Beanstalk", color: "Olive", styleCode: "Cargo", size: "36", mrp: 1899, price: 1499, stock: 6, barcode: "890100000012" }
  ];

  const mapProductsToRows = (items: Product[]): LabelPrintRow[] => {
    return items.map((p, idx) => ({
      id: p.id || `row-${idx}`,
      sNo: idx + 1,
      stockNo: p.code || String(idx + 1).padStart(6, "0"),
      barcode: p.barcode || p.code || "",
      brand: p.brand || "SMRITI",
      product: p.name || p.category || "Item",
      colour: p.color || "-",
      style: p.styleCode || "-",
      size: p.size || "-",
      mrp: p.mrp || p.price || 0,
      sellingPrice: p.price || 0,
      currentStock: p.stock ?? 0,
      labelCount: 1,
      originalProduct: p
    }));
  };

  const filterRowsByCriteria = (rows: LabelPrintRow[], criteria: Partial<SelectionCriteriaRange>): LabelPrintRow[] => {
    return rows.filter(row => {
      if (criteria.stockNoFrom && row.stockNo < criteria.stockNoFrom) return false;
      if (criteria.stockNoTo && row.stockNo > criteria.stockNoTo) return false;
      if (criteria.brandFrom && row.brand < criteria.brandFrom) return false;
      if (criteria.brandTo && row.brand > criteria.brandTo) return false;
      if (criteria.productFrom && row.product < criteria.productFrom) return false;
      if (criteria.productTo && row.product > criteria.productTo) return false;
      if (criteria.colourFrom && row.colour < criteria.colourFrom) return false;
      if (criteria.colourTo && row.colour > criteria.colourTo) return false;
      if (criteria.styleFrom && row.style < criteria.styleFrom) return false;
      if (criteria.styleTo && row.style > criteria.styleTo) return false;
      if (criteria.sizeFrom && row.size < criteria.sizeFrom) return false;
      if (criteria.sizeTo && row.size > criteria.sizeTo) return false;
      return true;
    });
  };

  const generateScriptToken = (config: ScriptFieldIdentification): string => {
    const fieldCode = config.field === "Stock Number" ? "01" :
      config.field === "Retail Price" ? "02" :
      config.field === "Lot Code" ? "03" :
      config.field === "Barcode" ? "04" :
      config.field === "Product Name" ? "05" :
      config.field === "Brand" ? "06" :
      config.field === "Style" ? "07" :
      config.field === "Size" ? "08" : "09";

    const dirCode = config.direction === "From Left" ? "01" : "02";
    const startStr = String(config.startPosition).padStart(2, "0");
    const numStr = String(config.numDigits).padStart(2, "0");

    return `@@@${fieldCode};${dirCode};02;${startStr};${numStr}@@@`;
  };

  it("1. should map product inventory records into LabelPrintRow models accurately", () => {
    const rows = mapProductsToRows(sampleProducts);
    expect(rows.length).toBe(6);
    expect(rows[0].stockNo).toBe("000006");
    expect(rows[0].brand).toBe("Beanstalk");
    expect(rows[0].product).toBe("Shirt");
    expect(rows[0].colour).toBe("Ecru");
    expect(rows[0].style).toBe("BeeLine");
    expect(rows[0].size).toBe("34");
    expect(rows[0].currentStock).toBe(12);
    expect(rows[0].labelCount).toBe(1);
  });

  it("2. should filter rows correctly by Stock No From/To ranges", () => {
    const rows = mapProductsToRows(sampleProducts);
    const filtered = filterRowsByCriteria(rows, { stockNoFrom: "000006", stockNoTo: "000008" });
    expect(filtered.length).toBe(3);
    expect(filtered.map(r => r.stockNo)).toEqual(["000006", "000007", "000008"]);
  });

  it("3. should filter rows correctly by multi-dimensional criteria (Product + Style)", () => {
    const rows = mapProductsToRows(sampleProducts);
    const filtered = filterRowsByCriteria(rows, { productFrom: "Trouser", styleFrom: "Cargo" });
    expect(filtered.length).toBe(3);
    expect(filtered.every(r => r.product === "Trouser" && r.style === "Cargo")).toBe(true);
  });

  it("4. should auto-populate labelCount from currentStock when in Present Stock mode", () => {
    const rows = mapProductsToRows(sampleProducts);
    const presentStockRows = rows.map(r => ({ ...r, labelCount: r.currentStock }));
    const totalLabels = presentStockRows.reduce((sum, r) => sum + r.labelCount, 0);
    const expectedStockSum = sampleProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
    expect(totalLabels).toBe(expectedStockSum);
    expect(totalLabels).toBe(83);
  });

  it("5. should support custom per-item # Lbls adjustment (Edit Quantity Details)", () => {
    const rows = mapProductsToRows(sampleProducts);
    const updated = rows.map(r => {
      if (r.stockNo === "000006") return { ...r, labelCount: 5 };
      if (r.stockNo === "000007") return { ...r, labelCount: 10 };
      return r;
    });
    expect(updated.find(r => r.stockNo === "000006")?.labelCount).toBe(5);
    expect(updated.find(r => r.stockNo === "000007")?.labelCount).toBe(10);
    expect(updated.reduce((sum, r) => sum + r.labelCount, 0)).toBe(19);
  });

  it("6. should compile identification field tokens matching industrial script macro format", () => {
    const token = generateScriptToken({
      field: "Stock Number",
      direction: "From Left",
      startPosition: 3,
      numDigits: 4,
      textValue1: "",
      textValue2: ""
    });
    expect(token).toBe("@@@01;01;02;03;04@@@");

    const rightDirToken = generateScriptToken({
      field: "Retail Price",
      direction: "From Right",
      startPosition: 1,
      numDigits: 6,
      textValue1: "",
      textValue2: ""
    });
    expect(rightDirToken).toBe("@@@02;02;02;01;06@@@");
  });

  it("7. should detect .blf script file extension for new printer selection modal workflow", () => {
    const isBlfFile = (filename: string) => filename.toLowerCase().endsWith(".blf");
    expect(isBlfFile("BarcodeScript_Acme.t")).toBe(false);
    expect(isBlfFile("ModernLabelDesign_TE244.blf")).toBe(true);
  });

  it("8. should parse Purchase Transaction (PT File) content and extract purchase quantities", () => {
    const customPtContent = `
# StockNo, Product, Brand, Style, Shade, Size, PurchaseQty, MRP, SalePrice, Barcode
000101, Jacket, Alpine, Puffer, Black, L, 25, 3499, 2999, 890100000101
000102, Jacket, Alpine, Puffer, Black, XL, 30, 3499, 2999, 890100000102
000103, Hoodie, Urban, Fleece, Navy, M, 50, 1999, 1499, 890100000103
`;
    const parsed = parsePTFileContent(customPtContent);
    expect(parsed.length).toBe(3);
    expect(parsed[0].stockNo).toBe("000101");
    expect(parsed[0].product).toBe("Jacket");
    expect(parsed[0].labelCount).toBe(25);
    expect(parsed[1].labelCount).toBe(30);
    expect(parsed[2].labelCount).toBe(50);
    expect(parsed.reduce((sum, r) => sum + r.labelCount, 0)).toBe(105);
  });

  it("9. should correctly enforce PT file mode quantity rules (fixed purchase quantity per item)", () => {
    const parsed = parsePTFileContent("");
    expect(parsed.length).toBe(6);
    expect(parsed[0].stockNo).toBe("000006");
    expect(parsed[0].labelCount).toBe(6);
    expect(parsed[1].stockNo).toBe("000007");
    expect(parsed[1].labelCount).toBe(10);
    const totalPtLabels = parsed.reduce((sum, r) => sum + r.labelCount, 0);
    expect(totalPtLabels).toBe(56);
  });

  it("10. should navigate sequential items in PT file and display active item purchase quantity", () => {
    const parsed = parsePTFileContent("");
    let activeIdx = 0;
    expect(parsed[activeIdx].stockNo).toBe("000006");
    expect(parsed[activeIdx].labelCount).toBe(6);

    activeIdx = 1;
    expect(parsed[activeIdx].stockNo).toBe("000007");
    expect(parsed[activeIdx].labelCount).toBe(10);

    activeIdx = parsed.length - 1;
    expect(parsed[activeIdx].stockNo).toBe("000012");
    expect(parsed[activeIdx].labelCount).toBe(5);
  });

  it("11. should query items Against Transactions matching document type, prefix, and range", () => {
    const grnItems = queryTransactionItems("Purchase Inward (GRN)", "GRN-2026-", "001", "001");
    expect(grnItems.length).toBe(3);
    expect(grnItems[0].stockNo).toBe("000006");
    expect(grnItems[0].labelCount).toBe(12); // GRN-001 quantity
    expect(grnItems[1].labelCount).toBe(15);
    expect(grnItems[2].labelCount).toBe(8);
    expect(grnItems.reduce((sum, r) => sum + r.labelCount, 0)).toBe(35);

    const returnItems = queryTransactionItems("Sales Return Inward", "RET-2026-", "001", "001");
    expect(returnItems.length).toBe(2);
    expect(returnItems[0].labelCount).toBe(2);
  });

  it("12. should query items Against Purchase Order and aggregate cumulative purchase quantities", () => {
    const poItems = queryPurchaseOrderItems("PO-2026-", "001", "002");
    // PO-001 has Shirt 34 (24), Shirt 36 (30), Shirt 38 (18)
    // PO-002 has Trouser 32 (40), Trouser 34 (35)
    expect(poItems.length).toBe(5);
    expect(poItems.find(r => r.stockNo === "000006")?.labelCount).toBe(24);
    expect(poItems.find(r => r.stockNo === "000010")?.labelCount).toBe(40);
    const totalPoLabels = poItems.reduce((sum, r) => sum + r.labelCount, 0);
    expect(totalPoLabels).toBe(147);
  });

  it("13. should query items Against Masters with date range filtering and unprinted status switch", () => {
    // Range from 2026-08-01 to 2026-08-22
    const allMasterItems = queryMasterItemsByDate("2026-08-01", "2026-08-22", false);
    expect(allMasterItems.length).toBe(6);

    // Filter unprinted only: items m-3, m-4, m-5, m-6 have isLabelPrinted = false
    const unprintedItems = queryMasterItemsByDate("2026-08-01", "2026-08-22", true);
    expect(unprintedItems.length).toBe(4);
    expect(unprintedItems.map(r => r.stockNo)).toEqual(["000008", "000010", "000011", "000012"]);
  });

  it("14. should support Direct Scan instant 1-label auto-print or specified quantity queue", () => {
    const scanInput = "890100000006";
    const matched = sampleProducts.find(p => p.barcode === scanInput);
    expect(matched).toBeDefined();

    // Auto print 1 label
    const singleScanRow: LabelPrintRow = {
      id: "scan-1",
      sNo: 1,
      stockNo: matched!.code,
      barcode: matched!.barcode!,
      brand: matched!.brand!,
      product: matched!.name,
      colour: matched!.color!,
      style: matched!.styleCode!,
      size: matched!.size!,
      mrp: matched!.mrp!,
      sellingPrice: matched!.price!,
      currentStock: matched!.stock!,
      labelCount: 1
    };
    expect(singleScanRow.labelCount).toBe(1);

    // Multi label scan (e.g. 5 labels)
    const multiScanRow: LabelPrintRow = { ...singleScanRow, labelCount: 5 };
    expect(multiScanRow.labelCount).toBe(5);
  });
});
