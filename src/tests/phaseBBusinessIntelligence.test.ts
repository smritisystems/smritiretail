/**
 * Project      : SMRITI Retail OS v7.0
 * Module       : Phase B Business Intelligence & MDQE Tests
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect } from "vitest";
import { MDQE } from "../kernel/ule/MasterDataQualityEngine.js";
import { ItemService } from "../kernel/internal/ItemService.js";
import { Product } from "../types.js";

describe("Phase B: Master Data Quality Engine (MDQE) & Business Intelligence", () => {
  const completeProduct: Product = {
    id: "prod-full-1",
    code: "SKU-999999",
    sku: "SKU-999999",
    name: "Classic Silk Festive Saree",
    category: "Apparel",
    brand: "Smriti Heritage",
    mrp: 14999,
    price: 12999,
    costPrice: 8500,
    hsnCode: "50072010",
    stock: 25,
    stock_qty: 25,
    min_stock_level: 5,
    warehouse: "Central WH-01",
    barcode: "8908888777666",
    status: "Active",
    primaryImageUrl: "/images/saree-front.webp",
    galleryImages: ["/images/saree-back.webp"],
    attributes: {
      preferred_supplier: "Heritage Weavers Pvt Ltd",
      defaultLabelTemplate: "75x50mm"
    }
  };

  const incompleteProduct: Product = {
    id: "prod-inc-1",
    code: "SKU-000001",
    sku: "SKU-000001",
    name: "Draft Unfinished Sample",
    category: "General",
    price: 0,
    mrp: 0,
    stock: 0,
    barcode: "",
    status: "Draft"
  };

  it("Evaluates pristine product master with high score and A+ grade", () => {
    const result = MDQE.evaluateProduct(completeProduct);
    expect(result.overallScore).toBeGreaterThanOrEqual(85);
    expect(result.grade).toMatch(/A\+|A/);
    expect(result.categoryBreakdown.basicInfo).toBeGreaterThan(0);
    expect(result.categoryBreakdown.pricing).toBeGreaterThan(0);
  });

  it("Evaluates incomplete product with missing gaps checklist", () => {
    const result = MDQE.evaluateProduct(incompleteProduct);
    expect(result.overallScore).toBeLessThan(50);
    expect(result.hasCriticalGaps).toBe(true);
    expect(result.missingGaps.length).toBeGreaterThan(0);

    const hasBarcodeGap = result.missingGaps.some((g) => g.field === "barcode");
    expect(hasBarcodeGap).toBe(true);
  });

  it("Validates POS billing guardrails via ItemService.validateStatus()", () => {
    const service = new ItemService();

    const allowedRes = service.validateStatus(completeProduct);
    expect(allowedRes.allowed).toBe(true);

    const draftRes = service.validateStatus(incompleteProduct);
    expect(draftRes.allowed).toBe(false);
    expect(draftRes.reason).toContain("DRAFT");
  });
});
