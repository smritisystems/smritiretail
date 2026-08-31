<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.91.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Enterprise Return Merchandise Authorization (RMA) & Reverse Logistics Engine (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the RMA Engine — a complete reverse logistics lifecycle management system for both customer returns and supplier returns, with immutable audit trail, restocking fee calculation, credit note tracking, and aggregated metrics.

## 2. Scope
- `RMAEngine` covering create, status transition, refund calculation, and metrics aggregation.
- `RMAManagementModal` with RMA queue, status transition actions, line item table, audit trail, and financial metrics dashboard.
- 10-status lifecycle: DRAFT → SUBMITTED → APPROVED → IN_TRANSIT → RECEIVED_AT_WAREHOUSE → QUALITY_INSPECTION → CREDIT_NOTE_ISSUED → REFUND_PROCESSED → REJECTED → CLOSED.

## 3. Files Created
- `src/utils/rmaEngine.ts`
- `src/components/purchase/RMAManagementModal.tsx`
- `src/tests/rmaEngine.test.ts`
- `docs/implementation/purchase/RMA_Reverse_Logistics_v1.0.0.md`
- `docs/walkthrough/purchase/RMA_Reverse_Logistics_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Immutable audit trail**: Each `RMAAuditEntry` records `fromStatus`/`toStatus`, performing operator, and timestamp — enabling full lifecycle forensics and regulatory traceability.
2. **Restocking fee conditionality**: Applied only when `reason === "CUSTOMER_CHANGED_MIND"` — mirrors standard retail return policy and IndAS 115 guidance on transaction price adjustments.
3. **Typed `RMAStatus` union**: 10-member union enforces compile-time correctness of all status transitions.

## 6. Design Rationale
Returns are a primary source of customer dissatisfaction if not handled transparently. The immutable audit trail ensures any dispute can be resolved with a timestamped log, while the credit note workflow ensures financial accuracy in accounting.

## 7. Implementation Summary
- `RMAEngine.create()`: Builds a new RMA in SUBMITTED state with computed `returnValue` per line item.
- `RMAEngine.transition()`: Appends audit entry, auto-sets `approvedAt`/`receivedAt`/`closedAt` timestamps.
- `RMAEngine.calculateRefund()`: Applies restocking fee only for CUSTOMER_CHANGED_MIND reason.
- `RMAEngine.computeMetrics()`: Aggregates pending, in-transit, credit notes, return values, and byReason/byResolution breakdowns.

## 8. Tests Executed
```bash
npm test
```

## 9. Verification Results
- **`src/tests/rmaEngine.test.ts`**: 4/4 tests passed.
- **Total Frontend Suite**: 63/63 test files, 424/424 tests green in 9.13s.

## 10. Known Limitations
- RMA records are in-memory; production persists to `rma_requests` and `rma_line_items` Postgres tables.
- Credit note issuance to ERP accounting module (journal entry auto-posting) is a future backend integration.

## 11. Future Work
- FastAPI `POST /api/v1/rma` and `PUT /api/v1/rma/{rmaNumber}/status` endpoints.
- Automated credit note generation and GL journal posting in Postgres accounting module.
- WhatsApp notification to customer on RMA status transitions.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-025`: RMA Lifecycle Status Model and Audit Trail Standard.

## 13. Related RFCs
- `RFC-094`: Customer Return Restocking Fee Policy and Credit Note Issuance Workflow.
