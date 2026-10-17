import { describe, expect, it } from "vitest";
import {
  aggregateScannedRows,
  normalizeUniversalImport,
  summarizeUniversalImport,
  UNIVERSAL_IMPORT_TEMPLATES,
} from "../services/universalImportEngine";

describe("UniversalImportEngine", () => {
  it("accepts barcode-only rows with a default quantity", () => {
    const result = normalizeUniversalImport(
      [{ rowNumber: 2, barcode: "8901234567890" }],
      "ITEM_MASTER",
    );

    expect(result.issues).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({
      identifier: "8901234567890",
      identifierType: "BARCODE",
      quantity: 1,
    });
  });

  it("accepts barcode, quantity, MRP, selling price, and cost price together", () => {
    const result = normalizeUniversalImport(
      [{ rowNumber: 2, barcode: "8901234567890", qty: "10", mrp: "500", sellingPrice: "425", costPrice: "300" }],
      "PRICE_BOOK",
    );

    expect(result.issues).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({ quantity: 10, mrp: 500, sellingPrice: 425, costPrice: 300 });
  });

  it("rejects a selling price above MRP before commit", () => {
    const result = normalizeUniversalImport(
      [{ rowNumber: 4, barcode: "8901234567890", mrp: 500, sellingPrice: 525 }],
      "PRICE_BOOK",
    );

    expect(result.rows).toHaveLength(0);
    expect(result.issues[0]).toMatchObject({ rowNumber: 4, code: "PRICE_ABOVE_MRP" });
  });

  it("uses SKU and item code when barcode is absent", () => {
    const result = normalizeUniversalImport(
      [{ rowNumber: 2, sku: "SKU-001" }, { rowNumber: 3, itemCode: "ITEM-002", quantity: 3 }],
      "STOCK_ADJUSTMENT",
    );

    expect(result.rows.map((row) => row.identifier)).toEqual(["SKU-001", "ITEM-002"]);
    expect(result.rows[1].quantity).toBe(3);
  });

  it("resolves a product using style/article, size, color, and optional brand", () => {
    const result = normalizeUniversalImport(
      [{ rowNumber: 2, style: "SHIRT-001", size: "M", color: "Blue", brand: "SMRITI", qty: 2 }],
      "PURCHASE_INWARD",
    );

    expect(result.issues).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({
      identifier: "SHIRT-001|M|BLUE|SMRITI",
      identifierType: "STYLE_SIZE_COLOR_BRAND",
      identity: { styleArticle: "SHIRT-001", size: "M", color: "Blue", brand: "SMRITI" },
    });
  });

  it("requires all three core composite fields when barcode is absent", () => {
    const result = normalizeUniversalImport(
      [{ rowNumber: 5, style: "SHIRT-001", size: "M" }],
      "ITEM_MASTER",
    );

    expect(result.rows).toHaveLength(0);
    expect(result.issues[0]).toMatchObject({ rowNumber: 5, code: "INCOMPLETE_COMPOSITE_IDENTIFIER" });
  });

  it("flags duplicate identifiers instead of silently combining them", () => {
    const result = normalizeUniversalImport(
      [{ rowNumber: 2, barcode: "ABC", qty: 2 }, { rowNumber: 3, barcode: "abc", qty: 4 }],
      "SALES_ORDER",
    );

    expect(result.rows).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ rowNumber: 3, code: "DUPLICATE_ROW" });
  });

  it("provides simple templates for common user activities", () => {
    expect(UNIVERSAL_IMPORT_TEMPLATES.map((template) => template.id)).toEqual([
      "BARCODE_ONLY",
      "BARCODE_QTY",
      "BARCODE_PRICES",
      "ATTRIBUTE_IDENTITY",
    ]);
    expect(UNIVERSAL_IMPORT_TEMPLATES[2].columns).toContain("Selling Price");
  });

  it("combines repeated scanner reads into one quantity", () => {
    const rows = aggregateScannedRows([
      { rowNumber: 2, barcode: "ABC", quantity: 1 },
      { rowNumber: 3, barcode: "ABC", quantity: 1 },
      { rowNumber: 4, barcode: "abc", quantity: 2 },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(4);
  });

  it("summarizes valid, invalid, new, and update rows", () => {
    const result = normalizeUniversalImport(
      [{ rowNumber: 2, barcode: "NEW" }, { rowNumber: 3, barcode: "OLD", qty: 2 }, { rowNumber: 4 }],
      "ITEM_MASTER",
    );
    const summary = summarizeUniversalImport(result, new Set(["old"]));

    expect(summary).toMatchObject({ total: 3, valid: 2, errors: 1, newItems: 1, updates: 1 });
  });
});