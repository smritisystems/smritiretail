/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-08-16
 * Modified     : 2026-08-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, beforeEach } from "vitest";
import { HeaderMappingEngine, defaultHeaderMappingEngine } from "../lib/headerMapping/HeaderMappingEngine";
import { normalizeHeader } from "../lib/headerMapping/HeaderNormalizer";
import { addCustomAlias, getSmritiItemMasterFields, clearCustomAliases } from "../lib/headerMapping/HeaderAliasRegistry";

describe("HeaderNormalizer Utility", () => {
  it("should normalize whitespace, casing, underscores, hyphens, and punctuation", () => {
    expect(normalizeHeader("SKU Code")).toBe("sku code");
    expect(normalizeHeader("sku_code")).toBe("sku code");
    expect(normalizeHeader("SKU-CODE")).toBe("sku code");
    expect(normalizeHeader("  sku   code  ")).toBe("sku code");
    expect(normalizeHeader("SkuCode")).toBe("skucode");
    expect(normalizeHeader("HSN/SAC")).toBe("hsn sac");
    expect(normalizeHeader("GST %")).toBe("gst %");
  });
});

describe("HeaderMappingEngine Core Pipeline", () => {
  let engine: HeaderMappingEngine;

  beforeEach(() => {
    engine = new HeaderMappingEngine();
    engine.clearProfiles();
  });

  it("should map exact headers cleanly", () => {
    const headers = ["SKU CODE", "ITEM NAME", "BARCODE", "CATEGORY", "HSN CODE", "GST %", "SELLING PRICE"];
    const result = engine.mapHeaders(headers);

    expect(result.exactCount).toBe(7);
    expect(result.isValid).toBe(true);
    expect(result.columns[0].mappedFieldKey).toBe("code");
    expect(result.columns[1].mappedFieldKey).toBe("name");
    expect(result.columns[2].mappedFieldKey).toBe("barcode");
    expect(result.columns[3].mappedFieldKey).toBe("category");
  });

  it("should map acceptance example 1 headers", () => {
    const headers = ["SKU", "Product", "EAN", "Brand Name", "Product Category", "HSN No", "GST Rate", "Sale Price"];
    const result = engine.mapHeaders(headers);

    const keys = result.columns.map(c => c.mappedFieldKey);
    expect(keys).toEqual(["code", "name", "barcode", "brand", "category", "hsnCode", "gstPercentage", "price"]);
    expect(result.exactCount + result.highCount).toBe(8);
  });

  it("should map acceptance example 2 headers", () => {
    const headers = ["Style No", "Description", "UPC Code", "Make", "Group", "Tax %", "MRP"];
    const result = engine.mapHeaders(headers);

    const keys = result.columns.map(c => c.mappedFieldKey);
    expect(keys).toEqual(["code", "name", "barcode", "brand", "category", "gstPercentage", "mrp"]);
  });

  it("should map acceptance example 3 headers", () => {
    const headers = ["Article", "Item Description", "Barcode No", "Manufacturer", "Subcategory", "Selling Rate"];
    const result = engine.mapHeaders(headers);

    const keys = result.columns.map(c => c.mappedFieldKey);
    expect(keys).toEqual(["code", "name", "barcode", "brand", "subCategory", "price"]);
  });

  it("should flag ambiguous headers for user review", () => {
    const headers = ["SKU", "Item Description", "Price"];
    const result = engine.mapHeaders(headers);

    const priceCol = result.columns.find(c => c.sourceHeader === "Price");
    expect(priceCol?.confidence).toBe("AMBIGUOUS");
    expect(priceCol?.isAmbiguous).toBe(true);
    expect(priceCol?.ambiguousCandidates?.map(c => c.key)).toContain("price");
    expect(priceCol?.ambiguousCandidates?.map(c => c.key)).toContain("mrp");
    expect(priceCol?.ambiguousCandidates?.map(c => c.key)).toContain("costPrice");
  });

  it("should handle unmapped headers without error", () => {
    const headers = ["SKU", "Item Description", "Unknown Random Column 99"];
    const result = engine.mapHeaders(headers);

    const unmappedCol = result.columns.find(c => c.sourceHeader === "Unknown Random Column 99");
    expect(unmappedCol?.confidence).toBe("UNMAPPED");
    expect(unmappedCol?.mappedFieldKey).toBeNull();
    expect(result.unmappedCount).toBe(1);
  });

  it("should identify missing required fields", () => {
    const headers = ["Brand Name", "UOM"];
    const result = engine.mapHeaders(headers);

    expect(result.isValid).toBe(false);
    expect(result.missingRequiredFields.length).toBeGreaterThan(0);
    const missingKeys = result.missingRequiredFields.map(f => f.key);
    expect(missingKeys).toContain("code");
    expect(missingKeys).toContain("name");
    expect(missingKeys).toContain("barcode");
  });

  it("should save and apply user mapping profiles", () => {
    const headers = ["Supplier_Part_Num", "Supplier_Title"];
    
    // First pass gives unmapped
    let result = engine.mapHeaders(headers);
    expect(result.unmappedCount).toBe(2);

    // Simulate user manual override
    result.columns[0].mappedFieldKey = "code";
    result.columns[1].mappedFieldKey = "name";

    // Save profile
    const profile = engine.saveProfile("Supplier X Profile", result.columns);
    expect(profile.name).toBe("Supplier X Profile");

    // Second pass applying profile
    result = engine.mapHeaders(headers, "ITEM_MASTER", profile);
    expect(result.columns[0].mappedFieldKey).toBe("code");
    expect(result.columns[1].mappedFieldKey).toBe("name");
    expect(result.columns[0].isOverridden).toBe(true);
  });

  it("should register and auto-map custom user header aliases", () => {
    clearCustomAliases();

    // Register custom vendor header alias
    addCustomAlias("code", "Vendor Catalog SKU Number");
    addCustomAlias("price", "Unit Sale Rate Excl Tax");

    const fields = getSmritiItemMasterFields();
    const customEngine = new HeaderMappingEngine(fields);

    const headers = ["Vendor Catalog SKU Number", "Item Description", "Unit Sale Rate Excl Tax"];
    const result = customEngine.mapHeaders(headers);

    expect(result.columns[0].mappedFieldKey).toBe("code");
    expect(result.columns[0].confidence).toBe("HIGH");
    expect(result.columns[2].mappedFieldKey).toBe("price");
    expect(result.columns[2].confidence).toBe("HIGH");
  });

  it("should detect header row when title lines precede the actual Excel table", () => {
    const matrix = [
      ["Supplier Price List - August 2026"],
      ["Updated by Vendor X on 15-08-2026"],
      [""],
      ["Brand Name", "GST Rate", "Product Name", "MRP", "SKU", "Barcode", "Category", "HSN"],
      ["Nike", "18", "T-Shirt", "1999", "TS001", "000890123", "Apparel", "6109"],
      ["Puma", "12", "Track Pant", "2499", "TP002", "000890456", "Apparel", "6103"]
    ];

    const detected = engine.detectHeaderRow(matrix);
    expect(detected.headerRowIndex).toBe(3);
    expect(detected.headers[0]).toBe("Brand Name");
    expect(detected.sampleRows.length).toBe(2);
    expect(detected.sampleRows[0][4]).toBe("TS001");
  });

  it("should map completely reversed/random Excel column order into canonical fields", () => {
    const randomHeaders = ["GST Rate", "Brand Name", "Barcode", "SKU", "Product Description", "MRP"];
    const result = engine.mapHeaders(randomHeaders);

    const mapping: Record<string, number> = {};
    result.columns.forEach(col => {
      if (col.mappedFieldKey) {
        mapping[col.mappedFieldKey] = col.sourceIndex;
      }
    });

    expect(mapping["gstPercentage"]).toBe(0);
    expect(mapping["brand"]).toBe(1);
    expect(mapping["barcode"]).toBe(2);
    expect(mapping["code"]).toBe(3);
    expect(mapping["name"]).toBe(4);
    expect(mapping["mrp"]).toBe(5);

    // Simulate mapping data row with leading zero preservation
    const sourceDataRow = ["18", "Adidas", "000456789", "AD-99", "Superstar Sneaker", "4999"];
    const canonicalRow: Record<string, string> = {};
    Object.keys(mapping).forEach(fieldKey => {
      canonicalRow[fieldKey] = sourceDataRow[mapping[fieldKey]];
    });

    expect(canonicalRow.code).toBe("AD-99");
    expect(canonicalRow.name).toBe("Superstar Sneaker");
    expect(canonicalRow.barcode).toBe("000456789");
    expect(canonicalRow.brand).toBe("Adidas");
    expect(canonicalRow.gstPercentage).toBe("18");
    expect(canonicalRow.mrp).toBe("4999");
  });

  it("should perform typo-tolerant semantic fuzzy matching for misspelled headers", () => {
    const typoHeaders = [
      "Item Nmae",      // -> name
      "Prodcut Nam",    // -> name
      "Barcod",         // -> barcode
      "Brnad",          // -> brand
      "Categroy",       // -> category
      "HSN Cdoe",       // -> hsnCode
      "GST Raet",       // -> gstPercentage
      "Sellng Price"    // -> price
    ];

    const result = engine.mapHeaders(typoHeaders);
    const mappedKeys = result.columns.map(c => c.mappedFieldKey);

    expect(mappedKeys[0]).toBe("name");
    expect(mappedKeys[2]).toBe("barcode");
    expect(mappedKeys[3]).toBe("brand");
    expect(mappedKeys[4]).toBe("category");
    expect(mappedKeys[5]).toBe("hsnCode");
    expect(mappedKeys[6]).toBe("gstPercentage");
    expect(mappedKeys[7]).toBe("price");
  });
});
