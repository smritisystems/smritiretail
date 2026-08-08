/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Field Mapping Engine Unit Tests
 * Standard     : SCS-PRINT-MAPPING-TESTS v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect } from "vitest";
import { FieldMappingEngine } from "../core/printing/fields/FieldMappingEngine.ts";
import { UniversalPrintTemplate } from "../core/printing/models/UniversalPrintTemplate.ts";

describe("Universal Field Mapping Engine Test Suite (Phase D)", () => {
  const sampleRuntimeContext = {
    product: {
      name: "Superstar Sneakers",
      code: "SKU-990",
      brand: "Tattly",
      style_code: "CH-01-A",
      color: "RED",
      size: "42",
      hsn_code: "6403",
    },
    pricing: {
      mrp: 1299.0,
      price: 1099.0,
      cost_price: 600.0,
    },
    barcode: {
      value: "8901234567890",
    },
    batch: {
      number: "BATCH-2026-08",
      mfg_date: "2026-08-01",
    },
    company: {
      name: "Tattly Retail Pvt Ltd",
    },
  };

  // 1. Discover barcode placeholder
  it("1. Discovers and auto-maps {barcode} placeholder to barcode.value", () => {
    const res = FieldMappingEngine.autoMapPlaceholder("{barcode}");
    expect(res.canonicalPath).toBe("barcode.value");
    expect(res.status).toBe("VALID");
  });

  // 2. Discover style placeholder
  it("2. Discovers and auto-maps {style} placeholder to product.style_code", () => {
    const res = FieldMappingEngine.autoMapPlaceholder("{style}");
    expect(res.canonicalPath).toBe("product.style_code");
    expect(res.status).toBe("VALID");
  });

  // 3. Discover color placeholder
  it("3. Discovers and auto-maps {color} placeholder to product.color", () => {
    const res = FieldMappingEngine.autoMapPlaceholder("{color}");
    expect(res.canonicalPath).toBe("product.color");
    expect(res.status).toBe("VALID");
  });

  // 4. Discover size placeholder
  it("4. Discovers and auto-maps {size} placeholder to product.size", () => {
    const res = FieldMappingEngine.autoMapPlaceholder("{size}");
    expect(res.canonicalPath).toBe("product.size");
    expect(res.status).toBe("VALID");
  });

  // 5. Discover MRP placeholder
  it("5. Discovers and auto-maps {mrp} placeholder to pricing.mrp", () => {
    const res = FieldMappingEngine.autoMapPlaceholder("{mrp}");
    expect(res.canonicalPath).toBe("pricing.mrp");
    expect(res.status).toBe("VALID");
  });

  // 6. Auto-map canonical aliases
  it("6. Auto-maps canonical aliases deterministically", () => {
    expect(FieldMappingEngine.autoMapPlaceholder("{item_name}").canonicalPath).toBe("product.name");
    expect(FieldMappingEngine.autoMapPlaceholder("{sku}").canonicalPath).toBe("product.code");
  });

  // 7. Case-insensitive mapping
  it("7. Performs case-insensitive placeholder matching", () => {
    expect(FieldMappingEngine.autoMapPlaceholder("{BRAND}").canonicalPath).toBe("product.brand");
    expect(FieldMappingEngine.autoMapPlaceholder("{Style_Code}").canonicalPath).toBe("product.style_code");
  });

  // 8. Brand aliases
  it("8. Resolves all brand synonym aliases (Brand, Manufacturer, mfg) to product.brand", () => {
    expect(FieldMappingEngine.autoMapPlaceholder("{Brand}").canonicalPath).toBe("product.brand");
    expect(FieldMappingEngine.autoMapPlaceholder("{manufacturer}").canonicalPath).toBe("product.brand");
    expect(FieldMappingEngine.autoMapPlaceholder("{mfg}").canonicalPath).toBe("product.brand");
  });

  // 9. Style aliases
  it("9. Resolves style synonym aliases (Style, Article Code, Model No) to product.style_code", () => {
    expect(FieldMappingEngine.autoMapPlaceholder("{article_no}").canonicalPath).toBe("product.style_code");
    expect(FieldMappingEngine.autoMapPlaceholder("{model_no}").canonicalPath).toBe("product.style_code");
  });

  // 10. Barcode aliases
  it("10. Resolves barcode synonym aliases (Barcode, EAN, GTIN) to barcode.value", () => {
    expect(FieldMappingEngine.autoMapPlaceholder("{ean}").canonicalPath).toBe("barcode.value");
    expect(FieldMappingEngine.autoMapPlaceholder("{gtin}").canonicalPath).toBe("barcode.value");
  });

  // 11. Ambiguous price mapping
  it("11. Returns AMBIGUOUS_MAPPING status for ambiguous {price} placeholder", () => {
    const res = FieldMappingEngine.autoMapPlaceholder("{price}");
    expect(res.status).toBe("AMBIGUOUS");
    expect(res.candidates).toContain("pricing.mrp");
    expect(res.candidates).toContain("pricing.price");
  });

  // 12. Unknown placeholder handling
  it("12. Preserves unknown placeholder {supplier_article_no} in UNMAPPED status without crashing", () => {
    const res = FieldMappingEngine.autoMapPlaceholder("{supplier_article_no}");
    expect(res.status).toBe("UNMAPPED");
    expect(res.canonicalPath).toBeUndefined();
  });

  // 13. Explicit user mapping
  it("13. Maps placeholder explicitly via mapField()", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Mapping Test" });
    const mapping = FieldMappingEngine.mapField(tmpl, "{custom_tag}", "product.brand");

    expect(mapping.canonicalPath).toBe("product.brand");
    expect(mapping.status).toBe("VALID");
    expect(tmpl.fieldMappings.get("{custom_tag}")).toBe("product.brand");
  });

  // 14. Remapping
  it("14. Remaps an existing mapping via remapField()", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Remap Test" });
    FieldMappingEngine.mapField(tmpl, "{style}", "product.style_code");
    expect(tmpl.fieldMappings.get("{style}")).toBe("product.style_code");

    FieldMappingEngine.remapField(tmpl, "{style}", "product.code");
    expect(tmpl.fieldMappings.get("{style}")).toBe("product.code");
  });

  // 15. Unmapping
  it("15. Unmaps a placeholder mapping cleanly via unmapField()", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Unmap Test" });
    FieldMappingEngine.mapField(tmpl, "{tag}", "product.name");
    expect(tmpl.fieldMappings.has("{tag}")).toBe(true);

    FieldMappingEngine.unmapField(tmpl, "{tag}");
    expect(tmpl.fieldMappings.has("{tag}")).toBe(false);
  });

  // 16. Required field validation
  it("16. Validates missing required fields returning MISSING_RUNTIME_VALUE", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Validation Test" });
    FieldMappingEngine.mapField(tmpl, "{required_missing}", "product.missing_attr", { required: true });

    const report = FieldMappingEngine.validateMappings(tmpl, sampleRuntimeContext);
    expect(report.isValid).toBe(false);
    expect(report.missingRequiredFields).toContain("product.missing_attr");
  });

  // 17. Optional field with default
  it("17. Resolves optional field using defaultValue when runtime value is missing", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Default Val Test" });
    const mapping = FieldMappingEngine.mapField(tmpl, "{batch}", "batch.missing_field", { required: false, defaultValue: "DEFAULT-BATCH" });

    const resolved = FieldMappingEngine.resolveValue(mapping, sampleRuntimeContext);
    expect(resolved).toBe("DEFAULT-BATCH");
  });

  // 18. Missing runtime value handling
  it("18. Returns empty string for unmapped or missing runtime values without default", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Missing Val Test" });
    const mapping = FieldMappingEngine.mapField(tmpl, "{unknown}", "", { required: false });

    const resolved = FieldMappingEngine.resolveValue(mapping, sampleRuntimeContext);
    expect(resolved).toBe("");
  });

  // 19. Runtime value resolution
  it("19. Resolves runtime values correctly from runtime context", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Runtime Res Test" });
    const mBrand = FieldMappingEngine.mapField(tmpl, "{brand}", "product.brand");
    const mMRP = FieldMappingEngine.mapField(tmpl, "{mrp}", "pricing.mrp");

    expect(FieldMappingEngine.resolveValue(mBrand, sampleRuntimeContext)).toBe("Tattly");
    expect(FieldMappingEngine.resolveValue(mMRP, sampleRuntimeContext)).toBe("1299");
  });

  // 20. Currency formatter
  it("20. Applies declarative currency formatter to numeric price value", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Currency Formatter Test" });
    const mapping = FieldMappingEngine.mapField(tmpl, "{mrp}", "pricing.mrp", { formatter: "currency" });

    expect(FieldMappingEngine.resolveValue(mapping, sampleRuntimeContext)).toBe("1299.00");
  });

  // 21. Date formatter
  it("21. Formats date values cleanly", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Date Formatter Test" });
    const mapping = FieldMappingEngine.mapField(tmpl, "{mfg_date}", "batch.mfg_date", { formatter: "date" });

    expect(FieldMappingEngine.resolveValue(mapping, sampleRuntimeContext)).toBe("2026-08-01");
  });

  // 22. Uppercase formatter
  it("22. Applies declarative uppercase formatter", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Uppercase Test" });
    const mapping = FieldMappingEngine.mapField(tmpl, "{brand}", "product.brand", { formatter: "uppercase" });

    expect(FieldMappingEngine.resolveValue(mapping, sampleRuntimeContext)).toBe("TATTLY");
  });

  // 23. Safe transform
  it("23. Applies safe declarative transforms (prefix, suffix, substring)", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Transform Test" });
    const mPrefix = FieldMappingEngine.mapField(tmpl, "{mrp}", "pricing.mrp", { transform: { type: "prefix", param1: "Rs. " } });
    const mSuffix = FieldMappingEngine.mapField(tmpl, "{mrp}", "pricing.mrp", { transform: { type: "suffix", param1: "/-" } });
    const mSub = FieldMappingEngine.mapField(tmpl, "{style}", "product.style_code", { transform: { type: "substring", param1: "0", param2: "2" } });

    expect(FieldMappingEngine.resolveValue(mPrefix, sampleRuntimeContext)).toBe("Rs. 1299");
    expect(FieldMappingEngine.resolveValue(mSuffix, sampleRuntimeContext)).toBe("1299/-");
    expect(FieldMappingEngine.resolveValue(mSub, sampleRuntimeContext)).toBe("CH");
  });

  // 24. Reject executable expressions / code injection
  it("24. SECURITY TEST: Rejects code injection strings and dangerous JavaScript expressions", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Security Test" });
    const injectionStr = "{{constructor.constructor('alert(1)')()}}";

    const mapping = FieldMappingEngine.mapField(tmpl, "{injected}", injectionStr);
    const resolved = FieldMappingEngine.resolveValue(mapping, sampleRuntimeContext);

    expect(resolved).toBe("[SECURITY REJECTED]");
  });

  // 25. Template A isolation
  it("25. Template A mappings cannot affect Template B mappings", () => {
    const tA = new UniversalPrintTemplate({ metadata: { id: "tA", name: "TA", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } });
    const tB = new UniversalPrintTemplate({ metadata: { id: "tB", name: "TB", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } });

    FieldMappingEngine.mapField(tA, "{style}", "product.style_code");
    FieldMappingEngine.mapField(tB, "{style}", "product.code");

    expect(tA.fieldMappings.get("{style}")).toBe("product.style_code");
    expect(tB.fieldMappings.get("{style}")).toBe("product.code");
  });

  // 26. Template version isolation
  it("26. Version 1 mappings remain isolated when Version 2 mappings are updated", () => {
    const v1 = new UniversalPrintTemplate({ metadata: { id: "tVer", name: "TVer", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } });
    FieldMappingEngine.mapField(v1, "{style}", "product.style_code");

    const v2 = v1.clone("tVer", "TVer V2");
    v2.bumpVersion("2.0.0");
    FieldMappingEngine.mapField(v2, "{style}", "product.attributes.article_code");

    expect(v1.fieldMappings.get("{style}")).toBe("product.style_code");
    expect(v2.fieldMappings.get("{style}")).toBe("product.attributes.article_code");
  });

  // 27. Clone isolation
  it("27. Cloned template receives an independent copy of field mappings", () => {
    const orig = new UniversalPrintTemplate({ name: "Orig" });
    FieldMappingEngine.mapField(orig, "{barcode}", "barcode.value");

    const cloned = orig.clone("cloned-id", "Cloned");
    FieldMappingEngine.mapField(cloned, "{barcode}", "barcode.serial");

    expect(orig.fieldMappings.get("{barcode}")).toBe("barcode.value");
    expect(cloned.fieldMappings.get("{barcode}")).toBe("barcode.serial");
  });

  // 28. Original PRN source preservation
  it("28. Mapping facade edits do not modify raw PRN source string", () => {
    const raw = "^XA^FD{style}^FS^XZ";
    const tmpl = new UniversalPrintTemplate({ source: { originalContent: raw, originalFormat: "ZPL" } });

    FieldMappingEngine.mapField(tmpl, "{style}", "product.style_code");
    expect(tmpl.source.originalContent).toBe(raw);
  });

  // 29. Tattly {barcode} mapping
  it("29. Maps Tattly fixture placeholder {barcode} to barcode.value", () => {
    const res = FieldMappingEngine.autoMapPlaceholder("{barcode}");
    expect(res.canonicalPath).toBe("barcode.value");
  });

  // 30. Tattly {style} mapping
  it("30. Maps Tattly fixture placeholder {style} to product.style_code", () => {
    const res = FieldMappingEngine.autoMapPlaceholder("{style}");
    expect(res.canonicalPath).toBe("product.style_code");
  });

  // 31. Tattly {color} mapping
  it("31. Maps Tattly fixture placeholder {color} to product.color", () => {
    const res = FieldMappingEngine.autoMapPlaceholder("{color}");
    expect(res.canonicalPath).toBe("product.color");
  });

  // 32. Tattly {size} mapping
  it("32. Maps Tattly fixture placeholder {size} to product.size", () => {
    const res = FieldMappingEngine.autoMapPlaceholder("{size}");
    expect(res.canonicalPath).toBe("product.size");
  });

  // 33. Tattly {mrp} mapping
  it("33. Maps Tattly fixture placeholder {mrp} to pricing.mrp", () => {
    const res = FieldMappingEngine.autoMapPlaceholder("{mrp}");
    expect(res.canonicalPath).toBe("pricing.mrp");
  });

  // 34. Tattly {pkd_date} mapping
  it("34. Maps Tattly fixture placeholder {mfg_date} / {pkd_date} to batch.mfg_date", () => {
    const res = FieldMappingEngine.autoMapPlaceholder("{mfg_date}");
    expect(res.canonicalPath).toBe("batch.mfg_date");
  });

  // 35. Multiple PRN templates with different placeholder names
  it("35. Supports multiple templates using completely different placeholder tag names", () => {
    const tA = new UniversalPrintTemplate({ name: "Apparel Template" });
    const tB = new UniversalPrintTemplate({ name: "Pharma Template" });

    FieldMappingEngine.mapField(tA, "{article}", "product.style_code");
    FieldMappingEngine.mapField(tB, "{batch_no}", "batch.number");

    expect(tA.fieldMappings.has("{article}")).toBe(true);
    expect(tB.fieldMappings.has("{batch_no}")).toBe(true);
  });

  // 36. Zero hardcoded Tattly mapping
  it("36. Operates without any hardcoded Tattly template dependencies", () => {
    const res = FieldMappingEngine.autoMapPlaceholder("{arbitrary_vendor_code}");
    expect(res.status).toBe("UNMAPPED");
  });

  // 37. Zero global mapping state
  it("37. Field mappings do not pollute global state", () => {
    const t1 = new UniversalPrintTemplate({ name: "T1" });
    FieldMappingEngine.mapField(t1, "{custom}", "product.name");

    const t2 = new UniversalPrintTemplate({ name: "T2" });
    expect(t2.fieldMappings.has("{custom}")).toBe(false);
  });

  // 38. Empty registry compatibility
  it("38. Handles empty runtime context gracefully returning empty/default values", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Empty Context Test" });
    const mapping = FieldMappingEngine.mapField(tmpl, "{brand}", "product.brand", { defaultValue: "GENERIC" });

    const resolved = FieldMappingEngine.resolveValue(mapping, {});
    expect(resolved).toBe("GENERIC");
  });

  // 39. Deterministic auto-mapping
  it("39. Produces deterministic auto-mapping results for identical input tags", () => {
    const r1 = FieldMappingEngine.autoMapPlaceholder("{brand}");
    const r2 = FieldMappingEngine.autoMapPlaceholder("{brand}");

    expect(r1.canonicalPath).toBe(r2.canonicalPath);
    expect(r1.confidence).toBe(r2.confidence);
  });

  // 40. Deterministic ambiguity detection
  it("40. Detects ambiguous fields deterministically across invocations", () => {
    const r1 = FieldMappingEngine.autoMapPlaceholder("{price}");
    const r2 = FieldMappingEngine.autoMapPlaceholder("{price}");

    expect(r1.status).toBe("AMBIGUOUS");
    expect(r2.status).toBe("AMBIGUOUS");
    expect(r1.candidates).toEqual(r2.candidates);
  });
});
