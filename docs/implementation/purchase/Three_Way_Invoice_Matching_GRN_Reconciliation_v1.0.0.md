<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.81.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Purchase Studio 3-Way Invoice Matching & GRN Auto-Reconciliation (v1.0.0-GA)

## 1. Objective
Establish an automated, interactive 3-Way Matching and Reconciliation modal (`ThreeWayMatchingModal.tsx`) in SMRITI Purchase Studio, cross-validating Purchase Orders (PO), Goods Receipt Notes (GRN), and Vendor Invoices to detect quantity drifts, rate variances, and tax mismatches prior to Accounts Payable (AP) posting.

## 2. Business Motivation
In retail procurement, over-billing by suppliers or accepting damaged inventory without corresponding invoice adjustments creates heavy margin erosion. Enforcing 3-way line item validation guarantees that invoices are only paid for physical stock verified and accepted at the warehouse or store dock.

## 3. Scope
- 3-Way Auto-Reconciliation Comparator Modal (`ThreeWayMatchingModal.tsx`).
- Triad reference context: PO Number/Date, GRN Number/Date, Vendor Invoice Number/Date.
- Line-by-line comparison across ordered quantities, accepted quantities, billed quantities, rates, and values.
- Line drift tags (`MATCHED`, `QTY_MISMATCH`, `RATE_MISMATCH`, `TAX_MISMATCH`).
- Net invoice variance summary and automated AP voucher posting.

## 4. Current State
Purchase orders and GRN generation were available, but matching invoices to receipts required manual multi-screen verification.

## 5. Gap Analysis
- Needed unified 3-way visual comparator dialog with tolerance checking and 1-click AP voucher posting.

## 6. Architecture Impact
- Re-verifies Rule 1 & Rule 5: UI calls `apiFetchV1` (`/api/v1/purchase/3way-matching/commit`) against the canonical FastAPI + PostgreSQL backend.

## 7. Proposed Design
```text
┌────────────────────────────────────────────────────────────────────────┐
│             PURCHASE 3-WAY MATCHING & AUTO-RECONCILIATION              │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ 1. PURCHASE ORDER │ 2. GOODS RECEIPT  │ 3. VENDOR INVOICE              │
│ - PO No / Date    │ - GRN No / Date   │ - Inv No / Date / GSTIN        │
├───────────────────┴───────────────────┴────────────────────────────────┤
│ LINE ITEM GRID: Item | PO Qty | GRN Accepted | Inv Qty | Drift | Status│
├────────────────────────────────────────────────────────────────────────┤
│ SUMMARY: Net Variance | Status: AUTO_APPROVED | [ Commit & Post AP ]   │
└────────────────────────────────────────────────────────────────────────┘
```

## 8. Files Created
- `src/components/purchase/ThreeWayMatchingModal.tsx`
- `src/tests/threeWayMatching.test.ts`
- `docs/implementation/purchase/Three_Way_Invoice_Matching_GRN_Reconciliation_v1.0.0.md`
- `docs/walkthrough/purchase/Three_Way_Invoice_Matching_GRN_Reconciliation_v1.0.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18+
- Tailwind CSS
- Vitest 4.1+

## 11. Risks
- *Risk:* Decimal rounding differences between supplier invoice and ERP line tax calculations.
  *Mitigation:* Configurable 5-paise rounding tolerance before flagging rate mismatch.

## 12. Rollback Strategy
Modular purchase component that can be opened or closed cleanly.

## 13. Verification Plan
- Unit tests verifying component exports, data models, variance calculation, and API commit POST.
- Full Vitest suite pass rate (`380/380 green`).

## 14. Test Plan
- Run `npm test`.

## 15. Documentation Impact
- Update SMRITI Purchase & Accounts Payable User Manual.

## 16. Deployment Plan
- Build and bundle with frontend client package.

## 17. Status
Completed & Verified (`380/380 frontend tests green`).

## 18. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-021`: Automated Accounts Payable 3-Way Matching Engine.

## 19. Related Walkthroughs
- `docs/walkthrough/purchase/Three_Way_Invoice_Matching_GRN_Reconciliation_v1.0.0.md`.
