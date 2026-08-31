<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.112.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Product Bundling & Combo Pricing Engine (v1.0.0-GA)

## 1. Purpose
Documents the Bundling Engine — flexible combo pricing supporting FIXED_BUNDLE, COMBO_DISCOUNT (% or flat), and BUY_X_GET_Y, with eligibility checking, cart application, and applicable-bundle discovery.

## 2. Scope
- `BundlingEngine` covering `createBundle()`, `computePricing()`, `isValid()`, `applyBundleToCart()`, `findApplicableBundles()`.
- `computePricing()` returns `sumMRP`, `discountAmt`, `bundlePrice`, `savingsPct`, `eligible`, `ineligibleSkus`, `componentLines` with per-line `effectivePrice`.
- `BUY_X_GET_Y`: total qty = requiredQty + freeQty; `effectivePrice = lineTotal / totalQty`.
- `findApplicableBundles()` filters by validity + branch + eligibility; sorts by `discountAmt` descending.
- `BundlingModal` with bundle list, price summary, component table (MRP/qty/free/effectivePrice/lineTotal), cart stock availability panel.

## 3. Files Created
- `src/utils/bundlingEngine.ts`
- `src/components/pricing/BundlingModal.tsx`
- `src/tests/bundlingEngine.test.ts`
- `docs/walkthrough/pricing/Bundling_Combo_Engine_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`, `docs/walkthrough/README.md`, `CHANGELOG.md`

## 5. Architecture Decisions
1. **`computePricing()` never mutates cart**: It reads `availableQty` for eligibility but does not deduct — only `applyBundleToCart()` mutates. This makes `computePricing()` safe to call speculatively for previews.
2. **`ineligibleSkus` array enables precise UX feedback**: Instead of a binary eligible/ineligible flag, the array identifies exactly which SKUs are short, allowing the UI to highlight the specific items blocking the bundle.
3. **BUY_X_GET_Y `effectivePrice` includes free units in denominator**: `effectivePrice = lineTotal / (requiredQty + freeQty)` — communicates to the customer the true per-unit cost they're paying, which is the marketing metric for this bundle type.
4. **`findApplicableBundles()` sorts by `discountAmt`**: Higher discount is always preferred at the point of sale. Production may expose a `sortBy` parameter for margin-aware sorting (e.g., by `savingsPct` instead).
5. **`isValid()` checks validity window + branch restriction**: `branchCodes = []` means "all branches" — an explicit whitelist design is safer than a blacklist for promotion management.

## 6. Design Rationale
Bundle pricing is complex because each component's contribution to the discount must be pro-rated for receipt printing and accounting. The `componentLines[].effectivePrice` field gives this pro-rated figure, enabling accurate COGS split even when the bundle discount doesn't divide evenly.

## 7. Implementation Summary
- `computePricing()`: Sums MRP across components; applies FIXED/flat/percentage discount; for BUY_X_GET_Y sets `freeQty` and computes `effectivePrice = lineTotal / totalQty`.
- `applyBundleToCart()`: Validates `isValid()` and eligibility; deducts `requiredQty + freeQty` from `cart[].availableQty`.
- `findApplicableBundles()`: Filters bundles where all component SKUs exist in cart; maps to `{ bundle, pricing }` pairs; filters to eligible only; sorts descending by `discountAmt`.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/bundlingEngine.test.ts`**: 4/4 tests passed.
  - Test 1: COMBO_DISCOUNT — sumMRP=860, discountAmt=86, bundlePrice=774, savingsPct=10 ✓
  - Test 2: FIXED_BUNDLE — sumMRP=530, bundlePrice=450, discountAmt=80, savingsPct≈15.09% ✓
  - Test 3: BUY_X_GET_Y — freeQty=1, qty=3, effectivePrice≈80 ✓
  - Test 4: Ineligible detection; cart deduction (denim: 10→8, cotton: 15→12); findApplicable sorted by discount ✓
- **Total Frontend Suite**: 84/84 test files, 508/508 tests green in 14.84s, exit code 0.

## 10. Known Limitations
- Bundles are not SKU-exclusive — two overlapping bundles can both be applied to the same cart items (production enforces single-bundle-per-SKU constraint at the server).
- `flatDiscount` and `discountPct` are mutually exclusive but not validated — production uses a discriminated union type on the API schema.

## 11. Future Work
- FastAPI `GET /api/v1/bundles/applicable?branch=&skus=`, `POST /api/v1/bundles/apply`.
- GST-compliant bundle invoice split (pro-rated by component HSN codes).

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record. `ADR-046`: Bundle Pricing Model, Component Pro-Rating, and Eligibility Policy.

## 13. Related RFCs
- `RFC-115`: Bundle Scheme Governance, Overlap Resolution Policy, and GST Allocation for Mixed-HSN Bundles.
