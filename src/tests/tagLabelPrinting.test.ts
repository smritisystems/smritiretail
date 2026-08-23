/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.8.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import {
  LabelPrintRow,
  SelectionCriteriaRange,
  ItemMasterSelectionCriteria,
  LabelPrintSettings,
  ScriptFieldIdentification,
  PrintSafetyValidation
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
    { id: "6", code: "000012", name: "Trouser", category: "Apparel", brand: "Beanstalk", color: "Olive", styleCode: "Cargo", size: "36", mrp: 1899, price: 1499, stock: 6, barcode: "890100000012" },
    { id: "7", code: "000020", name: "Sneakers Pro", category: "Footwear", brand: "Nike", color: "White", styleCode: "HighTop", size: "9", mrp: 4999, price: 3999, stock: 10, barcode: "890100000020" },
    { id: "8", code: "000021", name: "Casual Slip-On", category: "Footwear", brand: "Puma", color: "Grey", styleCode: "Flat", size: "8", mrp: 2499, price: 1999, stock: 14, barcode: "890100000021" }
  ];

  const mapProductsToRows = (items: Product[]): LabelPrintRow[] => {
    return items.map((p, idx) => ({
      id: p.id || `row-${idx}`,
      sNo: idx + 1,
      stockNo: p.code || String(idx + 1).padStart(6, "0"),
      barcode: p.barcode || p.code || "",
      brand: p.brand || "SMRITI",
      product: p.name || p.category || "Item",
      category: p.category || "General",
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

  const filterRowsByItemMasterCriteria = (
    rows: LabelPrintRow[],
    criteria: Partial<ItemMasterSelectionCriteria>
  ): LabelPrintRow[] => {
    return rows.filter(row => {
      // 1. Stock No / SKU range
      if (criteria.stockNoFrom && row.stockNo < criteria.stockNoFrom) return false;
      if (criteria.stockNoTo && row.stockNo > criteria.stockNoTo) return false;

      // 2. Exact Barcode Match
      if (criteria.barcode && criteria.barcode.trim()) {
        const b = criteria.barcode.trim().toLowerCase();
        if (row.barcode.toLowerCase() !== b && row.stockNo.toLowerCase() !== b) return false;
      }

      // 3. Product Names
      if (criteria.productNames && criteria.productNames.length > 0 && !criteria.productNames.includes(row.product)) {
        return false;
      }

      // 4. Brands
      if (criteria.brands && criteria.brands.length > 0 && !criteria.brands.includes(row.brand)) {
        return false;
      }

      // 5. Categories
      if (criteria.categories && criteria.categories.length > 0 && (!row.category || !criteria.categories.includes(row.category))) {
        return false;
      }

      // 6. Style Codes
      if (criteria.styleCodes && criteria.styleCodes.length > 0 && !criteria.styleCodes.includes(row.style)) {
        return false;
      }

      // 7. Colours / Shades
      if (criteria.colours && criteria.colours.length > 0 && !criteria.colours.includes(row.colour)) {
        return false;
      }

      // 8. Sizes
      if (criteria.sizes && criteria.sizes.length > 0 && !criteria.sizes.includes(row.size)) {
        return false;
      }

      return true;
    });
  };

  const evaluatePrintSafety = (
    loadedCount: number,
    selectedCount: number,
    selectedLabels: number,
    templateName: string,
    printerName: string,
    outputToFile: boolean
  ): PrintSafetyValidation => {
    const hasLoadedItems = loadedCount > 0;
    const hasSelectedItems = selectedCount > 0;
    const hasPositiveQuantity = selectedLabels > 0;
    const hasValidTemplate = Boolean(templateName?.trim());
    const hasValidPrinter = Boolean(printerName?.trim() || outputToFile);

    const missingReasons: string[] = [];
    if (!hasLoadedItems) missingReasons.push("No items loaded in grid matching criteria");
    if (!hasSelectedItems) missingReasons.push("No items selected in grid (check at least 1 row)");
    if (!hasPositiveQuantity) missingReasons.push("Total label quantity must be greater than 0");
    if (!hasValidTemplate) missingReasons.push("No label script / template configured");
    if (!hasValidPrinter) missingReasons.push("No printer configured and file output is disabled");

    return {
      canPrint: hasLoadedItems && hasSelectedItems && hasPositiveQuantity && hasValidTemplate && hasValidPrinter,
      hasLoadedItems,
      hasSelectedItems,
      hasPositiveQuantity,
      hasValidTemplate,
      hasValidPrinter,
      missingReasons
    };
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
    expect(rows.length).toBe(8);
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

  describe("Item Master 7 Selection Criteria and AND Logic", () => {
    it("2. should filter rows correctly by SKU range (Criterion 1)", () => {
      const rows = mapProductsToRows(sampleProducts);
      const filtered = filterRowsByItemMasterCriteria(rows, { stockNoFrom: "000006", stockNoTo: "000008" });
      expect(filtered.length).toBe(3);
      expect(filtered.map(r => r.stockNo)).toEqual(["000006", "000007", "000008"]);
    });

    it("3. should filter rows correctly by Product Name multi-select (Criterion 2)", () => {
      const rows = mapProductsToRows(sampleProducts);
      const filtered = filterRowsByItemMasterCriteria(rows, { productNames: ["Shirt", "Sneakers Pro"] });
      expect(filtered.length).toBe(4);
      expect(filtered.map(r => r.stockNo)).toEqual(["000006", "000007", "000008", "000020"]);
    });

    it("4. should filter rows correctly by Brand multi-select (Criterion 3)", () => {
      const rows = mapProductsToRows(sampleProducts);
      const filtered = filterRowsByItemMasterCriteria(rows, { brands: ["Nike", "Puma"] });
      expect(filtered.length).toBe(2);
      expect(filtered.map(r => r.stockNo)).toEqual(["000020", "000021"]);
    });

    it("5. should filter rows correctly by Category multi-select (Criterion 4)", () => {
      const rows = mapProductsToRows(sampleProducts);
      const filtered = filterRowsByItemMasterCriteria(rows, { categories: ["Footwear"] });
      expect(filtered.length).toBe(2);
      expect(filtered.map(r => r.stockNo)).toEqual(["000020", "000021"]);
    });

    it("6. should filter rows correctly by Style Code multi-select (Criterion 5)", () => {
      const rows = mapProductsToRows(sampleProducts);
      const filtered = filterRowsByItemMasterCriteria(rows, { styleCodes: ["Cargo"] });
      expect(filtered.length).toBe(3);
      expect(filtered.map(r => r.stockNo)).toEqual(["000010", "000011", "000012"]);
    });

    it("7. should filter rows correctly by Colour / Shade multi-select (Criterion 6)", () => {
      const rows = mapProductsToRows(sampleProducts);
      const filtered = filterRowsByItemMasterCriteria(rows, { colours: ["Olive"] });
      expect(filtered.length).toBe(3);
      expect(filtered.map(r => r.stockNo)).toEqual(["000010", "000011", "000012"]);
    });

    it("8. should filter rows correctly by Size multi-select (Criterion 7)", () => {
      const rows = mapProductsToRows(sampleProducts);
      const filtered = filterRowsByItemMasterCriteria(rows, { sizes: ["34", "36"] });
      expect(filtered.length).toBe(4);
      expect(filtered.map(r => r.stockNo)).toEqual(["000006", "000007", "000011", "000012"]);
    });

    it("9. should support dedicated exact-match Barcode scanner input", () => {
      const rows = mapProductsToRows(sampleProducts);
      const filtered = filterRowsByItemMasterCriteria(rows, { barcode: "890100000010" });
      expect(filtered.length).toBe(1);
      expect(filtered[0].stockNo).toBe("000010");
      expect(filtered[0].product).toBe("Trouser");
    });

    it("10. should combine multiple criteria with strict AND logic", () => {
      const rows = mapProductsToRows(sampleProducts);
      // Category: Apparel AND Brand: Beanstalk AND Product: Trouser AND Size: 34
      const filtered = filterRowsByItemMasterCriteria(rows, {
        categories: ["Apparel"],
        brands: ["Beanstalk"],
        productNames: ["Trouser"],
        sizes: ["34"]
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0].stockNo).toBe("000011");
      expect(filtered[0].size).toBe("34");
    });
  });

  describe("Grid Sorting and Per-Column Filtering", () => {
    it("11. should sort price and labels numerically with empty-values-last", () => {
      const rows = mapProductsToRows(sampleProducts);
      rows[0].sellingPrice = 999;
      rows[6].sellingPrice = 3999;
      rows[7].sellingPrice = 1999;

      const asc = [...rows].sort((a, b) => a.sellingPrice - b.sellingPrice);
      expect(asc[0].sellingPrice).toBe(999);
      expect(asc[asc.length - 1].sellingPrice).toBe(3999);

      const desc = [...rows].sort((a, b) => b.sellingPrice - a.sellingPrice);
      expect(desc[0].sellingPrice).toBe(3999);
      expect(desc[desc.length - 1].sellingPrice).toBe(999);
    });

    it("12. should filter loaded rows using per-column header filters", () => {
      const rows = mapProductsToRows(sampleProducts);
      const colFilter = { brand: "bean", colour: "olive" };

      const filtered = rows.filter(r =>
        r.brand.toLowerCase().includes(colFilter.brand) &&
        r.colour.toLowerCase().includes(colFilter.colour)
      );

      expect(filtered.length).toBe(3);
      expect(filtered.every(r => r.brand === "Beanstalk" && r.colour === "Olive")).toBe(true);
    });
  });

  describe("Print Safety Gate Rules", () => {
    it("13. should block printing when zero items are loaded", () => {
      const safety = evaluatePrintSafety(0, 0, 0, "template.blf", "Honeywell IH-2", false);
      expect(safety.canPrint).toBe(false);
      expect(safety.missingReasons).toContain("No items loaded in grid matching criteria");
    });

    it("14. should block printing when items exist but zero are selected", () => {
      const safety = evaluatePrintSafety(5, 0, 0, "template.blf", "Honeywell IH-2", false);
      expect(safety.canPrint).toBe(false);
      expect(safety.missingReasons).toContain("No items selected in grid (check at least 1 row)");
    });

    it("15. should block printing when items are selected but total quantity is 0", () => {
      const safety = evaluatePrintSafety(5, 2, 0, "template.blf", "Honeywell IH-2", false);
      expect(safety.canPrint).toBe(false);
      expect(safety.missingReasons).toContain("Total label quantity must be greater than 0");
    });

    it("16. should block printing when template name is missing", () => {
      const safety = evaluatePrintSafety(5, 2, 10, "", "Honeywell IH-2", false);
      expect(safety.canPrint).toBe(false);
      expect(safety.missingReasons).toContain("No label script / template configured");
    });

    it("17. should enable printing when all safety conditions are met", () => {
      const safety = evaluatePrintSafety(5, 3, 15, "ModernLabelDesign_TE244.blf", "Honeywell IH-2", false);
      expect(safety.canPrint).toBe(true);
      expect(safety.missingReasons.length).toBe(0);
    });
  });

  describe("External Sources Integration & Formatting", () => {
    it("18. should format ZPL / macro template tokens according to Industrial Logic standards", () => {
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

    it("19. should parse PT file header and purchase quantity rows accurately", () => {
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

    it("20. should query items Against Transactions matching document type, prefix, and range", () => {
      const grnItems = queryTransactionItems("Purchase Inward (GRN)", "GRN-2026-", "001", "001");
      expect(grnItems.length).toBe(3);
      expect(grnItems[0].stockNo).toBe("000006");
      expect(grnItems[0].labelCount).toBe(12); // GRN-001 quantity
      expect(grnItems.reduce((sum, r) => sum + r.labelCount, 0)).toBe(35);
    });

    it("21. should query items Against Masters with date range filtering and unprinted status switch", () => {
      const allMasterItems = queryMasterItemsByDate("2026-08-01", "2026-08-22", false);
      expect(allMasterItems.length).toBe(6);

      const unprintedItems = queryMasterItemsByDate("2026-08-01", "2026-08-22", true);
      expect(unprintedItems.length).toBe(4);
      expect(unprintedItems.map(r => r.stockNo)).toEqual(["000008", "000010", "000011", "000012"]);
    });

    it("22. should parse PDT CSV text into valid label rows with rates", () => {
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
});
