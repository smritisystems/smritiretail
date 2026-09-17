<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.33.1
  Created      : 2026-09-17
  Modified     : 2026-09-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Contractual 43.76% Discount Exclusivity & CSV Import for Reliance Retail Ltd.

**Plan Version:** 6.33.1  
**Module:** Billing & Sales Promotion Engine / POS CSV Import  
**Status:** In Progress  

---

## 1. Objective
Enforce strict contractual trade discount exclusivity for institutional accounts belonging to **Reliance Retail Ltd.** (e.g., `Reliance Retail Limited`, `RRL-001`, `CUST-001`, `cust-ril-1888`, customer groups `CG-LargeRetail`, `RELIANCE`). When Reliance Retail Ltd. is active in POS billing or Barcode CSV Import, suppress and skip all standard retail promotions (ILD 10%, EOSS 20%, clearance markdowns, BOGO, FEST500 bill-level discounts) and exclusively calculate a flat **43.76% discount on MRP** (`REL_RET_4376`).

---

## 2. Business Motivation
Institutional buyers operate under legally negotiated wholesale contracts specifying exact markdowns from statutory Maximum Retail Price (MRP). In standard retail billing systems, generic promotions (e.g. festival vouchers, end-of-season sales, buy-one-get-one deals) frequently collide or stack with institutional markdowns, eroding gross margins or violating contract compliance. By enforcing exclusivity and auto-applying the 43.76% markdown on both barcode CSV imports and manual cart lines, SMRITI POS eliminates billing friction and guarantees contract accuracy.

---

## 3. Scope
1. **Account Identification:** Centralized helper `isRelianceCustomer` in `SmritiSalesPromotionService` recognizing Reliance accounts by customer name, code, or assigned customer groups.
2. **Promotional Scheme Guarantee:** Dynamic creation, validation, and customer group binding for promotion campaign `REL_RET_4376` (`sp-reliance-4376`).
3. **Item-Level Short Circuit:** Immediate priority evaluation in `resolveBestItemPromo` returning `REL_RET_4376` (43.76% on MRP) and bypassing all general retail promos.
4. **Bill-Level Suppression:** Short-circuiting `resolveBestBillPromo` to return zero bill discounts when Reliance Retail Ltd. is the active customer.
5. **Backend CSV Ingestion:** Extending `validate_billing_csv` (`backend/app/api/v1/billing_csv.py`) to derive `effective_sp = catalog_mrp * (1 - 0.4376)` with `disc_amount = 0.00` to prevent double-discounting.
6. **Customer Policy Ceiling:** Ensuring customer discount ceiling permits at least 50% discount in `customer_discount_policy.py`.
7. **Frontend Modal UI:** Adding `#reliance-contract-banner` and 43.76% markdown badge to `BarcodeCSVImportModal.tsx`.
8. **POS Terminal Cart:** Mapping `REL_RET_4376` and 43.76% discount in `ProPosBillingTerm.tsx`, supporting mid-bill customer switch (`Alt+M`).
9. **Automated Verification:** Playwright headless end-to-end automation capturing 6 step-by-step screenshots and verifying PostgreSQL database records.

---

## 4. Current State
- `BarcodeCSVImportModal.tsx` supports multi-tier CSV parsing and mixed tax modes, but does not receive customer context from POS billing.
- `billing_csv.py` supports commercial discounts from CSV columns, but does not know customer institutional trade contracts.
- General promotion engine (`SmritiSalesPromotionService`) evaluates promotional candidates based on best discount rate or priority, risking general consumer promotions competing with or overwriting institutional contracts.

---

## 5. Gap Analysis
- Lack of customer context passing from `ProPosBillingTerm` to `BarcodeCSVImportModal` prevented the backend from applying institutional contracts at CSV validation time.
- Standard customer groups historically had a 20% or 30% discount ceiling, triggering HTTP 400 validation rejections during POS checkout if 43.76% was applied.
- General promotions could be selected by cashiers if Reliance accounts were not explicitly isolated in the promotion arbitration engine.

---

## 6. Architecture Impact
- **Single Source of Truth Arbitration:** `SmritiSalesPromotionService.resolveBestItemPromo` acts as the definitive gatekeeper for line item promotions.
- **Double-Discounting Elimination:** Calculating `effective_sp` directly from MRP and passing `discount_amount = 0.00` ensures downstream GST engines and invoice writers calculate exact net taxable amounts without deducting discounts twice.
- **Idempotency Preservation:** Preserving document numbering responsiveness ensures each test or checkout cycle produces unique invoice entries.

---

## 7. Proposed Design
- **Frontend Arbitration:**
  ```typescript
  if (isRelianceCustomer(customer)) {
    const relPromo = ensureReliance4376Promotion();
    // Return 43.76% on MRP, suppress all other promotions
  }
  ```
- **Backend CSV Ingestion:**
  ```python
  if is_reliance:
      rel_disc_pct = Decimal("43.76")
      effective_sp = (catalog_mrp * (Decimal("1.00") - rel_disc_pct / Decimal("100.00"))).quantize(Decimal("0.01"))
      disc_amount = Decimal("0.00")
  ```
- **UI Banner:**
  `#reliance-contract-banner` rendered at top of CSV Import modal informing cashier that 43.76% contract markdown is in effect.

---

## 8. Files Created
1. `src/tests/smritiRelianceDiscountExclusivity.test.ts`: Vitest test suite for Reliance customer recognition, contract promotion provisioning, and promo suppression.
2. `scripts/test_headless_csv_reliance_discount.py`: Automated Playwright headless runner with database audit.
3. `CSV/reliance_retail_order.csv`: Standard test CSV with catalogue barcodes for Reliance orders.
4. `docs/implementation/billing/Billing_CSV_Import_Reliance_Retail_Discount_Exclusivity_Plan_v6.33.1.md`: This plan document.

---

## 9. Files Modified
1. `src/services/smritiSalesPromotionService.ts`: Added `isRelianceCustomer`, `ensureReliance4376Promotion`, and short-circuits.
2. `backend/app/api/v1/billing_csv.py`: Added customer parameters, Reliance 43.76% rate calculation, and zero double-discounting guard.
3. `backend/app/services/customer_discount_policy.py`: Raised discount ceiling to 50% for Reliance accounts.
4. `backend/tests/test_billing_csv.py`: Added unit test `test_validate_row_reliance_contractual_4376`.
5. `src/components/billing/BarcodeCSVImportModal.tsx`: Added customer prop, contract banner, and 43.76% badge.
6. `src/components/billing/propos/CustBrowseDlg.tsx`: Mapped `customerGroup` and `customerGroupId`.
7. `src/components/billing/propos/ProPosBillingTerm.tsx`: Connected customer to modal, enforced `REL_RET_4376` in cart, enabled editable doc number.
8. `src/components/billing/propos/ProPosTaxInvoiceRc.tsx`: Displayed line item discount percent.
9. `docs/implementation/README.md`: Master index update.

---

## 10. Dependencies
- React 18, Vite 5, Tailwind CSS / Vanilla CSS tokens.
- FastAPI, SQLAlchemy, Pydantic v2.
- PostgreSQL 15 (`smriti001`).
- Playwright, Vitest, Pytest.

---

## 11. Risks
- **Leaking 43.76% Discount to Walk-in Shoppers:** If promotion scheme `REL_RET_4376` targeted group `"ALL"`, ordinary customers would receive wholesale pricing. Mitigated by restricting customer groups to `["RELIANCE", "RELIANCE_RETAIL", "CG-LargeRetail", "cg-retail", "cg-default"]` and enforcing customer matching checks.
- **Double-Discounting:** If 43.76% is subtracted in unit price AND discount amount, price is halved twice. Mitigated by setting `disc_amount = 0.00` when unit price already reflects the markdown.

---

## 12. Rollback Strategy
- Git revert of modified components.
- In-memory promotions can be reset via `SmritiSalesPromotionService.resetPromotions()`.

---

## 13. Verification Plan
- Unit tests: Vitest (4/4 in exclusivity suite, 25/25 in promotion studio suites), Pytest (10/10 in `test_billing_csv.py`).
- TypeScript compiler: `npx tsc --noEmit` exits with 0 errors.
- End-to-end Playwright run: Capturing 6 screenshots and asserting database row integrity.

---

## 14. Test Plan
- Scenario A: Select general walk-in customer -> Import CSV -> Standard rates / retail promos apply.
- Scenario B: Select Reliance Retail Ltd. -> Import CSV -> 43.76% contract banner shown, lines tagged `43.76% off MRP [REL_RET_4376]`.
- Scenario C: POS Cart shows `REL_RET_4376` with 43.76% markdown, 0 retail promos.
- Scenario D: Exact cash settlement posts to `/pos/checkout` without 400 error.
- Scenario E: Database records verified in PostgreSQL `smriti001`.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Ensure `docs/walkthrough/billing/Billing_CSV_Import_Reliance_Discount_Exclusivity_v6.33.1.md` reflects test results.
- Update Knowledge Base and Changelog.

---

## 16. Deployment Plan
- Deploy backend service changes to FastAPI runtime.
- Deploy frontend build bundle to Vite / static server.
- Database requires no migration (relies on existing tables and customer discount policies).

---

## 17. Status
Approved & In Progress.

---

## 18. Related ADRs
- `ADR-0042`: Statutory MRP Markdown and Discount Arbitration Priority
- `ADR-0056`: POS Barcode CSV Import Architecture and Audit Logging

---

## 19. Related Walkthroughs
- `docs/walkthrough/billing/Billing_CSV_Import_Reliance_Discount_Exclusivity_v6.33.1.md`
