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
  it("enforces global max discount cap at invoice level", () => {
    // Construct an extreme offer that would exceed 40% cap
    const extremeOffer: PromotionalOffer = {
      ...ACTIVE_OFFER, offerId: "PROMO-EXT", offerName: "Clearance 50%",
      discountValue: 50, priority: 1,
    };
    const extremeCoupon: CouponCode = { ...VIP_COUPON, discountType: "PERCENTAGE", discountValue: 20 };

    const lines = [
      { sku: SKU, qty: 5, baseUnitPrice: 1000, priceLists: [] as PriceListEntry[], customerGroupPrices: [] as CustomerGroupPrice[], activeOffers: [extremeOffer] },
    ];

    const invoice = PricingDiscountEngine.resolveInvoice(lines, { coupon: extremeCoupon, asOf: AS_OF });

    // Without cap: 50% + 20% on residual = 60% total → must be capped at 40%
    expect(invoice.capBreached).toBe(true);
    expect(invoice.discountPct).toBe(PRICING_CONFIG.maxDiscountCapPct);   // 40
    expect(invoice.grandTotal).toBe(invoice.subtotal * (1 - PRICING_CONFIG.maxDiscountCapPct / 100));
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
});
