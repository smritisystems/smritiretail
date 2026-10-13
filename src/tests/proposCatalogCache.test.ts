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

  it("STEP 5: should resolve temporal offline price across scheduled intervals with fallback safeguards", () => {
    const baseDate = new Date("2026-10-15T12:00:00Z");
    const product = {
      id: "prod-temp-01",
      code: "SKU-TEMP-01",
      name: "Scheduled Price Footwear",
      price: 1200.0, // baseline
      mrp: 1500.0,
      tax_rate: 5.0,
      is_active: true,
      revisions: [
        {
          revision_id: "rev-past",
          price: 1000.0,
          mrp: 1400.0,
          effective_from: "2026-10-10T00:00:00Z",
          effective_to: "2026-10-15T00:00:00Z",
        },
        {
          revision_id: "rev-current",
          price: 1300.0,
          mrp: 1600.0,
          effective_from: "2026-10-15T00:00:00Z",
          effective_to: "2026-10-20T00:00:00Z",
        },
        {
          revision_id: "rev-future",
          price: 1450.0,
          mrp: 1700.0,
          effective_from: "2026-10-20T00:00:00Z",
          effective_to: null,
        },
      ],
      last_synced_at: "2026-10-15T08:00:00Z",
    };

    // 1. Transaction in the past interval: should resolve rev-past
    const pastRes = ProPosMasterCatalogCache.resolveEffectiveProductPrice(
      product,
      new Date("2026-10-12T10:00:00Z")
    );
    expect(pastRes.price).toBe(1000.0);
    expect(pastRes.mrp).toBe(1400.0);
    expect(pastRes.source).toBe("REVISION_HISTORY");
    expect(pastRes.revision_id).toBe("rev-past");

    // 2. Transaction in current active interval: should resolve rev-current
    const currentRes = ProPosMasterCatalogCache.resolveEffectiveProductPrice(
      product,
      new Date("2026-10-15T14:30:00Z")
    );
    expect(currentRes.price).toBe(1300.0);
    expect(currentRes.mrp).toBe(1600.0);
    expect(currentRes.source).toBe("REVISION_HISTORY");
    expect(currentRes.revision_id).toBe("rev-current");

    // 3. Before future revision activates: future price must NOT leak prematurely
    expect(currentRes.price).not.toBe(1450.0);

    // 4. At future revision timestamp: should resolve rev-future
    const futureRes = ProPosMasterCatalogCache.resolveEffectiveProductPrice(
      product,
      new Date("2026-10-20T00:00:01Z")
    );
    expect(futureRes.price).toBe(1450.0);
    expect(futureRes.mrp).toBe(1700.0);
    expect(futureRes.revision_id).toBe("rev-future");

    // 5. Fallback without revisions: uses baseline price
    const plainProduct = {
      id: "prod-plain-01",
      code: "SKU-PLAIN",
      name: "Plain Product",
      price: 500.0,
      mrp: 600.0,
      tax_rate: 5.0,
      is_active: true,
    };
    const plainRes = ProPosMasterCatalogCache.resolveEffectiveProductPrice(plainProduct, baseDate);
    expect(plainRes.price).toBe(500.0);
    expect(plainRes.mrp).toBe(600.0);
    expect(plainRes.source).toBe("ACTIVE_BASELINE");

    // 6. Statutory ceiling clamping guard: price cannot exceed mrp
    const corruptedProduct = {
      id: "prod-corrupt-01",
      code: "SKU-CORRUPT",
      name: "Corrupt Rates",
      price: 900.0, // illegal: > mrp
      mrp: 800.0,
      tax_rate: 5.0,
      is_active: true,
    };
    const clampedRes = ProPosMasterCatalogCache.resolveEffectiveProductPrice(corruptedProduct, baseDate);
    expect(clampedRes.price).toBe(800.0); // clamped to mrp

    // 7. Stale cache detection (> 7 days)
    const staleProduct = {
      ...plainProduct,
      last_synced_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    };
    const staleRes = ProPosMasterCatalogCache.resolveEffectiveProductPrice(staleProduct, new Date());
    expect(staleRes.is_stale_warning).toBe(true);
    expect(staleRes.source).toBe("STALE_FALLBACK");
  });
});
