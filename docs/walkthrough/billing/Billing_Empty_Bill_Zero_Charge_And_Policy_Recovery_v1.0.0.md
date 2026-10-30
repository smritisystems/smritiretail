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

# SMRITI Billing Desk — Empty-Bill Zero-Charge Guard & Transaction Policy Recovery

**Walkthrough Version:** v1.0.0  
**Status:** Completed & Verified  
**Date:** 2026-10-25  
**Area:** Billing & Financial Governance  

---

## 1. Purpose
Remediate the empty-bill defect where a newly opened, clean Billing Desk with zero items and zero quantity displayed unexpected add-ons (`+₹150.00`) and a net payable amount (`₹150.00`). Recover the failing `/api/v1/billing/transaction-policy` endpoint, ensuring that the fail-closed settlement safeguard operates cleanly without displaying false settlement pause warnings, while preserving the policy-loading guard when connectivity fails.

---

## 2. Scope
- Zero-item and zero-quantity monetary guard in `BillingTerm.tsx`.
- Statutory sales factor eligibility guard in `smritiSalesFactorService.ts`.
- State lifecycle isolation across `handleNewInvoice`, `handleSuspendInvoice`, and `handleRecallInvoice`.
- Backend route verification and live policy resolution recovery in FastAPI / Docker.
- Comprehensive regression test suites covering empty-cart zero charges, valid cart PACK/DELV preservation, percentage factors/deductions, hold/recall state isolation, and fail-closed settlement safeguards.

---

## 3. Files Created
- `docs/walkthrough/billing/Billing_Empty_Bill_Zero_Charge_And_Policy_Recovery_v1.0.0.md` (this document)
- `src/tests/billingAdjustmentsConvergence.test.ts` (new dedicated adjustments, lifecycle, and preview convergence test suite)
- `backend/app/tests/test_billing_adjustments_and_discounts.py` (backend unit test suite for Section 8/15 GST adjustments and customer discount policy validation)

---

## 4. Files Modified
- `src/services/smritiSalesFactorService.ts`:
  - Added zero-sales-base guard in `calculateBillFactors` (`if (discountedSaleValue <= 0 && baseSaleAmount <= 0) continue;`).
  - Added safe optional parameters and sensible defaults for `FactorCalculationInput`.
- `src/components/billing/BillingTerm.tsx`:
  - Added fail-safe zero-item/zero-quantity guard in `estimatedSummaryTotals`.
  - Exported and reused `DEFAULT_TRANSPORTER_ROWS` and `DEFAULT_ADDON_ROWS` in state initialization, `handleNewInvoice`, and `handleSuspendInvoice`.
  - Implemented exact adjustment restoration in `handleRecallInvoice` from `rule_snapshots`.

---

## 5. Architecture Decisions
1. **Zero-Cart Invariant:** When cart item count or total quantity is zero, all monetary totals strictly evaluate to ₹0.00. Ancillary statutory sales factors (freight, packaging, delivery) cannot accrue against a non-existent or zero sales base.
2. **Business Value Preservation:** Fixed business values (PACK ₹50, DELV ₹100) are preserved in the configuration registry. They are not zeroed out or modified globally; rather, they are gated on the existence of an eligible sales base.
3. **Fail-Closed Policy Safeguard:** Settlement remains strictly blocked if the authoritative backend billing policy cannot be resolved (`billingPolicyError !== null`).
4. **Isolated Database Parity:** Verified that table `sales_factors` already exists in tenant databases (`smriti001`) with valid schema, avoiding redundant migrations or duplicate tables.

---

## 6. Design Rationale
- Gating ancillary charges on the sales base ensures mathematical correctness: freight and packaging cannot be levied on an invoice with no goods.
- Reusing canonical `DEFAULT_*` constants eliminates state leakage between successive invoices without hardcoding ephemeral mock rows.
- Holding an invoice preserves adjustments in `rule_snapshots` so that recalling restores identical customer-specific charges.

---

## 7. Implementation Summary
- **Statutory Sales Factors:** In `calculateBillFactors`, if `discountedSaleValue <= 0 && baseSaleAmount <= 0`, the engine skips ancillary factor application.
- **Estimated Summary Totals:** In `BillingTerm.tsx`, an immediate return of zeroed monetary totals is triggered if `itemCount === 0 || totalQty === 0`.
- **Billing Desk Lifecycle:** Reset desk adjustments to clean defaults upon new bill and hold; restore from snapshot upon recall.
- **Backend Service Recovery:** Restarted `smriti-api` container to register the newly mounted `/billing/transaction-policy` endpoint. Authenticated calls return HTTP 200 with complete configuration.

---

## 8. Tests Executed

### A. Frontend Vitest Tests
```powershell
npx vitest run src/tests/billingAdjustmentsConvergence.test.ts src/tests/smritiSalesFactorEngine.test.ts src/tests/billingPreview.test.ts src/tests/billingTerm.test.ts
```
**Results:** 4 test files passed, 35/35 tests passed green.

### B. Backend Pytest Tests
```powershell
.\.venv\Scripts\python.exe -m pytest backend/app/tests/test_billing_adjustments_and_discounts.py -v
```
**Results:** 7/7 tests passed green in 9.61s.

### C. TypeScript Type Check
```powershell
npx tsc --noEmit
```
**Results:** Exited with code 0 (0 errors).

### D. Production Build
```powershell
npm run build
```
**Results:** Built in 55.37s with 0 errors.

---

## 9. Verification Results
- **Evidence Level:** Level A (Directly observable diffs, literal test outputs, live HTTP 200 API responses, and clean production build).
- **Status:** Done.
- All empty-bill add-on charges eliminated while preserving legitimate charges on non-empty transactions.

---

## 10. Known Limitations
- Browser clients with modified localStorage items from older debug sessions may retain cached factor overrides until localStorage is cleared or refreshed via sync.

---

## 11. Future Work
- Add a periodic background heartbeat to refresh tenant transaction policy automatically if session tokens are rotated.
- Add dynamic cashier warning if freight or packaging exceeds a configurable percentage of invoice gross total.

---

## 12. Related ADRs
- `ADR-0042`: Canonical Sales Posting Writer & Headless Billing Convergence.
- `ADR-0045`: Single-Door Statutory GST & Sales Factor Governance.

---

## 13. Related RFCs
- `RFC-2026-09`: Section 15 GST Valuation & Ancillary Charges Policy.
- `RFC-2026-10`: Billing Window Adjustments, Deductions, and Precedence Engine.
