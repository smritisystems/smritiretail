/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.99.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import PricingDiscountEngine, {
  PriceListEntry,
  CustomerGroupPrice,
  PromotionalOffer,
  CouponCode,
  PRICING_CONFIG,
  setPricingConfig,
} from "../utils/pricingDiscountEngine";

describe("PricingDiscountEngine — Advanced Pricing Rules & Promotional Discount Engine", () => {
  const AS_OF = new Date("2026-08-28T12:00:00.000Z");
  const SKU = "APP-POLO-NAVY-M";
  const BASE_PRICE = 1000;

  const ACTIVE_OFFER: PromotionalOffer = {
    offerId: "PROMO-001", offerName: "Monsoon Sale 20%",
    discountType: "PERCENTAGE", discountValue: 20,
    applicableSkus: [], applicableGroups: [],
    validFrom: "2026-08-01T00:00:00.000Z", validTo: "2026-08-31T23:59:59.000Z",
    status: "ACTIVE", priority: 1, isStackable: true,
  };

  const VIP_COUPON: CouponCode = {
    code: "VIP200", discountType: "FLAT_AMOUNT", discountValue: 200,
    maxUsages: 100, usedCount: 5,
    validFrom: "2026-08-01T00:00:00.000Z", validTo: "2026-08-31T23:59:59.000Z",
    isActive: true,
  };

  const GROUP_PRICES: CustomerGroupPrice[] = [
    { customerGroup: "VIP", sku: SKU, unitPrice: 850, discountPct: undefined },
    { customerGroup: "WHOLESALE", sku: SKU, unitPrice: 0, discountPct: 15 },
  ];

  // ─── Test 1: Layer-by-layer pricing resolution ────────────────────────────
  it("resolves price through all 4 layers: base → group override → promo → coupon", () => {
    const result = PricingDiscountEngine.resolveLine({
      sku: SKU, qty: 3, baseUnitPrice: BASE_PRICE,
      customerGroup: "VIP",
      priceLists: [], customerGroupPrices: GROUP_PRICES,
      activeOffers: [ACTIVE_OFFER], coupon: VIP_COUPON, asOf: AS_OF,
    });

    // L2: VIP group price = ₹850
    expect(result.groupUnitPrice).toBe(850);
    // L3: 20% off ₹850 = ₹170 promo discount/unit
    expect(result.promoDiscount).toBe(510);              // ₹170 × 3 units
    expect(result.effectiveUnitPrice).toBe(680);         // 850 - 170
    // L4: coupon ₹200 flat on 3-unit line post-promo (3×680 = 2040)
    expect(result.couponDiscount).toBe(200);
    expect(result.finalLineTotal).toBe(1840);            // 2040 - 200
    expect(result.appliedOffer?.offerId).toBe("PROMO-001");
    expect(result.appliedCoupon?.code).toBe("VIP200");
    expect(result.resolutionTrace.length).toBe(4);       // One trace per layer
  });

  // ─── Test 2: Wholesale group price via % discount ─────────────────────────
  it("applies customer group percentage discount as L2 and highest-discount promo wins at L3", () => {
    const offer2: PromotionalOffer = {
      ...ACTIVE_OFFER, offerId: "PROMO-002", offerName: "Weekend Flash 10%",
      discountValue: 10, priority: 2,
    };
    const result = PricingDiscountEngine.resolveLine({
      sku: SKU, qty: 10, baseUnitPrice: BASE_PRICE,
      customerGroup: "WHOLESALE",
      priceLists: [], customerGroupPrices: GROUP_PRICES,
      activeOffers: [ACTIVE_OFFER, offer2], coupon: undefined, asOf: AS_OF,
    });

    // WHOLESALE 15% off ₹1000 = ₹850
    expect(result.groupUnitPrice).toBe(850);
    // Both offers apply; PROMO-001 (20%) > PROMO-002 (10%) → PROMO-001 wins
    expect(result.appliedOffer?.offerId).toBe("PROMO-001");
    // 20% off ₹850/unit × 10 = ₹1700 promo discount
    expect(result.promoDiscount).toBe(1700);
    expect(result.couponDiscount).toBe(0);
  });

  // ─── Test 3: Discount cap enforcement ─────────────────────────────────────
  it("enforces dynamic max discount cap at invoice level (40%, 50%, 60%)", () => {
    // Construct an extreme offer that would exceed cap: 50% promo + 20% coupon on residual = 60% total
    const extremeOffer: PromotionalOffer = {
      ...ACTIVE_OFFER, offerId: "PROMO-EXT", offerName: "Clearance 50%",
      discountValue: 50, priority: 1,
    };
    const extremeCoupon: CouponCode = { ...VIP_COUPON, discountType: "PERCENTAGE", discountValue: 20 };

    const lines = [
      { sku: SKU, qty: 5, baseUnitPrice: 1000, priceLists: [] as PriceListEntry[], customerGroupPrices: [] as CustomerGroupPrice[], activeOffers: [extremeOffer] },
    ];

    // Case A: Configured at 40%
    const inv40 = PricingDiscountEngine.resolveInvoice(lines, { coupon: extremeCoupon, asOf: AS_OF, maxDiscountCapPct: 40 });
    expect(inv40.capBreached).toBe(true);
    expect(inv40.discountPct).toBe(40);
    expect(inv40.grandTotal).toBe(inv40.subtotal * (1 - 40 / 100));

    // Case B: Configured at 50%
    const inv50 = PricingDiscountEngine.resolveInvoice(lines, { coupon: extremeCoupon, asOf: AS_OF, maxDiscountCapPct: 50 });
    expect(inv50.capBreached).toBe(true);
    expect(inv50.discountPct).toBe(50);
    expect(inv50.grandTotal).toBe(inv50.subtotal * (1 - 50 / 100));

    // Case C: Configured at 60% (matches raw total discount, no breach)
    const inv60 = PricingDiscountEngine.resolveInvoice(lines, { coupon: extremeCoupon, asOf: AS_OF, maxDiscountCapPct: 60 });
    expect(inv60.capBreached).toBe(false);
    expect(inv60.discountPct).toBe(60);

    // Case D: Default PRICING_CONFIG has NO hardcoded 40% ceiling
    expect(PRICING_CONFIG.maxDiscountCapPct).toBeUndefined();

    // Case E: Runtime setPricingConfig updates global config
    setPricingConfig({ maxDiscountCapPct: 45 });
    expect(PRICING_CONFIG.maxDiscountCapPct).toBe(45);
    const invRuntime = PricingDiscountEngine.resolveInvoice(lines, { coupon: extremeCoupon, asOf: AS_OF });
    expect(invRuntime.capBreached).toBe(true);
    expect(invRuntime.discountPct).toBe(45);
    setPricingConfig({ maxDiscountCapPct: undefined }); // reset
  });

  // ─── Test 4: Coupon validation ────────────────────────────────────────────
  it("validates coupon — rejects expired, exhausted, and inactive coupons", () => {
    // Valid coupon
    const valid = PricingDiscountEngine.validateCoupon(VIP_COUPON, AS_OF);
    expect(valid.valid).toBe(true);

    // Expired coupon
    const expired: CouponCode = { ...VIP_COUPON, validTo: "2026-07-31T23:59:59.000Z" };
    const expResult = PricingDiscountEngine.validateCoupon(expired, AS_OF);
    expect(expResult.valid).toBe(false);
    expect(expResult.reason).toContain("expired");

    // Exhausted coupon
    const exhausted: CouponCode = { ...VIP_COUPON, usedCount: 100, maxUsages: 100 };
    const exhResult = PricingDiscountEngine.validateCoupon(exhausted, AS_OF);
    expect(exhResult.valid).toBe(false);
    expect(exhResult.reason).toContain("limit");

    // Inactive coupon
    const inactive: CouponCode = { ...VIP_COUPON, isActive: false };
    const inactResult = PricingDiscountEngine.validateCoupon(inactive, AS_OF);
    expect(inactResult.valid).toBe(false);
  });

  // ─── Test 5: Dynamic Indian Financial Year calculation ───────────────────
  it("computes statutory Indian financial year dynamically (April 1 to March 31)", async () => {
    const { getCurrentFinancialYear } = await import("../components/billing/SmritiDefineBillPrefixModal");
    const fyInfo = getCurrentFinancialYear();
    expect(fyInfo.fy).toMatch(/^\d{4}-\d{4}$/);
    expect(fyInfo.suffix).toMatch(/^\d{2}-\d{2}$/);

    const [startYearStr, endYearStr] = fyInfo.fy.split("-");
    const startYear = parseInt(startYearStr, 10);
    const endYear = parseInt(endYearStr, 10);
    expect(endYear).toBe(startYear + 1);

    const [startSuff, endSuff] = fyInfo.suffix.split("-");
    expect(startSuff).toBe(String(startYear).slice(-2));
    expect(endSuff).toBe(String(endYear).slice(-2));
  });

  // ─── Test 6: Per-request coupon stacking override ─────────────────────────
  it("respects per-request couponStackingAllowed override on PriceResolutionInput", () => {
    // When couponStackingAllowed is explicitly false on the input
    const noStackResult = PricingDiscountEngine.resolveLine({
      sku: SKU, qty: 1, baseUnitPrice: BASE_PRICE,
      priceLists: [], customerGroupPrices: [],
      activeOffers: [ACTIVE_OFFER], coupon: VIP_COUPON, asOf: AS_OF,
      couponStackingAllowed: false,
    });
    // Promo applies (20% off 1000 = 200), but coupon does NOT stack
    expect(noStackResult.promoDiscount).toBe(200);
    expect(noStackResult.couponDiscount).toBe(0);
    expect(noStackResult.finalLineTotal).toBe(800);

    // When couponStackingAllowed is explicitly true on the input
    const stackResult = PricingDiscountEngine.resolveLine({
      sku: SKU, qty: 1, baseUnitPrice: BASE_PRICE,
      priceLists: [], customerGroupPrices: [],
      activeOffers: [ACTIVE_OFFER], coupon: VIP_COUPON, asOf: AS_OF,
      couponStackingAllowed: true,
    });
    // Promo applies (20% off 1000 = 200), AND coupon stacks (200 off 800 = 200)
    expect(stackResult.promoDiscount).toBe(200);
    expect(stackResult.couponDiscount).toBe(200);
    expect(stackResult.finalLineTotal).toBe(600);
  });
});

