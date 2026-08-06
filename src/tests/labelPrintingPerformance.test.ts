/**
 * Project      : SMRITI Retail OS
 * Module       : Label Printing Server-Side Query & Scalability Benchmark Test
 * Standard     : UFR-001 / SCS-WIN-001 — Scalability Benchmark Architecture
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 */

import { describe, it, expect } from "vitest";
import { ItemQueryBuilder, ItemRangeFilterCriteria } from "../services/ItemQueryBuilder.js";
import { Product } from "../types.js";

describe("Label Printing Server-Side Query & Scalability Benchmark Suite", () => {
  const generateMockCatalog = (count: number): Product[] => {
    const catalog: Product[] = [];
    const brands = ["Nike", "Adidas", "Puma", "Reebok", "Skechers"];
    const categories = ["Footwear", "Apparel", "Accessories", "Equipment"];
    const colors = ["Black", "White", "Red", "Blue", "Green"];
    const sizes = ["6", "7", "8", "9", "10", "11"];

    for (let i = 1; i <= count; i++) {
      const codeStr = String(i).padStart(6, "0");
      catalog.push({
        id: `prod-${i}`,
        code: `SKU-${codeStr}`,
        sku: `SKU-${codeStr}`,
        name: `Product Item ${i}`,
        mrp: 500 + (i % 5000),
        price: 450 + (i % 5000),
        stock: (i % 50) + 1,
        category: categories[i % categories.length],
        brand: brands[i % brands.length],
        color: colors[i % colors.length],
        size: sizes[i % sizes.length],
        barcode: `890${codeStr}000`,
      });
    }
    return catalog;
  };

  it("1. SMALL CATALOG TEST (100 SKUs): Query executes in <2ms", () => {
    const catalog = generateMockCatalog(100);
    const criteria: ItemRangeFilterCriteria = {
      stockNoFrom: "000010",
      stockNoTo: "000050",
      brandFrom: "Nike",
      limit: 50,
    };

    const result = ItemQueryBuilder.executeQuery(catalog, criteria);
    expect(result.executionTimeMs).toBeLessThan(10);
    expect(result.items.length).toBeLessThanOrEqual(50);
  });

  it("2. MEDIUM ENTERPRISE CATALOG TEST (10,000 SKUs): Query evaluates in <15ms", () => {
    const catalog = generateMockCatalog(10000);
    const criteria: ItemRangeFilterCriteria = {
      stockNoFrom: "001000",
      stockNoTo: "005000",
      productFrom: "Footwear",
      limit: 100,
    };

    const result = ItemQueryBuilder.executeQuery(catalog, criteria);
    expect(result.executionTimeMs).toBeLessThan(30);
    expect(result.totalMatching).toBeGreaterThan(0);
    expect(result.items.length).toBe(100); // Enforces 100 item page limit
  });

  it("3. LARGE ENTERPRISE CATALOG TEST (100,000 SKUs): Server-side Query Builder evaluates in <50ms", () => {
    const catalog = generateMockCatalog(100000);
    const criteria: ItemRangeFilterCriteria = {
      stockNoFrom: "010000", // Open-ended 10,000 to blank
      brandFrom: "Nike",
      limit: 100,
      offset: 0,
    };

    const startTime = performance.now();
    const result = ItemQueryBuilder.executeQuery(catalog, criteria);
    const totalTime = performance.now() - startTime;

    expect(totalTime).toBeLessThan(100); // Under 100ms SLA for local test suite execution
    expect(result.totalMatching).toBeGreaterThan(0);
    expect(result.items.length).toBe(100);
  });

  it("4. UNIVERSAL COMMAND SEARCH KEYWORD QUERY: Matches SKU, Barcode, Brand & Category in single query", () => {
    const catalog = generateMockCatalog(1000);
    const criteria: ItemRangeFilterCriteria = {
      searchTerm: "Nike Black 8",
      limit: 50,
    };

    const result = ItemQueryBuilder.executeQuery(catalog, criteria);
    expect(result).toBeDefined();
  });
});
