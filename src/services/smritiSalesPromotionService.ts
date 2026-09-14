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
  isHappyHours?: boolean;
  happyHoursStart?: string; // HH:mm
  happyHoursEnd?: string; // HH:mm
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "smriti_sales_promotions_catalog";

export const DEFAULT_DEFINED_SALES_PROMOTIONS: SmritiDefinedSalesPromotion[] = [
  // ─── 1. ITEM LEVEL PROMOTIONS ───────────────────────────────────────────
  {
    id: "sp-item-ild",
    code: "ILD",
    name: "Standard Item Line Discount",
    description: "Standard 10% promotional line discount on catalog apparel",
    level: "ITEM_LEVEL",
    category: "ITEM_DISCOUNT_PERCENT",
    priority: 1,
    discountValue: 10,
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
    maxDiscount: 3000,
    applicableCustomerGroups: ["ALL"],
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    isActive: true,
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
    isActive: true,
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

    if (idx >= 0) {
      all[idx] = { ...promo, updatedAt: now };
    } else {
      all.push({ ...promo, createdAt: promo.createdAt || now, updatedAt: now });
    }

    try {
      const storage = this.getStorage();
      storage?.setItem(STORAGE_KEY, JSON.stringify(all));
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
    } catch (e) {
      console.error("[SmritiSalesPromotionService] Failed to reset promotions", e);
    }
    return DEFAULT_DEFINED_SALES_PROMOTIONS;
  }
}

