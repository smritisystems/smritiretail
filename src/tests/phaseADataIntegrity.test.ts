/**
 * Project      : SMRITI Retail OS v7.0
 * Module       : Phase A Data Integrity Tests
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect } from "vitest";
import { findPotentialDuplicates, validateBarcodeUniqueness, calculateSimilarity } from "../utils/duplicateDetector.js";
import { ItemService } from "../kernel/internal/ItemService.js";
import { Product } from "../types.js";

describe("Phase A: Master Data Integrity Engine", () => {
  const sampleProducts: Product[] = [
    {
      id: "prod-1",
      code: "SKU-100001",
      sku: "SKU-100001",
      name: "Nike Air Zoom Running Shoes",
      barcode: "8901234567890",
      secondaryBarcodes: ["8901234567899"],
      category: "Footwear",
      brand: "Nike",
      price: 4999,
      mrp: 5999,
      stock: 50,
      status: "Active"
    },
    {
      id: "prod-2",
      code: "SKU-100002",
      sku: "SKU-100002",
      name: "Adidas Ultraboost Sneaker",
      barcode: "8909876543210",
      category: "Footwear",
      brand: "Adidas",
      price: 8999,
      mrp: 9999,
      stock: 10,
      status: "Inactive"
    },
    {
      id: "prod-3",
      code: "SKU-100003",
      sku: "SKU-100003",
      name: "Puma Classic Leather Belt",
      barcode: "8905555444333",
      category: "Accessories",
      brand: "Puma",
      price: 999,
      mrp: 1299,
      stock: 0,
      status: "Blocked"
    }
  ];

  it("Enforces duplicate barcode detection on primary and secondary barcodes", () => {
    // Primary barcode duplicate
    const check1 = validateBarcodeUniqueness("8901234567890", sampleProducts);
    expect(check1.isUnique).toBe(false);
    expect(check1.conflict?.product.id).toBe("prod-1");
    expect(check1.conflict?.location).toBe("Primary");

    // Secondary barcode duplicate
    const check2 = validateBarcodeUniqueness("8901234567899", sampleProducts);
    expect(check2.isUnique).toBe(false);
    expect(check2.conflict?.product.id).toBe("prod-1");
    expect(check2.conflict?.location).toBe("Secondary");

    // New unique barcode
    const check3 = validateBarcodeUniqueness("8907777888999", sampleProducts);
    expect(check3.isUnique).toBe(true);
  });

  it("Detects fuzzy duplicate item names", () => {
    const similarity = calculateSimilarity("Nike Air Zoom Running Shoes", "Nike Air Zoom Running Shoe");
    expect(similarity).toBeGreaterThanOrEqual(80);

    const matches = findPotentialDuplicates("Nike Air Zoom Running Shoe", sampleProducts);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].product?.id).toBe("prod-1");
  });

  it("Validates lifecycle status rules via ItemService.validateStatus()", () => {
    const service = new ItemService();

    const activeCheck = service.validateStatus(sampleProducts[0]);
    expect(activeCheck.allowed).toBe(true);

    const inactiveCheck = service.validateStatus(sampleProducts[1]);
    expect(inactiveCheck.allowed).toBe(false);
    expect(inactiveCheck.reason).toContain("INACTIVE");

    const blockedCheck = service.validateStatus(sampleProducts[2]);
    expect(blockedCheck.allowed).toBe(false);
    expect(blockedCheck.reason).toContain("BLOCKED");

    const draftCheck = service.validateStatus({ name: "Draft Item", status: "Draft" });
    expect(draftCheck.allowed).toBe(false);
    expect(draftCheck.reason).toContain("DRAFT");
  });

  it("Rejects saving items with duplicate barcodes in ItemService", async () => {
    const service = new ItemService();
    // Pre-populate service local cache
    await service.save(sampleProducts[0]);

    // Try saving another item with the exact same barcode
    await expect(
      service.save({
        name: "New Counterfeit Shoe",
        barcode: "8901234567890", // Same as sampleProducts[0]
        price: 1000
      })
    ).rejects.toThrow(/DUPLICATE BARCODE REJECTED/);
  });
});
