import { describe, it, expect } from "vitest";
import { UniversalAttributeEngine, CANONICAL_ATTRIBUTES } from "../core/metadata/attributes/UniversalAttributeEngine";

describe("SMRITI Canonical Attribute Registry & Column Deduplication Tests", () => {
  it("TEST 1: Core = Brand, Dynamic = Brand Name resolves to 1 canonical key BRAND", () => {
    const coreKey = UniversalAttributeEngine.resolveCanonicalKey("Brand");
    const dynamicKey = UniversalAttributeEngine.resolveCanonicalKey("Brand Name");
    expect(coreKey).toBe("BRAND");
    expect(dynamicKey).toBe("BRAND");
    expect(coreKey).toBe(dynamicKey);
  });

  it("TEST 2: Core = Product Style Code, Dynamic = Style resolves to 1 canonical key STYLE_CODE", () => {
    const coreKey = UniversalAttributeEngine.resolveCanonicalKey("Product Style Code");
    const dynamicKey = UniversalAttributeEngine.resolveCanonicalKey("Style");
    expect(coreKey).toBe("STYLE_CODE");
    expect(dynamicKey).toBe("STYLE_CODE");
    expect(coreKey).toBe(dynamicKey);
  });

  it("TEST 3: Core = Brand, Dynamic = Brand Name, Dynamic = Manufacturer collapse to single canonical BRAND set", () => {
    const labels = ["Brand", "Brand Name", "Manufacturer"];
    const canonicalSet = new Set(labels.map(l => UniversalAttributeEngine.resolveCanonicalKey(l)));
    expect(canonicalSet.size).toBe(1);
    expect(canonicalSet.has("BRAND")).toBe(true);
  });

  it("TEST 4: Footwear Business Model resolves STYLE_CODE display label as Product Style Code / Style", () => {
    const apparelLabel = UniversalAttributeEngine.getDisplayLabel("STYLE_CODE", "apparel");
    const electronicsLabel = UniversalAttributeEngine.getDisplayLabel("STYLE_CODE", "electronics");
    expect(apparelLabel).toBe("Style Code");
    expect(electronicsLabel).toBe("Model Number");
  });

  it("TEST 5: Import Header Alias Resolution maps BRAND NAME -> BRAND and STYLE/ARTICLE CODE -> STYLE_CODE", () => {
    expect(UniversalAttributeEngine.resolveCanonicalKey("BRAND NAME")).toBe("BRAND");
    expect(UniversalAttributeEngine.resolveCanonicalKey("STYLE/ARTICLE CODE")).toBe("STYLE_CODE");
    expect(UniversalAttributeEngine.resolveCanonicalKey("Article Code")).toBe("STYLE_CODE");
  });

  it("TEST 6: Variant dimensions remain explicitly COLOR and SIZE", () => {
    const colorMeta = UniversalAttributeEngine.getCanonicalMetadata("COLOR");
    const sizeMeta = UniversalAttributeEngine.getCanonicalMetadata("SIZE");
    const brandMeta = UniversalAttributeEngine.getCanonicalMetadata("BRAND");

    expect(colorMeta?.isVariantDimension).toBe(true);
    expect(sizeMeta?.isVariantDimension).toBe(true);
    expect(brandMeta?.isVariantDimension).toBe(false);
  });
});
