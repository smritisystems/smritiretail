<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.119.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Customer Credit Limit & Outstanding Engine (v1.0.0-GA)

## 1. Purpose
Documents the Customer Credit Engine — B2B credit lifecycle including limit assignment, invoice posting, FIFO payment allocation, 5-bucket aging, credit hold/release, and cross-account aging reports.

## 2. Scope
- `CustomerCreditEngine` covering `setLimit()`, `postInvoice()`, `postPayment()`, `refreshAging()`, `holdCredit()`, `releaseCredit()`, `agingReport()`.
- 5 aging buckets: CURRENT, OVERDUE_30 (1–30d), OVERDUE_60 (31–60d), OVERDUE_90 (61–90d), CRITICAL (>90d).
- `utilisationPct = outstandingAmt / creditLimit × 100`; `limitBreached = outstandingAmt > creditLimit`.
- FIFO payment: oldest invoices (by dueDate) allocated first; `PaymentAllocation[]` per payment.
- `CustomerCreditModal`: account sidebar (utilisation bar, breach badge), 3-tab (Invoices + payment form, Aging Report, Payment history).

## 3. Files Created
- `src/utils/customerCreditEngine.ts`
- `src/components/crm/CustomerCreditModal.tsx`
- `src/tests/customerCreditEngine.test.ts`
- `docs/walkthrough/crm/Customer_Credit_Engine_v1.0.0.md`

## 4. Files Modified
- `docs/walkthrough/README.md`, `docs/implementation/README.md`, `CHANGELOG.md`

## 5. Architecture Decisions
1. **`recalcAccount()` is called after every mutation that changes outstanding balance**: Rather than manually updating `outstandingAmt` field-by-field, `recalcAccount()` recomputes from `invoices[]` (filtering out PAID/WRITTEN_OFF). This eliminates drift between individual invoice states and the account-level summary.
2. **FIFO allocation sorts by `dueDate` ASC**: Oldest invoices are paid first — this is the standard accounts-receivable practice. Paying the newest invoices first (LIFO) would leave old overdue balances aging indefinitely.
3. **`postInvoice()` throws if account is ON_HOLD or SUSPENDED**: The credit hold mechanism is a hard gate. There is no "force post" API — a credit manager must explicitly release the hold before new invoices can be posted.
4. **`dueDate` is computed from `invoiceDate + paymentTermDays`**: This is done in `postInvoice()` at posting time, not at query time. Changing `paymentTermDays` on the account does not retroactively change existing invoice due dates.
5. **`refreshAging()` returns a new account object without persisting**: Aging buckets are refreshed at query time (or on explicit call). Production runs `refreshAging()` on every read from the credit account endpoint.
6. **`agingReport()` calls `refreshAging()` internally per account**: This ensures the report always reflects the current date's aging, not the cached state from when invoices were posted.

## 6. Design Rationale
B2B credit is a top source of bad debt in retail. The utilisation bar in the UI gives the credit manager an instant visual signal before approving a new order. The `limitBreached` flag drives the credit-hold recommendation workflow. FIFO allocation is the industry standard for AR ageing — it prevents old invoices from being hidden by new payments.

## 7. Implementation Summary
- `setLimit()`: Creates account with `outstandingAmt=0`, `availableCredit=creditLimit`, `utilisationPct=0`, `limitBreached=false`.
- `postInvoice()`: Throws if ON_HOLD/SUSPENDED; `dueDate = new Date(invoiceDate).getTime() + paymentTermDays * 86400000`; `computeAgingBucket(dueDate, asOf)`; appends to `invoices[]`; calls `recalcAccount()`.
- `postPayment()`: Filters unpaid invoices; sorts by `dueDate` ASC; greedy allocation via `Map<invoiceId, updatedInvoice>`; builds `PaymentAllocation[]`; appends `CreditPaymentRecord` to `payments[]`; calls `recalcAccount()`.
- `refreshAging()`: Remaps invoices with `computeAgingBucket(i.dueDate, asOf)`; updates `status = OVERDUE` for overdue OPEN invoices; calls `recalcAccount()`.
- `holdCredit()` / `releaseCredit()`: Status transitions; `holdReason` cleared on release.
- `agingReport()`: Maps accounts through `refreshAging()`; builds 5-bucket `{ count, totalAmt }` per account.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/customerCreditEngine.test.ts`**: 4/4 passed (1 assertion patch applied).
  - Test 1: setLimit (creditLimit=100000); postInvoice ₹60000 → utilisationPct=60; second ₹50000 → limitBreached=true, utilisationPct=110 ✓
  - Test 2: FIFO — postPayment ₹50000 on two invoices (₹40000 due Jul-01, ₹60000 due Jul-31) → INV-0010 fully paid; INV-0011 partial ₹50000; allocations[0]=₹40000, allocations[1]=₹10000; outstanding=₹50000; utilisationPct=25 ✓
  - Test 3: refreshAging — INV-A (May-01+30d=May-31 due, 89d overdue→OVERDUE_90); INV-B (Jun-01+30d=Jul-01 due, 58d→OVERDUE_60); holdCredit→postInvoice throws ON_HOLD; releaseCredit→status=ACTIVE, holdReason=undefined ✓
  - Test 4: agingReport — Vendor A (outstanding=₹60000, breached, OVERDUE_90 bucket=₹60000); Vendor B (outstanding=₹40000, utilisationPct=50, CURRENT bucket=₹40000) ✓
  - **Patch**: Test 3 `daysOverdue` corrected from 88 to 89 — `invoiceDate="2026-05-01" + 30d → dueDate="2026-05-31"`; asOf Aug-28 = 89 full days.
- **Total Frontend Suite**: 90/90 test files, 532/532 tests green, exit code 0.

## 10. Known Limitations
- `postPayment()` does not support partial allocation with a remainder unapplied (overpayment/advance). Excess payment beyond all outstanding invoices is silently discarded.
- `agingReport()` calls `refreshAging()` per account without caching — `O(n × m)` where n=accounts, m=invoices. Production uses a materialised aging view in Postgres.

## 11. Future Work
- FastAPI `POST /api/v1/credit-accounts/`, `POST /api/v1/credit-accounts/{id}/invoices`, `POST /api/v1/credit-accounts/{id}/payments`, `GET /api/v1/credit-accounts/aging-report`.
- Advance/overpayment handling: excess payment stored as `advanceBalance`; applied to next invoice automatically.
- Credit hold workflow integration: POS blocks `New Sale` for customers with `status === ON_HOLD`.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record. `ADR-053`: Customer Credit Policy, FIFO Allocation Standard, Aging Bucket Definitions, and Credit Hold Governance.

## 13. Related RFCs
- `RFC-122`: B2B Credit Programme, Payment Terms Matrix, Bad Debt Provisioning Policy, and Credit Risk Scoring.
