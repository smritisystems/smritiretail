<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.30.0
  * Created    : 2026-09-02
  * Modified   : 2026-09-02
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough — Customer Master Form Harmonization & B2B Billing Workflow v1.0.0

## 1. Purpose
This walkthrough documents the resolution of the Customer Master customer type selection blocker, price group code normalization, multi-tenant database routing verification (`smritisys` -> `smriti001`), and the complete end-to-end B2B invoice generation and compliance verification workflow.

## 2. Scope
- Customer Master Form (`CustFormTab.tsx`): Harmonize select option values (`CORP`, `CPP`, `TI`, `VIP`, `RETAIL`), synchronize `customerType` to `environment` (`Corporate`, `Wholesale`), add `data-field-key` and `data-testid` attributes.
- Customer Master Workspace (`CustMasterWs.tsx`): Dynamic catalogue header, mobile number resolution fallback from address modal, customer group mapping (`CG-Corporate` vs `CG-Retail`), and action button test IDs.
- Backend API Client (`apiFetchV1.ts`): Defensive header accessor chaining (`response.headers?.get?.()`).
- Database & Multi-Tenant Routing: Verification of tenant database `smriti001` routing via `smritisys.company_database_registries`.
- End-to-End Test Suite: 612/612 passing unit tests across 99 test files, production Vite build, and 7-stage end-to-end system verification.

## 3. Files Created
- `scratch/comprehensive_verification.py`
- `scratch/inspect_smriti001_db.py`
- `scratch/set_admin_branch.py`
- `scratch/debug_inv_post.py`
- `docs/walkthrough/crm/Customer_Master_Form_Harmonization_And_B2B_Workflow_v1.0.0.md`

## 4. Files Modified
- `src/components/customer/CustFormTab.tsx`
- `src/components/customer/CustMasterWs.tsx`
- `src/lib/apiFetchV1.ts`
- `src/tests/autoPopulate.test.ts`
- `src/tests/numbering.test.ts`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **ADR-CRM-01: Canonical Master Partitioning:** `customers` in tenant PostgreSQL database `smriti001` is the authoritative operational customer store.
- **ADR-CRM-02: Strict Multi-Tenant Routing:** Control plane database `smritisys` routes requests via `company_database_registries` to tenant database `smriti001` based on validated JWT context.
- **ADR-CRM-03: Backward-Compatible Select Option Normalization:** Form controls display descriptive labels while matching clean codes (`CORP`, `VIP`, `TI`, `CPP`, `RETAIL`) in the DOM.

## 6. Design Rationale
- Standardizing option values in `CustFormTab.tsx` allows automated selectors (e.g. Playwright `selectOption('CORP')`) and keyboard/mouse interaction to deterministically bind values without regex mismatch against complex string descriptors.
- Multi-field fallback in `CustMasterWs.tsx` handles address modal persistence where mobile numbers are entered in sub-dialogs before top-level form submission.

## 7. Implementation Summary
1. Cleaned up select values and added automated test identifiers (`data-testid="new-customer-btn"`, `data-testid="save-customer-btn"`, `data-testid="search-customer-btn"`).
2. Bound `customerType` changes to auto-select `environment="Corporate"` for corporate/wholesale classifications.
3. Verified PostgreSQL tenant table `smriti001.customers` and `smriti001.sales_invoices`.
4. Executed full 7-stage verification covering authentication, customer creation, database persistence, typeahead search, sales invoice creation, invoice item verification, and PDF invoice generation.

## 8. Tests Executed
1. `npm test` — Vitest unit test suite (99 test files, 612 tests).
2. `scratch/comprehensive_verification.py` — 7-stage end-to-end integration and database validation.
3. `npm run build` — Production bundle build validation (3,526 modules transformed).

## 9. Verification Results
- **Vitest Unit Tests:** 612/612 PASSED (100% green).
- **Vite Production Build:** SUCCESS (3,526 modules transformed, 0 errors in 28.09s).
- **End-to-End System Test:** 7/7 Stages PASSED:
  - Stage 1: Auth HTTP 200 (Operator `admin`, JWT generated, company `COMP-001`).
  - Stage 2: Customer Creation HTTP 201 (`Validation Test B2B Enterprise`, `CG-Corporate`).
  - Stage 3: Direct PostgreSQL Persistence in `smriti001.customers` verified.
  - Stage 4: Typeahead Search HTTP 200 (100% match on code and mobile).
  - Stage 5: B2B Credit Invoice HTTP 201 (Taxable: ₹13,103.10, Tax Total: ₹2,358.56, Grand Total: ₹15,461.66).
  - Stage 6: Direct PostgreSQL Persistence in `smriti001.sales_invoices` and `smriti001.sales_invoice_items` verified.
  - Stage 7: PDF Tax Invoice Generation HTTP 200 verified.

## 10. Known Limitations
- None for the verified customer creation and B2B billing flow.

## 11. Future Work
- Consolidate browse search dialogs (`AdvancedCustSearch`, `ProductSearchBrows`) into `UniversalBrowseEngine` (Phase 2 Owner-deferred).
- Schema remediation for `items.item_type` column (Phase 3 Owner-deferred).

## 12. Related ADRs
- ADR-CRM-01, ADR-CRM-02, ADR-CRM-03

## 13. Related RFCs
- RFC-SMRITI-B2B-001 (B2B Credit Billing Lifecycle Contract)
