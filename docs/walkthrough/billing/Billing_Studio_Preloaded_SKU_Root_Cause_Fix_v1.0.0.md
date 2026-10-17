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
  Classification: Walkthrough Document (WGP Compliant)
-->

# Billing Studio: Preloaded SKU Root-Cause Fix & Fresh Session Governance Walkthrough (v1.0.0)

## 1. Purpose
This walkthrough documents the root-cause diagnosis, architectural remediation, and automated verification of the issue where opening Billing Studio in Counter POS pre-loaded six products without user scan or selection. The fix guarantees that a fresh retail counter billing session always starts with an empty cart (`[]`), zero totals, and scanner autofocus, while preserving deliberate draft resumption and offering an explicit user choice for loading sample items.

## 2. Scope
- Root-cause identification in `src/components/billing/SmritiBillingStudio.tsx`.
- State remediation to initialize `cartItems` as `[]`, `billLevelDiscount` as `0`, and `receivedAmount` as `"0.00"`.
- Mode-aware default customer: `WALK_IN_CUSTOMER` for Counter POS / Retail POS, `DEMO_RELIANCE_CUSTOMER` for B2B.
- Isolation of billing workflows in `BillingWorkspace.tsx` using distinct React component keys.
- Comprehensive empty-cart table view with autofocus and quick action buttons.
- Preservation of F12 Park & Recall draft workflow with hold slip tracking.
- Test coverage additions (Tests 27–34) in `src/tests/smritiBillingStudio.test.ts`.

## 3. Files Created
1. `docs/implementation/billing/Billing_Studio_Preloaded_SKU_Root_Cause_Fix_v1.0.0.md`: IPGP implementation plan.
2. `docs/walkthrough/billing/Billing_Studio_Preloaded_SKU_Root_Cause_Fix_v1.0.0.md`: WGP walkthrough.

## 4. Files Modified
1. `src/components/billing/SmritiBillingStudio.tsx`:
   - Updated `computeBillingTotals` with fast-exit on empty cart returning mathematically exact zero totals.
   - Initialized `cartItems` as `[]` instead of `INITIAL_DEMO_CART_ITEMS`.
   - Initialized `billLevelDiscount` as `0` instead of `50`.
   - Initialized `receivedAmount` as `"0.00"` instead of `"16286.13"`.
   - Initialized `customer` mode-aware: `mode === "B2B_DISTRIBUTOR" ? DEMO_RELIANCE_CUSTOMER : WALK_IN_CUSTOMER`.
   - Added `useEffect` mounting hook to autofocus `barcodeInputRef`.
   - Added empty-cart table state with "Start Scanning (F1)", "Search Items (F2)", and "Load Sample Items" buttons.
   - Added `handleLoadSampleDemoItems` for deliberate, explicit demo loading.
   - Added `handleParkCurrentCart` and `showParkedBillsModal` with F12 keyboard shortcuts.
   - Cleared cart and reset state upon successful checkout or offline sale enqueue.
2. `src/components/billing/BillingWorkspace.tsx`:
   - Added distinct React keys `counter-pos-studio`, `credit-billing-studio`, and `b2b-distributor-studio` to guarantee zero state leakage across modes.
3. `src/tests/smritiBillingStudio.test.ts`:
   - Added Tests 27–34 verifying fresh session state, zero totals, draft resumption, and workflow isolation.
4. `docs/implementation/README.md`: Appended master index.
5. `docs/walkthrough/README.md`: Appended master index.
6. `CHANGELOG.md`: Logged release v6.96.0.
7. `RELEASE_NOTES.md`: Documented release notes for v6.96.0.

## 5. Architecture Decisions
1. **Preserve `INITIAL_DEMO_CART_ITEMS` as an Exported Constant:** Rather than deleting the 6 approved sample items, they remain exported for unit test validation (`computeBillingTotals`), catalog fallback matching during test scans, and the explicit "Load Sample Items" action.
2. **Explicit User Choice Over Silent Injection:** The UI never silently mutates state with demo products. Demo products are only inserted when the user explicitly clicks the "Load Sample Items" button.
3. **Pure Zero Totals Fast-Exit:** In `computeBillingTotals`, passing an empty items array `[]` immediately returns zero for all fields (`grossTotal: 0`, `subtotal: 0`, `billDiscount: 0`, `totalTax: 0`, `netPayable: 0`), preventing phantom discounts or taxes.
4. **React Reconciliation Key Isolation:** Binding `key="counter-pos-studio"` ensures that switching between Counter POS, Credit, and B2B unmounts and remounts clean instances.

## 6. Design Rationale
- **Cashier Ergonomics:** The scanner input is focused immediately upon opening Counter POS so that hardware barcode guns immediately scan the first product.
- **Accidental Charge Prevention:** Zero preloaded items prevents cashiers from accidentally ringing up items not present in the customer's physical basket.
- **Visual Confidence:** The empty cart state displays a clear, centered shopping cart icon with helpful instructions and keyboard hotkey cues.

## 7. Implementation Summary
- **Root Cause:** Line 443 in `SmritiBillingStudio.tsx` had `useState<ProPosCartItem[]>(INITIAL_DEMO_CART_ITEMS)` hardcoded during an earlier visual specification freeze.
- **Remediation:** Changed initial state to `useState<ProPosCartItem[]>([])`, reset bill discount to `0`, received tender to `"0.00"`, added empty cart table state, wired autofocus, and added workflow keys.

## 8. Tests Executed
```bash
npx vitest run src/tests/smritiBillingStudio.test.ts
```
Terminal output:
```text
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/smritiBillingStudio.test.ts (34 tests) 69ms

 Test Files  1 passed (1)
      Tests  34 passed (34)
   Duration  1.03s
```

All 34 tests green:
- Tests 1–26: Existing canonical billing regression tests (GST, tendered change, credit limits, idempotency, scan multiplier, etc.).
- Test 27: Fresh Counter POS empty cart and Walk-in defaults.
- Test 28: Session reload preservation without product injection.
- Test 29: Product scan/selection addition to empty cart.
- Test 30: Deliberate draft restoration via `SmritiPosParkedCartService.recallCart`.
- Test 31: Workflow state isolation between POS, Credit, and B2B modes.
- Test 32: Offline queue deduplication.
- Test 33: Pure zero totals enforcement on empty cart.
- Test 34: Explicit user choice for sample item loading.

## 9. Verification Results
- `npm run architecture:check`: 11/11 checks passed, 0 violations, 0 debt.
- `npm run validate-registry`: 98/98 form components verified.
- `npm run validate-launchpad`: 55/55 tiles verified.
- `npm run build`: Vite production build passed in 49.13s with 0 errors.

## 10. Known Limitations
None. All 8 requirements from the user specification are fully satisfied.

## 11. Future Work
- Integration with store-level hardware scale peripherals for weighted loose items.

## 12. Related ADRs
- ADR-0012: Pure Canonical Totals Engine & Tax Inclusivity Architecture.
- ADR-0044: B2B Packing Slips and Consolidated Tax Invoicing.

## 13. Related RFCs
- RFC-2026-POS-01: Point of Sale Terminal Hardening & Draft Isolation.
