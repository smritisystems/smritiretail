/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";
import { HeaderMappingEngine } from "../lib/headerMapping/HeaderMappingEngine.ts";
import { SMRITI_ITEM_MASTER_FIELDS } from "../lib/headerMapping/HeaderAliasRegistry.ts";

describe("Phase 3 Refactor: Config-Driven One-to-Many Alias Registry", () => {
  const engine = new HeaderMappingEngine(SMRITI_ITEM_MASTER_FIELDS);

  it("should perform exact match on canonical field label", () => {
    const result = engine.mapHeaders(["ITEM NAME"]);
    expect(result.columns[0].mappedFieldKey).toBe("name");
    expect(result.columns[0].confidence).toBe("EXACT");
  });

  it("should match known footwear aliases and attach one-to-many conditional targets", () => {
    const result = engine.mapHeaders(["BARCODE", "STYLE/Article CODE", "MRP"]);
    
    // Barcode mapping
    const barcodeCol = result.columns[0];
    expect(barcodeCol.mappedFieldKey).toBe("barcode");
    expect(barcodeCol.confidence).toBe("EXACT");
    expect(barcodeCol.additionalTargets).toBeDefined();
    expect(barcodeCol.additionalTargets?.some((t) => t.target === "sku")).toBe(true);

    // Style code mapping
    const styleCol = result.columns[1];
    expect(styleCol.mappedFieldKey).toBe("code");
    expect(styleCol.confidence).toBe("HIGH");

    // MRP mapping
    const mrpCol = result.columns[2];
    expect(mrpCol.mappedFieldKey).toBe("mrp");
  });

  it("should fuzzy match near-miss typos with medium/high confidence", () => {
    const result = engine.mapHeaders(["PRODUKT TAX", "MERCHANDISE CAT"]);
    const taxCol = result.columns[0];
    expect(taxCol.mappedFieldKey).toBe("gstPercentage");
    expect(taxCol.confidenceScore).toBeGreaterThanOrEqual(60);
  });

  it("should mark unrecognized arbitrary columns as UNMAPPED without throwing", () => {
    const result = engine.mapHeaders(["RANDOM_UNKNOWN_COLUMN_XYZ"]);
    expect(result.columns[0].mappedFieldKey).toBeNull();
    expect(result.columns[0].confidence).toBe("UNMAPPED");
  });
});
