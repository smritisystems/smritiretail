/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.75.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProPosMasterCatalogCache } from "../sync/ProPosMasterCatalogCache";
import * as apiFetchModule from "../lib/apiFetchV1";

describe("ProPOS Edge Master Catalog Cache & Sub-Millisecond Scanner Lookup", () => {
  beforeEach(() => {
    ProPosMasterCatalogCache.clearCache();
    vi.restoreAllMocks();
  });

  it("STEP 1: should index products and resolve primary/secondary barcodes instantly", () => {
    ProPosMasterCatalogCache.seedProducts([
      {
        id: "prod-01",
        code: "SKU-SHIRT-M",
        name: "Slim Fit Linen Shirt - Medium",
        barcode: "8901234567890",
        barcodes: ["EAN-8901234567890", "ALT-SHIRT-01"],
        category: "Menswear",
        price: 1899.0,
        mrp: 2499.0,
        tax_rate: 5.0,
        hsn_code: "6205.20",
        stock: 45,
        is_active: true,
      },
      {
        id: "prod-02",
        code: "SKU-JEANS-32",
        name: "Denim Straight Jeans - 32",
        barcode: "8909876543210",
        category: "Bottomwear",
        price: 2799.0,
        mrp: 3499.0,
        tax_rate: 12.0,
        is_active: true,
      },
    ]);

    // Primary barcode lookup
    const foundPrimary = ProPosMasterCatalogCache.lookupByBarcode("8901234567890");
    expect(foundPrimary).not.toBeNull();
    expect(foundPrimary?.id).toBe("prod-01");
    expect(foundPrimary?.price).toBe(1899.0);

    // Secondary / Alias barcode lookup
    const foundSecondary = ProPosMasterCatalogCache.lookupByBarcode("alt-shirt-01");
    expect(foundSecondary).not.toBeNull();
    expect(foundSecondary?.id).toBe("prod-01");

    // Product code lookup
    const foundCode = ProPosMasterCatalogCache.lookupByBarcode("sku-jeans-32");
    expect(foundCode).not.toBeNull();
    expect(foundCode?.id).toBe("prod-02");

    // Unknown barcode
    const notFound = ProPosMasterCatalogCache.lookupByBarcode("0000000000000");
    expect(notFound).toBeNull();
  });

  it("STEP 2: should perform high-speed fuzzy search across names, categories, and codes", () => {
    ProPosMasterCatalogCache.seedProducts([
      { id: "1", code: "P-1", name: "Cotton Casual Shirt", category: "Apparel", price: 999, mrp: 1299, tax_rate: 5, is_active: true },
      { id: "2", code: "P-2", name: "Silk Formal Shirt", category: "Apparel", price: 2999, mrp: 3999, tax_rate: 5, is_active: true },
      { id: "3", code: "P-3", name: "Leather Formal Shoes", category: "Footwear", price: 4500, mrp: 5500, tax_rate: 18, is_active: true },
      { id: "4", code: "P-4", name: "Inactive Test Item", category: "Misc", price: 100, mrp: 100, tax_rate: 5, is_active: false },
    ]);

    const resultsShirt = ProPosMasterCatalogCache.searchProducts("shirt");
    expect(resultsShirt.length).toBe(2);
    expect(resultsShirt.map((r) => r.id)).toEqual(["1", "2"]);

    const resultsFootwear = ProPosMasterCatalogCache.searchProducts("footwear");
    expect(resultsFootwear.length).toBe(1);
    expect(resultsFootwear[0].id).toBe("3");

    // Inactive items must not be returned
    const resultsInactive = ProPosMasterCatalogCache.searchProducts("inactive");
    expect(resultsInactive.length).toBe(0);
  });

  it("STEP 3: should index and lookup customers by phone number, name, or GSTIN", () => {
    ProPosMasterCatalogCache.seedCustomers([
      {
        id: "cust-01",
        name: "Rajesh Kumar",
        phone: "+91 98765-43210",
        email: "rajesh@retailcorp.in",
        gstin: "27AABCT3518Q1Z4",
        outstanding_balance: 14500.0,
        loyalty_points: 340,
        credit_limit: 50000.0,
      },
    ]);

    // Lookup by phone digits
    const byPhone = ProPosMasterCatalogCache.lookupCustomer("9876543210");
    expect(byPhone).not.toBeNull();
    expect(byPhone?.id).toBe("cust-01");
    expect(byPhone?.name).toBe("Rajesh Kumar");

    // Lookup by GSTIN
    const byGstin = ProPosMasterCatalogCache.lookupCustomer("27AABCT3518Q1Z4");
    expect(byGstin).not.toBeNull();
    expect(byGstin?.id).toBe("cust-01");

    // Lookup by Name
    const byName = ProPosMasterCatalogCache.lookupCustomer("Rajesh");
    expect(byName).not.toBeNull();
    expect(byName?.id).toBe("cust-01");
  });

  it("STEP 4: should sync and hydrate master catalog from FastAPI backend", async () => {
    vi.spyOn(apiFetchModule, "apiFetchV1").mockImplementation(async (path: string) => {
      if (path.includes("/products")) {
        return {
          items: [
            { id: "api-p1", code: "API-SKU-1", name: "Hydrated T-Shirt", price: 499, mrp: 699, tax_rate: 5, barcode: "999888777111" },
            { id: "api-p2", code: "API-SKU-2", name: "Hydrated Jeans", price: 1499, mrp: 1999, tax_rate: 12, barcode: "999888777222" },
          ],
        };
      }
      if (path.includes("/crm/customers")) {
        return {
          items: [
            { id: "api-c1", name: "Ananya Sharma", phone: "+919123456789", points: 150 },
          ],
        };
      }
      return {};
    });

    const stats = await ProPosMasterCatalogCache.syncCatalogFromServer("COMP-001", "BR-001");
    expect(stats.product_count).toBe(2);
    expect(stats.customer_count).toBe(1);
    expect(stats.last_synced_at).not.toBeNull();

    const lookupProd = ProPosMasterCatalogCache.lookupByBarcode("999888777111");
    expect(lookupProd?.name).toBe("Hydrated T-Shirt");

    const lookupCust = ProPosMasterCatalogCache.lookupCustomer("9123456789");
    expect(lookupCust?.name).toBe("Ananya Sharma");
  });
});
