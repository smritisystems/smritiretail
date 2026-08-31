<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.101.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Vendor PO Approval Workflow & 3-Way Match Engine (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the Three-Way Match Engine — full Purchase Order lifecycle management (DRAFT → CLOSED / DISPUTED) with multi-approver audit trail, GRN and vendor invoice application, and a three-way match that compares PO ↔ GRN ↔ Invoice per line using configurable tolerance bands (±2% qty, ±1% price).

## 2. Scope
- `ThreeWayMatchEngine` covering PO creation, submit/approve/reject/send, GRN application, invoice application, `runThreeWayMatch()`, `closeOrDispute()`.
- `POApprovalMatchModal` with PO queue, per-line lifecycle workflow buttons, per-line PO/GRN/invoice comparison table, tolerance indicators, and MATCHED/DISPUTED resolution.
- 11 PO statuses: DRAFT → PENDING_APPROVAL → APPROVED → SENT → PARTIALLY_RECEIVED / RECEIVED → INVOICED → THREE_WAY_MATCHED → CLOSED / DISPUTED / CANCELLED.
- 5 match result types: MATCHED, PRICE_VARIANCE, QTY_VARIANCE, BOTH_VARIANCE, UNMATCHED.
- Configurable tolerance: `qtyTolerancePct` (2%), `priceTolerancePct` (1%).

## 3. Files Created
- `src/utils/threeWayMatchEngine.ts`
- `src/components/procurement/POApprovalMatchModal.tsx`
- `src/tests/threeWayMatchEngine2.test.ts`
- `docs/walkthrough/procurement/PO_Approval_ThreeWay_Match_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Immutable audit trail on all transitions**: Every `transition()` call appends a `POAuditEntry` with `fromStatus`, `toStatus`, `action`, `performedBy`, `timestamp`, `note` — no status change occurs without a full audit record.
2. **`extras` spread pattern for actor persistence**: The `transition()` generic accepts `Partial<PurchaseOrder>` extras — `approve()`, `reject()`, `applyGRN()` use this to persist `approvedBy`, `rejectedBy`, `lines` without duplicating logic.
3. **Per-line received/invoiced qty overlay**: `applyGRN()` and `applyInvoice()` map over existing lines and overlay only the fields returned by the GRN/Invoice document — the original PO `unitPrice` and `orderedQty` are preserved for match comparison.
4. **Auto PARTIALLY_RECEIVED**: `applyGRN()` compares total received vs ordered per line; if any line is short, the status becomes `PARTIALLY_RECEIVED` — no explicit caller action required.
5. **Tolerance-band match result**: Each line produces an independent `MatchResult`; the invoice-level `overallResult` is the worst-case line result (BOTH_VARIANCE > PRICE_VARIANCE > QTY_VARIANCE > MATCHED).

## 6. Design Rationale
AP fraud and supplier overcharging are caught by three-way matching. The tolerance band prevents trivial rounding differences (e.g., ₹1 on a ₹250 item = 0.4%) from triggering disputes while still flagging real price violations (₹8 on ₹120 = 6.67%). The configurable `THREE_WAY_CONFIG` allows each deployment to set tighter or looser bands based on vendor SLA agreements.

## 7. Implementation Summary
- `createPO()`: Computes per-line `lineTotal`, `totalValue`, `taxTotal`, `grandTotal` from GST rates; generates `poNo` with date prefix.
- `submitForApproval()` / `approve()` / `reject()` / `markSent()`: Single-responsibility wrappers around `transition()`.
- `applyGRN()`: Overlays received qty/price per lineId, auto-selects RECEIVED vs PARTIALLY_RECEIVED.
- `applyInvoice()`: Overlays invoiced qty/price per lineId, transitions to INVOICED.
- `runThreeWayMatch()`: Per-line qty and price variance as `%`, applies tolerance bands, resolves `MatchResult`, aggregates totals, sets `requiresDispute`.
- `closeOrDispute()`: Transitions to CLOSED (match passed) or DISPUTED (variance found) in one call.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/threeWayMatchEngine2.test.ts`**: 4/4 tests passed.
  - Test 1: PO creation totals, submit, approve — `approvedBy` persisted ✓
  - Test 2: Full GRN + invoice → MATCHED (0.4% price var within 1% tolerance) → CLOSED ✓
  - Test 3: Invoice with 6.67% price variance → PRICE_VARIANCE → DISPUTED ✓
  - Test 4: PO rejection — `rejectedBy` + `rejectionReason` persisted, status CANCELLED ✓
- **Total Frontend Suite**: 72/72 test files, 460/460 tests green in 12.02s, exit code 0.

## 10. Known Limitations
- Three-way match runs on in-memory PO state; production pulls GRN and invoice data from Postgres `goods_receipt_notes` and `vendor_invoices` tables.
- `THREE_WAY_MATCHED` status is modelled but not set automatically after `runThreeWayMatch()` — production sets it in `closeOrDispute()` for matched POs before the final CLOSED transition.
- GRN batch numbers (`batchNo`) are modelled in the interface but not persisted to PO lines in this release.

## 11. Future Work
- FastAPI `POST /api/v1/purchase-orders/`, `POST /api/v1/purchase-orders/{id}/approve`, `POST /api/v1/purchase-orders/{id}/grn`, `POST /api/v1/purchase-orders/{id}/invoice`, `POST /api/v1/purchase-orders/{id}/match` backed by Postgres.
- Email notification to vendor on PO SENT and to AP team on DISPUTED result.
- Dispute resolution workflow: counter-party credit note issuance or revised invoice upload.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-035`: PO Approval Workflow, Three-Way Match Architecture, and Tolerance Band Policy.

## 13. Related RFCs
- `RFC-104`: Vendor PO Approval Matrix, GRN Receiving SLA, and Invoice Dispute Resolution Procedure.
