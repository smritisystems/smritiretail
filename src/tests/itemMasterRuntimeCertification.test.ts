import { describe, it, expect } from "vitest";
import { UniversalAttributeEngine, CANONICAL_ATTRIBUTES } from "../core/metadata/attributes/UniversalAttributeEngine";
import { generateSkuCode } from "../lib/skuGenerator";

describe("SMRITI Item Master Runtime Certification & Attribute Governance Suite V2", () => {
  // Scenario 1: Brand Aliases -> One Visible Column
  it("SCENARIO 1: Certifies Brand aliases deduplicate to exactly one visible column", () => {
    const rawColumns = [
      { canonicalKey: "BRAND", label: "Brand" },
      { canonicalKey: "BRAND", label: "Brand Name" },
      { canonicalKey: "BRAND", label: "Manufacturer" }
    ];
    const deduplicated = UniversalAttributeEngine.resolveDeduplicatedColumns(rawColumns, "apparel");
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].canonicalKey).toBe("BRAND");
    expect(deduplicated[0].label).toBe("Brand");
  });

  // Scenario 2: Style Aliases -> One Visible Column
  it("SCENARIO 2: Certifies Style aliases deduplicate to exactly one visible column", () => {
    const rawColumns = [
      { canonicalKey: "STYLE_CODE", label: "Style Code" },
      { canonicalKey: "STYLE_CODE", label: "Article Code" },
      { canonicalKey: "STYLE_CODE", label: "Model Number" }
    ];
    const deduplicated = UniversalAttributeEngine.resolveDeduplicatedColumns(rawColumns, "footwear");
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].canonicalKey).toBe("STYLE_CODE");
    expect(deduplicated[0].label).toBe("Article Code");
  });

  // Scenario 3: Cost Price Aliases -> One Visible Column
  it("SCENARIO 3: Certifies Cost Price aliases deduplicate to exactly one visible column", () => {
    const rawColumns = [
      { canonicalKey: "COST_PRICE", label: "Buy Cost" },
      { canonicalKey: "COST_PRICE", label: "Cost Price" },
      { canonicalKey: "COST_PRICE", label: "Buying Price" }
    ];
    const deduplicated = UniversalAttributeEngine.resolveDeduplicatedColumns(rawColumns);
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].canonicalKey).toBe("COST_PRICE");
  });

  // Scenario 4: Selling Price Aliases -> One Visible Column
  it("SCENARIO 4: Certifies Selling Price aliases deduplicate to exactly one visible column", () => {
    const rawColumns = [
      { canonicalKey: "SELLING_PRICE", label: "Selling Price" },
      { canonicalKey: "SELLING_PRICE", label: "Price" },
      { canonicalKey: "SELLING_PRICE", label: "Plate Rate" }
    ];
    const deduplicated = UniversalAttributeEngine.resolveDeduplicatedColumns(rawColumns);
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].canonicalKey).toBe("SELLING_PRICE");
  });

  // Scenario 5: GST Aliases -> One Visible Column
  it("SCENARIO 5: Certifies GST aliases deduplicate to exactly one visible column", () => {
    const rawColumns = [
      { canonicalKey: "GST_RATE", label: "GST %" },
      { canonicalKey: "GST_RATE", label: "Tax" },
      { canonicalKey: "GST_RATE", label: "GST Percentage" }
    ];
    const deduplicated = UniversalAttributeEngine.resolveDeduplicatedColumns(rawColumns);
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].canonicalKey).toBe("GST_RATE");
  });

  // Scenario 6: Footwear Terminology
  it("SCENARIO 6: Certifies Footwear terminology resolves STYLE_CODE to Article Code", () => {
    expect(UniversalAttributeEngine.getDisplayLabel("STYLE_CODE", "footwear")).toBe("Article Code");
  });

  // Scenario 7: Apparel Terminology
  it("SCENARIO 7: Certifies Apparel terminology resolves STYLE_CODE to Style Code", () => {
    expect(UniversalAttributeEngine.getDisplayLabel("STYLE_CODE", "apparel")).toBe("Style Code");
  });

  // Scenario 8: Electronics Terminology
  it("SCENARIO 8: Certifies Electronics terminology resolves STYLE_CODE to Model Number", () => {
    expect(UniversalAttributeEngine.getDisplayLabel("STYLE_CODE", "electronics")).toBe("Model Number");
  });

  // Scenario 9: Jewellery Terminology
  it("SCENARIO 9: Certifies Jewellery terminology resolves STYLE_CODE to Design / Style No", () => {
    expect(UniversalAttributeEngine.getDisplayLabel("STYLE_CODE", "jewellery")).toBe("Design / Style No");
  });

  // Scenario 10: Medical Terminology
  it("SCENARIO 10: Certifies Medical terminology resolves STYLE_CODE to Item Code", () => {
    expect(UniversalAttributeEngine.getDisplayLabel("STYLE_CODE", "medical")).toBe("Item Code");
  });

  // Scenario 11: Duplicate Canonical Key Detection Invariant
  it("SCENARIO 11: Certifies grid column registry pseudo-invariant new Set(keys).size === columns.length", () => {
    const rawColumns = [
      { canonicalKey: "BRAND", label: "Brand" },
      { canonicalKey: "BRAND", label: "Brand Name" },
      { canonicalKey: "STYLE_CODE", label: "Style Code" },
      { canonicalKey: "COLOR", label: "Color" },
      { canonicalKey: "SIZE", label: "Size" }
    ];
    const columns = UniversalAttributeEngine.resolveDeduplicatedColumns(rawColumns, "apparel");
    const keys = columns.map(c => c.canonicalKey);
    expect(new Set(keys).size).toBe(columns.length);
  });

  // Scenario 12: Excel Import Alias Normalization
  it("SCENARIO 12: Certifies Excel import headers normalize to canonical keys", () => {
    const rawHeaders1 = ["Brand Name", "Article Code", "Color", "Size"];
    const canonical1 = rawHeaders1.map(h => UniversalAttributeEngine.resolveCanonicalKey(h));
    expect(canonical1).toEqual(["BRAND", "STYLE_CODE", "COLOR", "SIZE"]);

    const rawHeaders2 = ["Manufacturer", "Model Number", "Color", "Size"];
    const canonical2 = rawHeaders2.map(h => UniversalAttributeEngine.resolveCanonicalKey(h));
    expect(canonical2).toEqual(["BRAND", "STYLE_CODE", "COLOR", "SIZE"]);
  });

  // Scenario 13: Two Aliases in Same Import -> Deterministic Validation Error
  it("SCENARIO 13: Certifies two aliases for same canonical key in same import triggers DUPLICATE_CANONICAL_COLUMN error", () => {
    const duplicateHeaders = ["Brand Name", "Brand", "Color", "Size"];
    const res = UniversalAttributeEngine.validateDuplicateCanonicalHeaders(duplicateHeaders);
    expect(res.valid).toBe(false);
    expect(res.duplicateError).toContain("DUPLICATE_CANONICAL_COLUMN");
    expect(res.duplicateError).toContain("Brand");
    expect(res.duplicateError).toContain("BRAND");

    const duplicateStyleHeaders = ["Style Code", "Article Code", "Color", "Size"];
    const resStyle = UniversalAttributeEngine.validateDuplicateCanonicalHeaders(duplicateStyleHeaders);
    expect(resStyle.valid).toBe(false);
    expect(resStyle.duplicateError).toContain("DUPLICATE_CANONICAL_COLUMN");
    expect(resStyle.duplicateError).toContain("STYLE_CODE");
  });

  // Scenario 14: Variant Dimensions Remain Unique & Separate from Parent Identity
  it("SCENARIO 14: Certifies variant dimensions (COLOR, SIZE) are separate from parent identity (BRAND, STYLE_CODE)", () => {
    const colorMeta = UniversalAttributeEngine.getCanonicalMetadata("COLOR");
    const sizeMeta = UniversalAttributeEngine.getCanonicalMetadata("SIZE");
    const brandMeta = UniversalAttributeEngine.getCanonicalMetadata("BRAND");
    const styleMeta = UniversalAttributeEngine.getCanonicalMetadata("STYLE_CODE");

    expect(colorMeta?.isVariantDimension).toBe(true);
    expect(sizeMeta?.isVariantDimension).toBe(true);
    expect(brandMeta?.isVariantDimension).toBe(false);
    expect(styleMeta?.isVariantDimension).toBe(false);
  });
});
