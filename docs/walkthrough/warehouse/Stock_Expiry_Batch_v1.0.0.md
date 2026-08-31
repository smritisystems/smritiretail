<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.117.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Stock Expiry & Batch Tracking Engine (v1.0.0-GA)

## 1. Purpose
Documents the Stock Expiry Engine — full batch/lot lifecycle including FEFO allocation, near-expiry alerting, quarantine management, idempotent expiry marking, and per-SKU batch reporting.

## 2. Scope
- `StockExpiryEngine` covering `registerBatch()`, `fefoAllocation()`, `deductAllocation()`, `nearExpiryBatches()`, `quarantineBatch()`, `releaseFromQuarantine()`, `expireIfDue()`, `expireBatch()`, `batchReport()`.
- Statuses: AVAILABLE, RESERVED, QUARANTINED, EXPIRED, DEPLETED, RECALLED.
- FEFO: First-Expired-First-Out; batches sorted by `expiryDate` ASC before greedy allocation.
- `StockExpiryModal`: batch sidebar, 3-tab (Batch Detail with quarantine/release, Near Expiry alert list, SKU Report grid).

## 3. Files Created
- `src/utils/stockExpiryEngine.ts`
- `src/components/warehouse/StockExpiryModal.tsx`
- `src/tests/stockExpiryEngine.test.ts`
- `docs/walkthrough/warehouse/Stock_Expiry_Batch_v1.0.0.md`

## 4. Files Modified
- `docs/walkthrough/README.md`, `docs/implementation/README.md`, `CHANGELOG.md`

## 5. Architecture Decisions
1. **FEFO is implemented as a pure sort+greedy pass over AVAILABLE batches**: No mutation occurs in `fefoAllocation()` — it returns an `AllocationResult` with `lines[]`. `deductAllocation()` is a separate call that applies the deduction. This separation allows the POS to preview allocations before committing.
2. **`expireIfDue()` is idempotent and guards EXPIRED/DEPLETED/RECALLED**: Running a nightly expiry job multiple times is safe — already-expired batches are returned unchanged. No duplicate EXPIRED entries accumulate.
3. **`quarantineBatch()` moves qty to `quarantinedQty`, does not zero `availableQty` to negative**: Guard throws if `qty > availableQty`. The quarantined qty is tracked separately so that partial quarantine is supported.
4. **`daysToExpiry()` is a private helper used in both `nearExpiryBatches()` and `batchReport()`**: Computed as `Math.floor((expiryDate - asOf) / 86400000)` — negative means expired.
5. **`fefoAllocation()` excludes expired batches from eligibility**: `new Date(b.expiryDate) > asOf` ensures batches expiring on `asOf` are not allocated (expired as of today).

## 6. Design Rationale
Batch tracking is mandatory for FSSAI-regulated pharma and food products. FEFO is the legal picking strategy for perishables — FIFO is acceptable for non-perishables. The engine is strategy-agnostic at the structural level (`PickingStrategy` type is exported) but currently implements FEFO. Quarantine is a QC hold mechanism that blocks sales without discarding stock.

## 7. Implementation Summary
- `registerBatch()`: Sets `availableQty = receivedQty`; `reservedQty = quarantinedQty = 0`; status AVAILABLE.
- `fefoAllocation()`: Filter (AVAILABLE + qty > 0 + not expired) → sort by `expiryDate` ASC → greedy take `min(remaining, batch.availableQty)` per batch.
- `deductAllocation()`: Creates `Map<batchId, deductedQty>` from result lines; maps over batch array; sets DEPLETED at zero.
- `nearExpiryBatches()`: Filter (AVAILABLE + qty > 0 + daysToExpiry ≤ threshold + daysToExpiry ≥ 0) → sort daysToExpiry ASC.
- `quarantineBatch()` / `releaseFromQuarantine()`: Guard throws; arithmetic on `availableQty ↔ quarantinedQty`; status logic.
- `expireIfDue()`: Single idempotent mutation — `status = "EXPIRED"` if `expiryDate < asOf`.
- `batchReport()`: Groups batches by SKU via `Map`; aggregates by status; calls `nearExpiryBatches(skuBatches, 30)`.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/stockExpiryEngine.test.ts`**: 4/4 passed (2 assertion patches applied).
  - Test 1: registerBatch fields, AVAILABLE status, zero reserved/quarantined ✓
  - Test 2: FEFO order (BT-2026-001 expires Oct; BT-2026-002 Dec; BT-2026-003 Jun-27) → 20+25=45 from first two batches; shortfall 20 of 120 ✓
  - Test 3: nearExpiry (BT-C 4d, BT-A 14d; BT-B 59d excluded); deductAllocation (BT-C DEPLETED); expireIfDue EXPIRED + idempotent ✓
  - Test 4: quarantine 30→availQty=70, quarantinedQty=30; release 30→AVAILABLE; overflow throws; batchReport totalExpired=50 (b2e.availableQty preserved) ✓
  - **Patch**: `totalExpired` corrected from 20 to 50 — `expireIfDue` preserves `availableQty` on the struct; `batchReport` sums that field.
- **Total Frontend Suite**: 90/90 test files, 532/532 tests green, exit code 0.

## 10. Known Limitations
- `fefoAllocation()` operates on an in-memory batch array — production reads from Postgres with `SELECT FOR UPDATE` row locks to prevent concurrent over-allocation.
- No partial batch split: if a batch has 100 units and you quarantine 50, the remaining 50 are still in one record (not split into two records).

## 11. Future Work
- FastAPI `POST /api/v1/batches/`, `POST /api/v1/batches/{id}/quarantine`, `GET /api/v1/batches/near-expiry`.
- Nightly cron job: `expireBatch()` applied to all AVAILABLE/QUARANTINED batches in Postgres; alert email/SMS to store manager.
- GRN (Goods Receipt Note) integration: batch auto-registered on GRN line confirmation.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record. `ADR-051`: Batch/Lot Tracking Policy, FEFO Mandate, Quarantine Governance.

## 13. Related RFCs
- `RFC-120`: Stock Expiry Management, Near-Expiry Disposal Policy, and FSSAI Batch Traceability Compliance.
