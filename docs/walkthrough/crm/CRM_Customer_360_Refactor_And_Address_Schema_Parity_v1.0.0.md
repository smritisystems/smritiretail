<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-24
  Modified     : 2026-10-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Walkthrough
-->

# Walkthrough: CRM Customer 360° Dashboard Refactoring & Address Schema Parity

## 1. Purpose
This walkthrough documents the comprehensive refactoring of the Customer 360° Dashboard into a streamlined, business-driven, read-only summary, delegating mutations to the canonical Customer Master workflow. It also documents the resolution of the address schema concurrency validation failure in `backend/app/schemas/crm.py` where delivery locations without state or postal codes previously failed strict string validation.

## 2. Scope
- **Backend Schemas & Validation:** `backend/app/schemas/crm.py` (`StoreAddressItem` and `StoreAddressCreate` updated to allow optional city, state, and postal code attributes).
- **Backend API Contract:** `backend/app/api/v1/crm.py` (enforcing exact requested customer identity, multi-company tenant scoping, and active company commercial terms).
- **Frontend Workspace & Navigation:** `src/components/customer/corporate360/Customer360DashboardView.tsx`, `CorporateCustomer360.tsx`, and `CorporateCustomerTabs.tsx`.
- **Automated Regression Test Suites:**
  - `backend/app/tests/test_corporate_customer_360.py` (17/17 pytest green)
  - `backend/tests/test_customer_multicompany_repository.py` (6/6 pytest green)
  - `src/tests/customer360DashboardView.test.tsx` (8/8 vitest green)
  - `src/tests/customerMasterLifecycle.test.tsx` (26/26 vitest green)
  - Full customer vitest test run (125/125 vitest green across 16 files)
  - TypeScript validation (`npx tsc --noEmit` 0 errors)

## 3. Files Created
- `docs/walkthrough/crm/CRM_Customer_360_Refactor_And_Address_Schema_Parity_v1.0.0.md`

## 4. Files Modified
- `backend/app/schemas/crm.py`
- `backend/app/api/v1/crm.py`
- `backend/app/repositories/customer.py`
- `src/components/customer/corporate360/Customer360DashboardView.tsx`
- `src/components/customer/corporate360/CorporateCustomer360.tsx`
- `src/components/customer/corporate360/CorporateCustomerTabs.tsx`
- `src/components/customer/corporate360/types.ts`
- `src/tests/customer360DashboardView.test.tsx`
- `src/tests/corporateCustomer360.test.tsx`

## 5. Architecture Decisions
1. **Separation of Dashboard Overview from Master Mutation:**
   - The Customer 360 view acts purely as a read-only analytical and operational status dashboard.
   - All profile edits, address additions, GSTIN updates, and commercial terms mutations continue through the existing Customer Master workflow.
2. **Business-Driven Status Guidance:**
   - Highlights critical operational blockers: inactive account warnings blocking billing, credit holds, unsaved changes, and pending PSV inward quantities.
   - Avoids guessing or synthetic overdue task flags in the absence of explicit task due dates in the database contract.
3. **Canonical Address Schema Nullability Alignment:**
   - In standard Indian retail workflows, store fronts or temporary delivery locations may initially be created with only `location_name` and `city`.
   - `StoreAddressItem` and `StoreAddressCreate` now allow `city: Optional[str]`, `state: Optional[str]`, and `pincode: Optional[str]`, matching the underlying `CustomerDeliveryLocationBase` model.

## 6. Design Rationale
- **Zero Fabrication / Dummy Elimination:** Removed all mock contacts, placeholder document vaults, and artificial audit timeline tabs that were disconnected from PostgreSQL.
- **Strict Tenant & Company Scoping:** Enforces multi-company tenant filters on customer identity resolution, guaranteeing that customers cannot leak across unauthorized companies.

## 7. Implementation Summary
- **Backend Address Schemas:** Updated `city`, `state`, and `pincode` in `StoreAddressItem` and `StoreAddressCreate` from strict non-null strings to optional strings with default `None`.
- **Frontend Dashboard View:** Replaced bloated mock markup in `Customer360DashboardView.tsx` with high-density, business-driven metric callouts, KPI indicators, store network summaries, and explicit navigation links to master configuration tabs.

## 8. Tests Executed
1. `python -m py_compile backend/app/schemas/crm.py backend/app/api/v1/crm.py backend/app/repositories/customer.py backend/app/tests/test_corporate_customer_360.py backend/tests/test_customer_multicompany_repository.py`
2. `pytest backend/app/tests/test_corporate_customer_360.py -v` (17 tests)
3. `pytest backend/tests/test_customer_multicompany_repository.py -v` (6 tests)
4. `npx tsc --noEmit`
5. `npx vitest run customer` (125 tests across 16 files)

## 9. Verification Results
- All 17 Corporate Customer 360 backend tests passed in 125.85s.
- All 6 Multi-Company repository tests passed in 37.70s.
- All 125 Vitest customer frontend tests passed in 3.93s.
- Zero TypeScript diagnostics reported.
- Zero Python compilation errors.

## 10. Known Limitations
- Overdue flags are omitted intentionally from the dashboard pending an official Task Due Date schema migration.

## 11. Future Work
- Integrate task SLA schemas and due date tracking to support overdue condition indicators on customer accounts.

## 12. Related ADRs
- `docs/architecture/decisions/ADR-CRM-004-Financial-Exposure-Reconciliation.md`
- `docs/architecture/decisions/ADR-CRM-006-Customer-Multi-Address-Concurrency.md`

## 13. Related RFCs
- `docs/rfc/RFC-CRM-Customer-360-Refactor.md`
