/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.50
 * Created      : 2026-10-09
 * Modified     : 2026-10-09 (v6.70.50 — Test suite for Catalog Date Filtering, Import Batch Isolation, and Barcode Label Queue)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ImportBatchManager, ImportBatchRecord } from "../services/importBatchManager.ts";
import { Product } from "../types.ts";

// Mock localStorage for headless tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

describe("SMRITI Item Master — Date Filtering & Import Batch Isolation Suite", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe("1. ImportBatchManager Storage & Retrieval", () => {
    it("records new import batch and retrieves it as latest batch", () => {
      const sampleBatch = ImportBatchManager.recordBatch({
        batchId: "batch-test-001",
        savedCount: 50,
        createdCount: 45,
        skippedCount: 5,
        failedCount: 0,
        itemCodes: ["ART-1001-BLK-42", "ART-1001-BLK-43"],
        barcodes: ["8901234567890", "8901234567891"],
        summary: "Batch (50 items) • 14:40",
      });

      expect(sampleBatch.batchId).toBe("batch-test-001");
      expect(sampleBatch.savedCount).toBe(50);
      expect(sampleBatch.timestamp).toBeDefined();

      const latest = ImportBatchManager.getLatestBatch();
      expect(latest).not.toBeNull();
      expect(latest?.batchId).toBe("batch-test-001");
      expect(latest?.itemCodes).toHaveLength(2);
    });

    it("maintains most recent 10 batches in chronological order", () => {
      for (let i = 1; i <= 15; i++) {
        ImportBatchManager.recordBatch({
          batchId: `batch-${i}`,
          savedCount: i * 5,
          createdCount: i * 5,
          skippedCount: 0,
          failedCount: 0,
          itemCodes: [`CODE-${i}`],
          barcodes: [`BARCODE-${i}`],
          summary: `Batch ${i}`,
        });
      }

      const recent = ImportBatchManager.getRecentBatches();
      expect(recent).toHaveLength(10);
      expect(recent[0].batchId).toBe("batch-15");
      expect(recent[9].batchId).toBe("batch-6");
    });

    it("clears all batches cleanly", () => {
      ImportBatchManager.recordBatch({
        batchId: "batch-to-clear",
        savedCount: 10,
        createdCount: 10,
        skippedCount: 0,
        failedCount: 0,
        itemCodes: ["X1"],
        barcodes: ["B1"],
        summary: "Clear Test",
      });

      expect(ImportBatchManager.getRecentBatches()).toHaveLength(1);
      ImportBatchManager.clearAllBatches();
      expect(ImportBatchManager.getRecentBatches()).toHaveLength(0);
      expect(ImportBatchManager.getLatestBatch()).toBeNull();
    });
  });

  describe("2. Date-Based Catalog Filtering Logic", () => {
    const now = new Date();
    const todayISO = now.toISOString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString();

    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoISO = threeDaysAgo.toISOString();

    const tenDaysAgo = new Date(now);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const tenDaysAgoISO = tenDaysAgo.toISOString();

    const testProducts: Product[] = [
      { id: "p1", code: "P1", name: "Product Today", price: 100, stock: 10, category: "Footwear", barcode: "BC1", createdAt: todayISO },
      { id: "p2", code: "P2", name: "Product Yesterday", price: 200, stock: 5, category: "Footwear", barcode: "BC2", createdAt: yesterdayISO },
      { id: "p3", code: "P3", name: "Product 3 Days Ago", price: 300, stock: 8, category: "Footwear", barcode: "BC3", createdAt: threeDaysAgoISO },
      { id: "p4", code: "P4", name: "Product 10 Days Ago", price: 400, stock: 2, category: "Footwear", barcode: "BC4", createdAt: tenDaysAgoISO },
    ];

    function filterByDate(products: Product[], filterType: string, customStart?: string, customEnd?: string): Product[] {
      return products.filter(p => {
        if (filterType === "ALL") return true;
        const ts = p.createdAt || p.created_at;
        if (!ts) return false;
        const d = new Date(ts);
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const itemDayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        if (filterType === "TODAY") {
          return itemDayStart.getTime() === todayStart.getTime();
        }
        if (filterType === "YESTERDAY") {
          const yest = new Date(todayStart);
          yest.setDate(yest.getDate() - 1);
          return itemDayStart.getTime() === yest.getTime();
        }
        if (filterType === "LAST_7_DAYS") {
          const sevenDaysAgo = new Date(todayStart);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
          return itemDayStart.getTime() >= sevenDaysAgo.getTime() && itemDayStart.getTime() <= todayStart.getTime();
        }
        if (filterType === "CUSTOM") {
          if (customStart && d < new Date(customStart)) return false;
          if (customEnd && d > new Date(customEnd + "T23:59:59")) return false;
          return true;
        }
        return true;
      });
    }

    it("filters products created TODAY accurately", () => {
      const res = filterByDate(testProducts, "TODAY");
      expect(res.map(p => p.id)).toEqual(["p1"]);
    });

    it("filters products created YESTERDAY accurately", () => {
      const res = filterByDate(testProducts, "YESTERDAY");
      expect(res.map(p => p.id)).toEqual(["p2"]);
    });

    it("filters products created in LAST 7 DAYS (includes Today, Yesterday, and 3 Days ago)", () => {
      const res = filterByDate(testProducts, "LAST_7_DAYS");
      expect(res.map(p => p.id)).toEqual(["p1", "p2", "p3"]);
      expect(res.find(p => p.id === "p4")).toBeUndefined();
    });

    it("filters products by custom date range", () => {
      const startDate = threeDaysAgo.toISOString().slice(0, 10);
      const endDate = yesterday.toISOString().slice(0, 10);
      const res = filterByDate(testProducts, "CUSTOM", startDate, endDate);
      expect(res.map(p => p.id)).toEqual(["p2", "p3"]);
    });
  });

  describe("3. Just-Imported Batch Isolation & Barcode Queue Extraction", () => {
    const batch: ImportBatchRecord = {
      batchId: "batch-footwear-50",
      timestamp: new Date().toISOString(),
      savedCount: 3,
      createdCount: 3,
      skippedCount: 0,
      failedCount: 0,
      itemCodes: ["SKU-001", "SKU-002", "SKU-003"],
      barcodes: ["890001", "890002", "890003"],
      summary: "Footwear 50 Items Batch",
    };

    const catalog: Product[] = [
      { id: "1", code: "SKU-001", name: "Apex Derby 41", price: 2499, stock: 10, category: "Footwear", barcode: "890001", mrp: 2999 },
      { id: "2", code: "SKU-002", name: "Apex Derby 42", price: 2499, stock: 12, category: "Footwear", barcode: "890002", mrp: 2999 },
      { id: "3", code: "SKU-003", name: "Apex Derby 43", price: 2499, stock: 8, category: "Footwear", barcode: "890003", mrp: 2999 },
      { id: "4", code: "OLD-001", name: "Old Loafer", price: 1500, stock: 2, category: "Footwear", barcode: "890999", mrp: 1999 },
      { id: "5", code: "OLD-002", name: "Old Sneaker", price: 1200, stock: 4, category: "Footwear", barcode: "890998", mrp: 1599 },
    ];

    it("isolates only the items belonging to the active import batch", () => {
      const codeSet = new Set(batch.itemCodes);
      const isolated = catalog.filter(p => codeSet.has(p.code));
      expect(isolated).toHaveLength(3);
      expect(isolated.map(p => p.code)).toEqual(["SKU-001", "SKU-002", "SKU-003"]);
    });

    it("extracts valid barcodes and commercial metadata for thermal label print spool", () => {
      const codeSet = new Set(batch.itemCodes);
      const isolated = catalog.filter(p => codeSet.has(p.code));

      const printableBarcodes = isolated.map(p => ({
        sku: p.code,
        barcode: p.barcode,
        title: p.name,
        mrp: p.mrp,
        price: p.price,
      }));

      expect(printableBarcodes).toHaveLength(3);
      expect(printableBarcodes[0].barcode).toBe("890001");
      expect(printableBarcodes[0].mrp).toBe(2999);
      expect(printableBarcodes[0].price).toBe(2499);
    });
  });
});
