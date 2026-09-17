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
 * * Version    : 6.17.0
 * * Created    : 2026-09-14
 * * Modified   : 2026-09-14
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 * * Classification: Internal
 *
 * SMRITI Sales Promotion Master & Catalogue Service
 * Architecture:
 *   Implements "Define Sales Promotions" repository as per retail enterprise
 *   standards. Houses active promotion schemes across 4 canonical categories:
 *     1. Item Level Discounts (Fixed %, Fixed Amount, Discounted Rate, Last Piece)
 *     2. Item Level Offers (Buy X Get Y Free, Bundle / Combination Offer)
 *     3. Bill Level Discounts (Fixed %, Fixed Amount, Value Range Slabs)
 *     4. Bill Level Offers (Free Gift / Free Item on Bill)
 *
 *   Provides dynamic resolution for F6 Promotional Scheme selection during POS billing.
 */

import { apiFetchV1 } from "../lib/apiFetchV1";

export type SmritiPromoLevel = "ITEM_LEVEL" | "BILL_LEVEL";

export type SmritiPromoCategory =
  | "ITEM_DISCOUNT_PERCENT"
  | "ITEM_DISCOUNT_FLAT"
  | "ITEM_OFFER_B2G1"
  | "ITEM_BUNDLE_COMBO"
  | "ITEM_LAST_PIECE"
  | "BILL_DISCOUNT_FLAT"
  | "BILL_DISCOUNT_PERCENT"
  | "BILL_VALUE_SLAB"
  | "BILL_FREE_GIFT";

// ─── 5 PROMOTION CORE PRIMITIVES (SMRITI ENTERPRISE ENGINE) ─────────────────

export interface PromotionEligibility {
  applicableCustomerGroups?: string[];
  applicableStores?: string[];
  daysOfWeek?: string[];
  isHappyHours?: boolean;
  happyHoursStart?: string;
  happyHoursEnd?: string;
  validFrom?: string;
  validTo?: string;
}

export interface PromotionTrigger {
  triggerType: "QUANTITY" | "VALUE" | "BASKET_VALUE" | "ITEM" | "CATEGORY" | "BRAND";
  thresholdQty?: number;
  thresholdValue?: number;
  targetCategories?: string[];
  targetBrands?: string[];
  targetSkus?: string[];
  targetBarcodes?: string[];
}

export interface PromotionReward {
  rewardType: "PERCENT" | "FLAT" | "FREE_ITEM" | "FIXED_COMBO" | "DIFFERENTIAL_ITEM";
  discountPct?: number;
  discountAmt?: number;
  freeQty?: number;
  fixedPrice?: number;
  appliedOn?: "LOWEST_PRICE" | "HIGHEST_PRICE" | "MRP" | "SELLING_PRICE";
  rewardScope?: {
    categories?: string[];
    brands?: string[];
    skus?: string[];
  };
  taxTreatment?: "PRE_TAX_TRADE_DISCOUNT" | "POST_TAX_INCENTIVE";
}

export interface PromotionLimits {
  maxDiscountCap?: number;
  maxRewardQty?: number;
  perBillLimit?: number;
}

export interface PromotionGovernance {
  priority: number;
  isExclusive?: boolean;
  allowStacking?: boolean;
  maxStackedDiscountPct?: number;
  requiresSupervisorAuth?: boolean;
}

export interface PromotionExplainabilityCheck {
  rule: string;
  passed: boolean;
  observedValue: any;
  requiredValue: any;
  explanation: string;
}

export interface PromotionExplanation {
  schemeCode: string;
  schemeName: string;
  checks: PromotionExplainabilityCheck[];
  arbitrationResult: "WON" | "FORGONE" | "DISQUALIFIED";
  rationale: string;
  winningDiscountAmount: number;
}

export interface UnclaimedFreeItemOffer {
  schemeCode: string;
  schemeName: string;
  triggerSku?: string;
  freeQty: number;
  freeItemCategory?: string;
  freeItemBrand?: string;
  estimatedSavings: number;
  qualificationStatus: "QUALIFIED" | "REDEEMED" | "DECLINED";
  declineReason?: string;
}

export interface BasketUpsellMilestone {
  targetSubtotal: number;
  remainingAmount: number;
  percentProgress: number;
  schemeCode: string;
  schemeName: string;
  potentialSavings: number;
  gaugeText: string;
}

export interface BackendPromotionSchemeDTO {
  id: string;
  code: string;
  name: string;
  description?: string;
  level: SmritiPromoLevel;
  category: SmritiPromoCategory;
  priority: number;
  discount_value: number;
  min_bill_value?: number;
  min_qty?: number;
  buy_qty?: number;
  free_qty?: number;
  max_discount?: number;
  applicable_categories?: string[];
  applicable_brands?: string[];
  applicable_customer_groups?: string[];
  valid_from: string;
  valid_to: string;
  is_happy_hours?: boolean;
  happy_hours_start?: string;
  happy_hours_end?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export function mapBackendSchemeToLocal(dto: BackendPromotionSchemeDTO): SmritiDefinedSalesPromotion {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    description: dto.description || "",
    level: dto.level,
    category: dto.category,
    priority: dto.priority || 1,
    discountValue: dto.discount_value || 0,
    minBillValue: dto.min_bill_value ?? undefined,
    minQty: dto.min_qty ?? undefined,
    buyQty: dto.buy_qty ?? undefined,
    freeQty: dto.free_qty ?? undefined,
    maxDiscount: dto.max_discount ?? undefined,
    applicableCategories: dto.applicable_categories || [],
    applicableBrands: dto.applicable_brands || [],
    applicableCustomerGroups: dto.applicable_customer_groups || ["ALL"],
    validFrom: dto.valid_from,
    validTo: dto.valid_to,
    isHappyHours: Boolean(dto.is_happy_hours),
    happyHoursStart: dto.happy_hours_start,
    happyHoursEnd: dto.happy_hours_end,
    recipeId: dto.recipe_id,
    appliedOn: dto.applied_on || "LOWEST_PRICE",
    daysOfWeek: dto.days_of_week || ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    customerClassifications: dto.customer_classifications || {},
    comboSets: dto.combo_sets || [],
    fixedComboPrice: dto.fixed_combo_price,
    isActive: dto.is_active !== false,
    createdAt: dto.created_at || new Date().toISOString(),
    updatedAt: dto.updated_at || new Date().toISOString(),
  };
}

export function mapLocalSchemeToBackend(promo: SmritiDefinedSalesPromotion): BackendPromotionSchemeDTO {
  return {
    id: promo.id,
    code: promo.code,
    name: promo.name,
    description: promo.description || "",
    level: promo.level,
    category: promo.category,
    priority: promo.priority,
    discount_value: promo.discountValue,
    min_bill_value: promo.minBillValue,
    min_qty: promo.minQty,
    buy_qty: promo.buyQty,
    free_qty: promo.freeQty,
    max_discount: promo.maxDiscount,
    applicable_categories: promo.applicableCategories || [],
    applicable_brands: promo.applicableBrands || [],
    applicable_customer_groups: promo.applicableCustomerGroups || ["ALL"],
    valid_from: promo.validFrom,
    valid_to: promo.validTo,
    is_happy_hours: promo.isHappyHours,
    happy_hours_start: promo.happyHoursStart,
    happy_hours_end: promo.happyHoursEnd,
    recipe_id: promo.recipeId,
    applied_on: promo.appliedOn,
    days_of_week: promo.daysOfWeek,
    customer_classifications: promo.customerClassifications,
    combo_sets: promo.comboSets,
    fixed_combo_price: promo.fixedComboPrice,
    is_active: promo.isActive,
    created_at: promo.createdAt,
    updated_at: promo.updatedAt,
  };
}

export interface SmritiDefinedSalesPromotion {
  id: string;
  code: string;
  name: string;
  description: string;
  level: SmritiPromoLevel;
  category: SmritiPromoCategory;
  priority: number; // 1 = highest priority
  discountValue: number; // % or ₹
  minBillValue?: number;
  minQty?: number;
  buyQty?: number;
  freeQty?: number;
  maxDiscount?: number; // Cap
  applicableCategories?: string[]; // e.g. ["Apparel", "Footwear"]
  applicableBrands?: string[];
  applicableCustomerGroups?: string[]; // ["ALL", "VIP", "WHOLESALE", "STAFF"]
  validFrom: string; // YYYY-MM-DD
  validTo: string; // YYYY-MM-DD
  startDate?: string;
  endDate?: string;
  isHappyHours?: boolean;
  happyHoursStart?: string; // HH:mm
  happyHoursEnd?: string; // HH:mm
  timeFrom?: string;
  timeTo?: string;
  recipeId?: string;
  appliedOn?: "LOWEST_PRICE" | "HIGHEST_PRICE" | "MRP" | "SELLING_PRICE";
  daysOfWeek?: string[]; // ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
  customerClassifications?: Record<string, string[]>;
  comboSets?: {
    setNo: number;
    condition: "AND" | "OR" | "END";
    categories?: string[];
    brands?: string[];
    minQty: number;
  }[];
  fixedComboPrice?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  rules?: any[];
}

const STORAGE_KEY = "smriti_sales_promotions_catalog";

export const DEFAULT_DEFINED_SALES_PROMOTIONS: SmritiDefinedSalesPromotion[] = [
  // ─── 1. ITEM LEVEL PROMOTIONS ───────────────────────────────────────────
  {
    id: "sp-reliance-4376",
    code: "REL_RET_4376",
    name: "Reliance Retail Store 43.76% on MRP",
    description: "Institutional trade concession: flat 43.76% markdown on MRP for Reliance Retail billing",
    level: "ITEM_LEVEL",
    category: "ITEM_DISCOUNT_PERCENT",
    priority: 1,
    discountValue: 43.76,
    appliedOn: "MRP",
    applicableCustomerGroups: ["RELIANCE", "RELIANCE_RETAIL", "CG-LargeRetail", "cg-retail", "cg-default"],
    validFrom: "2026-01-01",
    validTo: "2030-12-31",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z"
  },
  {
    id: "sp-item-ild",
    code: "ILD",
    name: "Standard Item Line Discount",
    description: "Standard 10% promotional line discount on catalog apparel",
    level: "ITEM_LEVEL",
    category: "ITEM_DISCOUNT_PERCENT",
    priority: 2,
    discountValue: 10,
    applicableCategories: ["Apparel"],
    applicableCustomerGroups: ["ALL"],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z"
  },
  {
    id: "sp-item-b2g1",
    code: "B2G1",
    name: "Buy 2 Get 1 Free (Same Item / Category)",
    description: "Cheapest third item free upon purchasing 3 qualifying units",
    level: "ITEM_LEVEL",
    category: "ITEM_OFFER_B2G1",
    priority: 2,
    discountValue: 100,
    buyQty: 2,
    freeQty: 1,
    minQty: 3,
    applicableCategories: ["Apparel"],
    applicableCustomerGroups: ["ALL"],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z"
  },
  {
    id: "sp-item-eoss20",
    code: "EOSS20",
    name: "End of Season Sale 20% Off",
    description: "Flat 20% promotional discount across fresh fashion arrivals",
    level: "ITEM_LEVEL",
    category: "ITEM_DISCOUNT_PERCENT",
    priority: 3,
    discountValue: 20,
    applicableCategories: ["Apparel", "Fashion"],
    applicableCustomerGroups: ["ALL"],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z"
  },
  {
    id: "sp-item-flat100",
    code: "FLAT100",
    name: "Flat ₹100 Off per piece",
    description: "Instant ₹100 markdown per eligible unit sold",
    level: "ITEM_LEVEL",
    category: "ITEM_DISCOUNT_FLAT",
    priority: 4,
    discountValue: 100,
    applicableCategories: ["Footwear"],
    applicableCustomerGroups: ["ALL"],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z"
  },
  {
    id: "sp-item-lastpc",
    code: "LAST_PC",
    name: "Last Piece Clearance Markdown",
    description: "25% discount markdown on last remaining unit in stock (Qty = 1)",
    level: "ITEM_LEVEL",
    category: "ITEM_LAST_PIECE",
    priority: 5,
    discountValue: 25,
    applicableCustomerGroups: ["ALL"],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z"
  },

  // ─── 2. BILL LEVEL PROMOTIONS ───────────────────────────────────────────
  {
    id: "sp-bill-none",
    code: "NONE",
    name: "No Bill Level Discount",
    description: "No bill-level promotional markdown applied",
    level: "BILL_LEVEL",
    category: "BILL_DISCOUNT_FLAT",
    priority: 99,
    discountValue: 0,
    applicableCustomerGroups: ["ALL"],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z"
  },
  {
    id: "sp-bill-fest500",
    code: "FEST500",
    name: "Festival Privilege ₹500 Off",
    description: "Flat ₹500 discount on billing cart values exceeding ₹3,000",
    level: "BILL_LEVEL",
    category: "BILL_DISCOUNT_FLAT",
    priority: 1,
    discountValue: 500,
    minBillValue: 3000,
    maxDiscount: 500,
    applicableCustomerGroups: ["ALL"],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z"
  },
  {
    id: "sp-bill-corp10",
    code: "CORP10",
    name: "Corporate Member 10% Off",
    description: "10% privilege discount for registered corporate customer accounts",
    level: "BILL_LEVEL",
    category: "BILL_DISCOUNT_PERCENT",
    priority: 2,
    discountValue: 10,
    maxDiscount: 2000,
    applicableCustomerGroups: ["VIP", "WHOLESALE"],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z"
  },
  {
    id: "sp-bill-clear15",
    code: "CLEAR15",
    name: "Stock Clearance 15% Off",
    description: "15% bill markdown for end-of-quarter stock clearance",
    level: "BILL_LEVEL",
    category: "BILL_DISCOUNT_PERCENT",
    priority: 3,
    discountValue: 15,
    minBillValue: 5000,
    maxDiscount: 3000,
    applicableCustomerGroups: ["ALL"],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    isActive: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z"
  },
  {
    id: "sp-bill-tier",
    code: "TIER_SLAB",
    name: "Spend More Save More Slab",
    description: "Progressive discount: 5% above ₹2,000, 10% above ₹5,000, 15% above ₹10,000",
    level: "BILL_LEVEL",
    category: "BILL_VALUE_SLAB",
    priority: 4,
    discountValue: 10,
    minBillValue: 2000,
    maxDiscount: 2500,
    applicableCustomerGroups: ["ALL"],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    isActive: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z"
  }
];

export class SmritiSalesPromotionService {
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

  /**
   * Retrieve all defined sales promotions from repository
   */
  public static getAllDefinedPromotions(): SmritiDefinedSalesPromotion[] {
    try {
      const storage = this.getStorage();
      if (!storage) {
        return DEFAULT_DEFINED_SALES_PROMOTIONS;
      }
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        storage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DEFINED_SALES_PROMOTIONS));
        return DEFAULT_DEFINED_SALES_PROMOTIONS;
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : DEFAULT_DEFINED_SALES_PROMOTIONS;
    } catch {
      return DEFAULT_DEFINED_SALES_PROMOTIONS;
    }
  }

  /**
   * Retrieve all active promotions filtered by level and priority
   * Priority rule: Smallest number = highest priority. If priorities equal, last created scheme wins.
   */
  public static getActivePromotionsByLevel(
    level: SmritiPromoLevel,
    asOf: Date = new Date()
  ): SmritiDefinedSalesPromotion[] {
    const all = this.getAllDefinedPromotions();
    const dateStr = asOf.toISOString().split("T")[0];

    return all
      .filter(p => {
        if (!p.isActive) return false;
        if (p.level !== level) return false;
        if (p.validFrom && p.validFrom > dateStr) return false;
        if (p.validTo && p.validTo < dateStr) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
  }

  /**
   * Save (insert or update) a promotional scheme definition
   */
  public static savePromotion(promo: SmritiDefinedSalesPromotion): void {
    const all = this.getAllDefinedPromotions();
    const idx = all.findIndex(p => p.id === promo.id);
    const now = new Date().toISOString();

    const normalizedPromo: SmritiDefinedSalesPromotion = {
      ...promo,
      validFrom: promo.validFrom || promo.startDate || "2026-01-01",
      validTo: promo.validTo || promo.endDate || "2026-12-31",
      happyHoursStart: promo.happyHoursStart || promo.timeFrom,
      happyHoursEnd: promo.happyHoursEnd || promo.timeTo,
      isHappyHours: promo.isHappyHours ?? Boolean(promo.happyHoursStart || promo.timeFrom),
      applicableCategories: promo.applicableCategories || (promo.rules?.filter((r: any) => r.ruleType === "CATEGORY").map((r: any) => r.targetValue)) || [],
      applicableBrands: promo.applicableBrands || (promo.rules?.filter((r: any) => r.ruleType === "BRAND").map((r: any) => r.targetValue)) || [],
      applicableCustomerGroups: promo.applicableCustomerGroups || (promo.rules?.filter((r: any) => r.ruleType === "CUSTOMER_GROUP").map((r: any) => r.targetValue)) || ["ALL"],
      minQty: promo.minQty || (promo.rules?.find((r: any) => r.ruleType === "MIN_QTY")?.minQuantity),
      minBillValue: promo.minBillValue ?? (promo as any).min_bill_value ?? (promo.rules?.find((r: any) => r.ruleType === "MIN_BILL_VALUE")?.minBillValue),
      maxDiscount: promo.maxDiscount ?? (promo as any).max_discount,
      rules: promo.rules || []
    };

    if (idx >= 0) {
      all[idx] = { ...normalizedPromo, updatedAt: now };
    } else {
      all.push({ ...normalizedPromo, createdAt: promo.createdAt || now, updatedAt: now });
    }

    try {
      const storage = this.getStorage();
      storage?.setItem(STORAGE_KEY, JSON.stringify(all));
      this.notifyChange();
    } catch (e) {
      console.error("[SmritiSalesPromotionService] Failed to save promotion to localStorage", e);
    }
  }

  /**
   * Delete a promotion definition by ID
   */
  public static deletePromotion(id: string): void {
    const all = this.getAllDefinedPromotions().filter(p => p.id !== id);
    try {
      const storage = this.getStorage();
      storage?.setItem(STORAGE_KEY, JSON.stringify(all));
      this.notifyChange();
    } catch (e) {
      console.error("[SmritiSalesPromotionService] Failed to delete promotion from localStorage", e);
    }
  }

  /**
   * Reset the catalog back to factory defaults
   */
  public static resetToDefaults(): SmritiDefinedSalesPromotion[] {
    try {
      const storage = this.getStorage();
      storage?.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DEFINED_SALES_PROMOTIONS));
      this.notifyChange();
    } catch (e) {
      console.error("[SmritiSalesPromotionService] Failed to reset promotions", e);
    }
    return DEFAULT_DEFINED_SALES_PROMOTIONS;
  }

  /**
   * Dispatch reactive update event to notify open components
   */
  private static notifyChange(): void {
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("smriti_promotions_updated"));
      }
    } catch {
      // ignore in non-browser environments
    }
  }

  /**
   * Identifies whether the customer belongs to the Reliance Retail institutional trade account.
   * Matches customer name (e.g. "Reliance Retail Ltd", "Reliance Retail Limited"), customer code (e.g. "CUST-RIL-1888", "CUST-001"),
   * or customer group (e.g. "RELIANCE", "RELIANCE_RETAIL", "CG-LargeRetail").
   */
  public static isRelianceCustomer(customer?: {
    name?: string;
    code?: string;
    customerGroup?: string;
    customerGroupId?: string;
  } | null): boolean {
    if (!customer) return false;
    const name = (customer.name || "").toUpperCase();
    const code = (customer.code || "").toUpperCase();
    const group = (customer.customerGroup || customer.customerGroupId || "").toUpperCase();

    return (
      name.includes("RELIANCE") ||
      code.includes("RIL") ||
      code.includes("RRL") ||
      code === "CUST-001" ||
      group === "RELIANCE" ||
      group === "RELIANCE_RETAIL" ||
      group === "CG-LARGERETAIL" ||
      group === "CG-RELIANCE"
    );
  }

  /**
   * Ensures the contractual 43.76% discount scheme for Reliance Retail Ltd. exists,
   * is active, and is assigned to all Reliance customer groups.
   * If missing, creates and saves it to local catalog.
   */
  public static ensureReliance4376Promotion(): SmritiDefinedSalesPromotion {
    const all = this.getAllDefinedPromotions();
    let promo = all.find(p => p.code === "REL_RET_4376" || p.discountValue === 43.76);
    const requiredGroups = ["RELIANCE", "RELIANCE_RETAIL", "CG-LargeRetail", "cg-retail", "cg-default"];

    if (promo) {
      const currentGroups = promo.applicableCustomerGroups || [];
      const hasAllGroups = requiredGroups.every(g => currentGroups.includes(g));
      if (!promo.isActive || promo.discountValue !== 43.76 || !hasAllGroups) {
        promo = {
          ...promo,
          isActive: true,
          discountValue: 43.76,
          appliedOn: "MRP",
          applicableCustomerGroups: Array.from(new Set([...currentGroups, ...requiredGroups])),
          updatedAt: new Date().toISOString()
        };
        this.savePromotion(promo);
      }
      return promo;
    }

    const newPromo: SmritiDefinedSalesPromotion = {
      id: "sp-reliance-4376",
      code: "REL_RET_4376",
      name: "Reliance Retail Store 43.76% on MRP",
      description: "Institutional trade concession: flat 43.76% markdown on MRP for Reliance Retail billing",
      level: "ITEM_LEVEL",
      category: "ITEM_DISCOUNT_PERCENT",
      priority: 1,
      discountValue: 43.76,
      appliedOn: "MRP",
      applicableCustomerGroups: requiredGroups,
      validFrom: "2026-01-01",
      validTo: "2030-12-31",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.savePromotion(newPromo);
    return newPromo;
  }

  /**
   * Two-Way Sync from PostgreSQL Database to Local Storage Cache
   */
  public static async syncFromBackend(): Promise<{
    schemes: SmritiDefinedSalesPromotion[];
    source: "DATABASE" | "LOCAL_CACHE";
    error?: string;
  }> {
    try {
      const remoteDTOs = await apiFetchV1<BackendPromotionSchemeDTO[]>("/promotions/schemes");
      if (Array.isArray(remoteDTOs) && remoteDTOs.length > 0) {
        const mapped = remoteDTOs.map(mapBackendSchemeToLocal);
        const storage = this.getStorage();
        if (storage) {
          storage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        }
        this.notifyChange();
        return { schemes: mapped, source: "DATABASE" };
      }
    } catch (err: any) {
      console.warn("[SmritiSalesPromotionService] Backend sync failed, falling back to local storage cache:", err?.message || err);
      return {
        schemes: this.getAllDefinedPromotions(),
        source: "LOCAL_CACHE",
        error: err?.message || "Offline or backend unavailable"
      };
    }

    return { schemes: this.getAllDefinedPromotions(), source: "LOCAL_CACHE" };
  }

  /**
   * Save (insert or update) a promotional scheme definition, saving to local storage
   * and synchronizing asynchronously to PostgreSQL.
   */
  public static async saveScheme(promo: SmritiDefinedSalesPromotion): Promise<{
    success: boolean;
    syncedToBackend: boolean;
    scheme: SmritiDefinedSalesPromotion;
  }> {
    // 1. Immediately commit locally for instant POS latency
    this.savePromotion(promo);

    // 2. Push to PostgreSQL database
    let synced = false;
    try {
      const payload = mapLocalSchemeToBackend(promo);
      const res = await apiFetchV1<BackendPromotionSchemeDTO>("/promotions/schemes", {
        method: "POST",
        body: payload
      });
      if (res && res.id) {
        synced = true;
      }
    } catch (err: any) {
      console.warn("[SmritiSalesPromotionService] Failed to push scheme to PostgreSQL backend:", err?.message || err);
    }

    this.notifyChange();
    return { success: true, syncedToBackend: synced, scheme: promo };
  }

  /**
   * Delete a promotion definition by ID from local storage and PostgreSQL
   */
  public static async deleteScheme(id: string): Promise<{
    success: boolean;
    syncedToBackend: boolean;
  }> {
    // 1. Remove from local storage
    this.deletePromotion(id);

    // 2. Remove from PostgreSQL
    let synced = false;
    try {
      await apiFetchV1(`/promotions/schemes/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      synced = true;
    } catch (err: any) {
      console.warn("[SmritiSalesPromotionService] Failed to delete scheme from PostgreSQL backend:", err?.message || err);
    }

    this.notifyChange();
    return { success: true, syncedToBackend: synced };
  }

  /**
   * Return 8 standard 1-click retail promotion recipes
   */
  public static getRecipes(): RetailPromotionRecipe[] {
    return SMRITI_PROMOTION_RECIPES;
  }

  /**
   * Generates an intuitive, non-technical plain English summary of the promotion rule
   */
  public static formatPromotionAsSentence(promo: Partial<SmritiDefinedSalesPromotion>): string {
    const parts: string[] = [];

    // Schedule prefix
    if (promo.isHappyHours && promo.happyHoursStart && promo.happyHoursEnd) {
      parts.push(`During Happy Hours (${promo.happyHoursStart} - ${promo.happyHoursEnd})`);
    }

    if (promo.daysOfWeek && promo.daysOfWeek.length > 0 && promo.daysOfWeek.length < 7) {
      parts.push(`on ${promo.daysOfWeek.join(", ")}`);
    }

    // Customer target
    if (promo.applicableCustomerGroups && promo.applicableCustomerGroups.length > 0 && !promo.applicableCustomerGroups.includes("ALL")) {
      parts.push(`for ${promo.applicableCustomerGroups.join(", ")} customers`);
    } else {
      parts.push(`for all customers`);
    }

    // Main condition & reward
    const targetCats = promo.applicableCategories && promo.applicableCategories.length > 0 
      ? promo.applicableCategories.join(" or ") 
      : "any item";
    const targetBrands = promo.applicableBrands && promo.applicableBrands.length > 0 
      ? ` (Brands: ${promo.applicableBrands.join(", ")})` 
      : "";

    switch (promo.category) {
      case "ITEM_OFFER_B2G1": {
        const buy = promo.buyQty || 2;
        const free = promo.freeQty || 1;
        const applied = promo.appliedOn === "HIGHEST_PRICE" ? "highest-priced" : "cheapest";
        parts.push(`buying ${buy} of ${targetCats}${targetBrands} gives ${free} FREE on the ${applied} piece`);
        break;
      }
      case "ITEM_DISCOUNT_PERCENT": {
        const pct = promo.discountValue || 10;
        const minQ = promo.minQty ? ` (min qty: ${promo.minQty})` : "";
        parts.push(`gives ${pct}% OFF on ${targetCats}${targetBrands}${minQ}`);
        break;
      }
      case "ITEM_DISCOUNT_FLAT": {
        const amt = promo.discountValue || 100;
        parts.push(`gives flat ₹${amt} OFF per piece on ${targetCats}${targetBrands}`);
        break;
      }
      case "ITEM_BUNDLE_COMBO": {
        const price = promo.fixedComboPrice || 1999;
        const minQ = promo.minQty || 3;
        parts.push(`any ${minQ} pieces of ${targetCats}${targetBrands} sold for a fixed bundle price of ₹${price.toLocaleString("en-IN")}`);
        break;
      }
      case "ITEM_LAST_PIECE": {
        const pct = promo.discountValue || 25;
        parts.push(`gives ${pct}% clearance markdown when purchasing the last remaining unit in stock`);
        break;
      }
      case "BILL_DISCOUNT_FLAT": {
        const amt = promo.discountValue || 500;
        const threshold = promo.minBillValue ? ` on bills of ₹${promo.minBillValue.toLocaleString("en-IN")} or more` : "";
        parts.push(`gives flat ₹${amt} OFF${threshold}`);
        break;
      }
      case "BILL_DISCOUNT_PERCENT": {
        const pct = promo.discountValue || 10;
        const threshold = promo.minBillValue ? ` on bills of ₹${promo.minBillValue.toLocaleString("en-IN")} or more` : "";
        parts.push(`gives ${pct}% OFF the entire bill${threshold}`);
        break;
      }
      case "BILL_VALUE_SLAB": {
        const pct = promo.discountValue || 10;
        const threshold = promo.minBillValue ? ` above ₹${promo.minBillValue.toLocaleString("en-IN")}` : "";
        parts.push(`gives ${pct}% slab savings${threshold}`);
        break;
      }
      case "BILL_FREE_GIFT": {
        const threshold = promo.minBillValue ? ` on bills above ₹${promo.minBillValue.toLocaleString("en-IN")}` : "";
        parts.push(`awards a free gift item${threshold}`);
        break;
      }
      default:
        parts.push(`applies promotional scheme ${promo.name || promo.code || ""}`);
    }

    if (promo.maxDiscount) {
      parts.push(`(max discount capped at ₹${promo.maxDiscount.toLocaleString("en-IN")})`);
    }

    return parts.join(", ").replace(/, for/, " for");
  }

  /**
   * Embedded Simulation Engine: Tests cart items against a promotion rule
   */
  public static simulateCart(
    cartLines: SimulatedCartLine[],
    promo: SmritiDefinedSalesPromotion,
    options: {
      applyBillLevelFirst?: boolean;
      customerGroup?: string;
      simulatedTime?: string; // HH:mm
      simulatedDay?: string; // e.g. "SAT"
    } = {}
  ): SimulationResult {
    const originalTotal = cartLines.reduce((acc, l) => acc + l.qty * l.unitPrice, 0);

    // 1. Day of week check
    if (promo.daysOfWeek && promo.daysOfWeek.length > 0 && options.simulatedDay) {
      if (!promo.daysOfWeek.includes(options.simulatedDay)) {
        return {
          isEligible: false,
          reason: `Not active on ${options.simulatedDay} (Applicable only on ${promo.daysOfWeek.join(", ")})`,
          originalTotal,
          discountTotal: 0,
          finalTotal: originalTotal,
          lines: cartLines.map(l => ({
            sku: l.sku,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            originalLineTotal: l.qty * l.unitPrice,
            discountAmount: 0,
            finalLineTotal: l.qty * l.unitPrice,
            appliedRule: "None (Inactive on this day)"
          }))
        };
      }
    }

    // 2. Happy hours check
    if (promo.isHappyHours && promo.happyHoursStart && promo.happyHoursEnd && options.simulatedTime) {
      if (options.simulatedTime < promo.happyHoursStart || options.simulatedTime > promo.happyHoursEnd) {
        return {
          isEligible: false,
          reason: `Happy hours active only between ${promo.happyHoursStart} and ${promo.happyHoursEnd}`,
          originalTotal,
          discountTotal: 0,
          finalTotal: originalTotal,
          lines: cartLines.map(l => ({
            sku: l.sku,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            originalLineTotal: l.qty * l.unitPrice,
            discountAmount: 0,
            finalLineTotal: l.qty * l.unitPrice,
            appliedRule: "None (Outside happy hours)"
          }))
        };
      }
    }

    // 3. Customer group check
    if (
      promo.applicableCustomerGroups &&
      promo.applicableCustomerGroups.length > 0 &&
      !promo.applicableCustomerGroups.includes("ALL")
    ) {
      const custGroup = options.customerGroup || "ALL";
      if (!promo.applicableCustomerGroups.includes(custGroup)) {
        return {
          isEligible: false,
          reason: `Restricted to ${promo.applicableCustomerGroups.join(", ")} customers (Current: ${custGroup})`,
          originalTotal,
          discountTotal: 0,
          finalTotal: originalTotal,
          lines: cartLines.map(l => ({
            sku: l.sku,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            originalLineTotal: l.qty * l.unitPrice,
            discountAmount: 0,
            finalLineTotal: l.qty * l.unitPrice,
            appliedRule: "None (Customer tier mismatch)"
          }))
        };
      }
    }

    // 4. Evaluate Item Level vs Bill Level
    if (promo.level === "BILL_LEVEL") {
      const minVal = promo.minBillValue || 0;
      if (originalTotal < minVal) {
        return {
          isEligible: false,
          reason: `Minimum cart value ₹${minVal.toLocaleString("en-IN")} required (Current: ₹${originalTotal.toLocaleString("en-IN")})`,
          originalTotal,
          discountTotal: 0,
          finalTotal: originalTotal,
          lines: cartLines.map(l => ({
            sku: l.sku,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            originalLineTotal: l.qty * l.unitPrice,
            discountAmount: 0,
            finalLineTotal: l.qty * l.unitPrice,
            appliedRule: "None (Threshold not met)"
          }))
        };
      }

      let billDiscount = 0;
      if (promo.category === "BILL_DISCOUNT_FLAT") {
        billDiscount = Math.min(promo.discountValue, originalTotal);
      } else if (promo.category === "BILL_DISCOUNT_PERCENT" || promo.category === "BILL_VALUE_SLAB") {
        billDiscount = (originalTotal * promo.discountValue) / 100;
      }

      if (promo.maxDiscount && billDiscount > promo.maxDiscount) {
        billDiscount = promo.maxDiscount;
      }

      // Prorate bill discount across lines
      const simulatedLines = cartLines.map(l => {
        const lineVal = l.qty * l.unitPrice;
        const lineDisc = originalTotal > 0 ? (lineVal / originalTotal) * billDiscount : 0;
        return {
          sku: l.sku,
          name: l.name,
          qty: l.qty,
          unitPrice: l.unitPrice,
          originalLineTotal: lineVal,
          discountAmount: Math.round(lineDisc * 100) / 100,
          finalLineTotal: Math.round((lineVal - lineDisc) * 100) / 100,
          appliedRule: `${promo.name} (Prorated Bill Discount)`
        };
      });

      return {
        isEligible: true,
        reason: `✅ Applied bill-level discount: ₹${billDiscount.toLocaleString("en-IN")} saved!`,
        originalTotal,
        discountTotal: billDiscount,
        finalTotal: originalTotal - billDiscount,
        lines: simulatedLines
      };
    }

    // 5. Item Level Evaluations
    const matchesItem = (l: SimulatedCartLine): boolean => {
      if (promo.applicableCategories && promo.applicableCategories.length > 0) {
        if (!promo.applicableCategories.some(c => c.toLowerCase() === l.category.toLowerCase())) {
          return false;
        }
      }
      if (promo.applicableBrands && promo.applicableBrands.length > 0) {
        if (!promo.applicableBrands.some(b => b.toLowerCase() === l.brand.toLowerCase())) {
          return false;
        }
      }
      return true;
    };

    const qualifyingLines = cartLines.filter(matchesItem);
    const qualifyingQty = qualifyingLines.reduce((acc, l) => acc + l.qty, 0);

    if (promo.category === "ITEM_OFFER_B2G1") {
      const buyQty = promo.buyQty || 2;
      const freeQty = promo.freeQty || 1;
      const bundleSize = buyQty + freeQty;

      if (qualifyingQty < bundleSize) {
        return {
          isEligible: false,
          reason: `Need at least ${bundleSize} qualifying items (Current: ${qualifyingQty})`,
          originalTotal,
          discountTotal: 0,
          finalTotal: originalTotal,
          lines: cartLines.map(l => ({
            sku: l.sku,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            originalLineTotal: l.qty * l.unitPrice,
            discountAmount: 0,
            finalLineTotal: l.qty * l.unitPrice,
            appliedRule: "None (Need more items)"
          }))
        };
      }

      const bundlesAwarded = Math.floor(qualifyingQty / bundleSize);
      const totalFreeUnits = bundlesAwarded * freeQty;

      // Expand qualifying units into single tokens
      interface Token {
        lineIndex: number;
        sku: string;
        name: string;
        unitPrice: number;
      }
      const tokens: Token[] = [];
      cartLines.forEach((l, idx) => {
        if (matchesItem(l)) {
          for (let q = 0; q < l.qty; q++) {
            tokens.push({ lineIndex: idx, sku: l.sku, name: l.name, unitPrice: l.unitPrice });
          }
        }
      });

      // Sort tokens: lowest first (default) or highest first
      if (promo.appliedOn === "HIGHEST_PRICE") {
        tokens.sort((a, b) => b.unitPrice - a.unitPrice);
      } else {
        tokens.sort((a, b) => a.unitPrice - b.unitPrice);
      }

      // Mark free tokens
      const freeTokens = tokens.slice(0, totalFreeUnits);
      const discountPerLine: Record<number, number> = {};
      freeTokens.forEach(t => {
        discountPerLine[t.lineIndex] = (discountPerLine[t.lineIndex] || 0) + t.unitPrice;
      });

      let totalDiscount = freeTokens.reduce((acc, t) => acc + t.unitPrice, 0);
      if (promo.maxDiscount && totalDiscount > promo.maxDiscount) {
        totalDiscount = promo.maxDiscount;
      }

      const resultLines = cartLines.map((l, idx) => {
        const disc = discountPerLine[idx] || 0;
        const orig = l.qty * l.unitPrice;
        return {
          sku: l.sku,
          name: l.name,
          qty: l.qty,
          unitPrice: l.unitPrice,
          originalLineTotal: orig,
          discountAmount: disc,
          finalLineTotal: orig - disc,
          appliedRule: disc > 0 ? `${promo.name} (Free Item Awarded)` : matchesItem(l) ? `${promo.name} (Qualifying Buy Line)` : "None",
          isFreeItem: disc > 0
        };
      });

      return {
        isEligible: true,
        reason: `✅ Applied BOGO offer: ${bundlesAwarded} bundle(s) qualified, saving ₹${totalDiscount.toLocaleString("en-IN")} on free item(s)!`,
        originalTotal,
        discountTotal: totalDiscount,
        finalTotal: originalTotal - totalDiscount,
        lines: resultLines
      };
    }

    // Standard item percentage or flat discount
    if (promo.category === "ITEM_DISCOUNT_PERCENT") {
      let totalDiscount = 0;
      const resultLines = cartLines.map(l => {
        const orig = l.qty * l.unitPrice;
        if (matchesItem(l)) {
          const disc = (orig * promo.discountValue) / 100;
          totalDiscount += disc;
          return {
            sku: l.sku,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            originalLineTotal: orig,
            discountAmount: disc,
            finalLineTotal: orig - disc,
            appliedRule: `${promo.name} (${promo.discountValue}% Off)`
          };
        }
        return {
          sku: l.sku,
          name: l.name,
          qty: l.qty,
          unitPrice: l.unitPrice,
          originalLineTotal: orig,
          discountAmount: 0,
          finalLineTotal: orig,
          appliedRule: "None"
        };
      });

      if (promo.maxDiscount && totalDiscount > promo.maxDiscount) {
        totalDiscount = promo.maxDiscount;
      }

      return {
        isEligible: totalDiscount > 0,
        reason: totalDiscount > 0 ? `✅ Saved ₹${totalDiscount.toLocaleString("en-IN")} (${promo.discountValue}% Off qualifying lines)!` : "No qualifying items in cart",
        originalTotal,
        discountTotal: totalDiscount,
        finalTotal: originalTotal - totalDiscount,
        lines: resultLines
      };
    }

    // Bundle / Combo Fixed Value
    if (promo.category === "ITEM_BUNDLE_COMBO") {
      const minQty = promo.minQty || 3;
      const comboPrice = promo.fixedComboPrice || 1999;
      if (qualifyingQty < minQty) {
        return {
          isEligible: false,
          reason: `Need at least ${minQty} items for bundle offer (Current: ${qualifyingQty})`,
          originalTotal,
          discountTotal: 0,
          finalTotal: originalTotal,
          lines: cartLines.map(l => ({
            sku: l.sku,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            originalLineTotal: l.qty * l.unitPrice,
            discountAmount: 0,
            finalLineTotal: l.qty * l.unitPrice,
            appliedRule: "None"
          }))
        };
      }

      const qualifyingTotal = qualifyingLines.reduce((acc, l) => acc + l.qty * l.unitPrice, 0);
      const discountAmount = Math.max(0, qualifyingTotal - comboPrice);

      return {
        isEligible: true,
        reason: `✅ Combo Bundle activated: ${minQty} items bundled for ₹${comboPrice.toLocaleString("en-IN")} (Saved ₹${discountAmount.toLocaleString("en-IN")})`,
        originalTotal,
        discountTotal: discountAmount,
        finalTotal: originalTotal - discountAmount,
        lines: cartLines.map(l => {
          const orig = l.qty * l.unitPrice;
          const disc = matchesItem(l) && qualifyingTotal > 0 ? (orig / qualifyingTotal) * discountAmount : 0;
          return {
            sku: l.sku,
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            originalLineTotal: orig,
            discountAmount: Math.round(disc * 100) / 100,
            finalLineTotal: Math.round((orig - disc) * 100) / 100,
            appliedRule: matchesItem(l) ? `${promo.name} (Fixed Bundle ₹${comboPrice})` : "None"
          };
        })
      };
    }

    // Default fallback
    return {
      isEligible: false,
      reason: "No rules matched the cart",
      originalTotal,
      discountTotal: 0,
      finalTotal: originalTotal,
      lines: cartLines.map(l => ({
        sku: l.sku,
        name: l.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        originalLineTotal: l.qty * l.unitPrice,
        discountAmount: 0,
        finalLineTotal: l.qty * l.unitPrice,
        appliedRule: "None"
      }))
    };
  }

  /**
  /**
   * Real-Time Item-Level Auto-Select Resolver:
   * Evaluates all active ITEM_LEVEL promotions against a scanned or entered product.
   * If multiple promotions qualify, selects the one offering the HIGHEST customer discount (Highest Discount Wins).
   */
  public static resolveBestItemPromo(params: {
    sku?: string;
    barcode?: string;
    category?: string;
    brand?: string;
    rate: number;
    qty?: number;
    customerGroup?: string;
    customerCode?: string;
    customerName?: string;
    pricingBasis?: "MRP" | "RATE";
    allowPromotionsOnRate?: boolean;
    evalDate?: Date;
    asOf?: Date;
    currentTime?: string; // "HH:mm"
    currentDay?: string; // "MON", "TUE", etc.
    isLastPiece?: boolean;
    stockQty?: number;
  }): ItemPromoResolutionResult {
    const qty = params.qty && params.qty > 0 ? params.qty : 1;
    const rate = params.rate > 0 ? params.rate : 0;
    const evalDate = params.evalDate || params.asOf || new Date();
    const customerGroup = (params.customerGroup || "ALL").trim().toUpperCase();
    const itemCat = (params.category || "").trim().toLowerCase();
    const itemBrand = (params.brand || "").trim().toLowerCase();
    const itemSku = (params.sku || "").trim().toLowerCase();
    const itemBarcode = (params.barcode || "").trim().toLowerCase();

    // Determine day of week if not passed
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const currentDay = params.currentDay || dayNames[evalDate.getDay()];

    // Determine current time HH:mm if not passed
    const hours = String(evalDate.getHours()).padStart(2, "0");
    const mins = String(evalDate.getMinutes()).padStart(2, "0");
    const currentTime = params.currentTime || `${hours}:${mins}`;

    const nullResult: ItemPromoResolutionResult = {
      applied: false,
      promo: null,
      rule: null,
      discountPct: 0,
      discountAmt: 0,
      promoCode: "",
      promoDescription: "",
      schemeType: null,
      reason: "No active promotion qualified",
      appliedOnQty: qty,
      badgeText: "",
      ruleDescription: ""
    };

    if (rate <= 0) {
      return nullResult;
    }

    // Institutional Contract Exclusivity: Customer Reliance Retail Ltd.
    // Requirement: Skip ALL discounts for Customer Reliance Retail Ltd. except 43.76% (if already added else create and assign it)
    const isReliance = this.isRelianceCustomer({
      name: params.customerName,
      code: params.customerCode,
      customerGroup: params.customerGroup
    });

    if (isReliance) {
      const relPromo = this.ensureReliance4376Promotion();
      const discPct = 43.76;
      const discAmt = Math.round(((rate * qty * discPct) / 100) * 100) / 100;
      return {
        applied: true,
        promo: relPromo,
        rule: relPromo.rules?.[0] || null,
        discountPct: discPct,
        discountAmt: discAmt,
        promoCode: relPromo.code,
        promoDescription: "Reliance Retail Trade Concession (43.76% on MRP)",
        schemeType: "ITEM_DISCOUNT_PERCENT",
        reason: "Applied mandatory 43.76% Reliance Retail trade concession. All other promotional schemes skipped per contractual exclusivity.",
        appliedOnQty: qty,
        badgeText: "43.76% [REL_RET_4376]",
        ruleDescription: "Reliance Retail Store 43.76% on MRP",
        explainability: {
          schemeCode: "REL_RET_4376",
          schemeName: "Reliance Retail Store 43.76% on MRP",
          checks: [
            {
              rule: "RELIANCE_CONTRACT_EXCLUSIVITY",
              passed: true,
              observedValue: params.customerName || params.customerCode || "Reliance Retail Ltd.",
              requiredValue: "Institutional 43.76% Trade Concession",
              explanation: "Strict contractual 43.76% discount applied; all standard retail promotions suppressed."
            }
          ],
          arbitrationResult: "WON",
          rationale: "Contractual trade discount for Reliance Retail Ltd.",
          winningDiscountAmount: discAmt
        },
        unclaimedFreeItemOffer: null,
        taxTreatment: "PRE_TAX_TRADE_DISCOUNT"
      };
    }

    // Margin Protection Governance for Wholesale Trade Rate:
    // If customer is billed on RATE, retail promotions (BOGO, ILD, EOSS, Clearance)
    // are suppressed by default to prevent double-discounting margin destruction.
    const pricingBasis = params.pricingBasis || "MRP";
    const allowPromotionsOnRate = Boolean(params.allowPromotionsOnRate);

    if (pricingBasis === "RATE" && !allowPromotionsOnRate) {
      return {
        applied: false,
        promo: null,
        rule: null,
        discountPct: 0,
        discountAmt: 0,
        promoCode: "",
        promoDescription: "Retail promotions suppressed: Customer billed on Wholesale Trade Rate",
        schemeType: null,
        reason: "Customer pricing basis is RATE (Wholesale/Trade). Retail promotional offers are automatically suppressed to safeguard trade margins.",
        appliedOnQty: qty,
        badgeText: "RATE (NET)",
        ruleDescription: "Trade Rate Net Billing"
      };
    }

    const activeItemPromos = this.getActivePromotionsByLevel("ITEM_LEVEL", evalDate);

    interface Candidate {
      promo: SmritiDefinedSalesPromotion;
      discountPct: number;
      discountAmt: number;
      badgeText: string;
      ruleDescription: string;
      savings: number;
      appliedQty: number;
    }

    const candidates: Candidate[] = [];

    for (const promo of activeItemPromos) {
      // 1. Day of week filter
      if (promo.daysOfWeek && promo.daysOfWeek.length > 0 && promo.daysOfWeek.length < 7) {
        if (!promo.daysOfWeek.includes(currentDay)) continue;
      }

      // 2. Happy hours filter
      const hhStart = promo.happyHoursStart || promo.timeFrom;
      const hhEnd = promo.happyHoursEnd || promo.timeTo;
      if ((promo.isHappyHours || hhStart) && hhStart && hhEnd) {
        if (currentTime < hhStart || currentTime > hhEnd) continue;
      }

      // 3. Customer group filter
      const custGroups = promo.applicableCustomerGroups || [];
      const ruleCustGroups = (promo.rules || [])
        .filter((r: any) => r.ruleType === "CUSTOMER_GROUP")
        .map((r: any) => r.targetValue);
      const allCustGroups = [...custGroups, ...ruleCustGroups].map(g => String(g).trim().toUpperCase());

      if (allCustGroups.length > 0 && !allCustGroups.includes("ALL")) {
        if (!customerGroup || customerGroup === "ALL") continue;
        const normCustGroup = customerGroup.trim().toUpperCase();
        const matches = allCustGroups.some(g =>
          normCustGroup === g ||
          normCustGroup.includes(g) ||
          g.includes(normCustGroup)
        );
        if (!matches) continue;
      }

      // 4. Category / Brand / SKU filters
      let matchesTarget = true;
      const promoCats = (promo.applicableCategories || []).map(c => c.trim().toLowerCase());
      const promoBrands = (promo.applicableBrands || []).map(b => b.trim().toLowerCase());

      if (promo.rules && promo.rules.length > 0) {
        for (const r of promo.rules) {
          if (r.ruleType === "CATEGORY") {
            const targetVal = String(r.targetValue).trim().toLowerCase();
            if (!itemCat || itemCat !== targetVal) {
              matchesTarget = false;
              break;
            }
          } else if (r.ruleType === "BRAND") {
            const targetVal = String(r.targetValue).trim().toLowerCase();
            if (!itemBrand || itemBrand !== targetVal) {
              matchesTarget = false;
              break;
            }
          } else if (r.ruleType === "SKU") {
            const targetVal = String(r.targetValue).trim().toLowerCase();
            if (!itemSku || (itemSku !== targetVal && itemBarcode !== targetVal)) {
              matchesTarget = false;
              break;
            }
          } else if (r.ruleType === "MIN_QTY") {
            if (qty < (r.minQuantity || 1)) {
              matchesTarget = false;
              break;
            }
          }
        }
      } else {
        if (promoCats.length > 0) {
          const catMatch = promoCats.some(c => itemCat === c || itemCat.includes(c) || c.includes(itemCat));
          if (!catMatch && itemCat) matchesTarget = false;
          if (promoCats.length > 0 && !itemCat) matchesTarget = false;
        }
        if (promoBrands.length > 0) {
          const brandMatch = promoBrands.some(b => itemBrand === b || itemBrand.includes(b) || b.includes(itemBrand));
          if (!brandMatch && itemBrand) matchesTarget = false;
          if (promoBrands.length > 0 && !itemBrand) matchesTarget = false;
        }
      }

      if (!matchesTarget) continue;

      // 5. Min quantity check
      const minQty = promo.minQty || promo.rules?.find((r: any) => r.ruleType === "MIN_QTY")?.minQuantity;
      if (minQty && qty < minQty) {
        continue;
      }

      // 6. Calculate discount for this promo
      let discPct = 0;
      let discAmt = 0;
      let appliedQty = qty;
      const lineGross = rate * qty;

      if (promo.category === "ITEM_DISCOUNT_PERCENT") {
        discPct = promo.discountValue || 0;
        discAmt = (lineGross * discPct) / 100;
        if (promo.maxDiscount && discAmt > promo.maxDiscount) {
          discAmt = promo.maxDiscount;
          discPct = lineGross > 0 ? (discAmt / lineGross) * 100 : 0;
        }
      } else if (promo.category === "ITEM_DISCOUNT_FLAT") {
        const perPieceAmt = promo.discountValue || 0;
        discAmt = Math.min(lineGross, perPieceAmt * qty);
        discPct = lineGross > 0 ? (discAmt / lineGross) * 100 : 0;
        if (promo.maxDiscount && discAmt > promo.maxDiscount) {
          discAmt = promo.maxDiscount;
          discPct = lineGross > 0 ? (discAmt / lineGross) * 100 : 0;
        }
      } else if (promo.category === "ITEM_OFFER_B2G1") {
        const buy = promo.buyQty || 2;
        const free = promo.freeQty || 1;
        const bundleSize = buy + free;
        if (qty >= bundleSize) {
          const bundles = Math.floor(qty / bundleSize);
          const freePieces = bundles * free;
          discAmt = freePieces * rate;
          discPct = lineGross > 0 ? (discAmt / lineGross) * 100 : 0;
          appliedQty = freePieces;
        } else {
          continue;
        }
      } else if (promo.category === "ITEM_LAST_PIECE") {
        const qualifiesLastPiece = params.isLastPiece || (params.stockQty !== undefined && params.stockQty <= 1);
        if (qualifiesLastPiece && qty === 1) {
          discPct = promo.discountValue || 25;
          discAmt = (lineGross * discPct) / 100;
        } else {
          continue;
        }
      }

      if (discAmt > 0 || discPct > 0) {
        candidates.push({
          promo,
          discountPct: Math.round(discPct * 100) / 100,
          discountAmt: Math.round(discAmt * 100) / 100,
          badgeText: `${discPct.toFixed(1)}% [${promo.code}]`,
          ruleDescription: promo.name || promo.description,
          savings: discAmt,
          appliedQty
        });
      }
    }

    if (candidates.length === 0) {
      return nullResult;
    }

    // Sort candidates: Highest savings wins. If savings equal, smallest priority number wins.
    candidates.sort((a, b) => {
      if (Math.abs(b.savings - a.savings) > 0.01) {
        return b.savings - a.savings;
      }
      return a.promo.priority - b.promo.priority;
    });

    const best = candidates[0];

    // Build explainability verification checklist
    const itemChecks: PromotionExplainabilityCheck[] = [
      {
        rule: "SCHEDULE_ACTIVE",
        passed: true,
        observedValue: `${currentDay} ${currentTime}`,
        requiredValue: "Within validity schedule",
        explanation: `Promotion is active on ${currentDay} at ${currentTime}`
      },
      {
        rule: "CUSTOMER_ELIGIBILITY",
        passed: true,
        observedValue: customerGroup,
        requiredValue: best.promo.applicableCustomerGroups?.join(", ") || "ALL",
        explanation: `Customer group '${customerGroup}' satisfies scheme eligibility`
      },
      {
        rule: "CATALOG_TARGETING",
        passed: true,
        observedValue: `${itemCat || "N/A"} / ${itemBrand || "N/A"}`,
        requiredValue: best.promo.applicableCategories?.join(", ") || "All Categories",
        explanation: `Line item satisfies targeted category/brand specifications`
      },
      {
        rule: "MIN_QUANTITY",
        passed: true,
        observedValue: qty,
        requiredValue: best.promo.minQty || 1,
        explanation: `Quantity ${qty} meets minimum required units of ${best.promo.minQty || 1}`
      }
    ];

    const explainability: PromotionExplanation = {
      schemeCode: best.promo.code,
      schemeName: best.promo.name,
      checks: itemChecks,
      arbitrationResult: "WON",
      rationale: candidates.length > 1
        ? `Won Best Benefit arbitration (Savings ₹${best.discountAmt.toFixed(2)}) against ${candidates.length - 1} other competing item promotions.`
        : `Primary qualifying promotion for this product scan.`,
      winningDiscountAmount: best.discountAmt
    };

    let unclaimedFreeItemOffer: UnclaimedFreeItemOffer | null = null;
    if (best.promo.category === "ITEM_OFFER_B2G1") {
      const buy = best.promo.buyQty || 2;
      const free = best.promo.freeQty || 1;
      const bundleSize = buy + free;
      const bundles = Math.floor(qty / bundleSize);
      const freePieces = bundles * free;
      unclaimedFreeItemOffer = {
        schemeCode: best.promo.code,
        schemeName: best.promo.name,
        freeQty: freePieces > 0 ? freePieces : free,
        estimatedSavings: (freePieces > 0 ? freePieces : free) * rate,
        qualificationStatus: freePieces > 0 ? "REDEEMED" : "QUALIFIED"
      };
    }

    return {
      applied: true,
      promo: best.promo,
      rule: best.promo.rules?.[0] || null,
      discountPct: best.discountPct,
      discountAmt: best.discountAmt,
      promoCode: best.promo.code,
      promoDescription: best.ruleDescription || best.promo.description || best.promo.name,
      schemeType: best.promo.category,
      reason: `Auto-selected best qualifying promotional scheme: ${best.promo.name} (${best.discountPct}% off)`,
      appliedOnQty: best.appliedQty,
      badgeText: best.badgeText,
      ruleDescription: best.ruleDescription,
      explainability,
      unclaimedFreeItemOffer,
      taxTreatment: "PRE_TAX_TRADE_DISCOUNT"
    };
  }

  /**
   * Real-Time Bill-Level Auto-Select Resolver:
   * Evaluates all active BILL_LEVEL promotions against the current cart subtotal, item count, and customer profile.
   * Enforces bill value thresholds (minBillValue), ceiling caps (maxDiscount), schedule gates, and customer group eligibility.
   * If multiple promotions qualify, selects the one offering the HIGHEST customer savings (Highest Discount Wins).
   */
  public static resolveBestBillPromo(params: {
    subtotal: number;
    itemsCount?: number;
    customerGroup?: string;
    customerCode?: string;
    customerName?: string;
    evalDate?: Date;
    asOf?: Date;
    currentTime?: string; // "HH:mm"
    currentDay?: string; // "MON", "TUE", etc.
  }): BillPromoResolutionResult {
    const subtotal = params.subtotal > 0 ? params.subtotal : 0;
    const itemsCount = params.itemsCount && params.itemsCount > 0 ? params.itemsCount : 0;
    const evalDate = params.evalDate || params.asOf || new Date();
    const customerGroup = (params.customerGroup || "ALL").trim().toUpperCase();

    // Determine day of week if not passed
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const currentDay = params.currentDay || dayNames[evalDate.getDay()];

    // Determine current time HH:mm if not passed
    const hours = String(evalDate.getHours()).padStart(2, "0");
    const mins = String(evalDate.getMinutes()).padStart(2, "0");
    const currentTime = params.currentTime || `${hours}:${mins}`;

    const nullResult: BillPromoResolutionResult = {
      applied: false,
      promo: null,
      discountPct: 0,
      discountAmt: 0,
      promoCode: "NONE",
      promoName: "No Bill Discount",
      promoDescription: "",
      schemeType: null,
      reason: "No active bill promotion qualified",
      badgeText: ""
    };

    if (subtotal <= 0) {
      return nullResult;
    }

    // Institutional Contract Check: Customer Reliance Retail Ltd.
    // Rule: Skip ALL bill promotions for Reliance Retail Ltd. (contractual markdown applied at item level)
    const isReliance = this.isRelianceCustomer({
      name: params.customerName,
      code: params.customerCode,
      customerGroup: params.customerGroup
    });

    if (isReliance) {
      return {
        applied: false,
        promo: null,
        discountPct: 0,
        discountAmt: 0,
        promoCode: "NONE",
        promoName: "No Bill Discount",
        promoDescription: "",
        schemeType: null,
        reason: "Bill-level discounts skipped for Reliance Retail Ltd. (Institutional 43.76% trade concession applied at line level)",
        badgeText: ""
      };
    }

    const activeBillPromos = this.getActivePromotionsByLevel("BILL_LEVEL", evalDate);

    interface BillCandidate {
      promo: SmritiDefinedSalesPromotion;
      discountPct: number;
      discountAmt: number;
      savings: number;
      badgeText: string;
      description: string;
    }

    const candidates: BillCandidate[] = [];

    for (const promo of activeBillPromos) {
      // 1. Skip dummy or zero discount
      const val = promo.discountValue ?? (promo as any).discount_value ?? 0;
      if (promo.code === "NONE" || val <= 0) {
        continue;
      }

      // 2. Day of week filter
      if (promo.daysOfWeek && promo.daysOfWeek.length > 0 && promo.daysOfWeek.length < 7) {
        if (!promo.daysOfWeek.includes(currentDay)) continue;
      }

      // 3. Happy hours / time filter
      const hhStart = promo.happyHoursStart || promo.timeFrom;
      const hhEnd = promo.happyHoursEnd || promo.timeTo;
      if ((promo.isHappyHours || hhStart) && hhStart && hhEnd) {
        if (currentTime < hhStart || currentTime > hhEnd) continue;
      }

      // 4. Customer group filter
      const custGroups = promo.applicableCustomerGroups || [];
      const ruleCustGroups = (promo.rules || [])
        .filter((r: any) => r.ruleType === "CUSTOMER_GROUP")
        .map((r: any) => r.targetValue);
      const allCustGroups = [...custGroups, ...ruleCustGroups].map(g => String(g).trim().toUpperCase());

      if (allCustGroups.length > 0 && !allCustGroups.includes("ALL")) {
        if (!customerGroup || customerGroup === "ALL") continue;
        const normCustGroup = customerGroup.trim().toUpperCase();
        const matches = allCustGroups.some(g =>
          normCustGroup === g ||
          normCustGroup.includes(g) ||
          g.includes(normCustGroup)
        );
        if (!matches) continue;
      }

      // 5. Minimum Bill Value threshold check
      const minBillVal = promo.minBillValue ?? (promo as any).min_bill_value ?? promo.rules?.find((r: any) => r.ruleType === "MIN_BILL_VALUE")?.minBillValue ?? 0;
      if (subtotal < minBillVal) {
        continue;
      }

      // 6. Minimum Quantity check (if specified on bill promo)
      const minQty = promo.minQty ?? (promo as any).min_qty ?? 0;
      if (minQty > 0 && itemsCount < minQty) {
        continue;
      }

      // 7. Calculate discount
      let discPct = 0;
      let discAmt = 0;
      const maxDisc = promo.maxDiscount ?? (promo as any).max_discount;

      if (promo.category === "BILL_DISCOUNT_PERCENT" || promo.category === "BILL_VALUE_SLAB") {
        discPct = val;
        discAmt = (subtotal * discPct) / 100;
        if (maxDisc && discAmt > maxDisc) {
          discAmt = maxDisc;
          discPct = subtotal > 0 ? (discAmt / subtotal) * 100 : 0;
        }
      } else if (promo.category === "BILL_DISCOUNT_FLAT") {
        discAmt = Math.min(subtotal, val);
        discPct = subtotal > 0 ? (discAmt / subtotal) * 100 : 0;
        if (maxDisc && discAmt > maxDisc) {
          discAmt = maxDisc;
          discPct = subtotal > 0 ? (discAmt / subtotal) * 100 : 0;
        }
      }

      if (discAmt > 0) {
        candidates.push({
          promo,
          discountPct: Math.round(discPct * 100) / 100,
          discountAmt: Math.round(discAmt * 100) / 100,
          savings: discAmt,
          badgeText: promo.category === "BILL_DISCOUNT_FLAT" ? `₹${discAmt.toFixed(0)} OFF [${promo.code}]` : `${discPct.toFixed(1)}% OFF [${promo.code}]`,
          description: promo.name || promo.description
        });
      }
    }

    if (candidates.length === 0) {
      return nullResult;
    }

    // Sort candidates: Highest savings wins. If savings equal, smallest priority number wins.
    candidates.sort((a, b) => {
      if (Math.abs(b.savings - a.savings) > 0.01) {
        return b.savings - a.savings;
      }
      return a.promo.priority - b.promo.priority;
    });

    const best = candidates[0];

    const billChecks: PromotionExplainabilityCheck[] = [
      {
        rule: "BILL_THRESHOLD_MET",
        passed: true,
        observedValue: `₹${subtotal.toFixed(2)}`,
        requiredValue: `₹${(best.promo.minBillValue || 0).toFixed(2)}`,
        explanation: `Cart subtotal ₹${subtotal.toFixed(2)} satisfies minimum bill threshold ₹${(best.promo.minBillValue || 0).toFixed(2)}`
      },
      {
        rule: "CUSTOMER_ELIGIBILITY",
        passed: true,
        observedValue: customerGroup,
        requiredValue: best.promo.applicableCustomerGroups?.join(", ") || "ALL",
        explanation: `Customer group '${customerGroup}' satisfies scheme eligibility criteria`
      }
    ];

    const billExplainability: PromotionExplanation = {
      schemeCode: best.promo.code,
      schemeName: best.promo.name,
      checks: billChecks,
      arbitrationResult: "WON",
      rationale: candidates.length > 1
        ? `Won 'Highest Discount Wins' arbitration (Save ₹${best.discountAmt.toFixed(2)}) against ${candidates.length - 1} other competing bill schemes.`
        : `Sole qualifying bill-level scheme for cart value ₹${subtotal.toFixed(2)}.`,
      winningDiscountAmount: best.discountAmt
    };

    return {
      applied: true,
      promo: best.promo,
      discountPct: best.discountPct,
      discountAmt: best.discountAmt,
      promoCode: best.promo.code,
      promoName: best.promo.name,
      promoDescription: best.description || best.promo.description || best.promo.name,
      schemeType: best.promo.category,
      reason: `Auto-selected best qualifying bill promotion: ${best.promo.name} (Save ₹${best.discountAmt.toFixed(2)})`,
      badgeText: best.badgeText,
      explainability: billExplainability,
      taxTreatment: "PRE_TAX_TRADE_DISCOUNT"
    };
  }

  /**
   * Single Primary Context-Aware Basket Upsell Milestone Gauge:
   * Finds the nearest qualifying bill promotion threshold above current subtotal.
   * Renders a single-line ASCII progress gauge to prevent POS UI noise.
   */
  public static getBasketUpsellMilestone(
    subtotal: number,
    customerGroup: string = "ALL",
    evalDate: Date = new Date()
  ): BasketUpsellMilestone | null {
    if (subtotal <= 0) return null;
    const activeBillPromos = this.getActivePromotionsByLevel("BILL_LEVEL", evalDate);
    const candidateMilestones: {
      minBillValue: number;
      promo: SmritiDefinedSalesPromotion;
      potentialSavings: number;
    }[] = [];

    const normGroup = (customerGroup || "ALL").trim().toUpperCase();

    for (const promo of activeBillPromos) {
      if (!promo.isActive || promo.code === "NONE") continue;
      const custGroups = (promo.applicableCustomerGroups || []).map(g => g.trim().toUpperCase());
      if (custGroups.length > 0 && !custGroups.includes("ALL")) {
        if (!normGroup || normGroup === "ALL") continue;
        if (!custGroups.includes(normGroup)) continue;
      }
      const minVal = promo.minBillValue ?? 0;
      if (minVal > subtotal) {
        let potSavings = 0;
        const val = promo.discountValue || 0;
        if (promo.category === "BILL_DISCOUNT_FLAT") {
          potSavings = Math.min(minVal, val);
        } else if (promo.category === "BILL_DISCOUNT_PERCENT" || promo.category === "BILL_VALUE_SLAB") {
          potSavings = (minVal * val) / 100;
        }
        if (promo.maxDiscount && potSavings > promo.maxDiscount) {
          potSavings = promo.maxDiscount;
        }
        candidateMilestones.push({
          minBillValue: minVal,
          promo,
          potentialSavings: potSavings
        });
      }
    }

    if (candidateMilestones.length === 0) return null;

    // Sort by ascending minBillValue (nearest target first)
    candidateMilestones.sort((a, b) => a.minBillValue - b.minBillValue);
    const nearest = candidateMilestones[0];
    const remaining = nearest.minBillValue - subtotal;
    const pctProgress = Math.min(100, Math.max(0, Math.round((subtotal / nearest.minBillValue) * 100)));

    // Create 16-block visual gauge: [██████████████░░]
    const filledBlocks = Math.round((pctProgress / 100) * 16);
    const emptyBlocks = 16 - filledBlocks;
    const bar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);
    const gaugeText = `[${bar}] ₹${subtotal.toLocaleString("en-IN")} / ₹${nearest.minBillValue.toLocaleString("en-IN")} — Add ₹${remaining.toFixed(0)} more to get ₹${nearest.potentialSavings.toFixed(0)} OFF [${nearest.promo.code}]`;

    return {
      targetSubtotal: nearest.minBillValue,
      remainingAmount: remaining,
      percentProgress: pctProgress,
      schemeCode: nearest.promo.code,
      schemeName: nearest.promo.name,
      potentialSavings: nearest.potentialSavings,
      gaugeText
    };
  }

  /**
   * Non-Blocking Free Item / Promotion Decline Audit Logger:
   * Records cashier/customer decline events without blocking checkout.
   */
  public static recordPromotionDecline(params: {
    salesSessionId: string;
    schemeCode: string;
    cashierId?: string;
    customerId?: string;
    reasonCode?: string;
    reasonText?: string;
    potentialSavings: number;
  }): { recorded: boolean; declineId: string; timestamp: string } {
    const declineId = `dec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const timestamp = new Date().toISOString();
    try {
      const storedDeclines = JSON.parse(localStorage.getItem("smriti_promotion_declines") || "[]");
      storedDeclines.push({
        id: declineId,
        ...params,
        timestamp
      });
      localStorage.setItem("smriti_promotion_declines", JSON.stringify(storedDeclines));
    } catch (e) {
      // Graceful fallback for non-storage environments
    }
    return { recorded: true, declineId, timestamp };
  }
}

export interface ItemPromoResolutionResult {
  applied: boolean;
  promo: SmritiDefinedSalesPromotion | null;
  rule?: any | null;
  discountPct: number;
  discountAmt: number;
  promoCode: string;
  promoDescription: string;
  schemeType: SmritiPromoCategory | null;
  reason: string;
  appliedOnQty: number;
  badgeText?: string;
  ruleDescription?: string;
  explainability?: PromotionExplanation | null;
  unclaimedFreeItemOffer?: UnclaimedFreeItemOffer | null;
  taxTreatment?: string;
}

export interface BillPromoResolutionResult {
  applied: boolean;
  promo: SmritiDefinedSalesPromotion | null;
  discountPct: number;
  discountAmt: number;
  promoCode: string;
  promoName: string;
  promoDescription: string;
  schemeType: SmritiPromoCategory | null;
  reason: string;
  badgeText: string;
  explainability?: PromotionExplanation | null;
  taxTreatment?: string;
}

export interface RetailPromotionRecipe {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  badge: string;
  defaultScheme: Partial<SmritiDefinedSalesPromotion>;
  madLibsTemplate: string;
}

export interface SimulatedCartLine {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  qty: number;
  unitPrice: number;
}

export interface SimulationResult {
  isEligible: boolean;
  reason: string;
  originalTotal: number;
  discountTotal: number;
  finalTotal: number;
  lines: {
    sku: string;
    name: string;
    qty: number;
    unitPrice: number;
    originalLineTotal: number;
    discountAmount: number;
    finalLineTotal: number;
    appliedRule: string;
    isFreeItem?: boolean;
  }[];
}

export const SMRITI_PROMOTION_RECIPES: RetailPromotionRecipe[] = [
  {
    id: "recipe-bogo",
    name: "Buy 2 Get 1 Free (BOGO)",
    tagline: "Customer buys 2 items, gets the 3rd cheapest item free",
    icon: "gift",
    badge: "Popular Deal",
    defaultScheme: {
      code: "B2G1_PROMO",
      name: "Buy 2 Get 1 Free",
      description: "Buy any 2 items and get the 3rd item free (cheapest unit discounted)",
      level: "ITEM_LEVEL",
      category: "ITEM_OFFER_B2G1",
      priority: 1,
      discountValue: 100,
      buyQty: 2,
      freeQty: 1,
      minQty: 3,
      appliedOn: "LOWEST_PRICE",
      applicableCategories: ["Apparel", "Footwear"],
      applicableCustomerGroups: ["ALL"],
      isActive: true
    },
    madLibsTemplate: "When customer buys 2 items, give 1 item FREE on the cheapest piece."
  },
  {
    id: "recipe-flat-pct",
    name: "Flat % Discount on Items",
    tagline: "Instant percentage off across selected brands or categories",
    icon: "percent",
    badge: "Seasonal",
    defaultScheme: {
      code: "FLAT20",
      name: "Flat 20% Off",
      description: "Flat 20% discount on fresh arrivals",
      level: "ITEM_LEVEL",
      category: "ITEM_DISCOUNT_PERCENT",
      priority: 2,
      discountValue: 20,
      applicableCategories: ["Apparel"],
      applicableCustomerGroups: ["ALL"],
      isActive: true
    },
    madLibsTemplate: "Give 20% OFF on all selected categories."
  },
  {
    id: "recipe-flat-inr",
    name: "Flat ₹100 Off per Piece",
    tagline: "Fixed rupee concession deducted from each qualifying unit",
    icon: "tag",
    badge: "Markdown",
    defaultScheme: {
      code: "FLAT100",
      name: "Flat ₹100 Off",
      description: "Flat ₹100 instant markdown per unit",
      level: "ITEM_LEVEL",
      category: "ITEM_DISCOUNT_FLAT",
      priority: 3,
      discountValue: 100,
      applicableCategories: ["Footwear"],
      applicableCustomerGroups: ["ALL"],
      isActive: true
    },
    madLibsTemplate: "Give flat ₹100 OFF per item on all selected categories."
  },
  {
    id: "recipe-combo-fixed",
    name: "Any 3 for ₹1,999",
    tagline: "Fixed total combo price for picking any 3 bundle items",
    icon: "package",
    badge: "Bundle Combo",
    defaultScheme: {
      code: "3_FOR_1999",
      name: "Pick Any 3 for ₹1,999",
      description: "Customer picks any 3 shirts or tees for a fixed price of ₹1,999",
      level: "ITEM_LEVEL",
      category: "ITEM_BUNDLE_COMBO",
      priority: 2,
      discountValue: 0,
      minQty: 3,
      fixedComboPrice: 1999,
      applicableCategories: ["Apparel"],
      applicableCustomerGroups: ["ALL"],
      isActive: true
    },
    madLibsTemplate: "Customer buys any 3 items for a fixed bundle price of ₹1,999."
  },
  {
    id: "recipe-spend-save",
    name: "Spend ₹3,000, Get ₹500 Off",
    tagline: "Cart threshold discount encouraging higher basket size",
    icon: "shopping-cart",
    badge: "Bill Slab",
    defaultScheme: {
      code: "SPEND3K_SAVE500",
      name: "Spend ₹3,000 Save ₹500",
      description: "Flat ₹500 discount when total cart value reaches or exceeds ₹3,000",
      level: "BILL_LEVEL",
      category: "BILL_DISCOUNT_FLAT",
      priority: 1,
      discountValue: 500,
      minBillValue: 3000,
      maxDiscount: 500,
      applicableCustomerGroups: ["ALL"],
      isActive: true
    },
    madLibsTemplate: "When total bill reaches ₹3,000, give flat ₹500 OFF the invoice."
  },
  {
    id: "recipe-happy-hours",
    name: "Happy Hours 15% Off",
    tagline: "Time-window gated discount to boost slow afternoon store traffic",
    icon: "clock",
    badge: "Time Gated",
    defaultScheme: {
      code: "HAPPY_HOURS_15",
      name: "Afternoon Happy Hours 15% Off",
      description: "Special 15% storewide discount between 2:00 PM and 5:00 PM on weekdays",
      level: "ITEM_LEVEL",
      category: "ITEM_DISCOUNT_PERCENT",
      priority: 1,
      discountValue: 15,
      isHappyHours: true,
      happyHoursStart: "14:00",
      happyHoursEnd: "17:00",
      daysOfWeek: ["MON", "TUE", "WED", "THU", "FRI"],
      applicableCustomerGroups: ["ALL"],
      isActive: true
    },
    madLibsTemplate: "Give 15% OFF weekdays between 2:00 PM and 5:00 PM."
  },
  {
    id: "recipe-clearance",
    name: "Last Piece Stock Clearance (40% Off)",
    tagline: "Clear out dead stock by discounting the single last piece",
    icon: "sparkles",
    badge: "Clearance",
    defaultScheme: {
      code: "LAST_PC_40",
      name: "Last Piece 40% Clearance",
      description: "Automatic 40% markdown when cashier bills the final remaining inventory unit",
      level: "ITEM_LEVEL",
      category: "ITEM_LAST_PIECE",
      priority: 5,
      discountValue: 40,
      applicableCustomerGroups: ["ALL"],
      isActive: true
    },
    madLibsTemplate: "Give 40% OFF when selling the last physical piece in stock."
  },
  {
    id: "recipe-vip",
    name: "VIP Club 10% Member Exclusive",
    tagline: "Privilege loyalty concession for registered VIP customers",
    icon: "crown",
    badge: "VIP Exclusive",
    defaultScheme: {
      code: "VIP_PRIVILEGE",
      name: "VIP Club 10% Concession",
      description: "Exclusive 10% bill discount for registered VIP and Corporate customers",
      level: "BILL_LEVEL",
      category: "BILL_DISCOUNT_PERCENT",
      priority: 1,
      discountValue: 10,
      maxDiscount: 2000,
      applicableCustomerGroups: ["VIP", "CORPORATE"],
      isActive: true
    },
    madLibsTemplate: "Give 10% OFF for VIP and Corporate club members."
  },
  {
    id: "recipe-reliance-trade",
    name: "Reliance Retail Trade Concession (43.76% on MRP)",
    tagline: "Standard institutional trade concession for Reliance Retail stores",
    icon: "building-2",
    badge: "Key Account",
    defaultScheme: {
      code: "REL_RET_4376",
      name: "Reliance Retail Store 43.76% on MRP",
      description: "Institutional trade discount: 43.76% markdown on MRP for Reliance Retail billing",
      level: "ITEM_LEVEL",
      category: "ITEM_DISCOUNT_PERCENT",
      priority: 1,
      discountValue: 43.76,
      appliedOn: "MRP",
      applicableCustomerGroups: ["RELIANCE", "RELIANCE_RETAIL", "ALL"],
      isActive: true
    },
    madLibsTemplate: "Give 43.76% trade concession on MRP for Reliance Retail Store."
  }
];



