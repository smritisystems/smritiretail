<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.1
  Created      : 2026-10-21
  Modified     : 2026-10-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Walkthrough
-->

# Walkthrough: CRM & Customer 360° Stores, Outlets & Financial Exposure Integrity Remediation

## 1. Purpose
This walkthrough documents the local code remediation for the Customer 360° Dashboard (Stores / Outlets, Parent–Child Hierarchy, Credit Limit, Receivables Reconciliation, and Purchase Trend Aggregation) for enterprise corporate accounts, specifically validated against Reliance Retail Limited (`RRL-001` / `cust-rrl-192b561d`). It enforces strict data consistency across multi-tier customer hierarchies, delivery locations, and financial ledgers, permanently eliminating mock tables, hardcoded counts, and fabricated sparklines.

## 2. Scope
- **Backend Schemas & Filtering:** `backend/app/schemas/crm.py` (authoritative relationship credit mapping and non-deleted location filtering).
- **Backend API Contract & Aggregations:** `backend/app/api/v1/crm.py` (filtering soft-deleted locations, distinct store/DC classification, and trailing 6 calendar months purchase trend aggregation).
- **Frontend Customer 360 Workspace:** `src/components/customer/corporate360/Customer360DashboardView.tsx`, `CorporateAccountHeader.tsx`, `CorporateKpiCards.tsx`, `CorporateStoreNetwork.tsx`, `CorporateStoreTypeWidget.tsx`, `CorporatePsvWidget.tsx`, and `types.ts`.
- **Regression Test Coverage:** `src/tests/customer360DashboardView.test.tsx` (Vitest) and `backend/app/tests/test_corporate_customer_360.py` (Pytest).

## 3. Files Created
- `docs/walkthrough/crm/CRM_Customer_360_Stores_Outlets_Integrity_Remediation_v6.99.1.md`

## 4. Files Modified
- `backend/app/schemas/crm.py`
- `backend/app/api/v1/crm.py`
- `src/components/customer/corporate360/types.ts`
- `src/components/customer/corporate360/Customer360DashboardView.tsx`
- `src/components/customer/corporate360/CorporateAccountHeader.tsx`
- `src/components/customer/corporate360/CorporateKpiCards.tsx`
- `src/components/customer/corporate360/CorporateStoreNetwork.tsx`
- `src/components/customer/corporate360/CorporateStoreTypeWidget.tsx`
- `src/components/customer/corporate360/CorporatePsvWidget.tsx`
- `src/tests/customer360DashboardView.test.tsx`

## 5. Architecture Decisions
1. **Accounting Semantics Reconciliation (ADR-CRM-004):**
   - Maintained semantic separation between Revolving Credit Ledger Exposure (`customer_credit_ledger_entries` / `customer.outstanding` = ₹155.24) and Total Unpaid Sales Invoice Receivables (`sales_invoices` with `outstanding_amount > 0` = ₹275.20).
   - Under standard retail ERP accounting, POS cash underpayments remain open on invoices without altering trade credit limit ledger entries. Neither figure was hardcoded or artificially mutated.
2. **Entity Classification & Non-Deleted Invariants:**
   - Soft-deleted delivery locations (`is_deleted = TRUE`) are strictly excluded in both backend schema serialization and frontend derivation.
   - Preserved customer accounts, delivery locations, retail outlets, and distribution centers/logistics hubs as distinct entities.
   - Single-tier accounts with 0 child entities authentically render `Direct Single-Tier Account — 0 Child Accounts` without coercing delivery locations into child customers.
3. **Calendar Month Purchase Trend Aggregation:**
   - Replaced arbitrary invoice `limit(10)` snippet with SQL query calculating monthly totals over the trailing 6 calendar months using PostgreSQL dates and UTC boundaries.
   - When no transactions exist, the UI renders an authentic `"Awaiting Trend"` empty state rather than fabricated sparklines.

## 6. Design Rationale
- **Authoritative SSOT:** Avoided synthetic fallbacks (e.g. 85 stores, 2,456 stores, 12 child accounts, ₹5,00,00,000 credit limit, ₹2,15,43,250 outstanding). All components now read from the authoritative customer and relationship contracts.
- **Fail-Safe Rendering:** Null-safe formatting across Indian Rupee representations (`toLocaleString("en-IN")`), ensuring graceful display without throwing uncaught exceptions or rendering raw `NaN`.

## 7. Implementation Summary
- **CRM Schema (`backend/app/schemas/crm.py`):** Filtered `is_deleted` out of `billing_locations`, `delivery_locations`, `gst_registrations`, and `external_identities`. Prioritized `CustomerCompanyRelationship` credit limit and terms before falling back to `CustomerGroup`.
- **API Router (`backend/app/api/v1/crm.py`):** Added `derive_store_type` recognizing Distribution Centers and Retail Stores. Filtered soft-deleted locations. Implemented trailing 6-month UTC date math for `purchase_trend`.
- **Customer 360 View (`Customer360DashboardView.tsx`):** Bound store network table and Tab 5 header to live non-deleted stores. Sourced hierarchy cards from actual child accounts. Replaced 7 mock sparkline bars with `"Awaiting Trend"`. Replaced prototype credit/outstanding fallbacks with dynamic variables.
- **Widgets Cleanup (`CorporateAccountHeader.tsx`, `CorporateKpiCards.tsx`, `CorporateStoreNetwork.tsx`, `CorporateStoreTypeWidget.tsx`, `CorporatePsvWidget.tsx`):** Eliminated hardcoded prototype fallbacks (`2318`, `2456`, `500000000`, `1624000000`).

## 8. Tests Executed
1. `npx vitest run src/tests/customer360DashboardView.test.tsx` (31 tests passed).
2. `F:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest backend/app/tests/test_corporate_customer_360.py -o addopts=""` (16 tests passed).
3. `npx tsc --noEmit` (0 errors, clean exit).
4. `python scripts/architecture_duplication_gate.py` (11 checks passed, 0 violations).
5. `npm run build` (`vite build`, production bundle generated cleanly in 56.70s).

## 9. Verification Results
- **Evidence Level:** A (Direct observable terminal outputs and git diffs).
- **All 31 Vitest Tests:** Passed.
- **All 16 Pytest Tests:** Passed.
- **TypeScript Typecheck:** 0 errors.
- **Vite Production Build:** Success.
- **Physical Schema Parity:** Preserved; 0 migrations needed.

## 10. Known Limitations
- Historical purchase trends depend on invoice transactions recorded within the current operating company context (`company_id`). Transactions from external sister companies require multi-company consolidated group view.

## 11. Future Work
- Surface multi-company consolidated invoice receivables in the right intelligence sidebar for corporate accounts with Model C relationships across multiple operational companies.

## 12. Related ADRs
- `ADR-CRM-001`: Model C Multi-Company Customer Commercial Terms
- `ADR-CRM-004`: Reconciliation of Revolving Trade Credit Ledger vs. Sales Invoice Receivables

## 13. Related RFCs
- `RFC-CRM-360-INTEGRITY`: Enterprise Customer 360° Data Integrity & Dynamic Location Invariants
