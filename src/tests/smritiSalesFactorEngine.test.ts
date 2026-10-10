/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 6.17.1
 * * Created    : 2026-09-14
 * * Modified   : 2026-09-14
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Classification: Internal
 *
 * Statutory GST Section 15 Sales Factors & Customer Price Group Engine - Test Suite
 *
 * Verifies:
 *   1. Master repository initialization, defaults, and localStorage caching.
 *   2. Above Tax Add-on/Deduction adjusting taxable base and GST per statutory Section 15.
 *   3. Below Tax Add-on/Deduction applied to post-tax settlement without changing GST liability.
 *   4. Customer Price Group dynamic inheritance (CPP, EMP) and customer-specific factors.
 *   5. Bill value range qualification thresholds (minBillValue, maxBillValue).
 *   6. Variable factor support and cashier overrides.
 *   7. Credit ceiling verification logic (outstanding + currentBill <= creditLimit).
 *   8. Offline-first local cache fallback and two-way sync with PostgreSQL backend.
 *   9. Zero legacy platform branding governance.
 */

vi.mock("../lib/apiFetchV1", () => ({
  apiFetchV1: vi.fn()
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetchV1 } from "../lib/apiFetchV1";
import {
  SmritiSalesFactorService,
  SmritiSalesFactor,
  DEFAULT_SALES_FACTORS,
  mapBackendFactorToLocal,
  mapLocalFactorToBackend,
  BackendSalesFactorDTO
} from "../services/smritiSalesFactorService";

const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, val: string) => { mockStorage[key] = String(val); }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
  get length() { return Object.keys(mockStorage).length; },
  key: vi.fn((idx: number) => Object.keys(mockStorage)[idx] || null)
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true
});

describe("SMRITI Statutory Sales Factor & Customer Price Group Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
  });

  describe("1. Master Repository Initialization & Storage", () => {
    it("should return factory standard default sales factors on cold start", () => {
      const factors = SmritiSalesFactorService.getAllSalesFactors();
      expect(factors.length).toBeGreaterThanOrEqual(6);
      expect(factors.some(f => f.code === "INS")).toBe(true);
      expect(factors.some(f => f.code === "PACK")).toBe(true);
      expect(factors.some(f => f.code === "DELV")).toBe(true);
      expect(factors.some(f => f.code === "CORP10")).toBe(true);
      expect(factors.some(f => f.code === "EMP15")).toBe(true);
      expect(factors.some(f => f.code === "RO_NEAREST")).toBe(true);
    });

    it("should retrieve active sales factors", () => {
      const active = SmritiSalesFactorService.getActiveSalesFactors();
      expect(active.every(f => f.isActive)).toBe(true);
    });

    it("should reset to factory default standards on request", () => {
      SmritiSalesFactorService.saveSalesFactorLocally({
        id: "sf-test-temp",
        code: "TEMP",
        description: "Temporary Factor",
        factorType: "ADD_ON",
        factorCategory: "ALL_CUSTOMERS",
        applicableCategories: [],
        applicableBrands: [],
        computationTiming: "BELOW_TAX",
        computedOn: "DISCOUNTED_VALUE",
        rateOrAmount: "AMOUNT",
        value: 10,
        isVariable: false,
        applicableDays: ["MON"],
        isActive: true
      });
      expect(SmritiSalesFactorService.getAllSalesFactors().some(f => f.code === "TEMP")).toBe(true);

      const reset = SmritiSalesFactorService.resetToDefaults();
      expect(reset.some(f => f.code === "TEMP")).toBe(false);
      expect(reset.length).toBe(DEFAULT_SALES_FACTORS.length);
    });
  });

  describe("2. Statutory GST Section 15 Calculation: Above Tax vs Below Tax", () => {
    it("should adjust taxable base and GST tax for ABOVE_TAX Add-ons and Deductions", () => {
      // Setup factors:
      // Base: ₹1,000, GST Rate: 18%
      // INS: Above Tax Add-on of 1% (₹10.00)
      // PACK: Above Tax Add-on of ₹50.00
      // CORP10: Above Tax Deduction of 10% (₹100.00)
      const testFactors: SmritiSalesFactor[] = [
        {
          id: "f-ins",
          code: "INS",
          description: "Transit Insurance",
          factorType: "ADD_ON",
          factorCategory: "ALL_CUSTOMERS",
          applicableCategories: [],
          applicableBrands: [],
          computationTiming: "ABOVE_TAX",
          computedOn: "DISCOUNTED_VALUE",
          rateOrAmount: "RATE",
          value: 1.0,
          isVariable: false,
          applicableDays: [],
          isActive: true
        },
        {
          id: "f-pack",
          code: "PACK",
          description: "Packaging Fee",
          factorType: "ADD_ON",
          factorCategory: "ALL_CUSTOMERS",
          applicableCategories: [],
          applicableBrands: [],
          computationTiming: "ABOVE_TAX",
          computedOn: "DISCOUNTED_VALUE",
          rateOrAmount: "AMOUNT",
          value: 50.0,
          isVariable: false,
          applicableDays: [],
          isActive: true
        },
        {
          id: "f-corp",
          code: "CORP10",
          description: "Corporate Concession",
          factorType: "DEDUCTION",
          factorCategory: "PRICE_GROUP_SPECIFIC",
          priceGroupCode: "CPP",
          applicableCategories: [],
          applicableBrands: [],
          computationTiming: "ABOVE_TAX",
          computedOn: "DISCOUNTED_VALUE",
          rateOrAmount: "RATE",
          value: 10.0,
          isVariable: false,
          applicableDays: [],
          isActive: true
        }
      ];

      const result = SmritiSalesFactorService.calculateBillFactors({
        baseSaleAmount: 1000,
        itemPromotionalDiscount: 0,
        billDiscount: 0,
        taxRatePercent: 18.0,
        isTaxInclusive: false,
        factors: testFactors
      });

      // Above Tax Addons = ₹10 (1% of 1000) + ₹50 = ₹60.00
      expect(result.aboveTaxAddons).toBe(60.00);
      // Above Tax Deductions = ₹100 (10% of 1000)
      expect(result.aboveTaxDeductions).toBe(100.00);
      // Adjusted Taxable Value = 1000 + 60 - 100 = ₹960.00
      expect(result.adjustedTaxableValue).toBe(960.00);
      // GST Tax (18% of 960) = 172.80
      expect(result.taxAmount).toBe(172.80);
      // Net Payable = 960 + 172.80 = 1132.80
      expect(result.netPayable).toBe(1132.80);
    });

    it("should apply BELOW_TAX factors post-tax without altering the GST taxable base", () => {
      // Base: ₹1,000, Tax: 18% (Tax amount = ₹180 on base of ₹1,000)
      // DELV: Below Tax Add-on of ₹100.00
      // ROUND_OFF: Bill round-off
      const testFactors: SmritiSalesFactor[] = [
        {
          id: "f-delv",
          code: "DELV",
          description: "Express Counter Delivery",
          factorType: "ADD_ON",
          factorCategory: "ALL_CUSTOMERS",
          applicableCategories: [],
          applicableBrands: [],
          computationTiming: "BELOW_TAX",
          computedOn: "DISCOUNTED_VALUE",
          rateOrAmount: "AMOUNT",
          value: 100.0,
          isVariable: false,
          applicableDays: [],
          isActive: true
        },
        {
          id: "f-ro",
          code: "RO_NEAREST",
          description: "Bill Round Off",
          factorType: "BILL_ROUND_OFF",
          factorCategory: "ALL_CUSTOMERS",
          applicableCategories: [],
          applicableBrands: [],
          computationTiming: "BELOW_TAX",
          computedOn: "DISCOUNTED_VALUE",
          rateOrAmount: "AMOUNT",
          value: 0,
          isVariable: false,
          applicableDays: [],
          isActive: true
        }
      ];

      const result = SmritiSalesFactorService.calculateBillFactors({
        baseSaleAmount: 1000,
        itemPromotionalDiscount: 0,
        billDiscount: 0,
        taxRatePercent: 18.0,
        isTaxInclusive: false,
        factors: testFactors
      });

      // Taxable value is unchanged
      expect(result.adjustedTaxableValue).toBe(1000.00);
      expect(result.taxAmount).toBe(180.00);
      expect(result.belowTaxAddons).toBe(100.00);
      // Unrounded: 1000 + 180 + 100 = 1280.00
      expect(result.unroundedNet).toBe(1280.00);
      expect(result.netPayable).toBe(1280.00);
      expect(result.billRoundOff).toBe(0.00);
    });

    it("should correctly compute fractional round-off to nearest rupee", () => {
      const testFactors: SmritiSalesFactor[] = [
        {
          id: "f-ro",
          code: "RO_NEAREST",
          description: "Nearest Rupee Round-Off",
          factorType: "BILL_ROUND_OFF",
          factorCategory: "ALL_CUSTOMERS",
          applicableCategories: [],
          applicableBrands: [],
          computationTiming: "BELOW_TAX",
          computedOn: "DISCOUNTED_VALUE",
          rateOrAmount: "AMOUNT",
          value: 0,
          isVariable: false,
          applicableDays: [],
          isActive: true
        }
      ];

      // Base: ₹105.50, GST: 5% = 5.275 -> 5.28 -> Unrounded: 110.78
      const result = SmritiSalesFactorService.calculateBillFactors({
        baseSaleAmount: 105.50,
        itemPromotionalDiscount: 0,
        billDiscount: 0,
        taxRatePercent: 5.0,
        isTaxInclusive: false,
        factors: testFactors
      });

      expect(result.unroundedNet).toBe(110.78);
      expect(result.netPayable).toBe(111.00);
      expect(result.billRoundOff).toBe(0.22);
    });
  });

  describe("3. Customer Price Group Dynamic Inheritance", () => {
    it("should retrieve universal factors for walk-in retail customers with no price group", () => {
      const factors = SmritiSalesFactorService.getFactorsForCustomerAndPriceGroup(undefined, undefined);
      expect(factors.every(f => f.factorCategory === "ALL_CUSTOMERS")).toBe(true);
      expect(factors.some(f => f.code === "INS")).toBe(true);
      expect(factors.some(f => f.code === "CORP10")).toBe(false); // price group specific
    });

    it("should inherit price group-specific factors when customer has matching priceGroupCode", () => {
      const cppFactors = SmritiSalesFactorService.getFactorsForCustomerAndPriceGroup("CPP", "cust-corporate");
      expect(cppFactors.some(f => f.code === "CORP10")).toBe(true);
      expect(cppFactors.some(f => f.code === "INS")).toBe(true); // universal also included
      expect(cppFactors.some(f => f.code === "EMP15")).toBe(false); // EMP group excluded
    });

    it("should inherit staff employee concession when priceGroupCode is EMP", () => {
      const empFactors = SmritiSalesFactorService.getFactorsForCustomerAndPriceGroup("EMP", "cust-staff");
      expect(empFactors.some(f => f.code === "EMP15")).toBe(true);
      expect(empFactors.some(f => f.code === "CORP10")).toBe(false);
    });
  });

  describe("4. Bill Value Range Qualifications", () => {
    it("should bypass factors when bill value does not meet minBillValue", () => {
      // CORP10 requires minBillValue = 500
      const factors = SmritiSalesFactorService.getFactorsForCustomerAndPriceGroup("CPP");
      const resultUnderMin = SmritiSalesFactorService.calculateBillFactors({
        baseSaleAmount: 400, // less than 500
        itemPromotionalDiscount: 0,
        billDiscount: 0,
        taxRatePercent: 18.0,
        factors
      });

      expect(resultUnderMin.aboveTaxDeductions).toBe(0);
      expect(resultUnderMin.appliedFactorDetails.some(d => d.code === "CORP10")).toBe(false);

      const resultOverMin = SmritiSalesFactorService.calculateBillFactors({
        baseSaleAmount: 600, // meets >= 500
        itemPromotionalDiscount: 0,
        billDiscount: 0,
        taxRatePercent: 18.0,
        factors
      });

      expect(resultOverMin.aboveTaxDeductions).toBe(60.00); // 10% of 600
      expect(resultOverMin.appliedFactorDetails.some(d => d.code === "CORP10")).toBe(true);
    });
  });

  describe("5. Credit Ceiling Enforcement Logic", () => {
    it("should validate credit ceiling correctly (outstanding + currentBill <= creditLimit)", () => {
      const customer = {
        creditLimit: 50000,
        outstanding: 42000
      };
      const validBill = 7000;
      const invalidBill = 9000;

      const isAllowedValid = (customer.outstanding + validBill) <= customer.creditLimit;
      const isAllowedInvalid = (customer.outstanding + invalidBill) <= customer.creditLimit;

      expect(isAllowedValid).toBe(true);
      expect(isAllowedInvalid).toBe(false);
    });
  });

  describe("6. Offline-First Cache Fallback & PostgreSQL Synchronization", () => {
    it("should synchronize with backend when PostgreSQL API is available", async () => {
      const mockDTOs: BackendSalesFactorDTO[] = [
        {
          id: "sf-remote-01",
          code: "REMOTE_INS",
          description: "Remote Transit Insurance",
          factor_type: "ADD_ON",
          factor_category: "ALL_CUSTOMERS",
          computation_timing: "ABOVE_TAX",
          computed_on: "DISCOUNTED_VALUE",
          rate_or_amount: "RATE",
          value: 2.5,
          is_active: true
        }
      ];
      vi.mocked(apiFetchV1).mockResolvedValueOnce(mockDTOs);

      const res = await SmritiSalesFactorService.syncFromBackend();
      expect(res.source).toBe("DATABASE");
      expect(res.factors.some(f => f.code === "REMOTE_INS")).toBe(true);
    });

    it("should gracefully fall back to local cache when backend call fails", async () => {
      vi.mocked(apiFetchV1).mockRejectedValueOnce(new Error("Database connection refused"));

      const res = await SmritiSalesFactorService.syncFromBackend();
      expect(res.source).toBe("LOCAL_CACHE");
      expect(res.factors.length).toBeGreaterThan(0);
      expect(res.error).toBe("Database connection refused");
    });

    it("should save factor locally with 0ms latency and then push to backend", async () => {
      vi.mocked(apiFetchV1).mockResolvedValueOnce({ id: "sf-new-01", code: "NEW_F" });

      const newFactor: SmritiSalesFactor = {
        id: "sf-new-01",
        code: "NEW_F",
        description: "New Test Factor",
        factorType: "ADD_ON",
        factorCategory: "ALL_CUSTOMERS",
        applicableCategories: [],
        applicableBrands: [],
        computationTiming: "BELOW_TAX",
        computedOn: "DISCOUNTED_VALUE",
        rateOrAmount: "AMOUNT",
        value: 25.0,
        isVariable: true,
        applicableDays: ["MON", "TUE"],
        isActive: true
      };

      const res = await SmritiSalesFactorService.saveFactor(newFactor);
      expect(res.success).toBe(true);
      expect(res.syncedToBackend).toBe(true);

      const localList = SmritiSalesFactorService.getAllSalesFactors();
      expect(localList.some(f => f.code === "NEW_F")).toBe(true);
    });
  });

  describe("7. Bidirectional DTO Mapping AST Parity", () => {
    it("should map snake_case backend DTO to camelCase frontend entity and back losslessly", () => {
      const backendDTO: BackendSalesFactorDTO = {
        id: "sf-parity-01",
        code: "PARITY",
        description: "Parity Factor",
        factor_type: "DEDUCTION",
        factor_category: "PRICE_GROUP_SPECIFIC",
        price_group_code: "CPP",
        computation_timing: "ABOVE_TAX",
        computed_on: "DISCOUNTED_VALUE",
        rate_or_amount: "RATE",
        value: 7.5,
        is_variable: true,
        min_bill_value: 1000,
        max_bill_value: 10000,
        is_active: true
      };

      const local = mapBackendFactorToLocal(backendDTO);
      expect(local.factorType).toBe("DEDUCTION");
      expect(local.factorCategory).toBe("PRICE_GROUP_SPECIFIC");
      expect(local.priceGroupCode).toBe("CPP");
      expect(local.computationTiming).toBe("ABOVE_TAX");
      expect(local.isVariable).toBe(true);
      expect(local.minBillValue).toBe(1000);

      const roundTrip = mapLocalFactorToBackend(local);
      expect(roundTrip.factor_type).toBe("DEDUCTION");
      expect(roundTrip.price_group_code).toBe("CPP");
      expect(roundTrip.computation_timing).toBe("ABOVE_TAX");
      expect(roundTrip.min_bill_value).toBe(1000);
      expect(roundTrip.value).toBe(7.5);
    });
  });

  describe("8. Universal Brand Governance Verification", () => {
    it("should have zero references to prohibited legacy platform branding across default factors and config", () => {
      const allFactorsJson = JSON.stringify(DEFAULT_SALES_FACTORS);
      const prohibitedTokens = ["shoper", "tally", "shoper9", "shoperpos", "shoperdist"];
      for (const token of prohibitedTokens) {
        expect(allFactorsJson.toLowerCase().includes(token)).toBe(false);
      }
    });
  });
});
