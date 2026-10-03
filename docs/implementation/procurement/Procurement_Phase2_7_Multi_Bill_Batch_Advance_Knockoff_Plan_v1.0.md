<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.49.9
  Created      : 2026-10-02
  Modified     : 2026-10-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Procurement Phase 2.7 — Multi-Bill Batch Advance Knock-Off & FIFO Allocation Engine

**Plan ID:** `IP-PROC-007`  
**Area:** `procurement`  
**Status:** Completed  
**Version:** `1.0.0`  
**Target Release:** `6.49.9`  
**Related ADRs:** `ADR-PROC-005`, `ADR-PROC-006`  
**Related Walkthroughs:** `WT-PROC-007`  

---

## 1. Objective
Design, implement, and verify an enterprise multi-bill batch knock-off and automated FIFO allocation engine for supplier advances in SMRITI Retail OS. Enable accounts payable operators to apply a single supplier advance payment (`Account 2050 Supplier Advance Liability`) across multiple open purchase bills (`Account 2010 Accounts Payable / Sundry Creditors`) in a single atomic transaction, either via 1-click FIFO cascading or customizable line-item allocation, generating a compound double-entry general ledger journal voucher with zero cash movement.

---

## 2. Business Motivation
In retail, wholesale, and apparel procurement, advance prepayments are typically issued in bulk sums against purchase orders or supplier contracts (e.g., ₹50,000 to ₹5,00,000). Goods are subsequently delivered in staggered consignments and multiple Goods Receipt Notes (GRNs), resulting in multiple distinct purchase bills:
1. **Fragmented Sourcing Inwards:** A single advance often covers 3 to 10 incoming shipment invoices.
2. **Operational Friction of 1-to-1 Knock-off:** Without batch allocation, finance teams must open a settlement modal repeatedly for each bill, manually compute partial remainders, and generate separate fragmented vouchers.
3. **Audit & Aging Compliance:** In accordance with standard accounting principles and Indian commercial practices, older due bills should be retired first (FIFO rule) to minimize overdue aging exposure and supplier dispute risks.
4. **Compound Ledger Transparency:** An atomic compound journal voucher (`DR 2010 Bill 1, DR 2010 Bill 2, ... / CR 2050 Advance`) provides superior audit clarity over dozens of detached micro-entries.

---

## 3. Scope

### In Scope
- **Backend Schemas (`backend/app/schemas/supplier_payment.py`):**
  - `SupplierAdvanceBatchKnockoffRequest`: supports `advance_payment_id`, `supplier_id`, optional `allocations: List[SupplierBillAllocation]`, `auto_fifo: bool`, and `notes`.
  - `SupplierAdvanceBatchKnockoffResponse`: structured response detailing all allocated bills, remaining advance credit, journal voucher reference, and execution timestamp.
- **Backend Service Layer (`backend/app/services/supplier_payment.py`):**
  - `batch_knockoff_advance`: multi-bill batch processor supporting explicit allocations and automated FIFO allocation across open `POSTED` purchase bills.
  - Multi-bill status transitions (`PAID` when fully settled, `PARTIALLY_PAID` if remaining balance exists).
  - Outbox event recording on `PSV_QUEUE` for downstream synchronization.
- **Unified General Ledger Service (`backend/app/services/unified_ledger.py`):**
  - `post_supplier_advance_batch_knockoff_to_gl`: atomic compound journal voucher generation with multiple debit lines (`DR 2010`) and a consolidated credit line (`CR 2050`).
  - Strict balance invariant check: `sum(DR) == sum(CR)` and `Net Cash Movement: ₹0.00`.
- **API Endpoint (`backend/app/api/v1/supplier_payment.py`):**
  - `POST /api/v1/supplier-payments/advance/batch-knockoff`.
- **Frontend UI Enhancements:**
  - `src/components/vendor/tabs/VendorAdvanceKnockoffModal.tsx`:
    - Tab toggle between **"Single Bill"** and **"Multi-Bill Batch & FIFO"**.
    - Advance selector card with available unallocated credit.
    - Quick Action bar: **"⚡ Auto FIFO Allocate"** and **"Clear All"**.
    - Open bills allocation grid with bill number, date, due date, total, paid, unpaid, and live editable allocation inputs.
    - Live compound double-entry GL preview showing all debits and consolidated credit.
  - `src/components/vendor/tabs/VendorPayablesTab.tsx`:
    - Add **"⚡ Batch Knock-Off (FIFO)"** action in header and on the Available Advances card.
  - `src/components/vendor/StandaloneVendorPayablesPreview.tsx`:
    - Connect batch simulation so operators and reviewers can test FIFO auto-allocation and custom splits interactively.
- **Automated Tests:**
  - `backend/app/tests/test_supplier_advance_batch_knockoff.py` covering multi-bill allocations, FIFO cascading, partial allocations, over-allocation rejections, and GL compound balancing.
- **Headless Visual Evidence:**
  - Playwright script capturing batch mode with FIFO allocation active and settled state.

### Out of Scope
- Direct bank refund of remaining advance balance (handled in Phase 2.8).
- Multi-currency forex revaluation during knock-off (all procurement operates in INR ₹).

---

## 4. Current State
- Phase 2.5 and Phase 2.6 implemented 1-to-1 supplier advance disbursement and single-bill knock-off.
- In `Vendor360`, the operator can select 1 advance and 1 bill. To knock off an advance across 3 bills, the operator must execute the modal 3 consecutive times.

---

## 5. Gap Analysis
| Capability | Current State (v6.49.8) | Target State (v6.49.9 - Phase 2.7) |
|---|---|---|
| **Batch Bill Knock-off** | 1-to-1 only (1 advance to 1 bill) | 1-to-N batch allocation in a single atomic transaction |
| **FIFO Allocation** | Manual calculation by operator | 1-Click "⚡ Auto FIFO Allocate" cascading advance across oldest bills |
| **GL Journal Voucher** | 1 voucher per individual bill knock-off | Single atomic compound voucher for all bills knocked off |
| **Knock-Off Modal UX** | Dropdown with single bill selection | Mode switch between Single Bill and Multi-Bill Allocation Grid |
| **Direct Action from AP Card** | Generic modal open | Dedicated "⚡ Batch Knock-Off (FIFO)" trigger |

---

## 6. Architecture Impact
```
                      ┌────────────────────────────────────────┐
                      │        Vendor 360 Payables Tab         │
                      └──────────────────┬─────────────────────┘
                                         │ Click "Batch Knock-Off (FIFO)"
                                         ▼
                      ┌────────────────────────────────────────┐
                      │    VendorAdvanceKnockoffModal.tsx      │
                      │  [Single Bill]  |  [Multi-Bill Batch]  │
                      └──────────────────┬─────────────────────┘
                                         │ POST /api/v1/supplier-payments/advance/batch-knockoff
                                         ▼
                      ┌────────────────────────────────────────┐
                      │         SupplierPaymentService         │
                      │  - Validate unallocated advance        │
                      │  - Validate or FIFO-compute bills      │
                      │  - Atomically update bills & status    │
                      │  - Decrement supplier.outstanding      │
                      │  - Append allocation manifest in notes │
                      └──────────────────┬─────────────────────┘
                                         │ Atomic DB Transaction
                                         ▼
                      ┌────────────────────────────────────────┐
                      │     UnifiedAccountingLedgerService     │
                      │  - DR 2010 AP (Bill 1): ₹XX,XXX        │
                      │  - DR 2010 AP (Bill 2): ₹YY,YYY        │
                      │  - CR 2050 Advance:     ₹(XX+YY)       │
                      │  - Net Cash Movement:   ₹0.00          │
                      └────────────────────────────────────────┘
```

---

## 7. Proposed Design

### Compound Double-Entry GL Ledger Posting
```text
Voucher Type: JOURNAL
Reference Doc Type: SUPPLIER_ADVANCE_BATCH_KNOCKOFF
Reference Doc ID: ADVANCE_ID_batch_XXXXXX

Lines:
  Line 1: DR Account 2010 (Accounts Payable / Sundry Creditors) - Bill 1 Amount
  Line 2: DR Account 2010 (Accounts Payable / Sundry Creditors) - Bill 2 Amount
  ...
  Line N: CR Account 2050 (Supplier Advance Liability)        - Total Knocked Off

Invariant Checks:
  sum(DR) == sum(CR) == Total Knocked Off
  Net Cash Movement == ₹0.00
```

### FIFO Cascading Algorithm
```python
remaining_advance = unallocated_advance
for bill in sorted_open_bills:
    if remaining_advance <= 0:
        break
    unpaid = bill.total_amount - bill.paid_amount
    alloc_amt = min(remaining_advance, unpaid)
    if alloc_amt > 0:
        bill.paid_amount += alloc_amt
        if bill.paid_amount >= bill.total_amount:
            bill.status = "PAID"
        remaining_advance -= alloc_amt
```

---

## 8. Files Created
1. `docs/implementation/procurement/Procurement_Phase2_7_Multi_Bill_Batch_Advance_Knockoff_Plan_v1.0.md`
2. `backend/app/tests/test_supplier_advance_batch_knockoff.py`
3. `scripts/capture_vendor_360_batch_advance_knockoff_headless.py`
4. `docs/walkthrough/procurement/Procurement_Phase2_7_Multi_Bill_Batch_Advance_Knockoff_v1.0.md`

---

## 9. Files Modified
1. `backend/app/schemas/supplier_payment.py`: Add batch request/response models.
2. `backend/app/services/supplier_payment.py`: Implement `batch_knockoff_advance`.
3. `backend/app/services/unified_ledger.py`: Implement `post_supplier_advance_batch_knockoff_to_gl`.
4. `backend/app/api/v1/supplier_payment.py`: Expose `/advance/batch-knockoff` endpoint.
5. `src/components/vendor/tabs/VendorAdvanceKnockoffModal.tsx`: Add batch mode, FIFO auto-allocate, and allocation table.
6. `src/components/vendor/tabs/VendorPayablesTab.tsx`: Add batch trigger button.
7. `src/components/vendor/StandaloneVendorPayablesPreview.tsx`: Add batch simulation logic.
8. `package.json`, `backend/app/core/config.py`, `src/config/version.ts`, `CHANGELOG.md`: Bump version to `6.49.9`.
9. `docs/implementation/README.md`, `docs/walkthrough/README.md`: Index updates.

---

## 10. Dependencies
- FastAPI + SQLAlchemy Async Session
- PostgreSQL `supplier_payments`, `purchase_bills`, `suppliers`, `journal_vouchers`, `general_ledger`
- Playwright Chromium Headless runtime

---

## 11. Risks
| Risk | Severity | Mitigation Strategy |
|---|---|---|
| Race condition during concurrent batch knock-offs | Medium | Strict database transaction lock and unallocated balance re-verification before flush. |
| Inaccurate rounding during multi-line FIFO allocations | Low | Strict `Decimal("0.01")` quantization across all calculation lines. |
| Over-allocation exceeding advance limit | Medium | Strict Pydantic and service-level validation ensuring `sum(allocations) <= unallocated_advance`. |

---

## 12. Rollback Strategy
All database mutations occur inside a single atomic async transaction (`session.begin()`). If any bill validation fails, or if GL entry creation fails, the entire transaction rolls back cleanly with zero partial commits.

---

## 13. Verification Plan
- Run automated unit test battery `backend/app/tests/test_supplier_advance_batch_knockoff.py`.
- Run frontend type check `npx tsc --noEmit`.
- Run headless Playwright capture script to visually verify multi-bill FIFO allocation and settled state.

---

## 14. Test Plan
- Test 1: Explicit multi-bill batch knock-off (allocating ₹30,000 advance as ₹12,000 to Bill 1 and ₹18,000 to Bill 2).
- Test 2: Auto FIFO batch knock-off across 3 open bills in ascending date order.
- Test 3: Partial FIFO knock-off where advance balance is less than total open bills.
- Test 4: Over-allocation rejection when requested amount exceeds available advance balance.
- Test 5: Over-allocation rejection when individual allocation exceeds bill unpaid amount.
- Test 6: Rejection of draft or cancelled purchase bills.
- Test 7: Compound GL voucher verification (`sum(DR) == CR`, `Net Cash Movement: ₹0.00`).
- Test 8: Post-knockoff bill status transition to `PAID` or `PARTIALLY_PAID`.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Author `docs/walkthrough/procurement/Procurement_Phase2_7_Multi_Bill_Batch_Advance_Knockoff_v1.0.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
- Code deployed to FastAPI backend and React frontend.
- Zero database migration required (utilizes existing `supplier_payments.notes` structured tags and standard `journal_vouchers`).

---

## 17. Status
**Completed** (Verified with 8/8 automated pytest test suite green, compound double-entry GL balance invariant `sum(DR) == sum(CR)`, zero cash movement, clean TypeScript compilation, and headless visual evidence).

---

## 18. Related ADRs
- `ADR-PROC-005`: Supplier Advance Payments & PO Knock-off General Ledger Architecture
- `ADR-PROC-006`: Multi-Bill Batch Advance Knock-Off & Compound Double-Entry GL Specification

---

## 19. Related Walkthroughs
- `WT-PROC-007`: Procurement Phase 2.7 — Multi-Bill Batch Advance Knock-Off & FIFO Allocation Engine
