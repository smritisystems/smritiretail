<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.22.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# ADR-POS-002: Foreign Key Constraints and Referential Integrity on ShiftCashTransaction GL References

**Status:** Accepted
**Date:** 2026-08-23
**Area:** ProPOS Cash Drawer & Accounting Integration

## Context

`ShiftCashTransaction` columns `account_id` and `gl_voucher_id` logically reference `accounts.id` (Chart of Accounts) and `journal_vouchers.id` (General Ledger Vouchers).
Application-layer validation is enforced by `POSService` and `UnifiedAccountingLedgerService` (account existence, active status, and GL double-entry posting).

## Decision

Database-level referential integrity is established via migration `v1360_pos_sct_fk_constraints`:
1. Foreign key `fk_sct_account_id` referencing `accounts(id)` ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED.
2. Foreign key `fk_sct_gl_voucher_id` referencing `journal_vouchers(id)` ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED.
3. Forward-only migration policy: `downgrade()` is explicitly blocked to prevent orphan reference accumulation.

## Rationale

1. **Transaction Lifecycle Alignment**: DEFERRABLE INITIALLY DEFERRED ensures that during async flush/commit workflows, both `ShiftCashTransaction` and `JournalVoucher` entries are verified at transaction commit time.
2. **Canonical Schema Target**: The canonical Chart of Accounts table in SMRITI is `accounts` (created in `v1343_accounting_gl`), and the journal voucher table is `journal_vouchers`.
3. **Safety & Zero-Orphan Preconditions**: Prior to applying `v1360`, live tenant databases (`smriti001`, `smriti002`) are verified to have 0 orphan account references and 0 orphan voucher references.

## Precondition & Verification Queries

```sql
-- Precondition 1: Zero orphan account references
SELECT COUNT(*) FROM shift_cash_transactions sct
  LEFT JOIN accounts acc ON acc.id = sct.account_id
 WHERE sct.account_id IS NOT NULL AND acc.id IS NULL;

-- Precondition 2: Zero orphan journal voucher references
SELECT COUNT(*) FROM shift_cash_transactions sct
  LEFT JOIN journal_vouchers jv ON jv.id = sct.gl_voucher_id
 WHERE sct.gl_voucher_id IS NOT NULL AND jv.id IS NULL;
```

## Related

- ADR-POS-001: `docs/adr/ADR-POS-001-Cash-In-Treasury-Float-Policy.md`
- Migration: `backend/alembic/versions/v1360_pos_sct_fk_constraints.py`
- Models: `backend/app/models/pos.py`, `backend/app/models/accounting.py`
