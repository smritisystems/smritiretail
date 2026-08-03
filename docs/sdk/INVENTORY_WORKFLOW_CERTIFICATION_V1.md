<!--
  Project      : SMRITI Retail OS
  Document     : Inventory Studio — Business Workflow Certification V1
  File         : docs/sdk/INVENTORY_WORKFLOW_CERTIFICATION_V1.md
  Author       : Jawahar Ramkripal Mallah
  Version      : 1.0.0  (Sprint 4 — Wave 1)
  Created      : 2026-08-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  Classification: Internal — Business Workflow Governance
-->

# Inventory Studio — Business Workflow Certification V1

**Status:** WAVE 1 CERTIFICATION — Sprint 4
**Scope:** INV-001 through INV-021
**Dependency:** All gates require SXP Platform Certification (CS-001 to CS-012) to be met first.
**Kernel Rule:** Every mutating workflow MUST call the Inventory Kernel service layer.
No UI component or manifest action may write stock data directly to the database.

---

## Certification Status

| Gate | Workflow | Criterion | Status |
|---|---|---|---|
| INV-001 | GRN | Stock-in movement posted to ledger via `StockLedgerService.applyMovement({ type:'in' })` | Unverified |
| INV-002 | GRN | `available_qty` increases by received quantity after posting | Unverified |
| INV-003 | GRN | Offline GRN correctly queued to `OfflineExperienceManager` on network failure | Unverified |
| INV-004 | GRN | GRN completes in ≤ 3 scanner interactions (SWEF P-007) | Unverified |
| INV-005 | GRN | Timeline entry created for stock receipt | Unverified |
| INV-006 | Adjustment | `available_qty` updated correctly for both positive and negative adjustments | Unverified |
| INV-007 | Adjustment | Reason code required — wizard blocked without a selection | Unverified |
| INV-008 | Adjustment | Timeline entry created with reason code recorded | Unverified |
| INV-009 | Transfer | `available_qty` decreases at source item/warehouse after transfer | Unverified |
| INV-010 | Transfer | `available_qty` increases at destination item/warehouse after transfer | Unverified |
| INV-011 | Transfer | Journal entry created via `PostingService` through the full pipeline | Unverified |
| INV-012 | Reserve | `reserved_qty` increases by reservation amount | Unverified |
| INV-013 | Reserve | `available_qty` never goes below zero on reserve (BLOCK policy enforced) | Unverified |
| INV-014 | Reserve | Release via `ReservationService.release()` restores `available_qty` correctly | Unverified |
| INV-015 | Write-Off | `available_qty` decreases by write-off quantity | Unverified |
| INV-016 | Stock Count | Physical count session creates variance entries for each mismatched item | Unverified |
| INV-017 | Stock Count | Posting variances triggers `adjust_stock` action for each variance item | Unverified |
| INV-018 | Reorder | Items at or below `reorder_point` appear in the "What to Order" list | Unverified |
| INV-019 | Scan / Inquiry | Barcode lookup returns item name + available qty in ≤ 1 interaction | Unverified |
| INV-020 | All | No workflow posts stock data directly to the database — all via Kernel APIs | Unverified |
| INV-021 | Timeline | Timeline reflects every inventory workflow in chronological order | Unverified |

---

## Gate Definitions

### INV-001 — GRN Ledger Posting

**Workflow:** Goods Receipt (GRN)
**Kernel Call:** `StockLedgerService.applyMovement(entry, { type: 'in', quantity, unitCost, warehouseId })`
**Evidence Required:**
- `git diff` of manifest execute() handler showing kernel call
- Unit test showing `applyMovement` receives correct movement object
- Ledger entry returned has `onHand` incremented

**Pass Criteria:** Test asserts `updatedEntry.onHand === originalOnHand + receivedQty`

---

### INV-002 — GRN Available Qty

**Workflow:** Goods Receipt (GRN)
**Evidence Required:** Unit test asserting `updatedEntry.available === updatedEntry.onHand - updatedEntry.reserved`
**Pass Criteria:** Available qty increases by the received quantity when no reservations exist.

---

### INV-003 — GRN Offline Queue

**Workflow:** Goods Receipt — Network Failure Path
**Evidence Required:**
- Unit test mocking `apiFetchV1` to throw a network error
- Assert `OfflineExperienceManager.getPendingCount()` increases by 1
- Assert queued operation type is `"stock_receipt"`

**Pass Criteria:** `getPendingCount()` increments; operation type matches.

---

### INV-004 — GRN ≤ 3 Interactions (SWEF P-007)

**Workflow:** Goods Receipt — Warehouse Scanner Path
**Evidence Required:** Manual or automated test counting wizard step renders.
**Pass Criteria:**
- Step 1: Scan barcode (1 interaction)
- Step 2: Confirm qty + cost (2 interactions)
- Step 3: Confirm supplier + warehouse + submit (3 interactions)
- No step beyond 3 is rendered before execution.

---

### INV-005 — GRN Timeline Entry

**Workflow:** Goods Receipt — Timeline
**Evidence Required:** Unit test asserting timeline adapter emits entry with `type: "stock_in"` after GRN execute.
**Pass Criteria:** Timeline entry contains `{ type: "stock_in", itemId, quantity, supplierId, timestamp }`.

---

### INV-006 — Adjustment Qty Accuracy

**Workflow:** Stock Adjustment
**Evidence Required:**
- Positive adjustment test: `updatedEntry.onHand === original + abs(adjustmentQty)`
- Negative adjustment test: `updatedEntry.onHand === original - abs(adjustmentQty)` (when stock sufficient)
**Pass Criteria:** Both directions pass.

---

### INV-007 — Adjustment Reason Required

**Workflow:** Stock Adjustment — Validation
**Evidence Required:**
- Unit test calling `validateAdjPayload({ itemId: 'X', adjustmentQty: -5, reason: undefined })` returns `false`
- `validateAdjPayload({ itemId: 'X', adjustmentQty: -5, reason: 'damaged' })` returns `true`
**Pass Criteria:** Validation factory rejects missing reason.

---

### INV-008 — Adjustment Timeline Entry

**Workflow:** Stock Adjustment — Timeline
**Evidence Required:** Unit test asserting timeline entry contains `{ type: "stock_adjustment", reason, adjustmentQty }`.
**Pass Criteria:** Reason code is recorded in the timeline entry.

---

### INV-009 — Transfer Source Deduction

**Workflow:** Stock Transfer
**Evidence Required:**
- Unit test: `result.fromEntry.onHand === original.fromEntry.onHand - transferQty`
**Pass Criteria:** Source ledger entry onHand decreases.

---

### INV-010 — Transfer Destination Addition

**Workflow:** Stock Transfer
**Evidence Required:**
- Unit test: `result.toEntry.onHand === original.toEntry.onHand + transferQty`
**Pass Criteria:** Destination ledger entry onHand increases.

---

### INV-011 — Transfer Journal Entry

**Workflow:** Stock Transfer — Finance Posting
**Evidence Required:**
- Unit test asserting `result.journalEntry` is defined and contains `{ debit, credit, amount }`
**Pass Criteria:** `PostingService.postStockTransfer()` called through pipeline; journal entry returned.

---

### INV-012 — Reserve Qty Increase

**Workflow:** Reservation
**Evidence Required:**
- Unit test: `updatedEntry.reserved === originalEntry.reserved + reserveQty`
**Pass Criteria:** `reserved_qty` increases by the reservation amount.

---

### INV-013 — Reserve Block Policy

**Workflow:** Reservation — Insufficient Stock
**Evidence Required:**
- Unit test with entry where `available < requestedQty` and `allowNegative: false`
- Assert `ReservationService.reserve()` throws `"Insufficient available stock to reserve"`
**Pass Criteria:** Action returns `{ success: false }` — no ledger write.

---

### INV-014 — Release Restores Available

**Workflow:** Reservation Release
**Evidence Required:**
- Unit test: `releasedEntry.available === (originalEntry.available + releasedQty)`
**Pass Criteria:** `available_qty` fully restored after release.

---

### INV-015 — Write-Off Deduction

**Workflow:** Write-Off
**Evidence Required:**
- Unit test: `updatedEntry.onHand === originalEntry.onHand - writeOffQty`
**Pass Criteria:** onHand decreases; `writeOff: true` flag in metadata.

---

### INV-016 — Count Session Variances

**Workflow:** Physical Stock Count
**Evidence Required:**
- Unit test: render `StockCountWorkspace` → simulate scan + enter counted qty ≠ system qty → assert variance computed correctly
**Pass Criteria:** `variance = countedQty - systemQty` for each item.

---

### INV-017 — Count Variance Posting

**Workflow:** Physical Stock Count — Post
**Evidence Required:**
- Unit test: mock `WorkspaceActionRegistry.execute` → call `postVariances()` → assert `adjust_stock` called for each variance item with correct `adjustmentQty`
**Pass Criteria:** One `adjust_stock` call per variance item; no direct ledger write.

---

### INV-018 — Reorder Suggestions

**Workflow:** Reorder
**Evidence Required:**
- Unit test: mock API returning 3 items below reorder point → assert all 3 appear in `ReorderWorkspace` list
- Assert items above reorder point are NOT shown
**Pass Criteria:** List contains only items where `availableQty <= reorderPoint`.

---

### INV-019 — Scan / Inquiry ≤ 1 Interaction

**Workflow:** Inventory Inquiry
**Evidence Required:**
- Manual or automated test: scan barcode → item name + available qty shown in single response
- No additional step required to see stock position
**Pass Criteria:** `inventory_inquiry` execute() returns name + available in one call.

---

### INV-020 — No Direct Database Writes

**Workflow:** All
**Evidence Required:**
- `grep -r "prisma\.\|db\.\|pool\.query\|knex\." src/components/inventory/` returns no matches
- All persistence flows through `putLedgerEntry()` (manifest helper) which calls `apiFetchV1 PUT`
**Pass Criteria:** Zero direct database client calls in any inventory component or manifest file.

---

### INV-021 — Timeline Chronological Consistency

**Workflow:** All
**Evidence Required:**
- After executing GRN → Adjustment → Transfer → Reserve in sequence, timeline adapter returns events in chronological order by timestamp
- No event appears out of sequence
**Pass Criteria:** `timeline.events[i].timestamp <= timeline.events[i+1].timestamp` for all i.

---

## Verification Checklist

Before marking any gate as `Done`:

- [ ] Unit test exists and passes (Rule 2 — literal terminal output)
- [ ] `git diff` shows the relevant kernel call (Rule 1)
- [ ] `npx tsc --noEmit` shows 0 errors (Rule 3)
- [ ] Status labeled as exactly one of: Done / Failed / Partially Verified / Unverified (Rule 7)

---

## Manual Gates (Docker `F:\SMRITI9TEST`)

These gates require human observation in a running Docker environment:

| Gate | Test | Expected Result |
|---|---|---|
| INV-004 | GRN in warehouse scanner mode — count wizard step renders | 3 steps max |
| INV-019 | Scan barcode on mobile 390px screen | Stock shown in ≤ 1 scan |
| INV-021 | Execute 4 workflows in sequence, view timeline | Chronological order |
| INV-020 | Check browser network tab for any direct DB connections | None visible |

---

## Gate Status Summary

| Status | Count |
|---|---|
| Done | 0 |
| Partially Verified | 0 |
| Unverified | 21 |
| Failed | 0 |

All 21 gates are currently **Unverified** — automated tests for INV-001 to INV-021 are created in Sprint 4
and must be run in the Docker test environment (`F:\SMRITI9TEST`) to produce evidence.
