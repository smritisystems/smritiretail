# Implementation Plan: Purchase Order Lifecycle — Phase A
<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-01
  Modified     : 2026-10-01
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

**Plan ID:** IMPL-PUR-2026-001-PhaseA
**Status:** Completed
**Lifecycle Version:** v1508
**Related Walkthrough:** `docs/walkthrough/purchase/Purchase_PO_Lifecycle_Phase_A_v1.0.md`

---

## 1. Objective

Replace the legacy single-step DRAFT→CONFIRMED PO creation with a two-stage
approval lifecycle: **DRAFT → SUBMITTED → CONFIRMED**, ensuring no PO can affect
stock or financials without explicit Manager/Sysadmin authorisation.

---

## 2. Business Motivation

- Enforces maker-checker control mandated for Indian GST-compliant procurement.
- Prevents accidental stock commits from unapproved draft purchase orders.
- Creates an auditable trail: who submitted and who confirmed each PO.
- Enables future Phase D amendment flow (via `parent_order_id`).

---

## 3. Scope

**In scope:**
- New PO default status: `DRAFT`
- New `SUBMITTED` intermediate state with audit columns
- Two new API endpoints (`/submit`, `/confirm`) with RBAC
- Alembic migration v1508 (8 columns)
- 20 Phase A automated tests
- Frontend `SUBMITTED` badge

**Out of scope (future phases):**
- Phase B: Status-aware workspace filters/UI
- Phase C: Cancellation workflow UI
- Phase D: Amendment/revision with `parent_order_id`
- Phase E: Configurable per-tenant RBAC matrix
- Conversion of existing CONFIRMED POs

---

## 4. Current State (Before Phase A)

- All new POs were created with `status="CONFIRMED"` immediately on save.
- No intermediate approval step existed.
- Cancel was only allowed on `CONFIRMED` POs (RECEIVED blocked).
- No actor audit columns on `purchase_orders`.
- `parties.merged_into_party_id` existed in ORM but not in DB schema (pre-existing drift).

---

## 5. Gap Analysis

| Gap | Resolution |
|-----|-----------|
| No DRAFT default on create | Service `create_purchase_order` now defaults to `DRAFT` |
| No SUBMITTED state in DB | Migration v1508 adds state; service enforces it |
| No audit trail on lifecycle events | 8 nullable audit columns added to `purchase_orders` |
| No `/confirm` endpoint | Added in `api/v1/purchase.py` |
| `/submit` skipped SUBMITTED (went direct to CONFIRMED) | Fixed in service |
| `parties.merged_into_party_id` missing from DB | Fixed by migration v1509 |

---

## 6. Architecture Impact

- `PurchaseOrder.status` now has 6 valid states: `DRAFT`, `SUBMITTED`, `CONFIRMED`, `RECEIVED`, `COMPLETED`, `CANCELLED`
- FastAPI + PostgreSQL remains the sole system of record (no Express, no in-memory)
- All calls go through `apiFetchV1.ts` (`/api/v1/*`)
- No new services or microservices introduced

---

## 7. Proposed Design

```
POST /api/v1/purchase/orders           → creates PO, status=DRAFT
POST /api/v1/purchase/orders/{id}/submit  → DRAFT → SUBMITTED  (MANAGER+)
POST /api/v1/purchase/orders/{id}/confirm → SUBMITTED → CONFIRMED (MANAGER+)
POST /api/v1/purchase/orders/{id}/cancel  → DRAFT|SUBMITTED|CONFIRMED → CANCELLED
```

Audit columns populated at each transition:
```
submit  → submitted_by, submitted_at
confirm → confirmed_by, confirmed_at
cancel  → cancelled_by, cancelled_at, cancellation_reason
```

---

## 8. Files Created

| File | Description |
|------|------------|
| `backend/alembic/versions/v1508_po_lifecycle_submitted_columns.py` | Migration: 8 audit columns |
| `backend/alembic/versions/v1509_parties_merged_into_party_id.py` | Migration: `parties.merged_into_party_id` schema drift fix |
| `docs/walkthrough/purchase/Purchase_PO_Lifecycle_Phase_A_v1.0.md` | WGP walkthrough |
| `docs/implementation/purchase/PO_Lifecycle_Phase_A_v1.0.md` | This document |

---

## 9. Files Modified

| File | Change |
|------|--------|
| `backend/app/models/purchase.py` | 8 audit columns; lifecycle docstring |
| `backend/app/schemas/purchase.py` | `PurchaseOrderConfirmRequest`; response audit fields |
| `backend/app/services/purchase.py` | DRAFT default; `submit_purchase_order`; `confirm_purchase_order`; cancel audit |
| `backend/app/api/v1/purchase.py` | `/submit` updated; `/confirm` added |
| `backend/app/tests/test_purchase.py` | 20 Phase A tests; workflow assertion fix |
| `src/components/purchase/poLifecycle.ts` | SUBMITTED badge/state |

---

## 10. Dependencies

| Dependency | Version | Notes |
|-----------|---------|-------|
| PostgreSQL | 14+ | `TIMESTAMPTZ`, `JSONB` support required |
| SQLAlchemy | 2.x async | Used for ORM + async session |
| Alembic | 1.x | Migration chain v1507→v1508→v1509 |
| FastAPI | 0.100+ | Depends injection for `get_current_user` |
| pytest-asyncio | 0.x | All 49 tests async |

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Existing integrations expect `/submit` to return `CONFIRMED` | Medium | Medium | Workflow test updated; other integrations should be checked |
| `SUBMITTED` POs accumulate (never confirmed) | Low | Low | Phase B will add workspace view with pending approval queue |
| Race condition: double-submit | Low | Low | Service raises 400 if order is not DRAFT; DB not locked but idempotent |

---

## 12. Rollback Strategy

```bash
# 1. Rollback migration on each tenant DB
python -m alembic -x target=tenant -x db=smriti001 downgrade v1507

# 2. Git revert commit 49899065
git revert 49899065 --no-edit

# 3. Push
git push
```

The downgrade script drops all 8 audit columns from `purchase_orders` and removes the `parent_order_id` FK index. Existing PO data is safe (all audit columns were NULL for pre-existing rows).

---

## 13. Verification Plan

| Check | Method | Result |
|-------|--------|--------|
| Migration applies cleanly | `alembic upgrade v1508` on smriti001–004 | Pass (exit 0 ×4) |
| Column audit (Rule 12) | `post_migration_evidence.py` | 8/8 columns, correct types |
| Existing PO data intact | `submitted_by IS NOT NULL` count | 0 (57 POs untouched) |
| Phase A tests | `pytest test_purchase.py` | 20/20 PASSED |
| No TypeScript errors | `npx tsc --noEmit` | 0 errors |

---

## 14. Test Plan

| Test ID | Scenario | Expected |
|---------|----------|---------|
| T1 | Create PO → status | `DRAFT` |
| T2 | GET created PO | `status=DRAFT` |
| T3 | Re-save DRAFT | Still `DRAFT` |
| T4 | DRAFT → no stock movement | `0` stock change |
| T5 | DRAFT → stock unchanged | baseline stock preserved |
| T6 | Submit DRAFT | `status=SUBMITTED` |
| T7 | After submit, `submitted_by` | populated |
| T8 | After submit, `submitted_at` | populated (non-null) |
| T9 | CASHIER tries submit | `403` |
| T10 | Confirm SUBMITTED | `status=CONFIRMED` |
| T11 | After confirm, `confirmed_by` | populated |
| T12 | CASHIER tries confirm | `403` |
| T13 | Confirm DRAFT directly | `400` |
| T14 | Submit already-CONFIRMED PO | `400` |
| T15 | Full lifecycle DRAFT→SUBMIT→CONFIRM | end status `CONFIRMED` |
| T16 | Existing CONFIRMED PO | unchanged after migration |
| T17 | Existing CANCELLED PO | unchanged after migration |
| T18 | Cancel stores reason in column | `cancellation_reason` populated |
| T19 | DRAFT → no accounting entry | 0 ledger rows |
| T20 | Cancel DRAFT PO | `status=CANCELLED` |

---

## 15. Documentation Impact

| Document | Updated? |
|----------|---------|
| Walkthrough | Created (`Purchase_PO_Lifecycle_Phase_A_v1.0.md`) |
| Implementation Plan | Created (this file) |
| CHANGELOG.md | To be appended |
| Walkthrough Index | To be appended |
| Implementation Index | To be appended |

---

## 16. Deployment Plan

1. Apply migration `v1508` to all tenant DBs via Alembic
2. Deploy backend code (commit `49899065`)
3. Deploy frontend build
4. Verify `smriti001` column audit via `post_migration_evidence.py`
5. Monitor `/submit` and `/confirm` endpoint logs for first real PO submissions

---

## 17. Status

**Completed** — commit `49899065` pushed to `smritisystems/smritiretail` on branch `smritiNX`.

---

## 18. Related ADRs

- ADR-PUR-001 (to be filed): Two-Stage PO Approval Lifecycle

---

## 19. Related Walkthroughs

- [`Purchase_PO_Lifecycle_Phase_A_v1.0.md`](../../../docs/walkthrough/purchase/Purchase_PO_Lifecycle_Phase_A_v1.0.md)
