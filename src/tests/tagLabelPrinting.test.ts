/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.31.0
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
  LabelPrintSettings
} from "../components/barcode/types.ts";
import { Product } from "../types.ts";

describe("SMRITI 9 Tag & Barcode Label Printing Logic Suite", () => {
  const sampleProducts: Product[] = [
    { id: "1", code: "000001", name: "Trousers", category: "Apparel", brand: "Abiba Halo", color: "Blue", styleCode: "BPTY", size: "32", mrp: 1299, price: 999, stock: 12, barcode: "890100000001" },
    { id: "2", code: "000002", name: "Trousers", category: "Apparel", brand: "Abiba Halo", color: "Blue", styleCode: "BPTY", size: "34", mrp: 1299, price: 999, stock: 15, barcode: "890100000002" },
    { id: "3", code: "000003", name: "Trousers", category: "Apparel", brand: "Abiba Halo", color: "Blue", styleCode: "BPTY", size: "36", mrp: 1299, price: 999, stock: 8, barcode: "890100000003" },
    { id: "4", code: "000004", name: "Knit Shirts", category: "Apparel", brand: "Lance Perry", color: "Blue", styleCode: "LPB9E", size: "L", mrp: 899, price: 699, stock: 24, barcode: "890100000004" },
    { id: "5", code: "000005", name: "Knit Shirts", category: "Apparel", brand: "Lance Perry", color: "Blue", styleCode: "LPB9E", size: "M", mrp: 899, price: 699, stock: 18, barcode: "890100000005" },
    { id: "6", code: "000006", name: "Knit Shirts", category: "Apparel", brand: "Lance Perry", color: "Blue", styleCode: "LPB9E", size: "S", mrp: 899, price: 699, stock: 6, barcode: "890100000006" }
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
      labelCount: 0,
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

  it("1. should map product inventory records into LabelPrintRow models accurately", () => {
    const rows = mapProductsToRows(sampleProducts);
    expect(rows.length).toBe(6);
    expect(rows[0].stockNo).toBe("000001");
    expect(rows[0].brand).toBe("Abiba Halo");
    expect(rows[0].product).toBe("Trousers");
    expect(rows[0].colour).toBe("Blue");
    expect(rows[0].style).toBe("BPTY");
    expect(rows[0].size).toBe("32");
    expect(rows[0].currentStock).toBe(12);
    expect(rows[0].labelCount).toBe(0);
  });

  it("2. should filter rows correctly by Stock No From/To ranges", () => {
    const rows = mapProductsToRows(sampleProducts);
    const filtered = filterRowsByCriteria(rows, { stockNoFrom: "000002", stockNoTo: "000004" });
    expect(filtered.length).toBe(3);
    expect(filtered.map(r => r.stockNo)).toEqual(["000002", "000003", "000004"]);
  });

  it("3. should filter rows correctly by Brand criteria", () => {
    const rows = mapProductsToRows(sampleProducts);
    const filtered = filterRowsByCriteria(rows, { brandFrom: "Lance Perry", brandTo: "Lance Perry" });
    expect(filtered.length).toBe(3);
    expect(filtered.every(r => r.brand === "Lance Perry")).toBe(true);
  });

  it("4. should auto-populate labelCount from currentStock when in Present Stock mode", () => {
    const rows = mapProductsToRows(sampleProducts);
    const presentStockRows = rows.map(r => ({ ...r, labelCount: r.currentStock }));
    const totalLabels = presentStockRows.reduce((sum, r) => sum + r.labelCount, 0);
    const expectedStockSum = sampleProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
    expect(totalLabels).toBe(expectedStockSum);
    expect(totalLabels).toBe(83);
  });

  it("5. should reset all label counts to 0 when clear action is triggered", () => {
    const rows = mapProductsToRows(sampleProducts);
    const populated = rows.map(r => ({ ...r, labelCount: 5 }));
    expect(populated.every(r => r.labelCount === 5)).toBe(true);

    const cleared = populated.map(r => ({ ...r, labelCount: 0 }));
    expect(cleared.every(r => r.labelCount === 0)).toBe(true);
  });
});
