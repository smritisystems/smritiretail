<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.113.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Supplier Payment Terms & Aging Engine (v1.0.0-GA)

## 1. Purpose
Documents the Supplier Payment Engine — vendor invoice lifecycle with payment term-based due date computation, 5-bucket aging, early-pay discount capture, due calendar, and per-vendor aging report.

## 2. Scope
- `SupplierPaymentEngine` covering `createInvoice()`, `recordPayment()`, `refreshAging()`, `buildDueCalendar()`, `vendorAgingReport()`.
- Terms: NET_30 / NET_45 / NET_60 / NET_90 / IMMEDIATE / CUSTOM.
- Aging: CURRENT (0d), OVERDUE_30 (1–30d), OVERDUE_60 (31–60d), OVERDUE_90 (61–90d), CRITICAL (>90d).
- Early-pay discount: `daysFromInvoice ≤ earlyPayCutoffDays → earlyPayDiscountPct %` applied to payment amount.
- `SupplierPaymentModal` with Invoice sidebar, Invoices tab (KPI + payment form + early-pay preview + payment history), Aging Report tab (per-vendor 5-bucket grid), Due Calendar tab (due-date grouped with overdue highlight).

## 3. Files Created
- `src/utils/supplierPaymentEngine.ts`
- `src/components/procurement/SupplierPaymentModal.tsx`
- `src/tests/supplierPaymentEngine.test.ts`
- `docs/walkthrough/procurement/Supplier_Payment_Aging_v1.0.0.md`

## 4. Files Modified
- `src/tests/supplierPaymentEngine.test.ts` (patch: Test 3 assertion corrected from OVERDUE_30 to OVERDUE_60 — May-31 to Jul-15 = 45 days overdue → 31–60d band)
- `docs/implementation/README.md`, `docs/walkthrough/README.md`, `CHANGELOG.md`

## 5. Architecture Decisions
1. **`computeDueDate()` is called once at `createInvoice()` and stored**: Due date is fixed at creation time — subsequent aging is always relative to the stored `dueDate`, not re-computed from `invoiceDate + terms`. This prevents due date drift if `terms` were hypothetically changed.
2. **`refreshAging()` returns a new array; it never mutates in place**: Designed to be called from both the UI (on date change) and a background cron — pure function, safe to memoize.
3. **Early-pay discount is computed and stored per payment, not per invoice**: The discount applied to payment P depends on when P was made, not the invoice's overall payment status. Separate storage enables partial-payment early-pay scenarios.
4. **`buildDueCalendar()` filters to outstanding invoices**: PAID invoices are excluded — the calendar is a forward-looking payment planning tool, not a historical ledger.
5. **`vendorAgingReport()` internally calls `refreshAging()`**: Ensures the report always reflects current aging even if the caller forgot to refresh — "defensive freshness" prevents stale aging data in reports.
6. **Bucket boundary for OVERDUE_30 is 1–30d (not 0–30d)**: `daysOverdue === 0` → CURRENT; `1–30` → OVERDUE_30. This is consistent with standard AP aging conventions where "current" means "not yet past due date."

## 6. Design Rationale
Unmanaged payables are a cash flow risk. The 5-bucket aging report gives finance teams an at-a-glance view of exposure concentration — a large CRITICAL bucket is an early warning of supplier relationship damage and potential supply disruption. Early-pay discounts (typically 1–2%) create a direct incentive to prioritise well-funded invoices.

## 7. Implementation Summary
- `createInvoice()`: Computes `dueDate = invoiceDate + termsDays`; calls `computeAgingBucket(dueDate, asOf)` for initial bucket.
- `recordPayment()`: Computes `daysFromInvoice`; applies early-pay discount if within cutoff; updates `paidAmt`, `outstandingAmt`; sets status PARTIALLY_PAID/PAID.
- `refreshAging()`: Maps over non-PAID invoices; recomputes `agingBucket` and `daysOverdue`; sets OVERDUE status if past due and still UNPAID.
- `buildDueCalendar()`: Groups outstanding by `dueDate`; sorts by date ascending; sums `outstandingAmt` per date.
- `vendorAgingReport()`: Groups by `vendorId` after refresh; maps 5 buckets per vendor; computes `totalOutstanding`, `criticalAmt`, `oldestDueDays`.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results (after bucket assertion patch)
- **`src/tests/supplierPaymentEngine.test.ts`**: 4/4 tests passed.
  - Test 1: NET_30 invoice — dueDate=2026-08-31, CURRENT bucket, outstandingAmt=50000 ✓
  - Test 2: Early-pay day 8 → 2% discount ₹1600, netPaid=78400, status=PAID ✓
  - Test 3: May-31+30d=May-31→Jul-15 = 45d overdue → OVERDUE_60 (patched); Aug-08 = 130d overdue → CRITICAL ✓
  - Test 4: Calendar Aug-28 entry totalDue=50000 (2 invoices); vendor report totalOutstanding=65000; OVERDUE_60 bucket=15000 ✓
- **Total Frontend Suite**: 84/84 test files, 508/508 tests green in 14.84s, exit code 0.

## 10. Known Limitations
- `daysFromInvoice` uses 86400000ms per day — ignores DST transitions. Production uses Postgres `EXTRACT(day FROM paidOn - invoiceDate)`.
- No invoice dispute workflow — `DISPUTED` status exists in the type but no `dispute()` method in this release.

## 11. Future Work
- FastAPI `POST /api/v1/supplier-invoices/`, `POST /api/v1/supplier-invoices/{id}/payments`, `GET /api/v1/supplier-invoices/aging-report`.
- Nightly aging refresh cron with configurable CRITICAL escalation email.
- `dispute()` method with reason, raised-by, and resolution date.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record. `ADR-047`: Supplier Payable Aging Bucket Definitions, Early-Pay Discount Policy, and Due Calendar Governance.

## 13. Related RFCs
- `RFC-116`: Supplier Payment Terms Governance, Aging Escalation Protocol, and Early-Pay Programme Configuration.
