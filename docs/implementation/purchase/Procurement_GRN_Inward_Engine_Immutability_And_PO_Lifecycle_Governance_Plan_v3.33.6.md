<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.33.6
  Created      : 2026-09-20
  Modified     : 2026-09-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: GRN Inward Engine Immutability & Purchase Order Lifecycle Governance

**Plan ID:** IP-PUR-3.33.6  
**Status:** Approved  
**Version:** 3.33.6  
**Target Subsystems:** Goods Receipt Note (GRN) Studio (`GrnReceiptTab.tsx`) & Backend Inward Engine (`backend/app/services/purchase.py`)  

---

## 1. Objective
Establish complete transactional immutability and Purchase Order lifecycle synchronization across the SMRITI Retail OS Inward Engine, guaranteeing 100% parity with Tally Shoper 9 (`GIR` / `PO` Governance). Eliminate the vulnerability where operators could re-submit or re-inward the same Goods Receipt Note number or re-process an already received Purchase Order.

## 2. Business Motivation
In retail warehouse and store operations, duplicate inwarding causes catastrophic financial and inventory discrepancies:
1. **Inventory Inflation:** WMS batch stock and stock movements double-increment, displaying phantom stock that cannot be reconciled during physical verification.
2. **Accounts Payable Overstatement:** Repeated GRN postings inflate supplier liabilities (`supplier.outstanding`), triggering duplicate payments or voucher mismatches.
3. **Audit Trail Failure:** A posted stock ledger document must be final, immutable, and non-repeatable. Adjustments must follow formal Debit Note (GOR) workflows rather than re-editing or re-posting.

## 3. Scope
* **Backend Inward Engine (`purchase.py`)**:
  - Pre-flight duplicate check on `receipt_no`.
  - Pre-flight check on linked `PurchaseOrder.status` (rejection of `RECEIVED`, `COMPLETED`, `CANCELLED` with HTTP 409 Conflict).
  - Atomic transition of linked `PurchaseOrder.status = "RECEIVED"` upon GRN commit.
  - Pre-flight de-duplication of supplier delivery challan / invoice number (`DCNoValidationPresent` parity).
* **Frontend GRN Studio (`GrnReceiptTab.tsx`)**:
  - Filter `loadOrders` to exclude `RECEIVED` and `COMPLETED` purchase orders (`ShowAllPendingPosInPOBrowse` parity).
  - Complete workspace state reset post-commit (clear lines, supplier, PO, advance sequence counter).
  - Lock editor state and navigate to read-only history view upon closing success modal.
* **Testing & Verification**:
  - Automated unit test suite verifying PO state transition and duplicate prevention.
  - Headless Playwright integration test validating post-save form reset and PO exclusion.

## 4. Current State
* `create_purchase_receipt` in `purchase.py` queries the linked PO to verify existence, but never checks if `po.status == "RECEIVED"` and never updates `po.status` upon inwarding.
* `GrnReceiptTab.tsx` does not clear editor state (`grnLines`, `grnNumber`, `selectedOrderId`) post-save, leaving the "Commit Inward" button enabled with the same data.
* `loadOrders` in `GrnReceiptTab.tsx` only filters `CANCELLED` orders, keeping fulfilled orders in the open PO launchpad.

## 5. Gap Analysis
* **Gap 1 (PO Fulfillment Loop):** POs never transition from `DRAFT`/`CONFIRMED` to `RECEIVED`, allowing infinite re-receipts.
* **Gap 2 (Pre-Flight Guard):** Duplicate GRN numbers only fail at database `commit()` via generic SQL unique constraint violations rather than clean domain-driven 409 Conflict errors.
* **Gap 3 (Workspace Memory Hygiene):** Frontend state persists across modal operations without an automatic sequence progression or form flush.

## 6. Architecture Impact
* Zero schema migrations required: `PurchaseOrder.status`, `PurchaseReceipt.receipt_no`, and `PurchaseReceipt.supplier_id` already exist in the PostgreSQL schema.
* Full compatibility with `OutboxService` event publishing and `LandedCostAllocationEngine`.

## 7. Proposed Design
1. **Backend Guarding (`backend/app/services/purchase.py`)**:
   - Query `PurchaseReceipt` for duplicate `receipt_no` in company scope &rarr; raise HTTP 409.
   - Query linked `PurchaseOrder` &rarr; verify `po.status not in ("RECEIVED", "COMPLETED", "CANCELLED")` &rarr; raise HTTP 409 if violated.
   - On commit, set `po.status = "RECEIVED"` and `po.modified_at = datetime.now(timezone.utc)`.
2. **Frontend Hygiene (`src/components/purchase/GrnReceiptTab.tsx`)**:
   - Filter `loadOrders`: `o.status !== "RECEIVED" && o.status !== "COMPLETED" && o.status !== "CANCELLED"`.
   - On successful post: reset all lines, reset PO selection, advance `grnNumber` using `generateDynamicGrnSequence()`.
   - On success modal dismiss: navigate view mode to `setSubView("history")`.

## 8. Files Created
* `docs/implementation/purchase/Procurement_GRN_Inward_Engine_Immutability_And_PO_Lifecycle_Governance_Plan_v3.33.6.md`
* `src/tests/grnImmutability.test.ts`

## 9. Files Modified
* `backend/app/services/purchase.py`
* `src/components/purchase/GrnReceiptTab.tsx`
* `docs/implementation/README.md`

## 10. Dependencies
* FastAPI, SQLAlchemy AsyncSession, PostgreSQL 15, React 18, Vitest, Playwright.

## 11. Risks
* Low. Hardening is strictly additive and prevents invalid duplicate states.

## 12. Rollback Strategy
* Git revert to commit `322e39f3`.

## 13. Verification Plan
* Backend Pytest: verify duplicate GRN rejection (409) and PO transition to `RECEIVED`.
* Frontend Vitest: verify `loadOrders` filtering and workspace reset behavior.
* Architecture Guard: `scripts/architecture_duplication_gate.py` (11/11 checks pass).

## 14. Test Plan
* Unit test: Submit GRN against PO `PO-001` &rarr; PO status becomes `RECEIVED`.
* Unit test: Submit second GRN against `PO-001` &rarr; HTTP 409 Conflict with `SMRITI-PUR-002`.
* Unit test: Submit GRN with duplicate `receipt_no` &rarr; HTTP 409 Conflict.

## 15. Documentation Impact
* Update `docs/implementation/README.md`.
* Create Walkthrough `docs/walkthrough/procurement/Procurement_GRN_Inward_Engine_Immutability_And_PO_Lifecycle_Governance_v3.33.6.md`.

## 16. Deployment Plan
* Apply backend code changes.
* Rebuild frontend bundle (`npm run build`).
* Restart container `docker restart smriti-api`.

## 17. Status
Approved — Ready for Execution.

## 18. Related ADRs
* **ADR-018**: SMRITI Enterprise Inward & Landed Cost Engine.
* **ADR-042**: SMRITI Dual-Key Parameter & Governance Architecture.

## 19. Related Walkthroughs
* `docs/walkthrough/procurement/Procurement_GRN_Real_Database_Wiring_Audit_v3.33.5.md`
* `docs/walkthrough/procurement/Procurement_Inward_Landed_Cost_And_Freight_Engine_v3.33.0.md`
