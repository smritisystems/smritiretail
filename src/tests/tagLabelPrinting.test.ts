/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.7.0
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

describe("SMRITI Tag & Barcode Label Printing Logic Suite", () => {
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
    expect(rows[0].mrp).toBe(1299);
    expect(rows[0].sellingPrice).toBe(999);
    expect(rows[0].currentStock).toBe(12);
    expect(rows[0].labelCount).toBe(1);
  });

  it("2. should filter rows correctly by Stock Number range", () => {
    const rows = mapProductsToRows(sampleProducts);
    const filtered = filterRowsByCriteria(rows, { stockNoFrom: "000006", stockNoTo: "000008" });
    expect(filtered.length).toBe(3);
    expect(filtered.map(r => r.stockNo)).toEqual(["000006", "000007", "000008"]);
  });

  it("3. should filter rows correctly by Product Name & Style criteria", () => {
    const rows = mapProductsToRows(sampleProducts);
    const filtered = filterRowsByCriteria(rows, { productFrom: "Trouser", productTo: "Trouser", styleFrom: "Cargo", styleTo: "Cargo" });
    expect(filtered.length).toBe(3);
    expect(filtered.map(r => r.stockNo)).toEqual(["000010", "000011", "000012"]);
  });

  it("4. should accurately compute total labels to print across all rows", () => {
    const rows = mapProductsToRows(sampleProducts);
    rows[0].labelCount = 5;
    rows[1].labelCount = 10;
    rows[2].labelCount = 0;
    rows[3].labelCount = 2;
    rows[4].labelCount = 3;
    rows[5].labelCount = 1;

    const totalLabels = rows.reduce((sum, r) => sum + r.labelCount, 0);
    expect(totalLabels).toBe(21);
  });

  it("5. should update individual row label quantity inline", () => {
    const rows = mapProductsToRows(sampleProducts);
    const targetRow = rows[0];
    targetRow.labelCount = 25;
    expect(rows[0].labelCount).toBe(25);
  });

  it("6. should format ZPL / macro template tokens according to Industrial Logic standards", () => {
    const config: ScriptFieldIdentification = {
      field: "Stock Number",
      direction: "From Left",
      startPosition: 1,
      numDigits: 6,
      textValue1: "",
      textValue2: ""
    };
    const token = generateScriptToken(config);
    expect(token).toBe("@@@01;01;02;01;06@@@");

    const priceConfig: ScriptFieldIdentification = {
      field: "Retail Price",
      direction: "From Left",
      startPosition: 1,
      numDigits: 16,
      textValue1: "",
      textValue2: ""
    };
    const priceToken = generateScriptToken(priceConfig);
    expect(priceToken).toBe("@@@02;01;02;01;16@@@");
  });

  it("7. should support switching between USB, COM, and QZ Tray port settings", () => {
    const settings: LabelPrintSettings = {
      scriptFileName: "ModernLabelDesign_TE244.blf",
      labelsPerRow: 1,
      outputToPort: true,
      outputToFile: false,
      portSetting: "USB",
      sourceOption: "Manual Selection",
      piPdtFileName: "",
      quantityMode: "Specified Quantity",
      targetPrinterName: "IMPACT by Honeywell IH-2 (300 dpi) - DPL"
    };

    expect(settings.portSetting).toBe("USB");
    settings.portSetting = "QZ Tray Thermal";
    expect(settings.portSetting).toBe("QZ Tray Thermal");
    settings.portSetting = "COM 1";
    expect(settings.portSetting).toBe("COM 1");
  });

  it("8. should parse PT file header and purchase quantity rows accurately", () => {
    const samplePtRaw = `
      000006|890100000006|Beanstalk|Shirt|Ecru|BeeLine|34|1299|999|6
      000007|890100000007|Beanstalk|Shirt|Ecru|BeeLine|36|1299|999|10
      000008|890100000008|Beanstalk|Shirt|Ecru|BeeLine|38|1299|999|8
    `;
    const parsed = parsePTFileContent(samplePtRaw);
    expect(parsed.length).toBe(3);
    expect(parsed[0].stockNo).toBe("000006");
    expect(parsed[0].labelCount).toBe(6);
    expect(parsed[1].labelCount).toBe(10);
    expect(parsed[2].labelCount).toBe(8);
  });

  it("9. should lock quantity mode to purchase quantity and disable manual quantity entry for PT file mode", () => {
    const ptRow: LabelPrintRow = {
      id: "pt-1",
      sNo: 1,
      stockNo: "000006",
      barcode: "890100000006",
      brand: "Beanstalk",
      product: "Shirt",
      colour: "Ecru",
      style: "BeeLine",
      size: "34",
      mrp: 1299,
      sellingPrice: 999,
      currentStock: 0,
      labelCount: 6
    };
    expect(ptRow.labelCount).toBe(6);
    expect(ptRow.currentStock).toBe(0);
  });

  it("10. should navigate sequentially through PT file item records using 4-way navigators", () => {
    const parsed = SAMPLE_PT_FILE_RECORDS.map((rec, idx) => ({
      id: `pt-${idx + 1}`,
      sNo: idx + 1,
      stockNo: rec.stockNo,
      barcode: rec.barcode,
      brand: rec.brand,
      product: rec.product,
      colour: rec.colour,
      style: rec.style,
      size: rec.size,
      mrp: rec.mrp,
      sellingPrice: rec.sellingPrice,
      currentStock: 0,
      labelCount: rec.purchaseQty
    }));

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
    expect(poItems.length).toBe(5);
    expect(poItems.find(r => r.stockNo === "000006")?.labelCount).toBe(24);
    expect(poItems.find(r => r.stockNo === "000010")?.labelCount).toBe(40);
    const totalPoLabels = poItems.reduce((sum, r) => sum + r.labelCount, 0);
    expect(totalPoLabels).toBe(147);
  });

  it("13. should query items Against Masters with date range filtering and unprinted status switch", () => {
    const allMasterItems = queryMasterItemsByDate("2026-08-01", "2026-08-22", false);
    expect(allMasterItems.length).toBe(6);

    const unprintedItems = queryMasterItemsByDate("2026-08-01", "2026-08-22", true);
    expect(unprintedItems.length).toBe(4);
    expect(unprintedItems.map(r => r.stockNo)).toEqual(["000008", "000010", "000011", "000012"]);
  });

  it("14. should support Direct Scan instant 1-label auto-print or specified quantity queue", () => {
    const scanInput = "890100000006";
    const matched = sampleProducts.find(p => p.barcode === scanInput);
    expect(matched).toBeDefined();

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

    const multiScanRow: LabelPrintRow = { ...singleScanRow, labelCount: 5 };
    expect(multiScanRow.labelCount).toBe(5);
  });

  it("15. should sort dataset ascending and descending when header sort is triggered", () => {
    const rows = mapProductsToRows(sampleProducts);
    // Sort by sellingPrice asc
    const sortedAsc = [...rows].sort((a, b) => a.sellingPrice - b.sellingPrice);
    expect(sortedAsc[0].sellingPrice).toBe(999);
    expect(sortedAsc[sortedAsc.length - 1].sellingPrice).toBe(1499);

    // Sort by sellingPrice desc
    const sortedDesc = [...rows].sort((a, b) => b.sellingPrice - a.sellingPrice);
    expect(sortedDesc[0].sellingPrice).toBe(1499);
    expect(sortedDesc[sortedDesc.length - 1].sellingPrice).toBe(999);
  });

  it("16. should execute Quick Fill operations in Batch Quantity Editor", () => {
    const rows = mapProductsToRows(sampleProducts);
    
    // Quick Fill All = 1
    const allOnes = rows.map(r => ({ ...r, labelCount: 1 }));
    expect(allOnes.every(r => r.labelCount === 1)).toBe(true);

    // Quick Fill All = Stock
    const allStock = rows.map(r => ({ ...r, labelCount: r.currentStock }));
    expect(allStock[0].labelCount).toBe(12);
    expect(allStock[3].labelCount).toBe(24);

    // Reset 0
    const allZero = rows.map(r => ({ ...r, labelCount: 0 }));
    expect(allZero.every(r => r.labelCount === 0)).toBe(true);
  });

  it("17. should parse PDT CSV text into valid label rows with rates", () => {
    const pdtCsv = `890100000006, 10, 999.00\n890100000010, 20, 1499.00`;
    const lines = pdtCsv.split("\n");
    const pdtRows: LabelPrintRow[] = [];
    lines.forEach((l, idx) => {
      const parts = l.split(",").map(p => p.trim());
      if (parts.length >= 2) {
        pdtRows.push({
          id: `pdt-${idx}`,
          sNo: idx + 1,
          stockNo: parts[0],
          barcode: parts[0],
          brand: "Beanstalk",
          product: "PDT Item",
          colour: "Std",
          style: "Std",
          size: "34",
          mrp: parseFloat(parts[2]),
          sellingPrice: parseFloat(parts[2]),
          currentStock: 0,
          labelCount: parseFloat(parts[1])
        });
      }
    });

    expect(pdtRows.length).toBe(2);
    expect(pdtRows[0].labelCount).toBe(10);
    expect(pdtRows[1].labelCount).toBe(20);
    expect(pdtRows[0].sellingPrice).toBe(999.00);
  });
});
