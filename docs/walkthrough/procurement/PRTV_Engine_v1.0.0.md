<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.115.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Purchase Return to Vendor (PRTV) Engine (v1.0.0-GA)

## 1. Purpose
Documents the PRTV Engine — vendor return order lifecycle from draft through settlement, including debit note generation, courier dispatch recording, vendor acknowledgement, and payable settlement.

## 2. Scope
- `PRTVEngine` covering `createReturn()`, `approve()`, `markDispatched()`, `acknowledge()`, `settle()`, `reject()`.
- Status flow: DRAFT → APPROVED → DISPATCHED → ACKNOWLEDGED → SETTLED; DRAFT/APPROVED → REJECTED.
- Line-level: `totalCost = unitCost × returnQty`; `taxAmt = totalCost × taxPct/100`; `netReturnAmt = totalCost + taxAmt`.
- Debit note auto-generated on `approve()` with `debitNoteNo` (DN-*).
- All transitions guarded with explicit status checks and throws.
- `PRTVModal`: order sidebar, 3-tab (Lines table, Debit Note card, Audit trail); lifecycle action buttons per status.

## 3. Files Created
- `src/utils/prtvEngine.ts`
- `src/components/procurement/PRTVModal.tsx`
- `src/tests/prtvEngine.test.ts`
- `docs/walkthrough/procurement/PRTV_Engine_v1.0.0.md`

## 4. Files Modified
- `docs/walkthrough/README.md`, `docs/implementation/README.md`, `CHANGELOG.md`

## 5. Architecture Decisions
1. **`recalc()` is private and called at `createReturn()` only**: Order-level totals are computed once from lines at creation. Subsequent state changes (approve, dispatch, settle) do not re-aggregate — totals are immutable after creation. This prevents silent total drift if a line were somehow mutated.
2. **Debit note is generated atomically with `approve()`**: Finance needs a debit note number immediately upon approval for their AP ledger entry. Separating them into two steps would create a window where an approved PRTV has no debit note.
3. **`settle()` requires ACKNOWLEDGED status**: Settlement without vendor acknowledgement is a finance control risk — the vendor could dispute receipt. The ACKNOWLEDGED gate ensures a chain-of-custody record before money moves.
4. **`reject()` is allowed from DRAFT or APPROVED only**: Once dispatched, rejection is no longer possible — physical goods are in transit. The engine enforces this business constraint.
5. **All status transitions use an explicit guard + throw pattern**: Rather than silent no-ops, out-of-sequence calls throw descriptive errors. This surfaces integration bugs immediately rather than leaving silent corrupted state.

## 6. Design Rationale
PRTV is an AP control process — it prevents vendors from denying returns and enables debit adjustments against open payables. The debit note is the legal document for GST credit reversal on returned goods, making its auto-generation at approval critical for compliance.

## 7. Implementation Summary
- `createReturn()`: Iterates lines; computes `totalCost`, `taxAmt`, `netReturnAmt` per line; calls `recalc()` for order totals; sets DRAFT; appends PRTV_CREATED audit.
- `approve()`: Guards DRAFT; generates `DebitNote` object with auto-incremented `debitNoteNo`; sets APPROVED; appends APPROVED audit.
- `markDispatched()`: Guards APPROVED; stores `DispatchInfo { courier, trackingNo, dispatchedBy, dispatchedAt }`; sets DISPATCHED.
- `acknowledge()`: Guards DISPATCHED; stores `acknowledgedAt`; sets ACKNOWLEDGED.
- `settle()`: Guards ACKNOWLEDGED; stores `settlement { settledAt, settledBy, payableRef, settledAmt }`; sets SETTLED.
- `reject()`: Guards DRAFT or APPROVED; stores reason in audit note; sets REJECTED.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/prtvEngine.test.ts`**: 4/4 tests passed.
  - Test 1: 2 lines — L1: totalCost=1800, tax=90, net=1890; L2: totalCost=1000, tax=120, net=1120; order: subTotal=2800, totalTax=210, netReturnAmt=3010 ✓
  - Test 2: approve → debitNoteNo matches `DN-*`, netDebitAmt=3010; double-approve throws ✓
  - Test 3: Full lifecycle — dispatch (BlueDart/BD-9812345678) → acknowledge → settle (₹1062, PAYABLE-REF-088); 5 audit entries ✓
  - Test 4: reject from DRAFT → REJECTED; approve-rejected throws; dispatch-draft throws ✓
- **Total Frontend Suite**: 87/87 test files, 520/520 tests green in 16.36s, exit code 0.

## 10. Known Limitations
- `prtvId` is client-side timestamp — production uses Postgres UUID.
- No partial return workflow (returning a subset of a PO line quantity with line-level partial tracking).
- GST credit note (not debit note) for cases where vendor issues the credit note is not yet modelled.

## 11. Future Work
- FastAPI `POST /api/v1/prtv/`, `PATCH /api/v1/prtv/{id}/approve`, `PATCH /api/v1/prtv/{id}/dispatch`, `PATCH /api/v1/prtv/{id}/settle`.
- GST debit note PDF generation (GSTR-2 filing reference).
- Partial line return: allow returning a subset of original PO line qty with prorated debit.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record. `ADR-049`: PRTV Status Flow, Debit Note Governance, and Payable Settlement Linkage Policy.

## 13. Related RFCs
- `RFC-118`: Vendor Return Policy, Debit Note Authority Matrix, and GST Credit Reversal Workflow.
