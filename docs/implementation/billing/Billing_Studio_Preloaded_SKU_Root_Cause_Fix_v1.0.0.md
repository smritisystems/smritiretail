<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.96.0
  Created      : 2026-10-17
  Modified     : 2026-10-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Implementation Plan (IPGP Compliant)
-->

# Billing Studio: Preloaded SKU Root-Cause Fix & Fresh Session Governance (v1.0.0)

## 1. Objective
Eliminate phantom preloaded line items when opening a Counter POS (B2C) billing session in SMRITI Retail OS. Ensure every fresh billing session initializes with a strictly empty cart (`[]`), zero totals, Walk-in customer defaults, autofocus on the barcode scanner, and isolated workflow lifecycles, while preserving explicit draft restoration, sales order / packing slip conversion, and providing an explicit user choice for loading sample items during testing or visual demonstrations.

## 2. Business Motivation
In retail counter operations, a cashier opening the billing terminal must always be presented with a clean slate ready for the first customer scan. Having six products pre-populated in the cart without cashier scan action causes confusion, risks accidental overcharging, distorts store metrics, and erodes operational trust.

## 3. Scope
- Identify the exact code path responsible for populating the cart on initial load.
- Initialize Counter POS (`RETAIL_POS`) with `cartItems = []`, `billLevelDiscount = 0`, `receivedAmount = "0.00"`, `customer = WALK_IN_CUSTOMER`, and `activeDraftId = null`.
- Provide an empty-cart visual state in the items table with actionable shortcuts (`F1`, `F2`) and an explicit `Load Sample Items` button for demonstration or layout verification.
- Prevent cross-mode state leakage by binding distinct React keys to `SmritiBillingStudio` in `BillingWorkspace.tsx` (`counter-pos-studio`, `credit-billing-studio`, `b2b-distributor-studio`).
- Wire F12 Park Cart & Resume Draft modal with explicit hold slip identification.
- Add comprehensive Vitest automated tests covering fresh session state, zero totals, draft restoration, and workflow isolation.

## 4. Current State
- `src/components/billing/SmritiBillingStudio.tsx` initialized `cartItems` state with `INITIAL_DEMO_CART_ITEMS` (a hardcoded array of 6 footwear products used in a prior visual review session).
- `billLevelDiscount` was initialized to `50` flat amount.
- `receivedAmount` was initialized to `"16286.13"`.
- `customer` was initialized to `DEMO_RELIANCE_CUSTOMER` regardless of billing mode.
- In `BillingWorkspace.tsx`, switching between Counter POS, Credit, and B2B modes shared a single unkeyed component slot, causing React to preserve state across mode transitions.

## 5. Gap Analysis
1. **Initial Cart Population:** Hardcoded `useState<ProPosCartItem[]>(INITIAL_DEMO_CART_ITEMS)` rather than `useState<ProPosCartItem[]>([])`.
2. **Preset Bill Discount:** `billLevelDiscount` preset to 50 rather than 0 on empty cart.
3. **Preset Tender Amount:** `receivedAmount` preset to 16286.13 rather than 0.00.
4. **Tender Math on Empty Cart:** `computeBillingTotals` did not fast-exit with exact zero values when `items.length === 0`.
5. **Workflow Isolation:** Lack of distinct React keys on `<SmritiBillingStudio>` allowed state retention when switching between Counter POS, Credit, and B2B Distributor modes.
6. **Missing Empty Cart Affordance:** The cart grid had no empty-state message explaining how to begin scanning.

## 6. Architecture Impact
Zero database schema changes. Full compliance with SMRITI Architecture Governance:
- `SmritiBillingStudio.tsx` retains canonical calculation engine `computeBillingTotals`.
- `SmritiPosParkedCartService` handles F12 Park & Recall.
- `ProPosOfflineSyncEngine` retains offline transaction queue and deduplication.
- Preflight certificates and capability ownership (`@SmritiCapability("BILLING", ...)`) remain active.

## 7. Proposed Design
1. **Initial Cart State:** Default `cartItems` to `[]`.
2. **Mode-Aware Defaults:** Initialize `customer` to `WALK_IN_CUSTOMER` for Counter POS and `DEMO_RELIANCE_CUSTOMER` for B2B.
3. **Autofocus Scanner:** Use `useEffect` on mount to focus `barcodeInputRef`.
4. **Empty Cart Table State:** Render a centered empty-cart container with quick actions: "Start Scanning (F1)", "Search Items (F2)", and "Load Sample Items".
5. **Explicit Sample Loader:** Provide `handleLoadSampleDemoItems` that loads `INITIAL_DEMO_CART_ITEMS` only when deliberately clicked by user.
6. **F12 Park & Recall Modal:** Enable cashier to park current cart or view and resume active drafts.
7. **Distinct Component Keys:** Assign unique keys in `BillingWorkspace.tsx` to isolate Counter POS from B2B and Credit modes.

## 8. Files Created
None (modifications and test enhancements only).

## 9. Files Modified
1. `src/components/billing/SmritiBillingStudio.tsx`: Root-cause fix for empty cart, zero totals, mode-aware defaults, empty state UI, and draft modal.
2. `src/components/billing/BillingWorkspace.tsx`: Added explicit React keys to isolate billing studio instances across workflows.
3. `src/tests/smritiBillingStudio.test.ts`: Added Tests 27–34 verifying fresh empty cart, zero totals, draft recall, and workflow isolation.
4. `docs/implementation/README.md`: Master index update.
5. `docs/walkthrough/README.md`: Master walkthrough index update.
6. `CHANGELOG.md`: Logged release v6.96.0.
7. `RELEASE_NOTES.md`: Documented release notes for v6.96.0.

## 10. Dependencies
- React 18
- Lucide React (icons: `Clock`, `ShoppingCart`, `Barcode`, `Trash2`)
- Vitest

## 11. Risks
- Risk: Breaking existing unit tests that reference `INITIAL_DEMO_CART_ITEMS`.
- Mitigation: Kept `INITIAL_DEMO_CART_ITEMS` exported for test fixtures and the explicit sample loader; existing tests 10, 11, and 12 continue to pass without modification.

## 12. Rollback Strategy
Git revert of commit `git revert <commit-hash>` cleanly restores prior hardcoded demo defaults.

## 13. Verification Plan
1. Vitest automated tests: all 34 tests in `smritiBillingStudio.test.ts` pass.
2. Regression tests: `b2bPackingConsolidatedBilling.test.ts`, `smritiPosParkedCart.test.ts`, and `procurementVisualReports.test.ts` pass.
3. Pre-commit architecture gate: `npm run architecture:check` passes with 0 violations.
4. Form registry validation: `npm run validate-registry` passes (98/98 components).
5. Launchpad validation: `npm run validate-launchpad` passes (55/55 tiles).
6. Production build: `npm run build` completes cleanly.

## 14. Test Plan
- Verify fresh Counter POS initializes with 0 items, 0 subtotal, 0 discount, 0 tax, and 0 net payable.
- Verify scanning an item adds it to the cart and calculates correct GST and totals.
- Verify parking a cart clears the screen and creates a hold slip.
- Verify resuming a draft restores the exact items and hold slip number.
- Verify switching between Counter POS, Credit, and B2B does not leak items.
- Verify offline retry deduplication.

## 15. Documentation Impact
- Updated `CHANGELOG.md` for v6.96.0.
- Updated `RELEASE_NOTES.md` for v6.96.0.
- Updated `docs/implementation/README.md`.
- Created walkthrough document `docs/walkthrough/billing/Billing_Studio_Preloaded_SKU_Root_Cause_Fix_v1.0.0.md`.

## 16. Deployment Plan
Commit and push directly to `smritiNX` tracking branch.

## 17. Status
Completed

## 18. Related ADRs
- ADR-0012: Pure Canonical Totals Engine & Tax Inclusivity Architecture.
- ADR-0044: B2B Packing Slips and Consolidated Tax Invoicing.

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Billing_Studio_Preloaded_SKU_Root_Cause_Fix_v1.0.0.md`
