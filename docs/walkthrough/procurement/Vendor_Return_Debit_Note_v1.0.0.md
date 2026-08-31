<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.103.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Vendor Return & Debit Note Engine (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the Vendor Return Engine — end-to-end Return-to-Vendor (RTV) lifecycle management with automatic debit note generation, per-line GST reversal computation, partial and full settlement tracking, and a vendor-level open-balance ledger.

## 2. Scope
- `VendorReturnEngine` covering RTV creation, 7-stage lifecycle (DRAFT → SETTLED), debit note auto-generation on `DEBIT_NOTE_RAISED`, partial/full settlement via `settleDebitNote()`, and vendor balance ledger via `computeVendorBalance()`.
- `VendorReturnModal` with 3-tab view: RTV workflow with one-click lifecycle buttons, debit note detail with settlement progress bar, and vendor balance ledger.
- 9 RTV statuses; 4 debit note statuses (OPEN, PARTIALLY_SETTLED, SETTLED, DISPUTED).
- 7 return reason codes.

## 3. Files Created
- `src/utils/vendorReturnEngine.ts`
- `src/components/procurement/VendorReturnModal.tsx`
- `src/tests/vendorReturnEngine.test.ts`
- `docs/walkthrough/procurement/Vendor_Return_Debit_Note_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Auto debit note on `DEBIT_NOTE_RAISED`**: `raiseDebitNote()` constructs the full `DebitNote` document inline — including vendor name, issued timestamp, per-line description with return reason, GST amounts, and `outstandingAmount = totalAmount`. No separate "create debit note" step required.
2. **`extras` spread pattern for actor fields**: Same pattern as `ThreeWayMatchEngine.transition()` — actor fields (`approvedBy`, `dispatchRef`, `debitNote`) are passed as `Partial<ReturnToVendorOrder>` extras and merged atomically with the status change.
3. **Partial settlement cumulative tracking**: `settleDebitNote()` always adds to `settledAmount` (never replaces), recomputes `outstandingAmount`, and auto-promotes `debitNote.status` to PARTIALLY_SETTLED or SETTLED — no separate "check if full" call needed.
4. **RTV auto-SETTLED on full debit note settlement**: When `outstandingAmount <= 0`, the RTV itself transitions to SETTLED in the same `settleDebitNote()` call — lifecycle closure is atomic.
5. **Vendor ledger is a pure computation**: `computeVendorBalance()` takes a snapshot of RTVs and computes outstanding in-memory — no statefulness, safe to recompute on every render.

## 6. Design Rationale
In garment retail, vendor returns for quality defects and wrong items are frequent. Without a formal debit note, the credit remains informal and is easily lost or disputed. The auto-generated `DebitNote` with GST reversal lines gives the accounts payable team a formal document that maps back to the original PO and GRN, enabling compliant GST credit-note matching under GST rules (Section 34, CGST Act).

## 7. Implementation Summary
- `createRTV()`: Per-line `lineValue`, `gstAmount`, `totalWithGST` computed; order-level totals aggregated; first audit entry written.
- `transition()`: Generic private method appending audit entry, spreading extras — all lifecycle methods delegate to it.
- `raiseDebitNote()`: Builds full `DebitNote` with DN number, per-line descriptive strings, and OPEN status.
- `settleDebitNote()`: Accumulates settlement, recomputes outstanding, auto-promotes statuses.
- `computeVendorBalance()`: Filters by vendorId, separates open vs settled debit notes, aggregates totals.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/vendorReturnEngine.test.ts`**: 4/4 tests passed.
  - Test 1: Per-line GST computation (Line1: ₹6300, Line2: ₹5250, Total: ₹11550) ✓
  - Test 2: Full lifecycle DRAFT → SETTLED — 6 audit trail entries ✓
  - Test 3: Partial ₹6000 → PARTIALLY_SETTLED, then remaining ₹5550 → SETTLED ✓
  - Test 4: Vendor ledger — 1 open + 1 settled debit note, outstanding = ₹11550 ✓
- **Total Frontend Suite**: 75/75 test files, 472/472 tests green in 14.26s, exit code 0.

## 10. Known Limitations
- Debit note does not auto-integrate with the GST E-Invoice IRN system in this release — production raises a credit note via the GSTN API in the FastAPI backend.
- No vendor email notification on debit note raise — production triggers via the communication module.
- Disputed debit note resolution workflow deferred to a future release.

## 11. Future Work
- FastAPI `POST /api/v1/vendor-returns/`, `POST /api/v1/vendor-returns/{id}/debit-note`, `PATCH /api/v1/vendor-returns/{id}/settle` backed by Postgres `rtv_orders`, `debit_notes`, `settlement_entries` tables.
- GST credit note (Section 34) auto-filing via GSTN API.
- Vendor portal integration: vendor acknowledges RTV via vendor portal link.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-037`: Vendor Return Lifecycle, Debit Note Auto-Generation, and GST Reversal Policy.

## 13. Related RFCs
- `RFC-106`: Vendor Return Authorisation Matrix, Debit Note Settlement SLA, and GST Credit Note Compliance Procedure.
