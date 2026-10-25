<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.1
  Created      : 2026-10-25
  Modified     : 2026-10-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Implementation Plan — Billing Desk Empty-Bill Zero-Charge Guard & Policy Recovery

**Plan Identifier:** IP-BILLING-2026-004  
**Version:** v1.0.0  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Internal Governance & Financial Correctness  

---

## 1. Objective
Remediate the empty-bill defect in SMRITI Retail OS where opening a fresh, empty Billing Desk with 0 items resulted in `Add-ons (Freight/Charges) +₹150.00` and `Net Payable ₹150.00`. Safely recover the `/api/v1/billing/transaction-policy` endpoint to eliminate false settlement pause warnings while preserving the fail-closed settlement blocking safeguard if policy loading ever fails.

---

## 2. Business Motivation
In retail operations, cashiers and store managers opening a new billing transaction expect a pristine terminal evaluating to ₹0.00. Automatic accrual of packaging (₹50.00) and delivery (₹100.00) charges without goods causes confusion, cashier distrust, and potential billing errors. Furthermore, false amber warnings indicating policy loading failures induce operational friction during settlement.

---

## 3. Scope
- Add sales base zero-gate in `calculateBillFactors` (`src/services/smritiSalesFactorService.ts`).
- Add zero-item and zero-quantity fail-safe guard to `estimatedSummaryTotals` in `BillingTerm.tsx`.
- Enforce clean state lifecycle isolation across `handleNewInvoice`, `handleSuspendInvoice`, and `handleRecallInvoice`.
- Verify Docker container route registration and live policy resolution in FastAPI backend.
- Create automated unit and regression tests certifying zero empty-bill totals, PACK/DELV preservation on valid sales, and fail-closed settlement security.

---

## 4. Current State
- `DEFAULT_SALES_FACTORS` loaded PACK (₹50) and DELV (₹100) on mount.
- `estimatedSummaryTotals` iterated and summed these factors unconditionally.
- When `items.length === 0`, `billingPreview` was bypassed, exposing `estimatedSummaryTotals` directly on the UI.
- Container `smriti-api` was running older worker processes started before `/billing/transaction-policy` was declared, returning 404.

---

## 5. Gap Analysis
- Missing precondition: Ancillary statutory sales factors should require an eligible sales base (`discountedSaleValue > 0 || baseSaleAmount > 0`).
- Missing terminal guard: Empty carts should unconditionally evaluate monetary sums to ₹0.00.
- Missing lifecycle reset: `handleNewInvoice` and post-hold desks used inline object literals rather than canonical default constants.
- Stale backend runtime: Container processes needed a graceful restart to load newly declared FastAPI routes without destructive migrations.

---

## 6. Architecture Impact
- **Financial Parity:** Preserves statutory Section 15 GST calculation for all non-empty transactions.
- **Fail-Closed Security:** Preserves policy loading safeguard blocking settlement when policies are unresolvable.
- **Data Integrity:** Table `sales_factors` in PostgreSQL tenant `smriti001` remains intact without schema alterations.

---

## 7. Proposed Design
1. In `smritiSalesFactorService.ts`:
   ```typescript
   if (discountedSaleValue <= 0 && baseSaleAmount <= 0) {
     continue;
   }
   ```
2. In `BillingTerm.tsx`:
   ```typescript
   if (itemCount === 0 || totalQty === 0) {
     return {
       itemCount: 0, totalQty: 0, salesValue: 0, itemDiscount: 0, billDiscount: 0,
       totalTax: 0, totalAddons: 0, totalDeductions: 0, aboveTaxAddons: 0,
       aboveTaxDeductions: 0, belowTaxAddons: 0, belowTaxDeductions: 0,
       adjustedTaxableValue: 0, roundOff: 0, netAmount: 0,
     };
   }
   ```
3. In `handleNewInvoice`, `handleSuspendInvoice`, `handleRecallInvoice`: Replaced inline objects with `DEFAULT_TRANSPORTER_ROWS` and `DEFAULT_ADDON_ROWS`, preserving `rule_snapshots`.

---

## 8. Files Created
- `docs/implementation/billing/Billing_Empty_Bill_Zero_Charge_And_Policy_Recovery_Plan_v1.0.0.md`
- `docs/walkthrough/billing/Billing_Empty_Bill_Zero_Charge_And_Policy_Recovery_v1.0.0.md`
- `src/tests/billingAdjustmentsConvergence.test.ts`
- `backend/app/tests/test_billing_adjustments_and_discounts.py`

---

## 9. Files Modified
- `src/services/smritiSalesFactorService.ts`
- `src/components/billing/BillingTerm.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

---

## 10. Dependencies
- FastAPI 0.111+
- React 18 / Vite 5
- Vitest 4 / Pytest 8
- PostgreSQL 16 (`smriti-db`)

---

## 11. Risks
- Cashiers with stale localStorage caches may retain locally edited factor overrides until refreshed.

---

## 12. Rollback Strategy
- Revert modifications in `BillingTerm.tsx` and `smritiSalesFactorService.ts` via Git.
- Code changes are purely logic guards; zero database migrations or structural alterations were introduced.

---

## 13. Verification Plan
- Verify empty cart produces ₹0.00 across all summary fields.
- Verify cart with items retains PACK (₹50) and DELV (₹100).
- Verify unauthenticated `/billing/transaction-policy` returns 401.
- Verify authenticated `/billing/transaction-policy` returns 200 with complete configuration.

---

## 14. Test Plan
- Run `npx vitest run src/tests/billingAdjustmentsConvergence.test.ts src/tests/smritiSalesFactorEngine.test.ts src/tests/billingPreview.test.ts src/tests/billingTerm.test.ts`.
- Run pytest suite `backend/app/tests/test_billing_adjustments_and_discounts.py`.
- Run `npx tsc --noEmit`.
- Run `npm run build`.

---

## 15. Documentation Impact
- Added implementation plan and walkthrough.
- Updated master indices in `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- Updated release notes in `CHANGELOG.md`.

---

## 16. Deployment Plan
- Restart container `smriti-api` upon deploying host source changes to production/staging.

---

## 17. Status
**Completed** (Verified Level A).

---

## 18. Related ADRs
- `ADR-0042`: Canonical Sales Posting Writer & Headless Billing Convergence.
- `ADR-0045`: Single-Door Statutory GST & Sales Factor Governance.

---

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Billing_Empty_Bill_Zero_Charge_And_Policy_Recovery_v1.0.0.md`
