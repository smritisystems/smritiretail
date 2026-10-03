/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.49.0
 * Created      : 2026-09-30
 * Modified     : 2026-09-30
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import { documentSeriesConfig } from "../components/global/configs/documentSeries.con";

describe("Document Series & Numbering Studio Configuration", () => {
  it("should have correct API endpoint, title, and metadata", () => {
    expect(documentSeriesConfig.apiEndpoint).toBe("/api/v1/numbering/series");
    expect(documentSeriesConfig.entityName).toBe("Document Series");
    expect(documentSeriesConfig.idKey).toBe("id");
    expect(documentSeriesConfig.columns.length).toBeGreaterThan(0);
    expect(documentSeriesConfig.fields.length).toBeGreaterThan(0);
  });

  describe("Category Field Dynamic Behavior", () => {
    const categoryField = documentSeriesConfig.fields.find((f) => f.name === "category");

    it("should define category field with dynamic showWhen condition", () => {
      expect(categoryField).toBeDefined();
      expect(categoryField?.type).toBe("select");
      expect(categoryField?.required).toBe(true);
      expect(categoryField?.showWhen).toBeDefined();
    });

    it("should show category ONLY when documentType is ARTICLE", () => {
      expect(categoryField?.showWhen?.({ documentType: "ARTICLE" })).toBe(true);
      expect(categoryField?.showWhen?.({ documentType: "Retail Invoice" })).toBe(false);
      expect(categoryField?.showWhen?.({ documentType: "Tax Invoice" })).toBe(false);
      expect(categoryField?.showWhen?.({ documentType: "Purchase Order" })).toBe(false);
      expect(categoryField?.showWhen?.({ documentType: "Sales Return" })).toBe(false);
    });

    it("should correctly transform category lookup options", () => {
      const mockRawData = [
        { code: "sandal", name: "Sandal" },
        { code: "shoes", name: "Shoes" }
      ];
      const transformed = categoryField?.transformOptions?.(mockRawData);
      expect(transformed).toEqual([
        { label: "Sandal", value: "SANDAL" },
        { label: "Shoes", value: "SHOES" }
      ]);
    });
  });

  describe("Current Sequence Number Access Controls", () => {
    const currentNumField = documentSeriesConfig.fields.find((f) => f.name === "currentNumber");

    it("should disable currentNumber during edit mode to prevent sequence tampering", () => {
      expect(currentNumField).toBeDefined();
      if (typeof currentNumField?.disabled === "function") {
        expect(currentNumField.disabled({}, true)).toBe(true);
        expect(currentNumField.disabled({}, false)).toBe(false);
      } else {
        expect(currentNumField?.disabled).toBe(true);
      }
    });
  });

  describe("Custom Validation Logic", () => {
    const validate = documentSeriesConfig.customValidation!;

    it("should fail validation if startNumber is less than 1 or invalid", () => {
      const result = validate(
        { documentType: "ARTICLE", category: "SANDAL", startNumber: 0, currentNumber: 0 },
        []
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes("Start Number"))).toBe(true);
    });

    it("should fail validation if endNumber is less than startNumber", () => {
      const result = validate(
        { documentType: "ARTICLE", category: "SANDAL", startNumber: 10000, endNumber: 9999, currentNumber: 5000 },
        []
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes("End Number"))).toBe(true);
    });

    it("should fail validation if currentNumber >= endNumber", () => {
      const result = validate(
        { documentType: "ARTICLE", category: "SANDAL", startNumber: 10000, endNumber: 19999, currentNumber: 20000 },
        []
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes("Current Counter"))).toBe(true);
    });

    it("should fail validation if category is missing for ARTICLE series", () => {
      const result = validate(
        { documentType: "ARTICLE", category: "", startNumber: 10000, endNumber: 19999, currentNumber: 9999 },
        []
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes("Category is required"))).toBe(true);
    });

    it("should pass validation for valid SANDAL configuration", () => {
      const result = validate(
        {
          documentType: "ARTICLE",
          category: "SANDAL",
          prefix: "SND-",
          startNumber: 10000,
          endNumber: 19999,
          currentNumber: 9999,
          suffix: "-A",
          runningLength: 5,
          isActive: true
        },
        []
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect overlapping active range for same category", () => {
      const existingSeries = [
        {
          id: "SER-ART-SANDAL-001",
          name: "Article Sandal Series",
          documentType: "ARTICLE",
          category: "SANDAL",
          startNumber: 10000,
          endNumber: 19999,
          currentNumber: 9999,
          isActive: true
        }
      ];

      // Overlapping range [15000 - 25000] with existing [10000 - 19999] for category SANDAL
      const resultOverlap = validate(
        {
          documentType: "ARTICLE",
          category: "SANDAL",
          startNumber: 15000,
          endNumber: 25000,
          currentNumber: 14999,
          isActive: true
        },
        existingSeries as any
      );
      expect(resultOverlap.valid).toBe(false);
      expect(resultOverlap.errors.some((e: string) => e.includes("overlaps with active series"))).toBe(true);

      // Disjoint range [20000 - 29999] for category SANDAL should pass
      const resultDisjoint = validate(
        {
          documentType: "ARTICLE",
          category: "SANDAL",
          startNumber: 20000,
          endNumber: 29999,
          currentNumber: 19999,
          isActive: true
        },
        existingSeries as any
      );
      expect(resultDisjoint.valid).toBe(true);

      // Same range [10000 - 19999] for different category SHOES should pass
      const resultDiffCategory = validate(
        {
          documentType: "ARTICLE",
          category: "SHOES",
          startNumber: 10000,
          endNumber: 19999,
          currentNumber: 9999,
          isActive: true
        },
        existingSeries as any
      );
      expect(resultDiffCategory.valid).toBe(true);
    });
  });

  describe("Payload Transform Logic", () => {
    it("should transform ARTICLE series payload correctly", () => {
      const rawForm = {
        name: "Article Shoes Series",
        documentType: "ARTICLE",
        category: "shoes",
        prefix: "SH-",
        suffix: "-A",
        startNumber: 20000,
        endNumber: 29999,
        runningLength: 5,
        isActive: true
      };

      const payload = documentSeriesConfig.payloadTransform!(rawForm, "create");
      expect(payload.module).toBe("INVENTORY");
      expect(payload.resetRule).toBe("Never");
      expect(payload.category).toBe("SHOES");
      expect(payload.currentNumber).toBe(19999); // startNum > 1 ? startNum - 1 : 0
      expect(payload.startNumber).toBe(20000);
      expect(payload.endNumber).toBe(29999);
      expect(payload.runningLength).toBe(5);
    });

    it("should transform statutory Sales Invoice payload correctly", () => {
      const rawForm = {
        name: "Main Retail Series",
        documentType: "Retail Invoice",
        prefix: "INV/{FY}/",
        startNumber: 1,
        runningLength: 6,
        isActive: true
      };

      const payload = documentSeriesConfig.payloadTransform!(rawForm, "create");
      expect(payload.module).toBe("SALES");
      expect(payload.resetRule).toBe("Financial Year");
      expect(payload.category).toBeNull();
      expect(payload.currentNumber).toBe(0);
      expect(payload.runningLength).toBe(6);
    });
  });
});
