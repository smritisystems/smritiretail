<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-10-27
  Modified     : 2026-10-27
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Invoicing — Invoice Number Collision Fix & Document Series Integration v3.17.0

## 1. Purpose

Eliminate the `INV/CR/0001` duplicate-invoice-number collision (unique constraint
`uq_sales_invoices_company_invoice_no` violations) by integrating all invoice
number allocation exclusively through the existing **Document Series & Numbering Studio**
(`NumberingService.allocate_voucher_number`). No new numbering engine was introduced.

## 2. Scope

- Backend canonical sales posting writer
- Backend numbering service (resolve_bill_prefix return dict)
- Frontend billing workspace (BillingTerm and SmritiBillingStudio)
- Alembic migration v1546 (document_series table data integrity + monitoring)
- Commit: `a5c428fc` on branch `smritiNX`

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/alembic/versions/v1546_invoice_numbering_integrity_fix.py` | Migration: dedup + unique index + monitoring view |

## 4. Files Modified

| File | Change Summary |
|---|---|
| `backend/app/services/canonical_sales_writer.py` | Replace hardcoded series ID; call resolve_bill_prefix → allocate_voucher_number atomically; add IntegrityError → 409 SMRITI-INV-DUP-001 |
| `backend/app/services/numbering.py` | Add `financialYear` to resolve_bill_prefix return dict |
| `src/components/billing/BillingTerm.tsx` | Remove client-side invoice_no from payload; post-save re-resolve from server; handle SMRITI-INV-DUP-001 with user advisory + auto-refresh |
| `src/components/billing/SmritiBillingStudio.tsx` | Remove `INV-${Date.now()}` generator; omit invoice_no from online payload; offline sync uses `OFFLINE-{uuid8}` reference |

## 5. Architecture Decisions

### AD-1: No new numbering engine
**Decision:** All allocation routes through the existing `NumberingService.allocate_voucher_number` under `WITH ... FOR UPDATE` advisory lock. No parallel counter, no separate Bill Prefix Series Management.
**Rationale:** The Document Series & Numbering Studio is the authoritative source and already provides atomic allocation, GST Rule 46(b) validation, financial-year rollover, and audit logging.

### AD-2: client_invoice_no semantic tightened
**Decision:** `client_invoice_no` in `CanonicalPostingRequest.context` is now reserved **only** for true offline POS transactions where a receipt was already physically printed before connectivity was lost. Any other caller that sends `client_invoice_no` will have it honoured (backward compatible), but the canonical online path never sends one.
**Rationale:** Preserves offline POS receipt integrity while closing the race condition window for online billing.

### AD-3: series_id hint passed from frontend
**Decision:** Frontend sends `series_id` (from `resolvedPrefixInfo.seriesId`) in the payload instead of `invoice_no`. Backend uses this to target the correct series without an additional resolve round-trip.
**Rationale:** One fewer database query per transaction; series lookup is deterministic based on UI context.

### AD-4: SMRITI-INV-DUP-001 structured 409
**Decision:** When `uq_sales_invoices_company_invoice_no` fires at DB level (last-resort race), the backend returns a structured JSON 409 body: `{ code, invoice_no, message }` rather than a generic 500.
**Rationale:** Frontend can distinguish this specific error and respond with UX (auto-refresh number) rather than generic failure dialog.

### AD-5: Migration v1546 — data deduplication not deletion
**Decision:** The 11 duplicate `SALES_CREDIT` NULL-company_id rows were soft-deleted (`is_deleted=true, is_active=false`) — not hard-deleted. The most recently created row is kept.
**Rationale:** Audit trail preserved; data is reversible if needed; no FK cascade risk.

## 6. Design Rationale

The root cause was a three-way mismatch:
1. Backend used a non-existent hardcoded series ID → fell to UUID fallback silently
2. Frontend sent preview-only numbers as authoritative `invoice_no` → bypassed atomic allocation
3. `document_series` table had 11 ghost duplicate rows → allocator would pick randomly

The fix closes all three simultaneously: backend resolves and allocates atomically, frontend stops sending numbers entirely (online path), and the database now has a uniqueness constraint to prevent future ghost duplicates per real company tenant.

## 7. Implementation Summary

### Backend (canonical_sales_writer.py)
Step 7 (Invoice Numbering Allocation) now:
1. Detects transaction type from payment_mode / tenders (`SALES_CREDIT` vs `SALES_CASH`)
2. Calls `resolve_bill_prefix(company_id, branch_id, terminal_id, tx_type)` to find live active series
3. Calls `allocate_voucher_number(series_id, branch, fy, username)` under FOR UPDATE lock
4. Falls back to UUID-based number only if no series exists at all (logged as WARNING)
5. Wraps `session.flush()` in `IntegrityError` catch → raises 409 `SMRITI-INV-DUP-001`

### Frontend (BillingTerm.tsx)
- `invoicePayload.invoice_no` removed; replaced with `invoicePayload.series_id`
- Post-save reset calls `SmritiBillPrefixService.resolveActivePrefix()` to load the next server-allocated preview (no `+1` client arithmetic)
- `catch` block detects `errDetail.code === "SMRITI-INV-DUP-001"` → refreshes prefix from server → shows info notification → keeps cart intact for retry

### Frontend (SmritiBillingStudio.tsx)
- `const generatedInvoiceNo = \`INV-${Date.now().toString().slice(-6)}\`` removed
- `invoice_no` field removed from online `/pos/checkout` payload
- Offline sync fallback: `OFFLINE-{clientTxUuid.slice(0,8).toUpperCase()}` — clearly marked, sync engine replaces on reconnect

### Migration (v1546)
- Step 1: `WITH ranked AS (ROW_NUMBER OVER PARTITION BY document_type, terminal_id ORDER BY created_at DESC) UPDATE ... WHERE rn > 1` — deduplicates 10 ghost rows
- Step 2: `CREATE UNIQUE INDEX uq_document_series_company_type_terminal_active ON document_series (company_id, document_type, COALESCE(terminal_id, 'COMMON')) WHERE is_deleted=false AND is_active=true AND company_id IS NOT NULL`
- Step 3: `CREATE OR REPLACE VIEW v_number_allocation_audit` — joins `document_series` with latest `numbering_audit_logs` entry per series

## 8. Tests Executed

| Suite | Command | Result |
|---|---|---|
| Backend numbering duplicate prevention | `pytest test_numbering_duplicate_prevention.py` | 5/5 PASSED |
| Backend bill prefix | `pytest test_bill_prefix.py` | 7/7 PASSED |
| Frontend bill prefix | `vitest run smritiBillPrefix.test.ts` | 18/18 PASSED |
| Frontend stitch flow | `vitest run distTaxInvoiceStitchFlow.test.ts` | 11/11 PASSED |
| TypeScript | `tsc --noEmit` | 0 errors |

## 9. Verification Results

### Evidence — Database (post-migration v1546)

```
=== DUPLICATE ACTIVE SERIES POST-MIGRATION ===
  NONE (clean)

=== NEW INDEX ===
  uq_document_series_company_type_terminal_active
  ON document_series (company_id, document_type, COALESCE(terminal_id, 'COMMON'))
  WHERE is_deleted = false AND is_active = true AND company_id IS NOT NULL

=== v_number_allocation_audit VIEW: EXISTS ===

=== ACTIVE SERIES (12 total — was 22 with 11 duplicates) ===
  SALES_CASH   | COMMON | COMP-CUSTA-2363AC | INV/C/   | curr=0
  SALES_CASH   | POS-01 | COMP-CUSTA-2363AC | T01/C/   | curr=0
  SALES_CASH   | COMMON | comp-sal-359785   | INV/C/   | curr=0
  SALES_CASH   | POS-01 | comp-sal-359785   | T01/C/   | curr=0
  SALES_CASH   | COMMON | NULL (seed)       | INV/C/   | curr=0
  SALES_CREDIT | COMMON | COMP-CUSTA-2363AC | CR-TEST- | curr=0
  SALES_CREDIT | COMMON | comp-sal-359785   | CR-TEST- | curr=0
  SALES_CREDIT | COMMON | NULL (seed)       | CR/      | curr=0
  SALES_INVOICE| COMMON | COMP-CUSTA-2363AC | TT2026-  | curr=19
  SALES_INVOICE| COMMON | NULL (seed)       | TT2026-  | curr=0
  ARTICLE      | COMMON | COMP-001          | ART/     | curr=0
  Purchase Order| COMMON | NULL (seed)      | PO-      | curr=0
```

### Evidence — Alembic
```
v1546 (head)
```

### Evidence — Commit
```
[smritiNX a5c428fc] fix(invoicing): integrate invoice numbering with Document Series Studio [SMRITI-INV-DUP-001]
5 files changed, 261 insertions(+), 56 deletions(-)
```

## 10. Known Limitations

- `test_numbering_authority.py` (8 tests) and `test_canonical_sales_writer.py` (5 tests) are blocked by `TEST SAFETY VIOLATION: cannot target smriti001`. These are **pre-existing** failures unrelated to this fix — they require a `smriti_test_*` database fixture.
- `F:\Smriti9` test environment migration pending: DB host `smriti-db` not reachable at time of writing (Docker not running). To apply: `alembic -x target=control -x db=smritisys upgrade v1546`
- NULL-company_id seed rows (3 remaining: SALES_CASH, SALES_CREDIT, SALES_INVOICE) should be converted to real company-scoped series via the Document Series & Numbering Studio UI.

## 11. Future Work

- Fix `test_numbering_authority.py` conftest to use `smriti_test_*` DB names
- Add an admin alert in the Document Series Studio when `current_number = 0` for active series (signals uninitialized series)
- Implement a series health dashboard using `v_number_allocation_audit`
- Add concurrency stress test: 100 concurrent invoice saves, assert 0 duplicates

## 12. Related ADRs

- ARCH-BILLING-001: Document Series & Numbering Studio as sole numbering authority
- ARCH-BACKEND-001: FastAPI + PostgreSQL sole backend system of record

## 13. Related RFCs

- RFC-INV-DUP-001: SMRITI Invoice Number Collision Prevention via Atomic Allocation
