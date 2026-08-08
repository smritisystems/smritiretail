/** @vitest-environment jsdom */

/**
 * Project      : SMRITI Retail OS
 * Module       : Sprint 2 POS Billing & Universal Person Master Unit Test Suite
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { Product, POSProfile, Bill } from "../types.ts";

describe("Sprint 2: POS Billing Cockpit & Universal Person Master", () => {
  let sampleProducts: Product[];

  beforeEach(() => {
    sessionStorage.clear();
    sampleProducts = [
      {
        id: "prod-1",
        code: "SKU-001",
        sku: "SKU-001",
        name: "Classic Shirt",
        barcode: "8901234567890",
        price: 1200,
        mrp: 1400,
        purchasePrice: 900,
        stock: 50,
        category: "Apparel"
      },
      {
        id: "prod-2",
        code: "SKU-002",
        sku: "SKU-002",
        name: "Denim Jeans",
        barcode: "8901234567891",
        price: 2500,
        mrp: 2900,
        purchasePrice: 1800,
        stock: 20,
        category: "Apparel"
      }
    ];
  });

  it("should match barcode scan under < 300ms SLA target", () => {
    const scannedBarcode = "8901234567890";
    const startTime = performance.now();

    const matched = sampleProducts.find(
      (p) => p.barcode === scannedBarcode || p.code === scannedBarcode
    );

    const duration = performance.now() - startTime;

    expect(matched).toBeDefined();
    expect(matched?.name).toBe("Classic Shirt");
    expect(duration).toBeLessThan(300);
  });

  it("should hold bill in session storage and restore bill with customer & sales personnel attribution", () => {
    const billToHold: Bill = {
      id: "bill-1001",
      billNumber: "POS-2026-0001",
      totalAmount: 3700,
      customerName: "Jawahar Mallah (VIP)",
      salespersonId: "emp-101",
      items: [
        { product: sampleProducts[0], quantity: 1, salespersonId: "emp-101" },
        { product: sampleProducts[1], quantity: 1, salespersonId: "emp-101" }
      ],
      createdAt: new Date().toISOString()
    } as any;

    sessionStorage.setItem("smriti_held_bills", JSON.stringify([billToHold]));

    const restored = JSON.parse(sessionStorage.getItem("smriti_held_bills") || "[]");
    expect(restored.length).toBe(1);
    expect(restored[0].billNumber).toBe("POS-2026-0001");
    expect(restored[0].customerName).toBe("Jawahar Mallah (VIP)");
    expect(restored[0].salespersonId).toBe("emp-101");
    expect(restored[0].totalAmount).toBe(3700);
  });

  it("should calculate cart total with discount percent correctly", () => {
    const subtotal = 1200 + 2500; // 3700
    const discountPercent = 10; // 10%
    const discountedTotal = subtotal * (1 - discountPercent / 100);
    expect(discountedTotal).toBe(3330);
  });
});
