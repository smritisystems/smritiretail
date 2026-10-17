/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.17.1
 * Created      : 2026-09-14
 * Modified     : 2026-09-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target Engine: Statutory GST Sales Factors, Customer Price Group & POS Add-ons/Deductions Engine
 */

import { apiFetchV1 } from "../lib/apiFetchV1";

export type SalesFactorType =
  | "RETAIL_PRICE_FACTOR"
  | "PRICE_ROUND_OFF"
  | "ADD_ON"
  | "DEDUCTION"
  | "BILL_ROUND_OFF";

export type SalesFactorCategory =
  | "CUSTOMER_SPECIFIC"
  | "PRICE_GROUP_SPECIFIC"
  | "ALL_CUSTOMERS";

export type ComputationTiming = "ABOVE_TAX" | "BELOW_TAX";

export type ComputedOn =
  | "SALE_VALUE_BEFORE_DISCOUNT"
  | "DISCOUNTED_VALUE"
  | "VALUE_INCLUSIVE_OF_TAX";

export type RateOrAmount = "RATE" | "AMOUNT";

export interface SmritiSalesFactor {
  id: string;
  code: string;
  description: string;
  factorType: SalesFactorType;
  factorCategory: SalesFactorCategory;
  customerId?: string;
  priceGroupCode?: string;
  applicableCategories: string[];
  applicableBrands: string[];
  computationTiming: ComputationTiming;
  computedOn: ComputedOn;
  rateOrAmount: RateOrAmount;
  value: number;
  isVariable: boolean;
  minBillValue?: number;
  maxBillValue?: number;
  validFrom?: string;
  validTo?: string;
  applicableDays: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackendSalesFactorDTO {
  id: string;
  code: string;
  description: string;
  factor_type: SalesFactorType;
  factor_category: SalesFactorCategory;
  customer_id?: string;
  price_group_code?: string;
  applicable_categories?: string[];
  applicable_brands?: string[];
  computation_timing: ComputationTiming;
  computed_on: ComputedOn;
  rate_or_amount: RateOrAmount;
  value: number;
  is_variable?: boolean;
  min_bill_value?: number;
  max_bill_value?: number;
  valid_from?: string;
  valid_to?: string;
  applicable_days?: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export const DEFAULT_SALES_FACTORS: SmritiSalesFactor[] = [
  {
    id: "sf-ins-01",
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
    isVariable: true,
    applicableDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "sf-pack-02",
    code: "PACK",
    description: "Gift & Garment Packaging",
    factorType: "ADD_ON",
    factorCategory: "ALL_CUSTOMERS",
    applicableCategories: [],
    applicableBrands: [],
    computationTiming: "ABOVE_TAX",
    computedOn: "DISCOUNTED_VALUE",
    rateOrAmount: "AMOUNT",
    value: 50.0,
    isVariable: true,
    applicableDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "sf-delv-03",
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
    isVariable: true,
    applicableDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "sf-corp-04",
    code: "CORP10",
    description: "Corporate Privilege Deduction",
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
    minBillValue: 500.0,
    applicableDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "sf-emp-05",
    code: "EMP15",
    description: "Staff Employee 15% Concession",
    factorType: "DEDUCTION",
    factorCategory: "PRICE_GROUP_SPECIFIC",
    priceGroupCode: "EMP",
    applicableCategories: [],
    applicableBrands: [],
    computationTiming: "ABOVE_TAX",
    computedOn: "DISCOUNTED_VALUE",
    rateOrAmount: "RATE",
    value: 15.0,
    isVariable: false,
    applicableDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "sf-ro-06",
    code: "RO_NEAREST",
    description: "Nearest Rupee Bill Round-off",
    factorType: "BILL_ROUND_OFF",
    factorCategory: "ALL_CUSTOMERS",
    applicableCategories: [],
    applicableBrands: [],
    computationTiming: "BELOW_TAX",
    computedOn: "DISCOUNTED_VALUE",
    rateOrAmount: "AMOUNT",
    value: 0.0,
    isVariable: false,
    applicableDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }
];

const STORAGE_KEY = "smriti_sales_factors";

export function mapBackendFactorToLocal(dto: BackendSalesFactorDTO): SmritiSalesFactor {
  return {
    id: dto.id,
    code: dto.code,
    description: dto.description || "",
    factorType: dto.factor_type,
    factorCategory: dto.factor_category,
    customerId: dto.customer_id,
    priceGroupCode: dto.price_group_code,
    applicableCategories: dto.applicable_categories || [],
    applicableBrands: dto.applicable_brands || [],
    computationTiming: dto.computation_timing || "ABOVE_TAX",
    computedOn: dto.computed_on || "DISCOUNTED_VALUE",
    rateOrAmount: dto.rate_or_amount || "RATE",
    value: dto.value || 0,
    isVariable: Boolean(dto.is_variable),
    minBillValue: dto.min_bill_value,
    maxBillValue: dto.max_bill_value,
    validFrom: dto.valid_from,
    validTo: dto.valid_to,
    applicableDays: dto.applicable_days || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    isActive: dto.is_active !== false,
    createdAt: dto.created_at || new Date().toISOString(),
    updatedAt: dto.updated_at || new Date().toISOString()
  };
}

export function mapLocalFactorToBackend(factor: SmritiSalesFactor): BackendSalesFactorDTO {
  return {
    id: factor.id,
    code: factor.code,
    description: factor.description,
    factor_type: factor.factorType,
    factor_category: factor.factorCategory,
    customer_id: factor.customerId,
    price_group_code: factor.priceGroupCode,
    applicable_categories: factor.applicableCategories || [],
    applicable_brands: factor.applicableBrands || [],
    computation_timing: factor.computationTiming,
    computed_on: factor.computedOn,
    rate_or_amount: factor.rateOrAmount,
    value: factor.value,
    is_variable: factor.isVariable,
    min_bill_value: factor.minBillValue,
    max_bill_value: factor.maxBillValue,
    valid_from: factor.validFrom,
    valid_to: factor.validTo,
    applicable_days: factor.applicableDays || [],
    is_active: factor.isActive,
    created_at: factor.createdAt,
    updated_at: factor.updatedAt
  };
}

export interface FactorCalculationInput {
  baseSaleAmount: number;
  itemPromotionalDiscount: number;
  billDiscount: number;
  taxRatePercent: number;
  isTaxInclusive?: boolean;
  factors: SmritiSalesFactor[];
}

export interface FactorCalculationResult {
  aboveTaxAddons: number;
  aboveTaxDeductions: number;
  adjustedTaxableValue: number;
  taxAmount: number;
  belowTaxAddons: number;
  belowTaxDeductions: number;
  unroundedNet: number;
  billRoundOff: number;
  netPayable: number;
  appliedFactorDetails: {
    code: string;
    description: string;
    factorType: SalesFactorType;
    computationTiming: ComputationTiming;
    rateOrAmount: RateOrAmount;
    value: number;
    computedAmount: number;
  }[];
}

export class SmritiSalesFactorService {
  private static getStorage(): Storage | null {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage;
      }
      if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
        return (globalThis as any).localStorage;
      }
    } catch {
      return null;
    }
    return null;
  }

  public static getAllSalesFactors(): SmritiSalesFactor[] {
    try {
      const storage = this.getStorage();
      if (!storage) return [...DEFAULT_SALES_FACTORS];
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        storage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SALES_FACTORS));
        return [...DEFAULT_SALES_FACTORS];
      }
      return JSON.parse(raw);
    } catch {
      return [...DEFAULT_SALES_FACTORS];
    }
  }

  public static getActiveSalesFactors(): SmritiSalesFactor[] {
    return this.getAllSalesFactors().filter(f => f.isActive);
  }

  public static getFactorsForCustomerAndPriceGroup(
    priceGroupCode?: string,
    customerId?: string
  ): SmritiSalesFactor[] {
    const active = this.getActiveSalesFactors();
    return active.filter(f => {
      if (f.factorCategory === "ALL_CUSTOMERS") return true;
      if (f.factorCategory === "PRICE_GROUP_SPECIFIC" && priceGroupCode) {
        return f.priceGroupCode?.toUpperCase() === priceGroupCode.toUpperCase();
      }
      if (f.factorCategory === "CUSTOMER_SPECIFIC" && customerId) {
        return f.customerId === customerId;
      }
      return false;
    });
  }

  public static saveSalesFactorLocally(factor: SmritiSalesFactor): void {
    try {
      const all = this.getAllSalesFactors();
      const idx = all.findIndex(f => f.id === factor.id || f.code.toUpperCase() === factor.code.toUpperCase());
      const updated: SmritiSalesFactor = {
        ...factor,
        updatedAt: new Date().toISOString()
      };
      if (idx >= 0) {
        all[idx] = updated;
      } else {
        all.push(updated);
      }
      const storage = this.getStorage();
      storage?.setItem(STORAGE_KEY, JSON.stringify(all));
      this.notifyChange();
    } catch (e) {
      console.error("[SmritiSalesFactorService] Failed to save factor locally", e);
    }
  }

  public static deleteSalesFactorLocally(id: string): void {
    try {
      const all = this.getAllSalesFactors().filter(f => f.id !== id && f.code !== id);
      const storage = this.getStorage();
      storage?.setItem(STORAGE_KEY, JSON.stringify(all));
      this.notifyChange();
    } catch (e) {
      console.error("[SmritiSalesFactorService] Failed to delete factor locally", e);
    }
  }

  public static resetToDefaults(): SmritiSalesFactor[] {
    try {
      const storage = this.getStorage();
      storage?.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SALES_FACTORS));
      this.notifyChange();
    } catch (e) {
      console.error("[SmritiSalesFactorService] Failed to reset sales factors", e);
    }
    return [...DEFAULT_SALES_FACTORS];
  }

  private static notifyChange(): void {
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("smriti_sales_factors_updated"));
      }
    } catch {
      // non-browser environments
    }
  }

  /**
   * Two-Way Sync from PostgreSQL Database to Local Storage Cache
   */
  public static async syncFromBackend(priceGroupCode?: string): Promise<{
    factors: SmritiSalesFactor[];
    source: "DATABASE" | "LOCAL_CACHE";
    error?: string;
  }> {
    try {
      const url = priceGroupCode
        ? `/pricing/sales-factors?price_group_code=${encodeURIComponent(priceGroupCode)}`
        : "/pricing/sales-factors";
      const remoteDTOs = await apiFetchV1<BackendSalesFactorDTO[]>(url);
      if (Array.isArray(remoteDTOs) && remoteDTOs.length > 0) {
        const mapped = remoteDTOs.map(mapBackendFactorToLocal);
        const storage = this.getStorage();
        if (storage) {
          storage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        }
        this.notifyChange();
        return { factors: mapped, source: "DATABASE" };
      }
    } catch (err: any) {
      console.warn("[SmritiSalesFactorService] Backend sync failed, falling back to local cache:", err?.message || err);
      return {
        factors: this.getAllSalesFactors(),
        source: "LOCAL_CACHE",
        error: err?.message || "Offline or backend unavailable"
      };
    }
    return { factors: this.getAllSalesFactors(), source: "LOCAL_CACHE" };
  }

  /**
   * Save (insert or update) a sales factor, committing locally first (0ms latency),
   * then syncing asynchronously to PostgreSQL.
   */
  public static async saveFactor(factor: SmritiSalesFactor): Promise<{
    success: boolean;
    syncedToBackend: boolean;
    factor: SmritiSalesFactor;
  }> {
    this.saveSalesFactorLocally(factor);
    let synced = false;
    try {
      const payload = mapLocalFactorToBackend(factor);
      const res = await apiFetchV1<BackendSalesFactorDTO>("/pricing/sales-factors", {
        method: "POST",
        body: payload
      });
      if (res && res.id) {
        synced = true;
      }
    } catch (err: any) {
      console.warn("[SmritiSalesFactorService] Failed to push factor to PostgreSQL backend:", err?.message || err);
    }
    this.notifyChange();
    return { success: true, syncedToBackend: synced, factor };
  }

  /**
   * Delete a sales factor locally and from PostgreSQL
   */
  public static async deleteFactor(id: string): Promise<{
    success: boolean;
    syncedToBackend: boolean;
  }> {
    this.deleteSalesFactorLocally(id);
    let synced = false;
    try {
      await apiFetchV1(`/pricing/sales-factors/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      synced = true;
    } catch (err: any) {
      console.warn("[SmritiSalesFactorService] Failed to delete factor from PostgreSQL backend:", err?.message || err);
    }
    this.notifyChange();
    return { success: true, syncedToBackend: synced };
  }

  /**
   * Statutory GST Section 15 Compliant Calculation Engine
   * Evaluates Add-ons and Deductions according to Above Tax vs Below Tax rules.
   */
  public static calculateBillFactors(input: FactorCalculationInput): FactorCalculationResult {
    const {
      baseSaleAmount,
      itemPromotionalDiscount,
      billDiscount,
      taxRatePercent,
      isTaxInclusive = false,
      factors
    } = input;

    // 1. Calculate Base Computation Values
    // Discounted sale value = Base - Item Discounts
    const discountedSaleValue = Math.max(0, baseSaleAmount - itemPromotionalDiscount);
    
    // In tax inclusive pricing, extract taxable value if applicable
    let effectiveBaseForRate = discountedSaleValue;
    if (isTaxInclusive && taxRatePercent > 0) {
      effectiveBaseForRate = discountedSaleValue / (1 + taxRatePercent / 100);
    }

    let aboveTaxAddons = 0;
    let aboveTaxDeductions = 0;
    let belowTaxAddons = 0;
    let belowTaxDeductions = 0;
    let hasBillRoundOff = false;

    const appliedDetails: FactorCalculationResult["appliedFactorDetails"] = [];

    for (const factor of factors) {
      if (!factor.isActive) continue;

      // Threshold check
      if (factor.minBillValue && discountedSaleValue < factor.minBillValue) continue;
      if (factor.maxBillValue && discountedSaleValue > factor.maxBillValue) continue;

      // Base value to apply factor against
      let calculationBase = effectiveBaseForRate;
      if (factor.computedOn === "SALE_VALUE_BEFORE_DISCOUNT") {
        calculationBase = isTaxInclusive && taxRatePercent > 0
          ? baseSaleAmount / (1 + taxRatePercent / 100)
          : baseSaleAmount;
      } else if (factor.computedOn === "VALUE_INCLUSIVE_OF_TAX") {
        calculationBase = baseSaleAmount;
      }

      // Compute factor amount
      let computedAmount = 0;
      if (factor.rateOrAmount === "RATE") {
        computedAmount = calculationBase * (factor.value / 100);
      } else {
        computedAmount = factor.value;
      }

      computedAmount = Math.round(computedAmount * 100) / 100;

      if (factor.factorType === "ADD_ON") {
        if (factor.computationTiming === "ABOVE_TAX") {
          aboveTaxAddons += computedAmount;
        } else {
          belowTaxAddons += computedAmount;
        }
      } else if (factor.factorType === "DEDUCTION") {
        if (factor.computationTiming === "ABOVE_TAX") {
          aboveTaxDeductions += computedAmount;
        } else {
          belowTaxDeductions += computedAmount;
        }
      } else if (factor.factorType === "BILL_ROUND_OFF") {
        hasBillRoundOff = true;
      }

      appliedDetails.push({
        code: factor.code,
        description: factor.description,
        factorType: factor.factorType,
        computationTiming: factor.computationTiming,
        rateOrAmount: factor.rateOrAmount,
        value: factor.value,
        computedAmount
      });
    }

    // 2. Adjust Taxable Base (Above Sales Tax)
    const rawTaxable = Math.max(0, effectiveBaseForRate - billDiscount + aboveTaxAddons - aboveTaxDeductions);
    const adjustedTaxableValue = Math.round(rawTaxable * 100) / 100;

    // 3. Compute GST Tax on Adjusted Taxable Base
    const taxAmount = Math.round(adjustedTaxableValue * (taxRatePercent / 100) * 100) / 100;

    // 4. Apply Below Sales Tax Adjustments
    const unroundedNet = Math.max(0, adjustedTaxableValue + taxAmount + belowTaxAddons - belowTaxDeductions);
    
    // 5. Bill Round-Off
    let netPayable = unroundedNet;
    let billRoundOff = 0;
    if (hasBillRoundOff || factors.some(f => f.factorType === "BILL_ROUND_OFF")) {
      netPayable = Math.round(unroundedNet);
      billRoundOff = Math.round((netPayable - unroundedNet) * 100) / 100;
    } else {
      netPayable = Math.round(unroundedNet * 100) / 100;
    }

    return {
      aboveTaxAddons: Math.round(aboveTaxAddons * 100) / 100,
      aboveTaxDeductions: Math.round(aboveTaxDeductions * 100) / 100,
      adjustedTaxableValue,
      taxAmount,
      belowTaxAddons: Math.round(belowTaxAddons * 100) / 100,
      belowTaxDeductions: Math.round(belowTaxDeductions * 100) / 100,
      unroundedNet: Math.round(unroundedNet * 100) / 100,
      billRoundOff,
      netPayable,
      appliedFactorDetails: appliedDetails
    };
  }
}
