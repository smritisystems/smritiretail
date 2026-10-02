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

# Walkthrough: Procurement Phase 2.7 — Multi-Bill Batch Advance Knock-Off & FIFO Allocation Engine

**Walkthrough ID:** `WT-PROC-007`  
**Area:** `procurement`  
**Version:** `1.0.0`  
**Status:** Completed  
**Release:** `6.49.9`  
**Related Implementation Plan:** [IP-PROC-007](../../implementation/procurement/Procurement_Phase2_7_Multi_Bill_Batch_Advance_Knockoff_Plan_v1.0.md)  
**Related ADRs:** `ADR-PROC-005`, `ADR-PROC-006`  
**Related RFCs:** `RFC-PROC-2026-07`  

---

## 1. Purpose
This document provides formal architectural verification and forensic engineering evidence for **Procurement Phase 2.7: Multi-Bill Batch Advance Knock-Off & FIFO Allocation Engine** in SMRITI Retail OS. It validates the capability of accounts payable operators to apply a single supplier advance prepayment (`Account 2050 Supplier Advance Liability`) across multiple open purchase bills (`Account 2010 Accounts Payable / Sundry Creditors`) in a single atomic transaction, either via 1-click FIFO cascading or customized split allocations, posting a compound double-entry general ledger journal voucher with strictly zero cash movement.

---

## 2. Scope

### In Scope
- **Backend Schemas (`backend/app/schemas/supplier_payment.py`):**
  - Added `SupplierAdvanceBatchKnockoffRequest` and `SupplierAdvanceBatchKnockoffResponse`.
- **Backend Service Engine (`backend/app/services/supplier_payment.py`):**
  - Implemented `batch_knockoff_advance` supporting both manual allocation manifests and automated FIFO chronological allocation.
  - Multi-bill status transitions (`PAID` vs `PARTIALLY_PAID`) and supplier liability decrements.
  - Allocation manifest persistence into `supplier_payments.notes`.
- **General Ledger Service (`backend/app/services/unified_ledger.py`):**
  - Implemented `post_supplier_advance_batch_knockoff_to_gl` generating atomic compound double-entry journal vouchers with multi-debit lines (`DR 2010`) and a consolidated credit line (`CR 2050`).
  - Strict balance invariant: `sum(DR) == sum(CR)` and `Net Cash Movement: ₹0.00`.
- **API Endpoint (`backend/app/api/v1/supplier_payment.py`):**
  - Added `POST /api/v1/supplier-payments/advance/batch-knockoff`.
- **Frontend Workspace & Modal (`src/components/vendor/`):**
  - Enhanced `VendorAdvanceKnockoffModal.tsx` with a dual-mode workflow switch (`Multi-Bill Batch & FIFO` vs `Single Bill`), open bills allocation table with live editable inputs, "Max" shortcut buttons, 1-click `⚡ Auto FIFO Allocate`, dynamic allocation progress strip, and live compound GL preview.
  - Enhanced `VendorPayablesTab.tsx` with direct `⚡ Batch Knock-Off (FIFO)` triggers in top bar and Account 2050 card.
  - Enhanced `StandaloneVendorPayablesPreview.tsx` with full batch simulation capabilities.
- **Automated Backend Test Battery (`backend/app/tests/test_supplier_advance_batch_knockoff.py`):**
  - 8/8 comprehensive pytest test cases green.
- **Programmatic Headless Playwright Verification:**
  - `scripts/capture_vendor_360_batch_advance_knockoff_headless.py` capturing modal and settled states.

### Out of Scope
- Direct banking cash refund of unallocated supplier advance (scheduled for Phase 2.8).
- Multi-currency forex revaluation (INR domestic procurement only).

---

## 3. Files Created
1. `docs/implementation/procurement/Procurement_Phase2_7_Multi_Bill_Batch_Advance_Knockoff_Plan_v1.0.md` — Implementation plan with 19 IPGP sections.
2. `backend/app/tests/test_supplier_advance_batch_knockoff.py` — Automated test suite with 8 test cases.
3. `scripts/capture_vendor_360_batch_advance_knockoff_headless.py` — Headless Playwright capture script.
4. `docs/walkthrough/procurement/Procurement_Phase2_7_Multi_Bill_Batch_Advance_Knockoff_v1.0.md` — This walkthrough document.
5. `docs/walkthrough/procurement/evidence/vendor_360_batch_knockoff_modal_fifo_active.png` — Screenshot of batch mode with FIFO allocation active.
6. `docs/walkthrough/procurement/evidence/vendor_360_batch_knockoff_settled_overview.png` — Screenshot of settled workspace post-batch knockoff.

---

## 4. Files Modified
1. `backend/app/schemas/supplier_payment.py`: Added `SupplierAdvanceBatchKnockoffRequest` and `SupplierAdvanceBatchKnockoffResponse`.
2. `backend/app/services/unified_ledger.py`: Added `post_supplier_advance_batch_knockoff_to_gl`.
3. `backend/app/services/supplier_payment.py`: Added `batch_knockoff_advance` and updated bill status transitions.
4. `backend/app/api/v1/supplier_payment.py`: Added `POST /advance/batch-knockoff` route.
5. `src/components/vendor/tabs/VendorAdvanceKnockoffModal.tsx`: Upgraded with batch mode, FIFO auto-allocation, and compound GL preview.
6. `src/components/vendor/tabs/VendorPayablesTab.tsx`: Added batch knockoff triggers and mode routing.
7. `src/components/vendor/StandaloneVendorPayablesPreview.tsx`: Connected batch simulation and updated UI.
8. `package.json`, `src/config/version.ts`, `CHANGELOG.md`: Bumped version to `6.49.9`.
9. `docs/implementation/README.md`, `docs/walkthrough/README.md`: Updated master index registries.

---

## 5. Architecture Decisions
- **Compound Journal Voucher Design (`ADR-PROC-006`):**
  Rather than posting separate journal vouchers for each bill in a batch settlement, SMRITI posts a single consolidated compound journal voucher:
  - Multiple debit lines (`DR 2010 Accounts Payable`) corresponding to each individual bill knocked off, detailing the specific purchase bill number in the remarks.
  - A single credit line (`CR 2050 Supplier Advance Liability`) equal to the exact sum of all allocations.
  - Strict balance check: `sum(DR) == sum(CR)` and `Net Cash Movement: ₹0.00`.
- **FIFO Chronological Prioritization:**
  In automated FIFO allocation mode (`auto_fifo=True`), open purchase bills are prioritized by `bill_date.asc().nullslast()`, `created_at.asc()`. This ensures that aging liabilities in the oldest buckets (e.g. 60–90+ days) are extinguished first, minimizing overdue penalty risks.
- **Structured Manifest Persistence:**
  Batch allocations are recorded atomically inside `supplier_payments.notes` using the standard `__ALLOCATIONS__:[{"bill_id": ..., "bill_no": ..., "amount": ..., "knocked_off_at": ...}]` tag, maintaining zero-schema-drift backward compatibility.

---

## 6. Design Rationale
In real-world retail sourcing:
- Advance prepayments (e.g., ₹50,000 to ₹5,00,000) are disbursed upfront to secure bulk yarn, fabrics, or merchandise.
- Consignments arrive in staggered lots across multiple Goods Receipt Notes (GRNs) and purchase bills (e.g. Bill 1: ₹42,500, Bill 2: ₹50,000).
- Requiring an accounts operator to execute a 1-to-1 knock-off modal multiple times introduces calculation fatigue, potential arithmetic mistakes, and fragmented audit trails.
- By providing a 1-click **"⚡ Auto FIFO Allocate"** engine with live compound double-entry GL visualization, finance teams can settle complex multi-bill invoices in under 5 seconds with guaranteed accounting invariants.

---

## 7. Implementation Summary

### Compound General Ledger Posting Architecture
```
┌────────────────────────────────────────────────────────────────────────┐
│             JOURNAL VOUCHER: BKNOCK-ADV-2026-0089                     │
│             Reference Doc: SUPPLIER_ADVANCE_BATCH_KNOCKOFF             │
├────────────────────────────────────────────────────────────────────────┤
│ Line 1: DR 2010 Accounts Payable (BILL-VARD-2026-001)    ₹42,500.00   │
│ Line 2: DR 2010 Accounts Payable (BILL-VARD-2026-002)     ₹7,500.00   │
│ Line 3: CR 2050 Supplier Advance Liability               ₹50,000.00   │
├────────────────────────────────────────────────────────────────────────┤
│ Invariant: sum(DR) = ₹50,000.00 == sum(CR) = ₹50,000.00 (Balanced)   │
│ Net Cash Movement: ₹0.00                                               │
└────────────────────────────────────────────────────────────────────────┘
```

### Visual Evidence: Batch FIFO Allocation Active
![Vendor 360 Batch Knockoff FIFO Modal Active](file:///C:/Users/netma/.gemini/antigravity-ide/brain/aaff00e6-0df9-4455-9368-34989e066b42/vendor_360_batch_knockoff_modal_fifo_active.png)

### Visual Evidence: Batch Knockoff Settled Overview
![Vendor 360 Batch Knockoff Settled Overview](file:///C:/Users/netma/.gemini/antigravity-ide/brain/aaff00e6-0df9-4455-9368-34989e066b42/vendor_360_batch_knockoff_settled_overview.png)

---

## 8. Tests Executed
Automated test battery executed via pytest against PostgreSQL test database:

```powershell
pytest backend/app/tests/test_supplier_advance_batch_knockoff.py -v
```

### Literal Terminal Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 8 items

backend\app\tests\test_supplier_advance_batch_knockoff.py::test_explicit_multi_bill_batch_knockoff PASSED [ 12%]
backend\app\tests\test_supplier_advance_batch_knockoff.py::test_auto_fifo_batch_knockoff PASSED [ 25%]
backend\app\tests\test_supplier_advance_batch_knockoff.py::test_partial_fifo_knockoff_leaving_unpaid_balance PASSED [ 37%]
backend\app\tests\test_supplier_advance_batch_knockoff.py::test_over_allocation_exceeds_advance_rejected PASSED [ 50%]
backend\app\tests\test_supplier_advance_batch_knockoff.py::test_over_allocation_exceeds_bill_unpaid_rejected PASSED [ 62%]
backend\app\tests\test_supplier_advance_batch_knockoff.py::test_cancelled_or_draft_bill_rejected_in_batch PASSED [ 75%]
backend\app\tests\test_supplier_advance_batch_knockoff.py::test_already_fully_allocated_advance_rejected PASSED [ 87%]
backend\app\tests\test_supplier_advance_batch_knockoff.py::test_missing_allocations_and_auto_fifo_rejected PASSED [100%]

======================= 8 passed, 14 warnings in 48.61s =======================
```

Regression test suite executed:
```powershell
pytest backend/app/tests/test_purchase_bill_listing.py backend/app/tests/test_supplier_advance_gl_knockoff.py backend/app/tests/test_supplier_payment_gl_knockoff.py -q
```
Output:
```text
.......................                                                  [100%]
23 passed, 14 warnings in 51.52s
```

TypeScript type-checker execution:
```powershell
npx tsc --noEmit
```
Exit code: `0` (Zero errors).

---

## 9. Verification Results
| Verification Item | Requirement | Observed Result | Status |
|---|---|---|---|
| **Explicit Multi-Bill Allocation** | Allocate ₹35k across 2 bills | Bill 1 settled to PAID, Bill 2 updated to PARTIALLY_PAID, remaining advance ₹15k | **Done** |
| **Auto FIFO Cascading** | Cascade ₹40k across 3 chronological bills | Oldest 2 bills paid in full, newest bill partially paid, advance fully exhausted | **Done** |
| **Compound GL Balancing** | Multiple DR lines equal single CR line | `sum(DR) == sum(CR)` invariant verified; Net Cash = ₹0.00 | **Done** |
| **Over-allocation Protection** | Total allocation > unallocated credit | Rejected with HTTP 400 error | **Done** |
| **Over-bill Protection** | Bill allocation > bill unpaid balance | Rejected with HTTP 400 error | **Done** |
| **Cancelled/Draft Protection** | Allocation to non-confirmed bills | Rejected with HTTP 400 error | **Done** |
| **Headless Visual Evidence** | Programmatic capture without physical windows | Both screenshots generated headlessly and verified | **Done** |
| **TypeScript Parity** | `npx tsc --noEmit` clean run | Exit code 0, 0 compiler errors | **Done** |

---

## 10. Known Limitations
- Batch knock-offs currently settle against bills within the same operating tenant/branch. Cross-branch multi-bill advance consolidation is not currently permitted by corporate chart of accounts governance.

---

## 11. Future Work
- **Procurement Phase 2.8: Vendor Statement of Account & Ledger Audit PDF/Excel Export:** Generate formal supplier ledger statements compiling chronological invoices, advances, payments, and non-cash knock-off journal vouchers.
- **Supplier Advance Refund Gateway:** Direct reversal of unallocated advance balances back to bank account (`DR 1020 / CR 2050`).

---

## 12. Related ADRs
- `ADR-PROC-005`: Supplier Advance Payments & PO Knock-off General Ledger Architecture
- `ADR-PROC-006`: Multi-Bill Batch Advance Knock-Off & Compound Double-Entry GL Specification

---

## 13. Related RFCs
- `RFC-PROC-2026-07`: Enterprise Batch Accounts Payable Settlement & FIFO Allocation Standard
