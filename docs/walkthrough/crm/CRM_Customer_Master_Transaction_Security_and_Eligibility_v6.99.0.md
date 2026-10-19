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

# Walkthrough: Customer Master Transaction Security, Eligibility Validation, and Pre-flight Relational Guards (Phase 3)

**Topic:** Customer Master Transaction Security, Foreign-Key Pre-flight Deletion Guards, Inactive Suspension Integrity, and Authoritative Commercial Boundaries  
**Version:** v6.99.0  
**Area:** CRM / Customer Master / Security & Governance  
**Author:** Jawahar Ramkripal Mallah  
**Date:** 2026-10-19  
**Status:** Completed  

---

## 1. Purpose

The objective of Phase 3 is to enforce rigorous transactional security, relational integrity, and foreign-key safety guards across the Customer Master subsystem of SMRITI Retail OS (`F:\SMRITRretailNX`).

Under Indian GST statutory regulations and accounting standards, customer records that have participated in tax billing, deliveries, financial ledgers, or purchase contracts must never be subject to blind or irreversible database deletion. This implementation:
1. **Pre-flight Dependency Inspection**: Inspects all relational dependencies across 8 database tables before evaluating deletion eligibility.
2. **Deterministic Hard-Blockers**: Completely locks out permanent deletion when tax invoices, sales orders, returns, ledgers, contracts, or open balances exist.
3. **Reversible Account Deactivation**: Routes operators to safe deactivation (`status = "Inactive"`) which suspends POS billing and dispatch while maintaining statutory ledger continuity.
4. **Clean Draft Destruction**: Safely permits single-click or code-confirmed permanent deletion only for unbilled draft accounts with zero transaction footprints.
5. **Architectural Parity & Preflight Certification**: Maintains zero-violation CI compliance across all SMRITI Architecture and Duplication Gates.

---

## 2. Scope

The scope spans both the transactional FastAPI + PostgreSQL backend and the React 18 + Vite frontend workspace:
- **Backend Service Layer (`backend/app/services/crm.py`)**:
  - `check_delete_eligibility(customer_id)`: Queries `SalesInvoice`, `SalesOrder`, `SalesReturn`, `CustomerCreditLedgerEntry`, `CustomerPurchaseOrder`, `PSVParty`, `CustomerRelationship`, and net outstanding ledger balances. Fixed import and model binding from legacy `CustomerCreditLedger` to canonical `CustomerCreditLedgerEntry`.
  - `permanent_delete_customer(customer_id)`: Re-validates eligibility before deletion. If blocked, returns HTTP 400 with `CUSTOMER_DELETE_BLOCKED`. If clean, cascades deletion to subordinate records (`CustomerGSTRegistration`, `CustomerDeliveryLocation`, `CustomerBillingLocation`, `CustomerCompanyRelationship`, `CustomerPolicy`) and writes an immutable `PERMANENT_DELETE` audit log.
  - `deactivate_customer(customer_id, reason)`: Transitions active account to `Inactive`, validates that already-inactive accounts cannot be redundantly deactivated (HTTP 400), and records an immutable `DEACTIVATE` audit event.
  - `reactivate_customer(customer_id)`: Transitions inactive account to `Active`, blocks redundant reactivation on active accounts (HTTP 400), and records an immutable `REACTIVATE` audit event.
- **Frontend Workspace & Modals (`src/components/customer/lifecycle/`)**:
  - `CustomerDeleteConfirmationModal.tsx`: Synchronous state initialization for unbilled drafts (`cust-draft-*`), real-time pre-flight inspection via `GET /crm/customers/{id}/delete-eligibility`, dual-casing support (camelCase and snake_case DTO mapping), automated blocker enumeration, typed safety confirmation code matching (`targetCode` or `"DELETE"`), and `data-testid` test hooks.
  - `CustomerDeactivateModal.tsx`: Operational impact disclosure banner, billing suspension notice, ledger preservation explanation, dynamic outstanding balance alert, and `data-testid="confirm-deactivate-btn"`.
  - `CustMasterWs.tsx`: Integrated delete safety dialog and deactivation workflow into toolbar actions and keyboard navigation (`Alt+D`, `Alt+E`, `Alt+N`).
- **Automated Test Automation**:
  - Backend pytest suite: `backend/tests/test_customer_lifecycle_security.py` (7 tests covering schema DTOs, eligibility blockers, clean deletion, cascade removal, and lifecycle status transitions).
  - Frontend vitest suite: `src/tests/customerMasterLifecycle.test.tsx` (11 tests covering modal rendering, draft customer immediate eligibility, balance alerts, and concurrency contracts).

---

## 3. Files Created

1. `backend/tests/test_customer_lifecycle_security.py`: Backend Pytest suite certifying pre-flight delete eligibility blockers, clean permanent deletion cascades, and deactivation/reactivation lifecycle transitions.
2. `docs/walkthrough/crm/CRM_Customer_Master_Transaction_Security_and_Eligibility_v6.99.0.md`: This comprehensive Phase 3 verification walkthrough document.

---

## 4. Files Modified

1. `backend/app/services/crm.py`: Corrected model import and query binding from `CustomerCreditLedger` to canonical `CustomerCreditLedgerEntry` in `check_delete_eligibility`.
2. `src/components/customer/lifecycle/CustomerDeleteConfirmationModal.tsx`: Enhanced draft customer initialization without loading flicker, added dual camelCase/snake_case DTO mapping, enabled `"DELETE"` confirmation code keyword, and added `data-testid` tags.
3. `src/tests/customerMasterLifecycle.test.tsx`: Added unit tests for draft customer immediate permanent deletion eligibility and zero-balance deactivation modal behavior.
4. `.architecture/certificates/PF-2026-1019-8CC4E0.json`: Re-issued Preflight Certificate for modified `CustomerDeleteConfirmationModal.tsx`.
5. `docs/walkthrough/README.md`: Appended chronological master index table entry for Phase 3.

---

## 5. Architecture Decisions

1. **Mandatory Pre-flight Multi-Model Inspection (ADR-CRM-005)**:
   - Evaluates 8 foreign-key and accounting tables before deletion:
     - `SalesInvoice` (`is_deleted == False`) — Tax compliance blocker.
     - `SalesOrder` (`is_deleted == False`) — Commercial contract blocker.
     - `SalesReturn` (`is_deleted == False`) — Credit note / statutory return blocker.
     - `CustomerCreditLedgerEntry` (`is_deleted == False`) — Financial ledger blocker.
     - `CustomerPurchaseOrder` (`is_deleted == False`) — B2B purchase contract blocker.
     - `PSVParty` — Physical stock verification assignment blocker.
     - `CustomerRelationship` — Parent/child corporate hierarchy blocker.
     - `outstanding` ledger balance (`abs(balance) > 0.001`) — Financial liability blocker.
2. **Two-Tier Safety Guard (Client Pre-flight + Server Enforced Atomicity)**:
   - The UI runs the pre-flight check to inform the user with actionable insights and alternatives.
   - The server re-runs `check_delete_eligibility` inside `permanent_delete_customer` within the transaction, guaranteeing that race conditions or bypass attempts are strictly rejected with HTTP 400.
3. **Draft Customer Local Bypass**:
   - Accounts created in the UI with ID prefix `cust-draft-*` that have never been persisted to PostgreSQL bypass remote network round-trips and are immediately purged from local state upon confirmation.

---

## 6. Design Rationale

- **Disclose, Explain, and Guide (SMRITI HREP Standard)**: When deletion is blocked, the modal does not display an obscure database foreign key error. Instead, it itemizes the exact dependencies (e.g., "Customer has 12 tax invoice(s) on record") and highlights the recommended business alternative: "Deactivate Customer Instead".
- **Reversible Deactivation**: Deactivation safely suspends POS checkout, sales orders, and dispatches without affecting historical reports, VAT/GST returns, or financial ledgers. Managers can reactivate the account with one click.
- **Typed Confirmation Code**: For pure unbilled draft accounts that are eligible for deletion, the operator must explicitly type either the customer code (e.g., `CUST-1001`) or the safety keyword `DELETE` before the permanent delete button becomes active.

---

## 7. Implementation Summary

### Pre-flight Dependency Analysis Matrix

| Entity Checked | Table | Blocker Condition | Severity |
| :--- | :--- | :--- | :--- |
| Tax Invoices | `sales_invoices` | `count > 0` | HARD BLOCKER (Statutory Tax Compliance) |
| Sales Orders | `sales_orders` | `count > 0` | HARD BLOCKER (Commercial Contract) |
| Sales Returns | `sales_returns` | `count > 0` | HARD BLOCKER (Credit Note Continuity) |
| Credit Ledger | `customer_credit_ledgers` | `count > 0` | HARD BLOCKER (Financial Accounting) |
| Customer POs | `customer_purchase_orders`| `count > 0` | HARD BLOCKER (Corporate Contract) |
| PSV Locations | `psv_parties` | `count > 0` | HARD BLOCKER (Inventory Control) |
| Relationships | `customer_relationships` | `count > 0` | HARD BLOCKER (Hierarchy Integrity) |
| Balance | `customers.outstanding` | `abs(bal) > 0.001` | HARD BLOCKER (Unsettled Financial Debt) |

---

## 8. Tests Executed

### 1. Backend Pytest Test Suites
- `backend/tests/test_customer_lifecycle_security.py` (7/7 passed)
- `backend/tests/test_customer_company_relationships.py` (4/4 passed)
- **Combined Backend Suite: 11/11 tests passed in 6.19s**.

### 2. Frontend Vitest Test Suites
- `src/tests/customerMasterLifecycle.test.tsx` (11/11 passed)
- `src/tests/corporateCustomerWorkspace.test.tsx` (9/9 passed)
- **Combined Frontend Suite: 20/20 tests passed in 927ms**.

### 3. Architecture & Governance Gates
- `scripts/architecture_duplication_gate.py`: 11/11 checks passed, 0 violations.
- `npm run validate-registry`: 106/106 form components verified.
- `npm run validate-launchpad`: 57/57 catalog tiles verified.
- `npm run lint` (`tsc --noEmit`): Exit code 0, 0 errors.

---

## 9. Verification Results

| Dimension | Command Executed | Result | Status |
| :--- | :--- | :--- | :--- |
| Backend Lifecycle Pytest | `.venv\Scripts\python.exe -m pytest backend/tests/test_customer_lifecycle_security.py` | 7 passed in 4.99s | Done |
| Backend Model C Pytest | `.venv\Scripts\python.exe -m pytest backend/tests/test_customer_company_relationships.py` | 4 passed in 4.83s | Done |
| Frontend Lifecycle Vitest | `npx vitest run src/tests/customerMasterLifecycle.test.tsx` | 11 passed in 53ms | Done |
| Frontend Corporate Vitest | `npx vitest run src/tests/corporateCustomerWorkspace.test.tsx` | 9 passed in 85ms | Done |
| Architecture Duplication Gate | `.venv\Scripts\python.exe scripts/architecture_duplication_gate.py` | 11/11 checks passed, 0 violations | Done |
| Form Registry Usage | `npm run validate-registry` | 106/106 components verified | Done |
| Launchpad Registry | `npm run validate-launchpad` | 57/57 tiles verified | Done |
| TypeScript Compiler | `npm run lint` (`tsc --noEmit`) | Exit code 0, 0 errors | Done |

---

## 10. Known Limitations

- **Statutory Deletion Prohibition**: In accordance with Indian GST law, accounts with historical invoices cannot be deleted under any circumstances, even by system administrators. Deactivation must be used.
- **Cascaded Subordinates**: Clean draft deletion permanently removes subordinate addresses, contacts, and company relationships without recovery.

---

## 11. Future Work

- Implement scheduled automated deactivation for customer accounts dormant for more than 730 days.
- Add supervisory override workflow for merging duplicate corporate accounts with automated ledger re-pointing.

---

## 12. Related ADRs

- `ADR-CRM-001`: Strict Foreign Key Pre-Flight Deletion Guard
- `ADR-CRM-002`: Authoritative Concurrency Control via `modified_at`
- `ADR-CRM-003`: Inactive Status Preservation for Statutory GST Continuity
- `ADR-CRM-004`: Server-Side Generation of Customer Code Identifiers
- `ADR-CRM-005`: Multi-Model Dependency Evaluation Matrix

---

## 13. Related RFCs

- `RFC-CRM-2026-004`: Customer Master Enterprise Lifecycle and Safety Governance
- `RFC-CRM-2026-005`: Model C Operating Legal Entity Commercial Terms Architecture
