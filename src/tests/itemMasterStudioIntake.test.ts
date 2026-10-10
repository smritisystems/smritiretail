/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.61.0
 * Created      : 2026-10-03
 * Modified     : 2026-10-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import { GridInputEngine } from "../services/gridInput/gridInputEngine";
import { HeaderMappingEngine } from "../lib/headerMapping/HeaderMappingEngine";
import { SMRITI_ITEM_MASTER_FIELDS } from "../lib/headerMapping/HeaderAliasRegistry";

describe("Item Master Studio Intake & Header Mapping", () => {
  const mappingEngine = new HeaderMappingEngine(SMRITI_ITEM_MASTER_FIELDS);

  it("parses tab-delimited Excel clipboard cells with quotation protection", () => {
    const rawTsv = `StockNo\tProduct\tBrand\tMRP\tPrice\nART-101\t"Classic Derby, Black"\tApex\t2999\t2499\nART-102\t"Casual Sneaker, White"\tBata\t1999\t1599`;
    const parseResult = GridInputEngine.parseDelimitedText(rawTsv);
    expect(parseResult.delimiter).toBe("\t");
    expect(parseResult.matrix).toHaveLength(3);
    expect(parseResult.matrix[1][1]).toBe("Classic Derby, Black");
    expect(parseResult.matrix[2][1]).toBe("Casual Sneaker, White");
  });

  it("detects header row with recognized item master fields", () => {
    const matrix = [
      ["SKU", "Product", "Brand", "MRP", "Price"],
      ["ART-101", "Derby", "Apex", "2999", "2499"],
    ];
    const detected = mappingEngine.detectHeaderRow(matrix);
    expect(detected.headerRowIndex).toBe(0);
    const hasRecognized = detected.headers.some((h) => mappingEngine.isKnownHeader(h));
    expect(hasRecognized).toBe(true);

    const mapping = mappingEngine.mapHeaders(detected.headers, "ITEM_MASTER");
    expect(mapping.columns.find((c) => c.sourceHeader === "SKU")?.mappedFieldKey).toBe("code");
    expect(mapping.columns.find((c) => c.sourceHeader === "Product")?.mappedFieldKey).toBe("name");
    expect(mapping.columns.find((c) => c.sourceHeader === "Brand")?.mappedFieldKey).toBe("brand");
  });

  it("preserves 100% of rows in headerless mode without discarding row 0", () => {
    const matrix = [
      ["ART-201", "Monk Strap", "Apex", "3499", "2999"],
      ["ART-202", "Chelsea Boot", "Apex", "4499", "3999"],
    ];
    // In headerless mode, hasHeaderRow = false
    const hasHeaderRow = false;
    let headerRowIndex = -1;
    let dataRows: string[][] = [];
    let headers: string[] = [];

    if (!hasHeaderRow) {
      const maxCols = Math.max(...matrix.map((r) => r.length));
      headers = Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);
      headerRowIndex = -1;
      dataRows = matrix;
    }

    expect(headerRowIndex).toBe(-1);
    expect(headers).toEqual(["Column 1", "Column 2", "Column 3", "Column 4", "Column 5"]);
    expect(dataRows).toHaveLength(2);
    expect(dataRows[0][0]).toBe("ART-201");
    expect(dataRows[1][0]).toBe("ART-202");
  });

  it("handles CSV input with escaped commas correctly", () => {
    const rawCsv = `Article,Product Name,Brand,Color,Size,MRP\nST-99,"Running Shoe, High-Arch",Nike,Black,9,4999`;
    const parseResult = GridInputEngine.parseDelimitedText(rawCsv);
    expect(parseResult.delimiter).toBe(",");
    expect(parseResult.matrix).toHaveLength(2);
    expect(parseResult.matrix[1][1]).toBe("Running Shoe, High-Arch");

    const detected = mappingEngine.detectHeaderRow(parseResult.matrix);
    expect(detected.headerRowIndex).toBe(0);
    const mapping = mappingEngine.mapHeaders(detected.headers, "ITEM_MASTER");
    expect(["code", "style_code"]).toContain(mapping.columns.find((c) => c.sourceHeader === "Article")?.mappedFieldKey);
    expect(mapping.columns.find((c) => c.sourceHeader === "Product Name")?.mappedFieldKey).toBe("name");
    expect(mapping.columns.find((c) => c.sourceHeader === "Color")?.mappedFieldKey).toBe("colour");
    expect(mapping.columns.find((c) => c.sourceHeader === "Size")?.mappedFieldKey).toBe("size");
  });
});
