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

# ADR-POS-002: Deliberate Deferral of Database-Level Foreign Keys on ShiftCashTransaction GL References

**Status:** Accepted
**Date:** 2026-08-23
**Area:** ProPOS Cash Drawer

## Context

`ShiftCashTransaction` columns `account_id` and `gl_voucher_id` are plain nullable VARCHAR(50) with no FOREIGN KEY constraints.
Application-layer validation is enforced by POSService (account existence, type, activity), but the database engine does not enforce referential integrity.

## Decision

FK addition is deliberately deferred to a dedicated forward-only migration `v1360_pos_sct_fk_constraints`. It is not part of `v1346`.

## Rationale

1. Migration atomicity: FK ordering depends on accounting-table migrations from a separate domain.
2. Existing data safety: dynamic tenant provisioning may have SCT rows before ChartOfAccount rows exist in ephemeral DBs.
3. GL voucher lifecycle: `gl_voucher_id` is written after SCT flush; an immediate NOT NULL FK would require DEFERRABLE DDL not yet in the migration pipeline.
4. Application-layer enforcement is present and covers the business correctness requirements.

## Accepted Risks

| Risk | Mitigation |
|---|---|
| account_id references deleted account | App guards check is_active and is_deleted before write |
| gl_voucher_id NULL on failed GL post | GL failure raises HTTPException, SCT rolled back in same transaction |
| Orphan rows from migration bug | Forward-only policy (ADR-POS-001) prevents rollback; explicit repair migration required |

## Planned Resolution

Migration `v1360_pos_sct_fk_constraints` will add DEFERRABLE INITIALLY DEFERRED FK constraints after:
1. All active tenant DBs verified to have zero orphan account_id references.
2. All active tenant DBs verified to have zero NULL gl_voucher_id on CLOSED SCTs.
3. DEFERRABLE DDL syntax validated against Alembic render pipeline.

Scheduled: After Slice 8 (Accounting Module hardening) integration tests pass.

## Related

- ADR-POS-001: docs/adr/ADR-POS-001-Cash-In-Treasury-Float-Policy.md
- Migration: backend/alembic/versions/v1346_pos_cash_denominations.py
