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
  isHappyHours?: boolean;
  happyHoursStart?: string; // HH:mm
  happyHoursEnd?: string; // HH:mm
  recipeId?: string;
  appliedOn?: "LOWEST_PRICE" | "HIGHEST_PRICE";
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
  }
];



