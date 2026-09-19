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

# Walkthrough: Reliance Retail Ltd. 43.76% Contract Markdown Exclusivity & CSV Import Engine

**Document Version:** 6.33.1  
**Module:** Billing & Sales Promotion Engine / POS CSV Import  
**Status:** Completed & Verified  

---

## 1. Purpose
Enforce contractual trade discount exclusivity for institutional accounts belonging to **Reliance Retail Ltd.** (e.g. `Reliance Retail Limited`, `RRL-001`, `CUST-001`, `cust-ril-1888`, customer groups `CG-LargeRetail`, `RELIANCE`). Under this trade contract, all general consumer/retail promotions (e.g., ILD 10%, EOSS 20%, clearance, BOGO, festival ₹500 off, VIP bill-level discounts) are strictly suppressed and skipped. Instead, a flat **43.76% markdown on MRP** (`REL_RET_4376`) is exclusively assigned and automatically calculated across catalogue items, including during POS Barcode CSV Import workflows.

---

## 2. Scope
- Dynamic creation, activation, and customer group assignment of promotion campaign `REL_RET_4376` (43.76% markdown on MRP).
- Item-level sales promotion arbitration (`smritiSalesPromotionService.ts`): Immediate short-circuit evaluation applying `REL_RET_4376` and skipping all other candidate promotions for Reliance accounts.
- Bill-level sales promotion arbitration (`smritiSalesPromotionService.ts` and `ProPosBillingTerm.tsx`): Suppression of all bill-level discounts (e.g., FEST500) for Reliance accounts.
- Backend CSV validation API (`backend/app/api/v1/billing_csv.py`): Auto-calculation of `effective_sp = catalog_mrp * (1 - 0.4376)` with `disc_amount = 0.00` to prevent double-discounting.
- Customer discount policy (`backend/app/services/customer_discount_policy.py`): Relaxation of max discount limit to 50% for institutional Reliance accounts.
- POS Barcode CSV Import Modal (`BarcodeCSVImportModal.tsx`): Display of active `#reliance-contract-banner` and 43.76% markdown badge.
- POS Terminal (`ProPosBillingTerm.tsx`): Preserving contract pricing in cart, mapping `REL_RET_4376`, editable document numbering, and mid-bill customer switch re-evaluation.
- Headless automated Playwright test suite capturing step-by-step screenshots and verifying PostgreSQL database persistence (`sales_invoices`, `sales_invoice_items`, `billing_csv_import_logs`).

---

## 3. Files Created
1. `src/tests/smritiRelianceDiscountExclusivity.test.ts` — Vitest unit test suite covering Reliance account identification, contract promotion creation, item-level exclusivity, and bill-level discount suppression.
2. `scripts/test_headless_csv_reliance_discount.py` — Automated Playwright headless runner driving end-to-end POS workflow, screenshot capture, and PostgreSQL audit verification.
3. `F:/SMRITRretailNX/CSV/reliance_retail_order.csv` — Dedicated sample CSV test file with catalogue barcodes for Reliance orders.
4. `docs/walkthrough/billing/Billing_CSV_Import_Reliance_Discount_Exclusivity_v6.33.1.md` — This walkthrough document.

---

## 4. Files Modified
1. `src/services/smritiSalesPromotionService.ts` — Added `isRelianceCustomer` method, `ensureReliance4376Promotion` assignment, and exclusivity short-circuits in `resolveBestItemPromo` and `resolveBestBillPromo`.
2. `src/components/billing/BarcodeCSVImportModal.tsx` — Added `#reliance-contract-banner` banner, customer context passing, and 43.76% MRP markdown badge rendering.
3. `src/components/billing/propos/CustBrowseDlg.tsx` — Mapped `customerGroup` and `customerGroupId` in `mapToProPosCustomers`.
4. `src/components/billing/propos/ProPosBillingTerm.tsx` — Enforced 43.76% discount assignment on CSV import, mid-bill customer switch re-evaluation, passing customer name to `resolveBestBillPromo`, and made `posDocNumber` editable.
5. `src/components/billing/propos/ProPosTaxInvoiceRc.tsx` — Verified receipt formatting displays `Disc: 43.76%` on each line item.
6. `backend/app/api/v1/billing_csv.py` — Added customer context to `CsvValidateRequest`, institutional contract rate derivation, and double-discounting guard.
7. `backend/app/services/customer_discount_policy.py` — Institutional discount allowance override for Reliance accounts.
8. `backend/tests/test_billing_csv.py` — Added unit test `test_validate_row_reliance_contractual_4376`.
9. `docs/walkthrough/README.md` — Appended walkthrough entry.
10. `docs/implementation/README.md` — Synchronized implementation index.

---

## 5. Architecture Decisions
- **AD-REL-01 (Single Discount Enforcement):** In retail billing, applying both a commercial rate markdown and a consumer promotional discount causes compounding error. When `effective_sp` is derived from `mrp * (1 - 0.4376)`, line item `discount_amount` passed to tax computation is strictly set to `0.00` to prevent secondary discounting.
- **AD-REL-02 (Exclusivity Group Isolation):** Scheme `REL_RET_4376` strictly targets customer groups `["RELIANCE", "RELIANCE_RETAIL", "CG-LargeRetail", "cg-retail", "cg-default"]` and does NOT target `"ALL"` to avoid leaking the 43.76% discount to general retail walk-in shoppers.
- **AD-REL-03 (Idempotency and Document Serialization):** POS checkouts use client invoice document numbers as idempotency keys. Making `posDocNumber` reactive ensures sequential numbers post fresh sales invoices into PostgreSQL without tripping cache replays.

---

## 6. Design Rationale
Trade agreements with institutional buyers like Reliance Retail Ltd. are legally binding contracts negotiated at fixed markdowns on statutory MRP. Permitting algorithmic retail engines to stack seasonal promotions (e.g. 50% clearance + 43.76% contract markdown) would erode margins and violate pricing governance. Centralizing account recognition at both frontend and backend guarantees non-repudiation.

---

## 7. Implementation Summary
- **Identification:** `isRelianceCustomer` checks customer name (`RELIANCE`), customer code (`RIL`, `RRL`, `CUST-001`), and customer groups (`CG-LargeRetail`, `RELIANCE`).
- **Dynamic Provisioning:** `ensureReliance4376Promotion` guarantees scheme `sp-reliance-4376` (`REL_RET_4376`) is active and assigned in database/local promotion registries.
- **Item-Level Short Circuit:** `resolveBestItemPromo` checks `isRelianceCustomer` and immediately returns `REL_RET_4376` at 43.76% off MRP.
- **Bill-Level Suppression:** `resolveBestBillPromo` skips all candidate bill-level discounts.
- **CSV Ingestion:** `_validate_row` derives `effective_sp = catalog_mrp * (1 - 0.4376)` and returns display badge `43.76% off MRP [REL_RET_4376]`.

---

## 8. Tests Executed
1. `npx vitest run src/tests/smritiRelianceDiscountExclusivity.test.ts` (4/4 passed)
2. `npx vitest run src/tests/smritiSalesPromotionsStudio.test.ts src/tests/smritiAutoSelectPromotion.test.ts` (25/25 passed)
3. `python -m pytest backend/tests/test_billing_csv.py` (10/10 passed)
4. `npx tsc --noEmit` (0 errors)
5. `npm run build` (Production Vite bundle built successfully in 30.57s)
6. `python scripts/test_headless_csv_reliance_discount.py` (Headless Playwright test with 6 high-res screenshots and PostgreSQL database audit)

---

## 9. Verification Results
- **Terminal Test Outputs:**
  - Vitest: 29/29 passed across promotion test suites.
  - Pytest: 10/10 passed in `backend/tests/test_billing_csv.py`.
  - TypeScript: 0 compilation errors.
- **Playwright Test Execution:**
  - Customer loaded: `Reliance Retail Limited (RRL-001)`.
  - Banner displayed: `Contract Active: Reliance Retail Limited 43.76% Markdown`.
  - Preview badges: `43.76% off MRP [REL_RET_4376]` on all rows.
  - Cart line items: Assigned `REL_RET_4376 43.76%`, 0 retail promos applied.
  - Settlement: Exact Cash [F7] posted to `/pos/checkout`.
  - Persisted Invoice: `TT/0003` in `sales_invoices`, grand total ₹4,103.84.
  - Line Items: Line 1 (MRP ₹2599 -> Unit Price ₹1461.68), Line 2 (MRP ₹2099 -> Unit Price ₹1180.48). Both 43.76% discount verified.
  - Audit Log: `log-csv-de4c493c7bc7` saved in `billing_csv_import_logs`.

---

## 10. Known Limitations
- If an item in the catalogue has MRP = 0.00, the contract discount falls back to catalog selling price since markdown requires a positive statutory MRP.

---

## 11. Future Work
- Add multi-tier contract rates for different institutional sub-divisions (e.g. Reliance Trends vs. Reliance Smart).

---

## 12. Related ADRs
- `ADR-0042`: Statutory MRP Markdown and Discount Arbitration Priority
- `ADR-0056`: POS Barcode CSV Import Architecture and Audit Logging

---

## 13. Related RFCs
- `RFC-2026-08`: Institutional B2B Pricing and Contract Markdown Engine
