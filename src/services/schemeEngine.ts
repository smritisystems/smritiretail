/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Retail Business Engine
 * Component    : Indian Retail Scheme Engine (Buy X Get Y, Discounts, Coupons)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export type SchemeType = "BUY_X_GET_Y" | "FLAT_DISCOUNT" | "PERCENTAGE_DISCOUNT" | "MIX_AND_MATCH" | "COUPON";

export interface RetailSchemeDefinition {
  schemeId: string;
  schemeName: string;
  type: SchemeType;
  buyQty?: number;
  freeQty?: number;
  discountPercentage?: number;
  flatDiscountAmount?: number;
  couponCode?: string;
  minPurchaseAmount?: number;
  applicableSkuOrCategory?: string;
  validUntil?: string;
  isActive: boolean;
}

export interface SchemeCalculationItem {
  sku: string;
  category?: string;
  qty: number;
  rate: number;
}

export interface SchemeCalculationResult {
  appliedSchemeId?: string;
  appliedSchemeName?: string;
  totalDiscountAmount: number;
  freeItems: Array<{ sku: string; freeQty: number }>;
  discountedTotal: number;
}

class SchemeEngineService {
  private schemes: Map<string, RetailSchemeDefinition> = new Map();

  constructor() {
    this.seedDefaultSchemes();
  }

  private seedDefaultSchemes() {
    this.register({
      schemeId: "scheme-b2g1",
      schemeName: "Festive Offer: Buy 2 Get 1 Free",
      type: "BUY_X_GET_Y",
      buyQty: 2,
      freeQty: 1,
      isActive: true,
    });

    this.register({
      schemeId: "scheme-flat-100",
      schemeName: "Monsoon Super Savings: Flat ₹100 Off on ₹1000",
      type: "FLAT_DISCOUNT",
      flatDiscountAmount: 100,
      minPurchaseAmount: 1000,
      isActive: true,
    });
  }

  public register(scheme: RetailSchemeDefinition): void {
    this.schemes.set(scheme.schemeId, scheme);
  }

  public listSchemes(): RetailSchemeDefinition[] {
    return Array.from(this.schemes.values()).filter((s) => s.isActive);
  }

  public calculateBestScheme(items: SchemeCalculationItem[], coupon?: string): SchemeCalculationResult {
    const rawTotal = items.reduce((acc, item) => acc + item.qty * item.rate, 0);
    let bestDiscount = 0;
    let bestScheme: RetailSchemeDefinition | undefined;
    let freeItems: Array<{ sku: string; freeQty: number }> = [];

    const activeSchemes = this.listSchemes();

    for (const scheme of activeSchemes) {
      if (scheme.minPurchaseAmount && rawTotal < scheme.minPurchaseAmount) continue;

      if (scheme.type === "FLAT_DISCOUNT" && scheme.flatDiscountAmount) {
        if (scheme.flatDiscountAmount > bestDiscount) {
          bestDiscount = scheme.flatDiscountAmount;
          bestScheme = scheme;
        }
      }

      if (scheme.type === "PERCENTAGE_DISCOUNT" && scheme.discountPercentage) {
        const disc = (rawTotal * scheme.discountPercentage) / 100;
        if (disc > bestDiscount) {
          bestDiscount = disc;
          bestScheme = scheme;
        }
      }

      if (scheme.type === "BUY_X_GET_Y" && scheme.buyQty && scheme.freeQty) {
        for (const item of items) {
          if (item.qty >= scheme.buyQty) {
            const freeCount = Math.floor(item.qty / scheme.buyQty) * scheme.freeQty;
            const disc = freeCount * item.rate;
            if (disc > bestDiscount) {
              bestDiscount = disc;
              bestScheme = scheme;
              freeItems = [{ sku: item.sku, freeQty: freeCount }];
            }
          }
        }
      }
    }

    return {
      appliedSchemeId: bestScheme?.schemeId,
      appliedSchemeName: bestScheme?.schemeName,
      totalDiscountAmount: bestDiscount,
      freeItems,
      discountedTotal: Math.max(0, rawTotal - bestDiscount),
    };
  }
}

export const SchemeEngine = new SchemeEngineService();
