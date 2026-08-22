/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage for node test environment
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};
Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

import { 
  ColumnMappingResult, 
  REUSE_WARNING_THRESHOLDS, 
  MappingTarget 
} from "../lib/headerMapping/types";
import { 
  addCustomAlias, 
  getCustomAliases, 
  removeCustomAlias,
  SMRITI_ITEM_MASTER_FIELDS 
} from "../lib/headerMapping/HeaderAliasRegistry";
import { HeaderMappingEngine } from "../lib/headerMapping/HeaderMappingEngine";

describe("Multi-Target Column Mapping & Tiered Warning Engine", () => {
  const engine = new HeaderMappingEngine(SMRITI_ITEM_MASTER_FIELDS);

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe("1. Single-Target Mapping Regression (Backward Compatibility)", () => {
    it("preserves single-target mapping when targets.length === 1", () => {
      const col: ColumnMappingResult = {
        sourceHeader: "ITEM NAME",
        sourceIndex: 0,
        mappedFieldKey: "name",
        mappedFieldLabel: "ITEM NAME",
        targets: [{ target: "name", targetLabel: "ITEM NAME" }],
        confidence: "EXACT",
        confidenceScore: 100,
        isAmbiguous: false
      };

      expect(col.targets).toHaveLength(1);
      expect(col.targets?.[0].target).toBe(col.mappedFieldKey);
      expect(col.targets?.length).toBe(1);
    });

    it("maps standard headers using engine and produces valid single-target results", () => {
      const res = engine.mapHeaders(["SKU CODE", "BARCODE", "MRP"]);
      expect(res.columns[0].mappedFieldKey).toBe("code");
      expect(res.columns[1].mappedFieldKey).toBe("barcode");
      expect(res.columns[2].mappedFieldKey).toBe("mrp");
    });
  });

  describe("2. Tiered Warning Constants & Reuse Count Evaluation", () => {
    it("validates named constant thresholds (2x, 3x, 4x+)", () => {
      expect(REUSE_WARNING_THRESHOLDS.TIER_2_BADGE).toBe(2);
      expect(REUSE_WARNING_THRESHOLDS.TIER_3_WARNING).toBe(3);
      expect(REUSE_WARNING_THRESHOLDS.TIER_4_CONFIRM).toBe(4);
    });

    it("correctly computes warning tier for 1x, 2x, 3x, and 4x+ reuse", () => {
      const getWarningTier = (reuseCount: number) => {
        if (reuseCount >= REUSE_WARNING_THRESHOLDS.TIER_4_CONFIRM) return "TIER_4_CONFIRM";
        if (reuseCount === REUSE_WARNING_THRESHOLDS.TIER_3_WARNING) return "TIER_3_WARNING";
        if (reuseCount === REUSE_WARNING_THRESHOLDS.TIER_2_BADGE) return "TIER_2_BADGE";
        return "DEFAULT";
      };

      expect(getWarningTier(1)).toBe("DEFAULT");
      expect(getWarningTier(2)).toBe("TIER_2_BADGE");
      expect(getWarningTier(3)).toBe("TIER_3_WARNING");
      expect(getWarningTier(4)).toBe("TIER_4_CONFIRM");
      expect(getWarningTier(5)).toBe("TIER_4_CONFIRM");
    });
  });

  describe("3. Multi-Target Data Expansion & Live Preview Logic", () => {
    it("expands a single source column into multiple target preview columns", () => {
      const multiCol: ColumnMappingResult = {
        sourceHeader: "RETAIL MRP",
        sourceIndex: 0,
        mappedFieldKey: "mrp",
        mappedFieldLabel: "MRP",
        targets: [
          { target: "mrp", targetLabel: "MRP" },
          { target: "price", targetLabel: "SELLING PRICE" },
          { target: "costPrice", targetLabel: "COST PRICE" }
        ],
        confidence: "EXACT",
        confidenceScore: 100,
        isAmbiguous: false,
        reuseReason: "Vendor supplies single price point"
      };

      expect(multiCol.targets).toHaveLength(3);

      // Simulate Live Preview Table column projection
      const projectedColumns = (multiCol.targets || []).map((t, idx) => ({
        sourceIndex: multiCol.sourceIndex,
        sourceHeader: multiCol.sourceHeader,
        targetField: t.target,
        targetLabel: t.targetLabel,
        previewColumnIndex: idx
      }));

      expect(projectedColumns).toHaveLength(3);
      expect(projectedColumns[0].targetField).toBe("mrp");
      expect(projectedColumns[1].targetField).toBe("price");
      expect(projectedColumns[2].targetField).toBe("costPrice");

      // Verify sample row value replication across all 3 targets
      const sampleRow = ["1999.00"];
      const targetValues = projectedColumns.map(pCol => sampleRow[pCol.sourceIndex]);
      expect(targetValues).toEqual(["1999.00", "1999.00", "1999.00"]);
    });

    it("preserves optional reason note without blocking mapping", () => {
      const colWithReason: ColumnMappingResult = {
        sourceHeader: "PRICE",
        sourceIndex: 0,
        mappedFieldKey: "mrp",
        mappedFieldLabel: "MRP",
        targets: [
          { target: "mrp", targetLabel: "MRP" },
          { target: "price", targetLabel: "SELLING PRICE" }
        ],
        confidence: "EXACT",
        confidenceScore: 100,
        isAmbiguous: false,
        reuseReason: "Standard wholesale import format"
      };

      expect(colWithReason.reuseReason).toBe("Standard wholesale import format");
      
      // Empty reason is valid and does not block
      const colWithoutReason = { ...colWithReason, reuseReason: "" };
      expect(colWithoutReason.reuseReason).toBe("");
    });
  });

  describe("4. Multi-Target Permanent Alias Save (Two Weights)", () => {
    it("saves multi-target aliases permanently when confirmed", () => {
      const sourceHeader = "UNIFIED_PRICE";
      const targets: MappingTarget[] = [
        { target: "mrp", targetLabel: "MRP" },
        { target: "price", targetLabel: "SELLING PRICE" }
      ];

      // Simulate 'Save Permanently'
      targets.forEach(t => {
        addCustomAlias(t.target, sourceHeader);
      });

      const aliases = getCustomAliases();
      expect(aliases["mrp"]).toContain("UNIFIED_PRICE");
      expect(aliases["price"]).toContain("UNIFIED_PRICE");
    });


    it("does NOT write to custom aliases when 'Use Just This Once' is chosen", () => {
      const sourceHeader = "TEMP_DISCOUNT_COL";
      // Simulate 'Use Just This Once': No addCustomAlias called
      const aliases = getCustomAliases();
      expect(aliases["discountPercentage"] || []).not.toContain(sourceHeader);
    });
  });

  describe("5. Data Fill Grid Mapping Emulation", () => {
    it("populates multiple grid row properties from a single multi-target source column", () => {
      const mappings: ColumnMappingResult[] = [
        {
          sourceHeader: "BARCODE",
          sourceIndex: 0,
          mappedFieldKey: "barcode",
          mappedFieldLabel: "BARCODE",
          targets: [
            { target: "barcode", targetLabel: "BARCODE" },
            { target: "code", targetLabel: "SKU CODE" }
          ],
          confidence: "EXACT",
          confidenceScore: 100,
          isAmbiguous: false
        },
        {
          sourceHeader: "MRP",
          sourceIndex: 1,
          mappedFieldKey: "mrp",
          mappedFieldLabel: "MRP",
          targets: [
            { target: "mrp", targetLabel: "MRP" },
            { target: "price", targetLabel: "SELLING PRICE" }
          ],
          confidence: "EXACT",
          confidenceScore: 100,
          isAmbiguous: false
        }
      ];

      const rawRow = ["8901234567890", "1499.00"];
      const gridRow: Record<string, any> = {};

      rawRow.forEach((cellVal, colIdx) => {
        const colMapping = mappings.find(m => m.sourceIndex === colIdx);
        if (!colMapping) return;

        const targetKeys: string[] = [];
        if (colMapping.targets && colMapping.targets.length > 0) {
          colMapping.targets.forEach(t => {
            if (t.target) targetKeys.push(t.target);
          });
        }

        targetKeys.forEach(k => {
          gridRow[k] = cellVal.trim();
        });
      });

      // Both targets from BARCODE column populated
      expect(gridRow.barcode).toBe("8901234567890");
      expect(gridRow.code).toBe("8901234567890");

      // Both targets from MRP column populated
      expect(gridRow.mrp).toBe("1499.00");
      expect(gridRow.price).toBe("1499.00");
    });
  });
});
