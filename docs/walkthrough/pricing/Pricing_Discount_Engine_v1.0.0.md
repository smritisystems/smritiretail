<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.99.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Advanced Pricing Rules & Promotional Discount Engine (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the Pricing & Discount Engine — a four-layer pricing hierarchy that resolves the effective sell price for any SKU through Base Price → Customer Group Override → Best Promotional Offer (highest-discount wins) → Coupon stacking, with a configurable global discount cap enforced at invoice level.

## 2. Scope
- `PricingDiscountEngine` covering single-line `resolveLine()`, multi-line `resolveInvoice()`, `validateCoupon()`, and `getActiveOffers()`.
- `PricingStudioModal` with 3-tab view: live invoice resolver with group/coupon controls, active offers catalogue, and per-line layer-by-layer pricing trace.
- 4 resolution layers: Base, Customer Group, Promotional Offer, Coupon.
- Configurable global max discount cap (default: 40% of subtotal).

## 3. Files Created
- `src/utils/pricingDiscountEngine.ts`
- `src/components/pricing/PricingStudioModal.tsx`
- `src/tests/pricingDiscountEngine.test.ts`
- `docs/walkthrough/pricing/Pricing_Discount_Engine_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **4-layer immutable resolution**: Each layer operates on the output of the previous — Base → Group price → Promo → Coupon. No layer skips; each writes a trace step regardless of whether it modifies the price.
2. **Highest-discount-wins promo resolution**: All eligible offers for a line are evaluated; only the one producing the maximum per-unit discount is applied. Priority field breaks ties deterministically.
3. **Coupon on post-promo price**: Coupon is applied to the line total after promo discount, not to base price — correctly reflects retail accounting practice.
4. **Cap at invoice level, not line level**: The global discount cap (40%) is checked against total invoice subtotal. If breached, the cap discount replaces the sum of all discounts — no line-level rescaling is performed.
5. **Offer stackability flag**: `isStackable: false` on a promo blocks coupon combination for that line — enforcing "promo OR coupon, not both" for specific campaigns.

## 6. Design Rationale
Flat discount structures punish loyal VIP customers who also have a coupon. The 4-layer model correctly sequences discounts: group loyalty benefit first, then campaign offer on top of the group price, then coupon on the reduced amount — matching how retail pricing is negotiated in practice.

## 7. Implementation Summary
- `resolveLine()`: Applies 4 layers sequentially; each writes a `[L1]–[L4]` trace entry. Returns `PriceResolutionResult` with per-layer discount breakdown.
- `resolveInvoice()`: Maps all lines through `resolveLine()`, sums discounts, applies cap, returns `InvoicePricingResult` with `capBreached` flag.
- `validateCoupon()`: Checks `isActive`, `usedCount < maxUsages`, `validFrom/validTo`, returns `{ valid, reason }`.
- `getActiveOffers()`: Filters offers by `status === "ACTIVE"` and current date within `validFrom/validTo`.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/pricingDiscountEngine.test.ts`**: 4/4 tests passed.
- **Total Frontend Suite**: 72/72 test files, 460/460 tests green in 12.02s, exit code 0.

## 10. Known Limitations
- Offer `minOrderValue` check is defined on the interface but deferred to invoice-level pre-check in the API layer; `resolveLine()` does not validate it against a single line.
- Price list tiering (`PriceListEntry` with `minQty`) is modelled in types but not applied in the current resolution — Layer 1 uses `baseUnitPrice` passed from the caller; full price list lookup will be added in the FastAPI backend.
- No overlap-conflict detection for offers sharing the same SKU and date range.

## 11. Future Work
- FastAPI `POST /api/v1/pricing/resolve` endpoint backed by Postgres `price_lists`, `promotional_offers`, `customer_group_prices` tables.
- Real-time active offer count badge in POS header.
- Offer scheduling (`SCHEDULED` → `ACTIVE`) via APScheduler cron at `validFrom` time.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-033`: 4-Layer Pricing Resolution Model, Stacking Rules, and Discount Cap Policy.

## 13. Related RFCs
- `RFC-102`: Promotional Offer Configuration, Customer Group Price Override Workflow, and Maximum Discount Cap Governance.
