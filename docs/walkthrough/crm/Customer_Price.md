<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.9.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — Customer Price Group Master & Database Flow Integrity (v6.9.0)

## 1. Purpose
This walkthrough documents the complete implementation of the **Customer Price Group Master** window and the resolution of the **Customer Flow & Database Integrity Audit**, establishing PostgreSQL as the single canonical source of truth for CRM records while removing misleading frontend mock fallbacks.

## 2. Scope
* Customer Price Group Master Modal (`src/components/customer/CustPriceGroupDlg.tsx`)
* Customer Form Tab Integration (`src/components/customer/CustFormTab.tsx`)
* Customer Storage & Sync Service (`src/services/customerStore.ts`)
* Billing Terminal & ProPOS Live Customer Browse (`src/components/billing/BillingTerm.tsx`, `src/components/billing/propos/CustBrowseDlg.tsx`)
* Backend Tenant Context & CRM Service Resilience (`backend/app/api/deps.py`, `backend/app/services/crm.py`, `backend/app/schemas/crm.py`)
* Database Canonical Seeding (`backend/app/db/seed_customers.py`)
* Automated Regression Test Suites (`src/tests/custPriceGrp.test.ts`, `src/tests/custFlow.test.ts`)

## 3. Files Created
* `src/components/customer/CustPriceGroupDlg.tsx`
* `backend/app/db/seed_customers.py`
* `src/tests/custPriceGrp.test.ts`
* `src/tests/custFlow.test.ts`
* `docs/walkthrough/crm/Customer_Price.md`
* `docs/implementation/crm/Customer_Price.md`

## 4. Files Modified
* `src/types.ts`
* `src/components/customer/types.ts`
* `src/services/customerStore.ts`
* `src/components/customer/CustFormTab.tsx`
* `src/components/billing/BillingTerm.tsx`
* `src/components/billing/propos/CustBrowseDlg.tsx`
* `backend/app/api/deps.py`
* `backend/app/services/crm.py`
* `backend/app/schemas/crm.py`
* `docs/walkthrough/README.md`
* `docs/implementation/README.md`
* `CHANGELOG.md`

## 5. Architecture Decisions
1. **Desktop ERP Replicated Customer Price Group Master**:
   - Replicated exact desktop ERP layout with Code, Description, Payment Terms, Credit Days, Dest-Wise Tax Type, Credit Limit, Item Classification-wise Price Factor checkbox, and `Transactions Allowed` group box (Credit Invoice, Cash Invoice, Tax Exclusive Invoice, Misc. Issue).
   - Standard shortcut key bindings: <kbd>Alt+O</kbd> (Ok), <kbd>Alt+C</kbd> (Cancel), <kbd>Alt+A</kbd> (Add), <kbd>Alt+E</kbd> (Edit), <kbd>Alt+D</kbd> (Delete), <kbd>Alt+X</kbd> / <kbd>Escape</kbd> (Exit).
2. **PostgreSQL Single Source of Truth**:
   - Seeded canonical Customer Groups (`CG-Retail`, `CG-LargeRetail`, `CG-Branches`, `CG-Franchises`) and 7 canonical Customers into PostgreSQL with tenant isolation (`COMP-001` / `BR-MAIN-001`).
   - Explicitly preserved invoice-linked customer IDs such as `cust-rrl-192b561d` (Reliance Retail) to eliminate foreign key orphan risks.
3. **Removal of Silent Mock Fallback**:
   - Removed `DEFAULT_CUSTOMERS` and fallback array substitutions from `CustBrowseDlg.tsx` and `BillingTerm.tsx`. When the database has 0 rows, the UI reflects an explicit empty state rather than fabricating demo data.

## 6. Design Rationale
* Enterprise density UI with high contrast borders (`#64748b`, `#cbd5e1`) and clean tabular catalogue for quick group inspection.
* Zero data desynchronization between billing terminal, customer master, and PostgreSQL transactional ledger.

## 7. Implementation Summary
* Added `CustomerPriceGroup` interface across domain definitions.
* Built reactive store helpers (`getCustomerPriceGroups`, `saveCustomerPriceGroups`, `addCustomerPriceGroup`, `updateCustomerPriceGroup`, `deleteCustomerPriceGroup`).
* Linked Customer Form Tab directly to Customer Price Group modal with dynamic dropdown population and an inline `[...]` management launcher.
* Resolved `deps.py` tenant branch resolution bug (`BR-001` vs `BR-MAIN-001`).
* Updated CRM service with specific `IntegrityError` diagnosis and optional schema ID generation.

## 8. Tests Executed
* `npx vitest run src/tests/custPriceGrp.test.ts` (6/6 passed)
* `npx vitest run src/tests/custFlow.test.ts` (4/4 passed)
* `npx vitest run` (34 test suites, 258 tests passed in 8.73s)
* `npm run build` (Vite production bundle compiled cleanly in 22.21s)

## 9. Verification Results
* PostgreSQL customer tables verified with 4 Customer Groups and 7 Canonical Customers.
* Zero broken links, zero console errors, zero orphan invoice foreign key references.
* Docker multi-container stack (`smriti-api`, `smriti-db`, `smriti-web`) running healthy.

## 10. Known Limitations
* Offline customer creation queues in `smriti_pending_customers` local storage; requires reconnect event or background poll to sync to PostgreSQL.

## 11. Future Work
* Integrate WebSocket broadcast for real-time customer balance and credit utilization updates across POS terminals.

## 12. Related ADRs
* ADR-028: Multi-Tenant Schema & Branch Scope Alignment
* ADR-034: Removal of In-Memory Mock Fallbacks in Production Billing

## 13. Related RFCs
* RFC-042: Universal Customer Master & Price Group Management
