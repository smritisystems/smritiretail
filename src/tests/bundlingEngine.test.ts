/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.112.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import BundlingEngine, { BundleConfig, CartItem } from "../utils/bundlingEngine";

describe("BundlingEngine — Product Bundling & Combo Pricing Engine", () => {

  const CART: CartItem[] = [
    { sku: "FAB-DENIM-BLU",  productName: "Denim Blue 1m",  mrp: 250, qty: 0, availableQty: 10 },
    { sku: "FAB-COTTON-WHT", productName: "Cotton White 1m", mrp: 120, qty: 0, availableQty: 15 },
    { sku: "ACC-BELT-BRN",   productName: "Leather Belt",    mrp: 350, qty: 0, availableQty: 5  },
    { sku: "ACC-SCARF-BLUE", productName: "Blue Scarf",      mrp: 180, qty: 0, availableQty: 8  },
  ];

  function mkBundle(overrides: Partial<BundleConfig> = {}): BundleConfig {
    return BundlingEngine.createBundle({
      name: "Fabric Combo",
      description: "Denim + Cotton combo",
      type: "COMBO_DISCOUNT",
      components: [
        { sku: "FAB-DENIM-BLU",  productName: "Denim Blue 1m",  mrp: 250, requiredQty: 2 },
        { sku: "FAB-COTTON-WHT", productName: "Cotton White 1m", mrp: 120, requiredQty: 3 },
      ],
      discountPct: 10,
      validFrom: "2026-01-01",
      validTo:   "2026-12-31",
      ...overrides,
    });
  }

  // ─── Test 1: COMBO_DISCOUNT — correct sumMRP, discountAmt, bundlePrice ────
  it("COMBO_DISCOUNT: computes sumMRP, 10% discountAmt, bundlePrice, savingsPct correctly", () => {
    const bundle  = mkBundle();
    const pricing = BundlingEngine.computePricing(bundle, CART);

    // sumMRP: (250×2) + (120×3) = 500 + 360 = 860
    expect(pricing.sumMRP).toBe(860);
    expect(pricing.discountAmt).toBe(86);      // 860 × 10% = 86
    expect(pricing.bundlePrice).toBe(774);     // 860 - 86
    expect(pricing.savingsPct).toBe(10);
    expect(pricing.eligible).toBe(true);
    expect(pricing.ineligibleSkus).toHaveLength(0);
  });

  // ─── Test 2: FIXED_BUNDLE — fixedPrice overrides component sum ────────────
  it("FIXED_BUNDLE: fixedPrice overrides sumMRP; discountAmt = sumMRP - fixedPrice", () => {
    const bundle = BundlingEngine.createBundle({
      name: "Accessories Value Pack",
      description: "Belt + Scarf fixed pack",
      type: "FIXED_BUNDLE",
      components: [
        { sku: "ACC-BELT-BRN",   productName: "Leather Belt", mrp: 350, requiredQty: 1 },
        { sku: "ACC-SCARF-BLUE", productName: "Blue Scarf",   mrp: 180, requiredQty: 1 },
      ],
      fixedPrice: 450,   // sumMRP=530, fixed=450, discount=80
      validFrom: "2026-01-01",
      validTo:   "2026-12-31",
    });

    const pricing = BundlingEngine.computePricing(bundle, CART);
    expect(pricing.sumMRP).toBe(530);
    expect(pricing.bundlePrice).toBe(450);
    expect(pricing.discountAmt).toBe(80);
    expect(pricing.savingsPct).toBeCloseTo(15.09, 1);
  });

  // ─── Test 3: BUY_X_GET_Y — free qty allocation ────────────────────────────
  it("BUY_X_GET_Y: freeQty items are included; effectivePrice per unit < mrp", () => {
    const bundle = BundlingEngine.createBundle({
      name: "Buy 2 Get 1 Free — Cotton",
      description: "Buy 2 cotton, get 1 free",
      type: "BUY_X_GET_Y",
      components: [
        { sku: "FAB-COTTON-WHT", productName: "Cotton White 1m", mrp: 120, requiredQty: 2, freeQty: 1 },
      ],
      validFrom: "2026-01-01",
      validTo:   "2026-12-31",
    });

    const pricing = BundlingEngine.computePricing(bundle, CART);
    const line = pricing.componentLines[0];
    expect(line.freeQty).toBe(1);
    expect(line.qty).toBe(3);                   // 2 paid + 1 free
    expect(line.effectivePrice).toBeCloseTo(80, 0); // 240 / 3 = 80 per unit
    expect(pricing.eligible).toBe(true);
  });

  // ─── Test 4: Eligibility check, cart application, findApplicable ──────────
  it("marks ineligible when stock insufficient; applyBundleToCart deducts qty; findApplicableBundles returns sorted by discount", () => {
    // Bundle requiring more than available
    const bigBundle = mkBundle({
      components: [
        { sku: "FAB-DENIM-BLU",  productName: "Denim Blue 1m",  mrp: 250, requiredQty: 20 },  // only 10 available
        { sku: "FAB-COTTON-WHT", productName: "Cotton White 1m", mrp: 120, requiredQty: 3  },
      ],
    });
    const pricingIneligible = BundlingEngine.computePricing(bigBundle, CART);
    expect(pricingIneligible.eligible).toBe(false);
    expect(pricingIneligible.ineligibleSkus).toContain("FAB-DENIM-BLU");

    // Valid bundle — apply to cart
    const validBundle = mkBundle();
    const asOf = new Date("2026-08-28");
    const result = BundlingEngine.applyBundleToCart(validBundle, CART, asOf);
    const updatedDenim = result.updatedCart.find((c) => c.sku === "FAB-DENIM-BLU");
    expect(updatedDenim!.availableQty).toBe(8);    // 10 - 2
    const updatedCotton = result.updatedCart.find((c) => c.sku === "FAB-COTTON-WHT");
    expect(updatedCotton!.availableQty).toBe(12);  // 15 - 3
    expect(result.totalSavings).toBe(86);

    // findApplicableBundles
    const b2 = mkBundle({ discountPct: 15 });
    const applicable = BundlingEngine.findApplicableBundles([validBundle, b2], CART, asOf);
    expect(applicable.length).toBe(2);
    // Sorted by discountAmt descending — b2 (15%) should come first
    expect(applicable[0].pricing.discountAmt).toBeGreaterThan(applicable[1].pricing.discountAmt);
  });
});
