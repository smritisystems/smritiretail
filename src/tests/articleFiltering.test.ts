/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.77.0
 * Created      : 2026-10-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal / Purchase Order & Item Grid Auto-Filtering Engine Unit Tests
 */

import { describe, it, expect } from "vitest";
import {
  buildArticleCatalogIndex,
  getAvailableArticles,
  getAvailableColorsForArticle,
  getAvailableSizesForArticleAndColor,
  resolveVariantFromIndex,
  resolveByBarcodeOrSkuFromIndex,
  getArticleSummaryFromIndex,
} from "../components/purchase/articleFiltering.ts";
import type { Product } from "../types.ts";

const MOCK_PRODUCTS: Product[] = [
  // Article CH-13-C (Colors: BLACK, BRONZE. Sizes: 36, 37, 38)
  {
    id: "prod-1",
    code: "CH-13-C-BLACK-36",
    barcode: "8904551002389",
    name: "TATLD ETHNIC CHAPPAL, BLACK, 36",
    price: 2499,
    stock: 10,
    category: "Footwear",
    styleCode: "CH-13-C",
    color: "BLACK",
    size: "36",
    costPrice: 500,
    mrp: 2499,
    brand: "Tattly",
  },
  {
    id: "prod-2",
    code: "CH-13-C-BLACK-37",
    barcode: "8904551002396",
    name: "TATLD ETHNIC CHAPPAL, BLACK, 37",
    price: 2499,
    stock: 15,
    category: "Footwear",
    styleCode: "CH-13-C",
    color: "BLACK",
    size: "37",
    costPrice: 500,
    mrp: 2499,
    brand: "Tattly",
  },
  {
    id: "prod-3",
    code: "CH-13-C-BLACK-38",
    barcode: "8904551002402",
    name: "TATLD ETHNIC CHAPPAL, BLACK, 38",
    price: 2499,
    stock: 20,
    category: "Footwear",
    styleCode: "CH-13-C",
    color: "BLACK",
    size: "38",
    costPrice: 500,
    mrp: 2499,
    brand: "Tattly",
  },
  {
    id: "prod-4",
    code: "CH-13-C-BRONZE-38",
    barcode: "8904551002471",
    name: "TATLD ETHNIC CHAPPAL, BRONZE, 38",
    price: 2499,
    stock: 5,
    category: "Footwear",
    styleCode: "CH-13-C",
    color: "BRONZE",
    size: "38",
    costPrice: 500,
    mrp: 2499,
    brand: "Tattly",
  },
  // Article CH-01-A (Colors: CREAM, PEACH. Sizes: 36, 40)
  {
    id: "prod-5",
    code: "CH-01-ACREAM36",
    barcode: "8904551000002",
    name: "TATLD FORMAL CHAPPAL, CREAM, 36",
    price: 1899,
    stock: 8,
    category: "Footwear",
    styleCode: "CH-01-A",
    color: "CREAM",
    size: "36",
    costPrice: 375,
    mrp: 1899,
    brand: "Tattly",
  },
  {
    id: "prod-6",
    code: "CH-01-APEACH40",
    barcode: "8904551000118",
    name: "TATLD FORMAL CHAPPAL, PEACH, 40",
    price: 1899,
    stock: 12,
    category: "Footwear",
    styleCode: "CH-01-A",
    color: "PEACH",
    size: "40",
    costPrice: 375,
    mrp: 1899,
    brand: "Tattly",
  },
];

describe("Article-Based Auto-Filtering Engine", () => {
  const index = buildArticleCatalogIndex(MOCK_PRODUCTS);

  it("extracts and indexes unique articles", () => {
    const articles = getAvailableArticles(index);
    expect(articles).toContain("CH-13-C");
    expect(articles).toContain("CH-01-A");
    expect(articles).toHaveLength(2);
  });

  it("filters query search on articles", () => {
    const matched = getAvailableArticles(index, "13-c");
    expect(matched).toEqual(["CH-13-C"]);
  });

  it("filters colors strictly associated with the selected article", () => {
    // For CH-13-C: only BLACK and BRONZE
    const colors13 = getAvailableColorsForArticle(index, "CH-13-C");
    expect(colors13).toEqual(["BLACK", "BRONZE"]);
    expect(colors13).not.toContain("CREAM");
    expect(colors13).not.toContain("PEACH");

    // For CH-01-A: only CREAM and PEACH
    const colors01 = getAvailableColorsForArticle(index, "CH-01-A");
    expect(colors01).toEqual(["CREAM", "PEACH"]);
    expect(colors01).not.toContain("BLACK");
    expect(colors01).not.toContain("BRONZE");
  });

  it("filters sizes strictly associated with the selected article and color", () => {
    // For (CH-13-C, BLACK): 36, 37, 38
    const sizesBlack = getAvailableSizesForArticleAndColor(index, "CH-13-C", "BLACK");
    expect(sizesBlack).toEqual(["36", "37", "38"]);

    // For (CH-13-C, BRONZE): only 38
    const sizesBronze = getAvailableSizesForArticleAndColor(index, "CH-13-C", "BRONZE");
    expect(sizesBronze).toEqual(["38"]);

    // For (CH-01-A, PEACH): only 40
    const sizesPeach = getAvailableSizesForArticleAndColor(index, "CH-01-A", "PEACH");
    expect(sizesPeach).toEqual(["40"]);
  });

  it("resolves the exact variant product when size is selected", () => {
    const variant = resolveVariantFromIndex(index, "CH-13-C", "BLACK", "38");
    expect(variant).toBeDefined();
    expect(variant?.barcode).toBe("8904551002402");
    expect(variant?.code).toBe("CH-13-C-BLACK-38");
    expect(variant?.costPrice).toBe(500);
    expect(variant?.mrp).toBe(2499);
  });

  it("performs reverse resolution by barcode or SKU", () => {
    // By Barcode
    const fromBarcode = resolveByBarcodeOrSkuFromIndex(index, "8904551000118");
    expect(fromBarcode).toBeDefined();
    expect(fromBarcode?.article).toBe("CH-01-A");
    expect(fromBarcode?.color).toBe("PEACH");
    expect(fromBarcode?.size).toBe("40");

    // By SKU
    const fromSku = resolveByBarcodeOrSkuFromIndex(index, "CH-13-C-BLACK-36");
    expect(fromSku).toBeDefined();
    expect(fromSku?.article).toBe("CH-13-C");
    expect(fromSku?.color).toBe("BLACK");
    expect(fromSku?.size).toBe("36");
  });

  it("returns article summary details", () => {
    const summary = getArticleSummaryFromIndex(index, "CH-13-C");
    expect(summary).toBeDefined();
    expect(summary?.brand).toBe("Tattly");
    expect(summary?.costPrice).toBe(500);
    expect(summary?.mrp).toBe(2499);
    expect(summary?.availableColors).toEqual(["BLACK", "BRONZE"]);
  });

  it("handles unknown or invalid inputs defensively without throwing", () => {
    expect(getAvailableColorsForArticle(index, "UNKNOWN-ART")).toEqual([]);
    expect(getAvailableSizesForArticleAndColor(index, "UNKNOWN-ART", "RED")).toEqual([]);
    expect(resolveVariantFromIndex(index, "UNKNOWN", "RED", "99")).toBeUndefined();
    expect(resolveByBarcodeOrSkuFromIndex(index, "INVALID_BARCODE")).toBeUndefined();
  });
});
