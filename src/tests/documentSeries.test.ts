/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.4
 * Created      : 2026-09-14
 * Modified     : 2026-09-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Enterprise Document Series & Voucher Numbering Engine Unit Tests
 */

import { describe, it, expect } from "vitest";
import { NumberingEngine, DocumentSeries, ResetRule, NumberingMode } from "../services/numberingEngine.ts";

describe("SMRITI — Enterprise Document Series & Numbering Engine Unit Tests", () => {
  describe("1. Default Series Retrieval & Structure", () => {
    it("should provide initial standard series", () => {
      const seriesList = NumberingEngine.getAllSeries();
      expect(seriesList.length).toBeGreaterThanOrEqual(2);

      const retailInv = seriesList.find(s => s.id === "SER-001");
      expect(retailInv).toBeDefined();
      expect(retailInv?.documentType).toBe("Retail Invoice");
      expect(retailInv?.module).toBe("Sales");
      expect(retailInv?.runningLength).toBe(6);
      expect(retailInv?.resetRule).toBe("Financial Year");
      expect(retailInv?.mode).toBe("Auto");
    });

    it("should contain mandatory enterprise extension flags", () => {
      const seriesList = NumberingEngine.getAllSeries();
      const series = seriesList[0];
      expect(series.isActive).toBe(true);
      expect(series.effectiveFrom).toBeDefined();
      expect(series.effectiveTo).toBeDefined();
      expect(series.companyCode).toBeDefined();
    });
  });

  describe("2. Sequence Format Preview & Template Interpolation", () => {
    const testSeries: DocumentSeries = {
      id: "TEST-SER-01",
      name: "GST Sales Invoice",
      documentType: "Tax Invoice",
      module: "Sales",
      branch: "All",
      financialYear: "2026-2027",
      prefix: "INV/{FY}/{Branch}/",
      suffix: "-GST",
      runningLength: 5,
      currentNumber: 42,
      resetRule: "Financial Year",
      mode: "Auto",
      isActive: true,
      effectiveFrom: "2026-04-01",
      effectiveTo: "2027-03-31",
      companyCode: "SMRITI"
    };

    it("should format sequence preview with zero-padded number", () => {
      // current is 42, next is 43, padded to 5 digits -> 00043
      const preview = NumberingEngine.formatPreview(testSeries, {
        branch: "MUM",
        fy: "26-27"
      });
      expect(preview).toBe("INV/26-27/MUM/00043-GST");
    });

    it("should fallback branch 'All' to 'HQ' when not specified", () => {
      const preview = NumberingEngine.formatPreview(testSeries, { fy: "26-27" });
      expect(preview).toBe("INV/26-27/HQ/00043-GST");
    });

    it("should support date tokens {Year}, {Month}, {Date}", () => {
      const dateSeries: DocumentSeries = {
        ...testSeries,
        prefix: "RCP/{Year}/{Month}/",
        suffix: "",
        runningLength: 4,
        currentNumber: 9
      };

      const preview = NumberingEngine.formatPreview(dateSeries, {
        date: "2026-09-14T10:00:00Z"
      });
      expect(preview).toBe("RCP/2026/09/0010");
    });

    it("should support {User} and {Module} placeholders", () => {
      const auditSeries: DocumentSeries = {
        ...testSeries,
        prefix: "{Module}/{User}-",
        suffix: "",
        runningLength: 3,
        currentNumber: 0
      };

      const preview = NumberingEngine.formatPreview(auditSeries, {
        user: "Cashier1"
      });
      expect(preview).toBe("Sales/Cashier1-001");
    });
  });

  describe("3. Reset Rules & Numbering Modes Integrity", () => {
    const validResetRules: ResetRule[] = [
      "Never",
      "Daily",
      "Monthly",
      "Quarterly",
      "Financial Year",
      "Calendar Year",
      "Branch"
    ];

    const validModes: NumberingMode[] = ["Auto", "Manual", "Hybrid"];

    it("should recognize all standard reset rules", () => {
      validResetRules.forEach(rule => {
        expect(typeof rule).toBe("string");
      });
      expect(validResetRules).toContain("Financial Year");
      expect(validResetRules).toContain("Never");
    });

    it("should recognize all numbering modes", () => {
      validModes.forEach(mode => {
        expect(typeof mode).toBe("string");
      });
      expect(validModes).toContain("Auto");
      expect(validModes).toContain("Manual");
      expect(validModes).toContain("Hybrid");
    });

    it("should correctly calculate next number without mutate current series state", () => {
      const series: DocumentSeries = {
        id: "TEST-02",
        name: "Test",
        documentType: "PO",
        module: "Purchase",
        branch: "DEL",
        financialYear: "2026-2027",
        prefix: "PO-",
        suffix: "",
        runningLength: 4,
        currentNumber: 99,
        resetRule: "Never",
        mode: "Auto",
        isActive: true,
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-12-31"
      };

      const preview = NumberingEngine.formatPreview(series);
      expect(preview).toBe("PO-0100");
      expect(series.currentNumber).toBe(99); // Unmutated
    });
  });
});
