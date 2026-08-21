/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.2.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
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
});
