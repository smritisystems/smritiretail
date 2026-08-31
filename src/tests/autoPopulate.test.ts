/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.9.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Test Suite   : Universal Backend Auto-Populate & Typeahead Verification
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  searchBackendCustomers,
  searchBackendProducts,
  searchHsnCodes
} from "../services/autoPopulateService.ts";
import { Product } from "../types.ts";

describe("Universal Backend Auto-Populate & Typeahead Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return auto-populated customer records matching query string with commercial policy attributes", async () => {
    const results = await searchBackendCustomers("Reliance");
    expect(results.length).toBeGreaterThan(0);
    const reliance = results.find(r => r.name.includes("Reliance"));
    expect(reliance).toBeDefined();
    expect(reliance?.id).toBe("cust-rrl-192b561d");
    expect(reliance?.priceGroupCode).toBeDefined();
    expect(reliance?.creditDays).toBeGreaterThan(0);
    expect(reliance?.creditLimit).toBeGreaterThan(0);
  });

  it("should match customer by mobile number", async () => {
    const results = await searchBackendCustomers("9876543210");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("Rahul Sharma");
  });

  it("should match customer by customer code / id", async () => {
    const results = await searchBackendCustomers("CUST-002");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("Super Textiles Ltd");
  });

  it("should auto-populate product details from local product list as user types SKU / barcode / name", async () => {
    const mockProducts: Product[] = [
      {
        id: "prod-101",
        code: "TSHIRT-BLK-M",
        barcode: "8901234567890",
        name: "Classic Cotton Black T-Shirt",
        category: "Apparel",
        sellingPrice: 799,
        mrp: 999,
        costPrice: 400,
        gstPercentage: 12,
        hsnCode: "6109",
        brand: "Smriti Classics",
        size: "M",
        color: "Black",
        uom: "Pcs",
        stock: 50
      },
      {
        id: "prod-102",
        code: "JEANS-SLIM-32",
        barcode: "8909876543210",
        name: "Denim Slim Fit Jeans",
        category: "Apparel",
        sellingPrice: 1999,
        mrp: 2499,
        costPrice: 1100,
        gstPercentage: 12,
        hsnCode: "6203",
        brand: "Smriti Denim",
        size: "32",
        color: "Indigo",
        uom: "Pcs",
        stock: 25
      }
    ];

    // Search by SKU code
    const skuMatches = await searchBackendProducts("TSHIRT", mockProducts);
    expect(skuMatches.length).toBe(1);
    expect(skuMatches[0].name).toBe("Classic Cotton Black T-Shirt");
    expect(skuMatches[0].sellingPrice).toBe(799);
    expect(skuMatches[0].hsnCode).toBe("6109");

    // Search by Barcode
    const barcodeMatches = await searchBackendProducts("8909876543210", mockProducts);
    expect(barcodeMatches.length).toBe(1);
    expect(barcodeMatches[0].code).toBe("JEANS-SLIM-32");
    expect(barcodeMatches[0].sellingPrice).toBe(1999);
  });

  it("should return comprehensive 14+ item identifiers and related details from either Stock No or Barcode", async () => {
    const mockProductsWithMeta: any[] = [
      {
        id: "prod-201",
        code: "STK-SHIRT-01",
        sku: "SKU-SLIM-SHT-40",
        style_code: "STK-SHIRT-01",
        barcode: "8904445556667",
        name: "Premium Oxford Formal Shirt",
        category: "Formal Wear",
        sellingPrice: 1499,
        mrp: 1999,
        costPrice: 750,
        gstPercentage: 5,
        hsnCode: "6205",
        brand: "SMRITI Heritage",
        size: "40",
        color: "Sky Blue",
        uom: "Pcs",
        stock: 38,
        pricingMode: "Fixed",
        trackingMode: "Standard",
        weightGrams: 280,
        primaryImageUrl: "https://assets.smriti.com/shirt.jpg"
      }
    ];

    // 1. Search via Stock No / SKU field
    const byStockNo = await searchBackendProducts("STK-SHIRT-01", mockProductsWithMeta);
    expect(byStockNo.length).toBe(1);
    const item1 = byStockNo[0];
    expect(item1.barcode).toBe("8904445556667");
    expect(item1.stockNo).toBe("STK-SHIRT-01");
    expect(item1.sku).toBe("SKU-SLIM-SHT-40");
    expect(item1.code).toBe("STK-SHIRT-01");
    expect(item1.name).toBe("Premium Oxford Formal Shirt");
    expect(item1.mrp).toBe(1999);
    expect(item1.sellingPrice).toBe(1499);
    expect(item1.costPrice).toBe(750);
    expect(item1.stockQty).toBe(38);
    expect(item1.size).toBe("40");
    expect(item1.color).toBe("Sky Blue");
    expect(item1.gstPercentage).toBe(5);
    expect(item1.brand).toBe("SMRITI Heritage");
    expect(item1.category).toBe("Formal Wear");
    expect(item1.hsnCode).toBe("6205");
    expect(item1.pricingMode).toBe("Fixed");
    expect(item1.trackingMode).toBe("Standard");
    expect(item1.weightGrams).toBe(280);

    // 2. Search via Barcode No field
    const byBarcode = await searchBackendProducts("8904445556667", mockProductsWithMeta);
    expect(byBarcode.length).toBe(1);
    const item2 = byBarcode[0];
    expect(item2.barcode).toBe("8904445556667");
    expect(item2.stockNo).toBe("STK-SHIRT-01");
    expect(item2.sellingPrice).toBe(1499);
    expect(item2.stockQty).toBe(38);
  });

  it("should auto-populate HSN description and tax rate", () => {
    const hsnResults = searchHsnCodes("6203");
    expect(hsnResults.length).toBe(1);
    expect(hsnResults[0].code).toBe("6203");
    expect(hsnResults[0].gstRate).toBe(5);
    expect(hsnResults[0].description).toContain("Suits");
  });
});
