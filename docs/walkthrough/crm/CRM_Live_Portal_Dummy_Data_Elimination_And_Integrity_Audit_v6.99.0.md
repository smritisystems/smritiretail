<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.0
  Created      : 2026-10-20
  Modified     : 2026-10-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
  Target Area  : CRM / Enterprise Customer Master & Corporate 360 Workspace
-->

# Walkthrough: CRM Live Portal Dummy Data Elimination & Data Integrity Audit

**Version:** 6.99.0  
**Status:** Completed & Verified  
**Date:** 2026-10-20  
**Target Portal & Screen:** `https://tattlythreads.smritisys.com/` — Customer Master → Corporate / Parent–Child / Addresses / Store Network / Tax Invoice Preview  

---

## 1. Purpose
Identify and eliminate unintended dummy, placeholder, mock, hardcoded, stale, or incorrectly mapped data displayed in the live SMRITI Retail OS portal. Ensure every live customer field, corporate tax field, child account, store/location card, commercial term, invoice number, invoice date, item row, barcode, quantity, price, and total is sourced from authoritative backend records, and replace mock fallbacks with honest, truthful empty states.

---

## 2. Scope
1. Remote Production API and Database Headless Inspection (target customer `Reliance Retail Limited`, PAN `AABCR1718E`, ID `cust-rrl-192b561d`).
2. Elimination of hardcoded mock fallbacks in frontend corporate workspace components:
   - `src/components/customer/corporateWorkspace/CustomerSummaryCard.tsx`
   - `src/components/customer/corporateWorkspace/CustomerTaxInvoicePreview.tsx`
   - `src/components/customer/corporateWorkspace/CustomerHierarchyTree.tsx`
   - `src/components/customer/corporateWorkspace/CorporateNetworkPanel.tsx`
   - `src/components/customer/corporateWorkspace/EnterpriseCustomerMasterView.tsx`
   - `src/components/customer/corporate360/StoreCodeLookupModal.tsx`
   - `src/components/customer/CustMasterWs.tsx`
3. Elimination of hardcoded mock fixtures in backend API:
   - `backend/app/api/v1/crm.py` (`get_corporate_customer_360`)
4. Full column, datatype, and contract parity testing across backend and frontend.

---

## 3. Files Created
1. `src/tests/customerDataIntegrityAndDummyElimination.test.tsx`:
   - Comprehensive Vitest automated regression suite verifying zero placeholder injection, dynamic tax invoice calculations, honest empty states for trees and networks, and customer identity isolation.
2. `docs/walkthrough/crm/CRM_Live_Portal_Dummy_Data_Elimination_And_Integrity_Audit_v6.99.0.md`:
   - This governance walkthrough artifact.

---

## 4. Files Modified
1. `src/components/customer/corporateWorkspace/CustomerSummaryCard.tsx`
2. `src/components/customer/corporateWorkspace/CustomerTaxInvoicePreview.tsx`
3. `src/components/customer/corporateWorkspace/CustomerHierarchyTree.tsx`
4. `src/components/customer/corporateWorkspace/CorporateNetworkPanel.tsx`
5. `src/components/customer/corporateWorkspace/EnterpriseCustomerMasterView.tsx`
6. `src/components/customer/corporate360/StoreCodeLookupModal.tsx`
7. `src/components/customer/CustMasterWs.tsx`
8. `src/tests/corporateCustomer360.test.tsx`
9. `src/tests/enterpriseCustomerMasterView.test.tsx`
10. `backend/app/api/v1/crm.py`
11. `CHANGELOG.md`
12. `docs/walkthrough/README.md`

---

## 5. Architecture Decisions
1. **Truth-In-Data Over Fabricated Visual Polish:**
   Components must never synthesize placeholder corporate stores (`RRL-MUM-001` through `RRL-HYD-001`), hardcoded child counts (`12`), static outlet numbers (`85`), fabricated invoices (`TT2026-2027/18`), or dummy line items (`ART001`) when database records are missing or empty. Honest empty states ("No Posted Tax Invoices", "No Child Accounts Linked") must be rendered.
2. **Authoritative Backend Data Hydration in Parent Workspace:**
   `CustMasterWs.tsx` proactively dispatches canonical API fetches (`/crm/customers/{id}/gst-registrations`, `/crm/customers/{id}/delivery-locations`, `/crm/customers/{id}/billing-locations`, `/crm/customers/{id}/dependants`) upon customer selection, propagating authentic arrays down to all corporate child views.
3. **Numeric Calculation Parity for Invoice Line Items:**
   Line items in `CustomerTaxInvoicePreview.tsx` compute totals strictly via `quantity * price`, tax amount via `tax_amount`, and subtotals via `totalAmount - gstAmount`.

---

## 6. Design Rationale
Previously, UI engineers implemented fallback sample data within the ternary/null-coalescing branches of components to simulate a populated portal during initial layout reviews. When real customer records were queried, these fallbacks masked real empty conditions and caused data leakage between active customer records. Removing all mock arrays and replacing them with honest empty states ensures high production data integrity.

---

## 7. Implementation Summary
- **Backend (`crm.py`)**: Removed `ref_stores` (5 mock stores, 2,456 total stores, 2,318 active stores, ₹ 1.867B PSV) and mock orders (`SO-2024-11872`, ₹ 4.285B purchase value) when database delivery locations or invoices are empty. Returned truthful zero metrics, dynamic monthly invoice trends, and empty lists.
- **Frontend Workspace Components**:
  - `CustomerSummaryCard.tsx`: Replaced default prop counts `12` and `85` with `0`. Replaced fake PAN/GSTIN fallbacks with truthful customer properties or `"Not Registered"` / `"—"`.
  - `CustomerTaxInvoicePreview.tsx`: Replaced hardcoded sample invoice `TT2026-2027/18` with dynamic query to `/sales/invoices?customer_id=...&limit=1`. Renders honest empty state when no invoices exist.
  - `CustomerHierarchyTree.tsx`: Replaced hardcoded demo branches (`Phoenix Mall`, `Inorbit Mall`, `Amanora Mall`) with dynamic `childrenNodes`. Renders honest empty state when no child accounts are linked.
  - `CorporateNetworkPanel.tsx`: Removed mock stores `RRL-001` to `RRL-005` fallback.
  - `EnterpriseCustomerMasterView.tsx`: Cleaned Cards 1, 2, 3, 4, 6, 8, 9 to render honest empty states for addresses, contacts, documents, and audit logs.
  - `StoreCodeLookupModal.tsx`: Eliminated `getFallbackLookupItems`.

---

## 8. Tests Executed
1. **Frontend Vitest Suites:**
   - `src/tests/customerDataIntegrityAndDummyElimination.test.tsx` (6/6 passed)
   - `src/tests/enterpriseCustomerMasterView.test.tsx` (8/8 passed)
   - `src/tests/customer360DashboardView.test.tsx` (19/19 passed)
   - `src/tests/corporateCustomer360.test.tsx` (11/11 passed)
   - `src/tests/corporateCustomerWorkspace.test.tsx` (9/9 passed)
   - `src/tests/customerMasterLifecycle.test.tsx` (25/25 passed)
   - `src/tests/customerStateSync.test.ts` (4/4 passed)
   - `src/tests/customerMasterAndActiveField.test.ts` (8/8 passed)
   - `src/tests/customerLocationHydration.test.ts` (4/4 passed)
   **Total Frontend:** 94/94 passed green.
2. **Backend Pytest Suite:**
   - `pytest backend/app/tests/test_corporate_customer_360.py` (16/16 passed green).
3. **TypeScript Compiler Check:**
   - `npx tsc --noEmit` (0 errors).
4. **Version SSOT Validation:**
   - `python scripts/validate_version_ssot.py` (PASSED 6.99.0).

---

## 9. Verification Results
- All 94 Vitest unit/integration tests passed.
- All 16 Pytest backend contract tests passed.
- 0 TypeScript compiler errors.
- Version SSOT validated across `package.json`, `config.py`, `version.ts`, and `CHANGELOG.md`.

---

## 10. Known Limitations
- The remote live portal `https://tattlythreads.smritisys.com/` was audited read-only per safety rules; remote database mutation and live deployment must be authorized by system operators.

---

## 11. Future Work
- Implement backend batch pagination for corporate customers having >1000 store delivery locations.
- Connect historical audit log backend streams to Card 9 (`activity_audit`).

---

## 12. Related ADRs
- `ADR-004`: Truth-in-Data & Anti-Phantom Data Governance
- `ADR-018`: Single Authoritative Backend Ledger (FastAPI + PostgreSQL)

---

## 13. Related RFCs
- `RFC-2026-CRM-09`: Corporate Customer 360 Degree Data Integrity Standard
