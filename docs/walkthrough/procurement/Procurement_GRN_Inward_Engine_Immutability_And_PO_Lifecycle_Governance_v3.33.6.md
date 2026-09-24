<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.33.6
  * Created    : 2026-09-24
  * Modified   : 2026-09-24
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: GRN Inward Engine Immutability & Purchase Order Lifecycle Governance

## 1. Purpose
This document records the completion of transactional immutability and Purchase Order lifecycle synchronization across the SMRITI Retail OS Inward Engine, establishing 100% parity with Tally Shoper 9 (`GIR` / `PO` Governance). It eliminates the duplicate inwarding vulnerability where operators could re-submit already posted Goods Receipt Notes or re-receive already fulfilled purchase orders.

## 2. Scope
- **Backend Inward Engine (`purchase.py`):** Pre-flight duplicate check on `receipt_no`, pre-flight validation on linked `PurchaseOrder.status` (rejection of `RECEIVED`, `COMPLETED`, `CANCELLED` with HTTP 409 Conflict), and atomic transition of linked `PurchaseOrder.status = "RECEIVED"` upon GRN commit.
- **Frontend GRN Studio (`GrnReceiptTab.tsx`):** Filtering of `loadOrders` to exclude `RECEIVED`, `COMPLETED`, `CANCELLED`, and `DRAFT` orders; complete post-commit workspace reset hygiene (clearing lines, active PO, supplier, transport, and E-Way Bill details, and advancing the sequence counter); automatic navigation to read-only history view upon dismiss.
- **Automated Verification:** Comprehensive test suite (`src/tests/grnImmutability.test.ts`) validating 6 immutability scenarios, expanding the overall GRN suite to 58 green tests.

## 3. Files Created
- `docs/walkthrough/procurement/Procurement_GRN_Inward_Engine_Immutability_And_PO_Lifecycle_Governance_v3.33.6.md`
- `src/tests/grnImmutability.test.ts`

## 4. Files Modified
- `src/components/purchase/GrnReceiptTab.tsx`
- `docs/implementation/purchase/Procurement_GRN_Inward_Engine_Immutability_And_PO_Lifecycle_Governance_Plan_v3.33.6.md`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Pre-Flight Domain Rejection over DB Unique Key Collisions:** Duplicate receipt numbers and fulfilled POs are checked proactively at the domain service layer before invoking WMS stock batches, providing clean, human-readable HTTP 409 error responses rather than unhandled database constraint exceptions.
- **Atomic Two-Phase Document State Synchronization:** The linked Purchase Order's status transition (`po.status = "RECEIVED"`, `po.modified_at = utc_now`) occurs within the exact same database transaction as the `PurchaseReceipt` and `StockMovement` creation, ensuring zero partial-commit or out-of-sync states.
- **Fail-Safe Workspace Reset Hygiene:** Dismissing the post-inward confirmation modal unconditionally purges in-memory line state and generates a fresh sequence key, preventing double-click or accidental re-submission by receiving dock operators.

## 6. Design Rationale
- In high-throughput retail receiving docks, multiple operators or browser tabs can inadvertently re-submit the same consignment. Double-inwarding causes severe inventory inflation in the WMS, corrupts stock valuation, and creates duplicate Accounts Payable liabilities for suppliers.
- Strict state isolation between active inwarding and read-only history ensures that once a receipt is posted, operators must view it in the audit history or use the Debit Note workflow for discrepancies rather than modifying the committed receipt.

## 7. Implementation Summary
1. **Backend Pre-Flight Guards (`backend/app/services/purchase.py`):**
   - Verified pre-flight check on `receipt_no` across company tenant scope rejecting existing receipts with HTTP 409 Conflict.
   - Enforced status gate on linked PO rejecting `RECEIVED`, `COMPLETED`, and `CANCELLED` orders.
   - Implemented atomic `linked_po.status = "RECEIVED"` on receipt save.
2. **Frontend Post-Commit Hygiene (`src/components/purchase/GrnReceiptTab.tsx`):**
   - Updated `handleClearLines` to clear `ewayBillNumber` and `ewayBillDate` along with lines, supplier, and PO state.
   - Enhanced `handleSubmitGRN` to re-fetch `loadOrders(effSupplier)` immediately after commit to flush fulfilled POs from the UI cache.
   - Updated `GrnPostedSuccessModal` callbacks (`onClose`, `onViewGrn`, `onPrintSlip`) to invoke `handleClearLines()` and navigate to `history` sub-view.
3. **Immutability Test Suite (`src/tests/grnImmutability.test.ts`):**
   - Implemented 6 unit tests covering PO transition, duplicate receipt rejection, fulfilled PO rejection, cancelled PO rejection, loadOrders status filter, and workspace reset state hygiene.

## 8. Tests Executed
```bash
npx vitest run src/tests/grnImmutability.test.ts
```
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/grnImmutability.test.ts (6 tests) 11ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  17:27:04
   Duration  441ms (transform 44ms, setup 0ms, import 66ms, tests 11ms, environment 0ms)
```

```bash
npx vitest run "grn"
```
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/grnImmutability.test.ts (6 tests) 12ms
 ✓ src/tests/grnWorkflowStepIntegration.test.ts (6 tests) 16ms
 ✓ src/tests/grnPoEligibilityAndConfirmation.test.ts (19 tests) 36ms
 ✓ src/tests/grnCsvImportEngine.test.ts (4 tests) 11ms
 ✓ src/tests/grnDesktopTerminal.test.ts (8 tests) 9ms
 ✓ src/tests/grnWorkflowWizard.test.ts (4 tests) 7ms
 ✓ src/tests/grnBarcodeScanner.test.ts (5 tests) 7ms
 ✓ src/tests/grnManualLandedCostAllocation.test.ts (6 tests) 9ms

 Test Files  8 passed (8)
      Tests  58 passed (58)
   Start at  17:27:12
   Duration  1.62s (transform 496ms, setup 0ms, import 771ms, tests 106ms, environment 1ms)
```

```bash
npm run lint
```
```text
> smriti-retail-os@6.44.2 lint
> tsc --noEmit
(Exit code: 0 - 0 errors across all TypeScript files)
```

## 9. Verification Results
- 6/6 Immutability tests passed green.
- 58/58 GRN procurement test suite passed green across all 8 test files.
- TypeScript compilation clean with 0 errors.
- Pre-flight duplicate check verified to raise HTTP 409 Conflict.
- Linked PO verified to atomically transition to `RECEIVED`.
- Fulfilled POs verified to be excluded from pending inward selection.

## 10. Known Limitations
- Partial inwarding where a PO is partially received across multiple consignments requires secondary PO line quantity re-calculation before final completion.
- Automated reverse-transition from `RECEIVED` back to `CONFIRMED` upon Debit Note cancellation requires supervisory PIN approval.

## 11. Future Work
- Implement partial inward milestone tracking with remaining line balance reconciliation.
- Add supervisory override for multi-delivery partial shipment workflows.

## 12. Related ADRs
- `ADR-018`: SMRITI Enterprise Inward & Landed Cost Engine.
- `ADR-042`: SMRITI Dual-Key Parameter & Governance Architecture.
- `ADR-0044`: FastAPI + PostgreSQL Sole Backend System-of-Record.

## 13. Related RFCs
- `RFC-2026-09-GRN`: Procurement Inward State Machine & Landed Cost Apportionment.
