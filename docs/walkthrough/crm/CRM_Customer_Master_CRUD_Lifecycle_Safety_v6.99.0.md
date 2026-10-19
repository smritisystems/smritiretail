<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.0
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Customer Master CRUD Lifecycle UX, Concurrency, and Safety Architecture

**Topic:** Customer Master CRUD Lifecycle UX, Concurrency Locking, Deactivation Policy, and Conditional Permanent Delete Safety Guards  
**Version:** v6.99.0  
**Area:** CRM / Customer Master  
**Author:** Jawahar Ramkripal Mallah  
**Date:** 2026-10-19  
**Status:** Completed  

---

## 1. Purpose

The objective of this implementation is to establish an enterprise-grade Customer Master lifecycle with distinct **Create**, **View**, **Edit**, **Deactivate/Reactivate**, and conditionally permitted **Permanent Delete** workflows in SMRITI Retail OS. 

This architecture guarantees:
1. **Safety First**: Prohibits inadvertent loss of financial transactions, audit histories, or tax records through hard deletions.
2. **Authoritative Concurrency Protection**: Eliminates blind overwrites via optimistic concurrency locking on `Customer.modified_at`.
3. **Explicit Operational State Transitions**: Clear boundaries between read-only View Mode, explicit Edit Mode, and suspended Deactivation.
4. **Duplicate Prevention**: Automated duplicate candidate detection prior to persistence while maintaining server-side code generation.

---

## 2. Scope

The scope spans both the transactional FastAPI + PostgreSQL backend and the React 18 + Vite frontend client:
- **Backend Audit & Routes (`backend/app/api/v1/crm.py`, `backend/app/services/crm.py`, `backend/app/schemas/crm.py`)**:
  - Pre-flight foreign-key dependency evaluator (`GET /crm/customers/{id}/delete-eligibility`).
  - Dedicated lifecycle status endpoints (`POST /crm/customers/{id}/deactivate`, `POST /crm/customers/{id}/reactivate`).
  - Safe, atomic, conditional permanent deletion endpoint (`DELETE /crm/customers/{id}/permanent`) restricted to `SYSADMIN` and clean drafts.
  - Optimistic locking verification in `update_customer` using `expected_modified_at`.
  - Immutable audit logging to `SmritiAuditLog` for all lifecycle transitions.
- **Frontend Workspace & Modals (`CustMasterWs.tsx`, `lifecycle/`)**:
  - `CreateCustomerModal.tsx`: Multi-step customer creation supporting Retail Fast Path vs Corporate B2B, real-time debounced duplicate detection, and candidate review.
  - `CustomerDeactivateModal.tsx`: Explicit operational impact disclosures, billing suspension notices, outstanding balance alerts, and reversible deactivation.
  - `CustomerDeleteConfirmationModal.tsx`: Automated pre-flight check, itemized blockers display, disabled hard-delete button when dependencies exist, and typed code confirmation for eligible records.
  - `CustMasterWs.tsx`: Toolbar integration, View Mode banner, Edit Mode banner, keyboard navigation (`Alt+N`, `Alt+E`, `Alt+D`, `Ctrl+S`, `Esc`).

---

## 3. Files Created

1. `src/components/customer/lifecycle/types.ts`: Lifecycle type contracts, delete eligibility DTOs, and duplicate candidate interfaces.
2. `src/components/customer/lifecycle/CustomerDeleteConfirmationModal.tsx`: Multi-stage safety dialog querying pre-flight eligibility and enforcing deletion blockers.
3. `src/components/customer/lifecycle/CustomerDeactivateModal.tsx`: Operational impact disclosure modal for suspending customer accounts.
4. `src/components/customer/lifecycle/CreateCustomerModal.tsx`: Customer onboarding modal with duplicate candidate review and type selection.
5. `src/tests/customerMasterLifecycle.test.tsx`: Vitest suite covering safety modals, impact disclosures, and fast path creation.

---

## 4. Files Modified

1. `backend/app/schemas/crm.py`: Added `expected_modified_at` to `CustomerUpdate`, added `CustomerDeactivateRequest` and `CustomerDeleteEligibilityResponse`.
2. `backend/app/services/crm.py`: Implemented `check_delete_eligibility`, `deactivate_customer`, `reactivate_customer`, `permanent_delete_customer`, optimistic concurrency check in `update_customer`, and audit logging.
3. `backend/app/api/v1/crm.py`: Exposed and role-guarded delete-eligibility, deactivate, reactivate, and permanent delete endpoints.
4. `src/components/customer/CustMasterWs.tsx`: Integrated lifecycle mode state (`view` vs `edit`), mode banners, save/cancel handlers, navigation reset guards, and modal mounting.

---

## 5. Architecture Decisions

1. **Pre-Flight Multi-Table Dependency Inspection (ADR-CRM-001)**:
   - Evaluates 8 foreign-key and accounting tables before permitting deletion: `SalesInvoice`, `SalesOrder`, `SalesReturn`, `CustomerCreditLedger`, `CustomerPurchaseOrder`, `PSVParty`, `CustomerRelationship`, and outstanding balance.
   - If any blocker is found (`count > 0` or `balance != 0`), `eligible` is strictly `false` and permanent deletion is blocked.
2. **Optimistic Concurrency Locking (ADR-CRM-002)**:
   - When updating a customer, `expected_modified_at` is compared against `customer.modified_at`. If the record was modified by another user or session in the interim, HTTP 409 `CONCURRENT_MODIFICATION_DETECTED` is raised. Local form edits are preserved so the user's input is never lost.
3. **Deactivation as Primary Operational Safeguard (ADR-CRM-003)**:
   - Deactivation sets `customer.status = "Inactive"` and logs `CUSTOMER_DEACTIVATED`. Historical sales invoices, returns, receipts, and ledgers remain fully intact for GST statutory reporting. Billed customers cannot be hard-deleted.
4. **Strict Server-Assigned Customer Codes (ADR-CRM-004)**:
   - Client applications never generate customer codes or force merge potential duplicates. The server-side identity engine sequentially allocates codes upon record creation.

---

## 6. Design Rationale

- **View Mode by Default**: Prevents accidental keystrokes from modifying critical GSTIN, commercial terms, or bank accounts when users are browsing customer accounts.
- **Non-Destructive Save Failures**: When validation or concurrency errors occur, user input is preserved in the form state rather than discarded.
- **Disclose Before Action**: Deactivation modals explain precisely what will happen (POS checkout blocked, deliveries halted, history preserved, balance highlighted).
- **Two-Step Deletion Confirmation**: Eligible records (such as draft accounts with zero transactions) require typing the customer's exact code to prevent misclicks.

---

## 7. Implementation Summary

### Backend Service API Layer
- `check_delete_eligibility(db, customer_id, company_id)`:
  - Queries `sales_invoices`, `sales_orders`, `sales_returns`, `customer_credit_ledgers`, `customer_pos`, `psv_parties`, and `customer_relationships`.
  - Calculates net outstanding balance.
  - Returns `CustomerDeleteEligibilityResponse` with itemized blockers, warnings, and recommendation.
- `permanent_delete_customer(db, customer_id, company_id)`:
  - Runs pre-flight eligibility check. If blockers exist, raises HTTP 400.
  - Atomically deletes subordinate contact/registration records and the customer record within a PostgreSQL transaction.
- `deactivate_customer(db, customer_id, company_id, reason)`:
  - Updates status to `Inactive`, stores reason in notes, and writes to `SmritiAuditLog`.
- `reactivate_customer(db, customer_id, company_id)`:
  - Updates status to `Active` and writes to `SmritiAuditLog`.

### Frontend Lifecycle Subsystem
- Integrated View Mode and Edit Mode banners into both Corporate Workspace and Retail 3-Tab views.
- Wired keyboard shortcuts: `Alt+N` (New), `Alt+E` (Edit), `Alt+D` (Delete Safety Check), `Ctrl+S` (Save), `Esc` (Cancel Changes).
- Integrated `CreateCustomerModal`, `CustomerDeactivateModal`, and `CustomerDeleteConfirmationModal`.

---

## 8. Tests Executed

1. **Vitest Unit Tests**:
   - `src/tests/customerMasterLifecycle.test.tsx` (6 tests passed)
   - `src/tests/corporateCustomerWorkspace.test.tsx` (8 tests passed)
   - `src/tests/corporateCustomer360.test.tsx` (11 tests passed)
   - `src/tests/customerPricingBasisAndPromo.test.ts` (10 tests passed)
   - `src/tests/customerMasterAndActiveField.test.ts` (8 tests passed)
   - `src/tests/customerLocationHydration.test.ts` (4 tests passed)
   - **Combined Customer Suite: 47/47 tests passed**.
2. **TypeScript Compilation**:
   - `npx tsc --noEmit` exited with code 0 (zero errors).
3. **Production Vite Build**:
   - `npm run build` completed in 50.34s with code 0.
4. **Backend Python Compilation**:
   - `python -m py_compile backend/app/schemas/crm.py backend/app/services/crm.py backend/app/api/v1/crm.py` passed with code 0.

---

## 9. Verification Results

| Verification Dimension | Command Executed | Result | Status |
| :--- | :--- | :--- | :--- |
| TypeScript Type Safety | `npx tsc --noEmit` | Clean output (code 0) | Done |
| Lifecycle Test Suite | `npm test -- src/tests/customerMasterLifecycle.test.tsx` | 6/6 passed | Done |
| Customer Regression Suite | `npm test -- customer` | 47/47 passed across 6 test suites | Done |
| Production Bundle Build | `npm run build` | Built in 50.34s (code 0) | Done |
| Python Syntax & Import Gate | `python -m py_compile ...` | Clean output (code 0) | Done |

---

## 10. Known Limitations

- **Hard Deletion Restricted to Pure Drafts**: Any customer who has ever been invoiced, returned items, or holds a credit ledger entry cannot be permanently deleted, by design. This is a deliberate compliance guarantee under Indian GST audit regulations.
- **Draft Code Pre-fix**: Draft customers created client-side before server synchronization use `cust-draft-` prefixes; permanent delete of such records bypasses server calls and performs immediate local cleanup.

---

## 11. Future Work

- Implement scheduled automated deactivation for dormant accounts exceeding 730 days without activity.
- Introduce customer merge request workflow with supervisor approval for resolving duplicate corporate accounts.

---

## 12. Related ADRs

- `ADR-CRM-001`: Strict Foreign Key Pre-Flight Deletion Guard
- `ADR-CRM-002`: Authoritative Concurrency Control via `modified_at`
- `ADR-CRM-003`: Inactive Status Preservation for Statutory GST Continuity
- `ADR-CRM-004`: Server-Side Generation of Customer Code Identifiers

---

## 13. Related RFCs

- `RFC-CRM-2026-004`: Customer Master Enterprise Lifecycle and Safety Governance
