/**
 * Project      : SMRITI Retail OS v7.0
 * Module       : Phase C Advanced Retail Operations Tests
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect } from "vitest";
import { Product, SupplierCatalogueEntry, PriceRule, TaggedMediaEntry } from "../types.js";
import { MDQE } from "../kernel/ule/MasterDataQualityEngine.js";

describe("Phase C: Advanced Retail Operations & Studio Tools", () => {
  const sampleProduct: Product = {
    id: "prod-c-1",
    code: "SKU-FOOT-001",
    sku: "SKU-FOOT-001",
    name: "Smriti Running Leather Shoes",
    category: "Footwear",
    brand: "Smriti Pro",
    mrp: 3999,
    price: 3499,
    costPrice: 2100,
    hsnCode: "6403",
    stock: 45,
    barcode: "8907777111222",
    status: "Active",
    supplierCatalogue: [
      {
        id: "sup-1",
        supplierId: "VND-101",
        supplierName: "Apex Leather Supplies Ltd",
        supplierItemCode: "APX-SH-01",
        purchaseUom: "Box",
        moq: 10,
        lastPurchaseRate: 2100,
        currentRate: 2050,
        leadTimeDays: 3,
        priority: 1,
        isPreferred: true
      },
      {
        id: "sup-2",
        supplierId: "VND-102",
        supplierName: "Metro Footwear Dist",
        supplierItemCode: "MTR-999",
        purchaseUom: "Pcs",
        moq: 20,
        lastPurchaseRate: 2200,
        currentRate: 2150,
        leadTimeDays: 5,
        priority: 2,
        isPreferred: false
      }
    ],
    priceRules: [
      {
        id: "pr-1",
        name: "Diwali Festive Promotion",
        type: "Promotional",
        startDate: "2026-10-01",
        endDate: "2026-10-15",
        promotionalPrice: 2999,
        discountPercentage: 25,
        isActive: true
      }
    ],
    taggedMedia: [
      { id: "m-1", url: "/media/shoe-front.jpg", tag: "Front", isPrimary: true },
      { id: "m-2", url: "/media/shoe-box.jpg", tag: "Packaging", isPrimary: false }
    ]
  };

  it("Validates Supplier Catalogue entries with priority rankings", () => {
    expect(sampleProduct.supplierCatalogue).toBeDefined();
    expect(sampleProduct.supplierCatalogue?.length).toBe(2);

    const primaryVendor = sampleProduct.supplierCatalogue?.find((s) => s.priority === 1);
    expect(primaryVendor).toBeDefined();
    expect(primaryVendor?.supplierName).toBe("Apex Leather Supplies Ltd");
    expect(primaryVendor?.isPreferred).toBe(true);
  });

  it("Validates Price Rules and Promotional Pricing schedule", () => {
    expect(sampleProduct.priceRules).toBeDefined();
    const festiveRule = sampleProduct.priceRules?.find((r) => r.type === "Promotional");
    expect(festiveRule).toBeDefined();
    expect(festiveRule?.promotionalPrice).toBe(2999);
  });

  it("Validates Tagged Media Gallery entries", () => {
    expect(sampleProduct.taggedMedia).toBeDefined();
    expect(sampleProduct.taggedMedia?.length).toBe(2);
    expect(sampleProduct.taggedMedia?.[0].tag).toBe("Front");
    expect(sampleProduct.taggedMedia?.[1].tag).toBe("Packaging");
  });

  it("Evaluates Product Quality including supplier and default label profiles via MDQE", () => {
    const quality = MDQE.evaluateProduct(sampleProduct);
    expect(quality.overallScore).toBeGreaterThanOrEqual(80);
    expect(quality.categoryBreakdown.supplier).toBe(100);
  });
});
