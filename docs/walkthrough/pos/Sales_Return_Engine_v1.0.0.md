<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.120.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Sales Return & Exchange Engine (v1.0.0-GA)

## 1. Purpose
Documents the Sales Return & Exchange Engine — full lifecycle of post-sale returns and exchanges including line-level return reasons, restock decisions, auto-refund method derivation, and REFUNDED/EXCHANGED status flow.

## 2. Scope
- `SalesReturnEngine` covering `createReturn()`, `createExchange()`, `approve()`, `reject()`, `returnSummary()`.
- Restock decisions: RESALEABLE | DAMAGED | DISPOSE per line.
- Refund methods: ORIGINAL_METHOD | STORE_CREDIT | EXCHANGE_CREDIT.
- `priceDifference = totalExchangeAmt - totalReturnAmt`; auto-selected `refundMethod`.
- `SalesReturnModal`: order sidebar, summary strip, 3-tab (Return Lines, Exchange Lines + price diff banner, Audit).

## 3. Files Created
- `src/utils/salesReturnEngine.ts`
- `src/components/pos/SalesReturnModal.tsx`
- `src/tests/salesReturnEngine.test.ts`
- `docs/walkthrough/pos/Sales_Return_Engine_v1.0.0.md`

## 4. Files Modified
- `docs/walkthrough/README.md`, `docs/implementation/README.md`, `CHANGELOG.md`

## 5. Architecture Decisions
1. **`createExchange()` auto-derives `refundMethod`**: If `priceDifference >= 0` (customer owes more), `refundMethod = EXCHANGE_CREDIT` and `refundAmt = 0`. If `priceDifference < 0` (store owes refund), `refundMethod = STORE_CREDIT` and `refundAmt = abs(priceDifference)`. This eliminates a manual selection step and removes a category of user error.
2. **`approve()` routes status by `orderType`**: RETURN → REFUNDED; EXCHANGE → EXCHANGED. Both are terminal states — no further mutation is permitted. This makes the status graph linear and auditable.
3. **Restock decision is per-line, not per-order**: A single return order can contain one RESALEABLE item and one DISPOSED item. The `restockDecision` field drives warehouse restocking logic in the backend — not aggregated at order level.
4. **`returnSummary()` aggregates only REFUNDED and EXCHANGED orders for `totalRefundedAmt`**: DRAFT and REJECTED orders are excluded from the refund total. This prevents uncommitted orders from appearing in financial summaries.
5. **Audit trail is append-only with descriptive notes**: `RETURN_CREATED` note includes line count and refund method. `APPROVED` note specifies status + method + amount. `REJECTED` note includes the rejection reason text.

## 6. Design Rationale
Return fraud is the #1 shrinkage category in fashion retail. The per-line `restockDecision` field creates an automatic quality control gate — items marked DAMAGED or DISPOSE trigger write-off entries in the P&L engine. The `priceDifference` auto-calculation prevents cashiers from manually computing exchange top-ups, eliminating both errors and manipulation opportunities.

## 7. Implementation Summary
- `createReturn()`: Maps lines to `ReturnLine[]` with `totalReturnAmt = unitPrice × returnQty`; `refundAmt = totalReturnAmt` for non-EXCHANGE_CREDIT methods; RETURN_CREATED audit.
- `createExchange()`: Builds both `returnLines[]` and `exchangeLines[]`; computes `totalReturnAmt`, `totalExchangeAmt`, `priceDifference`; auto-selects `refundMethod`; `refundAmt = max(0, -priceDifference)`.
- `approve()`: Throws if not DRAFT; sets REFUNDED (RETURN) or EXCHANGED (EXCHANGE); APPROVED audit.
- `reject()`: Throws if not DRAFT; sets REJECTED; stores `rejectionReason`.
- `returnSummary()`: Single pass over `orders[]`; accumulates `refundedAmt` only for REFUNDED/EXCHANGED; tallies restock decisions across all return lines.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/salesReturnEngine.test.ts`**: 4/4 passed (no patches required).
  - Test 1: `₹499×2=₹998`, `₹1299×1=₹1299`, total=`₹2297`; `refundAmt=2297`; `returnNo` matches `RET-BR-MUM-01-*`; RETURN_CREATED audit ✓
  - Test 2: approve→REFUNDED; double-approve throws "Cannot approve"; reject on REFUNDED throws "Cannot reject" ✓
  - Test 3: Exchange pos diff (₹1500-₹1000=+₹500) → EXCHANGE_CREDIT, refundAmt=0; neg diff (₹1200-₹2000=-₹800) → STORE_CREDIT, refundAmt=800 ✓
  - Test 4: returnSummary — totalRefundedAmt=1200 (₹700+₹500); resaleable=2, damaged=3, dispose=1; byStatus REFUNDED=2 ✓
- **Total Frontend Suite**: 93/93 test files, 544/544 tests green, exit code 0.

## 10. Known Limitations
- No partial return support: all lines in `createReturn()` must be returned in full (no partial qty return on a single line). Production splits at the invoice line level.
- Exchange doesn't enforce that return SKUs match the original sale — backend validation required via original invoice reference.

## 11. Future Work
- FastAPI `POST /api/v1/returns/`, `POST /api/v1/returns/{id}/approve`.
- Stock ledger: RESALEABLE lines auto-debit the return quantity back to the branch stock.
- Write-off: DAMAGED/DISPOSE lines post a stock shrinkage entry to the consolidated P&L.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record. `ADR-054`: Sales Return Policy, Restock Decision Governance, Exchange Price Differential Handling.

## 13. Related RFCs
- `RFC-123`: Customer Return & Exchange Policy, Restocking SLA, Refund Processing Timelines.
