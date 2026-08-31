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

/**
 * Advanced Pricing Rules & Promotional Discount Engine
 *
 * Implements a multi-layer pricing resolution hierarchy:
 *   Layer 1 — Base Price List       : Default catalogue price per SKU
 *   Layer 2 — Customer Group Price  : Segment-specific price override
 *   Layer 3 — Promotional Offer     : Time-bound discount (% or flat)
 *   Layer 4 — Coupon / Voucher      : One-time additional reduction
 *
 * Stacking rules:
 *   - Only one promotional offer applies per line (highest-discount wins)
 *   - Coupon applies AFTER promotion on the post-promo price
 *   - Customer group price is the effective base before applying promos
 *   - Global max discount cap enforced at invoice level
 */

export type DiscountType = "PERCENTAGE" | "FLAT_AMOUNT";
export type OfferStatus  = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "PAUSED";
export type PriceListType = "STANDARD" | "WHOLESALE" | "VIP" | "STAFF" | "DISTRIBUTOR";

export interface PriceListEntry {
  priceListId: string;
  priceListType: PriceListType;
  sku: string;
  unitPrice: number;
  minQty: number;             // Minimum quantity for this price tier
  validFrom: string;          // ISO
  validTo?: string;           // ISO — open-ended if absent
}

export interface CustomerGroupPrice {
  customerGroup: string;      // e.g. "VIP", "WHOLESALE", "STAFF"
  sku: string;
  unitPrice: number;
  discountPct?: number;       // Alternative — % off standard price
}

export interface PromotionalOffer {
  offerId: string;
  offerName: string;
  discountType: DiscountType;
  discountValue: number;      // % or flat ₹ amount
  applicableSkus: string[];   // Empty = all SKUs
  applicableGroups: string[]; // Empty = all customer groups
  minOrderValue?: number;     // Minimum cart value to activate
  minQty?: number;
  validFrom: string;          // ISO
  validTo: string;            // ISO
  status: OfferStatus;
  priority: number;           // Lower = evaluated first; highest discount wins
  isStackable: boolean;       // Can combine with coupon
}

export interface CouponCode {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxUsages: number;
  usedCount: number;
  validFrom: string;
  validTo: string;
  minOrderValue?: number;
  applicableSkus?: string[];
  isActive: boolean;
}

export interface PriceResolutionInput {
  sku: string;
  qty: number;
  baseUnitPrice: number;
  customerGroup?: string;
  priceLists: PriceListEntry[];
  customerGroupPrices: CustomerGroupPrice[];
  activeOffers: PromotionalOffer[];
  coupon?: CouponCode;
  asOf: Date;
}

export interface PriceResolutionResult {
  sku: string;
  qty: number;
  baseUnitPrice: number;
  groupUnitPrice: number;           // After customer group price override
  effectiveUnitPrice: number;       // After best promo applied
  promoDiscount: number;            // ₹ discount from promo
  couponDiscount: number;           // ₹ discount from coupon
  totalLineDiscount: number;
  finalLineTotal: number;
  appliedOffer?: PromotionalOffer;
  appliedCoupon?: CouponCode;
  resolutionTrace: string[];        // Human-readable audit steps
}

export interface InvoicePricingResult {
  lines: PriceResolutionResult[];
  subtotal: number;               // Sum of groupUnitPrice × qty
  totalPromoDiscount: number;
  totalCouponDiscount: number;
  totalDiscount: number;
  grandTotal: number;
  discountPct: number;            // % of subtotal discounted
  capBreached: boolean;           // True if max discount cap was applied
}

/** Engine-wide constants */
export const PRICING_CONFIG = {
  maxDiscountCapPct: 40,          // No invoice may receive more than 40% total discount
  couponStackingAllowed: true,    // Coupons may stack on top of promos
};

export class PricingDiscountEngine {
  /** Resolve effective unit price through the 4-layer hierarchy for a single line */
  public static resolveLine(input: PriceResolutionInput): PriceResolutionResult {
    const trace: string[] = [];
    const now = input.asOf;

    // ── Layer 1: Base price ────────────────────────────────────────────────
    let groupUnitPrice = input.baseUnitPrice;
    trace.push(`[L1] Base price: ₹${groupUnitPrice}`);

    // ── Layer 2: Customer group price ──────────────────────────────────────
    if (input.customerGroup) {
      const cgp = input.customerGroupPrices.find(
        (p) => p.sku === input.sku && p.customerGroup === input.customerGroup
      );
      if (cgp) {
        if (cgp.unitPrice) {
          groupUnitPrice = cgp.unitPrice;
          trace.push(`[L2] Group override (${input.customerGroup}): ₹${groupUnitPrice}`);
        } else if (cgp.discountPct) {
          groupUnitPrice = Math.round(groupUnitPrice * (1 - cgp.discountPct / 100) * 100) / 100;
          trace.push(`[L2] Group discount ${cgp.discountPct}%: ₹${groupUnitPrice}`);
        }
      } else {
        trace.push(`[L2] No group price for ${input.customerGroup} — using base`);
      }
    }

    // ── Layer 3: Best promotional offer ────────────────────────────────────
    const eligibleOffers = input.activeOffers.filter((o) => {
      if (o.status !== "ACTIVE") return false;
      if (new Date(o.validFrom) > now || new Date(o.validTo) < now) return false;
      if (o.applicableSkus.length > 0 && !o.applicableSkus.includes(input.sku)) return false;
      if (o.applicableGroups.length > 0 && input.customerGroup && !o.applicableGroups.includes(input.customerGroup)) return false;
      if (o.minQty && input.qty < o.minQty) return false;
      return true;
    }).sort((a, b) => a.priority - b.priority);

    let promoDiscount = 0;
    let appliedOffer: PromotionalOffer | undefined;
    let effectiveUnitPrice = groupUnitPrice;

    for (const offer of eligibleOffers) {
      const d = offer.discountType === "PERCENTAGE"
        ? Math.round(groupUnitPrice * (offer.discountValue / 100) * 100) / 100
        : Math.min(offer.discountValue, groupUnitPrice);
      if (d > promoDiscount) {
        promoDiscount = d;
        appliedOffer = offer;
      }
    }

    if (appliedOffer) {
      effectiveUnitPrice = Math.max(0, groupUnitPrice - promoDiscount);
      trace.push(`[L3] Promo "${appliedOffer.offerName}" → -₹${promoDiscount}/unit (effective: ₹${effectiveUnitPrice})`);
    } else {
      trace.push(`[L3] No eligible promotional offer`);
    }

    const linePromoDiscount = Math.round(promoDiscount * input.qty * 100) / 100;
    let linePostPromo = Math.round(effectiveUnitPrice * input.qty * 100) / 100;

    // ── Layer 4: Coupon ───────────────────────────────────────────────────
    let couponDiscount = 0;
    let appliedCoupon: CouponCode | undefined;

    if (input.coupon && PRICING_CONFIG.couponStackingAllowed && (!appliedOffer || appliedOffer.isStackable)) {
      const c = input.coupon;
      const validCoupon =
        c.isActive &&
        c.usedCount < c.maxUsages &&
        new Date(c.validFrom) <= now &&
        new Date(c.validTo) >= now &&
        (!c.applicableSkus || c.applicableSkus.length === 0 || c.applicableSkus.includes(input.sku));

      if (validCoupon) {
        couponDiscount = c.discountType === "PERCENTAGE"
          ? Math.round(linePostPromo * (c.discountValue / 100) * 100) / 100
          : Math.min(c.discountValue, linePostPromo);
        appliedCoupon = c;
        linePostPromo = Math.max(0, linePostPromo - couponDiscount);
        trace.push(`[L4] Coupon "${c.code}" → -₹${couponDiscount} on line`);
      } else {
        trace.push(`[L4] Coupon invalid or expired`);
      }
    } else {
      trace.push(`[L4] No coupon applied`);
    }

    const totalLineDiscount = linePromoDiscount + couponDiscount;
    const finalLineTotal = linePostPromo;

    return {
      sku: input.sku,
      qty: input.qty,
      baseUnitPrice: input.baseUnitPrice,
      groupUnitPrice,
      effectiveUnitPrice,
      promoDiscount: linePromoDiscount,
      couponDiscount,
      totalLineDiscount,
      finalLineTotal,
      appliedOffer,
      appliedCoupon,
      resolutionTrace: trace,
    };
  }

  /** Resolve all lines and compute invoice-level totals with cap enforcement */
  public static resolveInvoice(
    lines: Omit<PriceResolutionInput, "coupon" | "asOf">[],
    shared: { coupon?: CouponCode; asOf: Date }
  ): InvoicePricingResult {
    const resolved = lines.map((l) => this.resolveLine({ ...l, ...shared }));

    const subtotal            = resolved.reduce((s, l) => s + Math.round(l.groupUnitPrice * l.qty * 100) / 100, 0);
    const totalPromoDiscount  = resolved.reduce((s, l) => s + l.promoDiscount, 0);
    const totalCouponDiscount = resolved.reduce((s, l) => s + l.couponDiscount, 0);
    const totalDiscount       = totalPromoDiscount + totalCouponDiscount;
    const rawTotal            = subtotal - totalDiscount;
    const discountPct         = subtotal > 0 ? Math.round((totalDiscount / subtotal) * 10000) / 100 : 0;

    // Cap enforcement
    const maxAllowedDiscount  = Math.round(subtotal * (PRICING_CONFIG.maxDiscountCapPct / 100) * 100) / 100;
    const capBreached         = totalDiscount > maxAllowedDiscount;
    const cappedDiscount      = capBreached ? maxAllowedDiscount : totalDiscount;
    const grandTotal          = Math.round((subtotal - cappedDiscount) * 100) / 100;

    return {
      lines: resolved,
      subtotal,
      totalPromoDiscount,
      totalCouponDiscount,
      totalDiscount: cappedDiscount,
      grandTotal,
      discountPct: capBreached ? PRICING_CONFIG.maxDiscountCapPct : discountPct,
      capBreached,
    };
  }

  /** Validate a coupon code against current state */
  public static validateCoupon(coupon: CouponCode, asOf: Date): { valid: boolean; reason?: string } {
    if (!coupon.isActive) return { valid: false, reason: "Coupon is inactive" };
    if (coupon.usedCount >= coupon.maxUsages) return { valid: false, reason: `Usage limit (${coupon.maxUsages}) reached` };
    if (new Date(coupon.validFrom) > asOf) return { valid: false, reason: "Coupon not yet valid" };
    if (new Date(coupon.validTo) < asOf) return { valid: false, reason: "Coupon has expired" };
    return { valid: true };
  }

  /** Get all currently active offers for a given date */
  public static getActiveOffers(offers: PromotionalOffer[], asOf: Date): PromotionalOffer[] {
    return offers.filter(
      (o) => o.status === "ACTIVE" && new Date(o.validFrom) <= asOf && new Date(o.validTo) >= asOf
    );
  }
}

export default PricingDiscountEngine;
