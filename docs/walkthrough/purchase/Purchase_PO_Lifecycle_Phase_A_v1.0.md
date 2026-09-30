# Purchase_PO_Lifecycle_Phase_A_v1.0.md
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

## 1. Purpose

Implement Phase A of the SMRITI Purchase Order (PO) two-stage approval lifecycle.
New POs now save as **DRAFT** and must be explicitly **SUBMITTED** (DRAFT → SUBMITTED)
and then **CONFIRMED** (SUBMITTED → CONFIRMED) by an authorised MANAGER or SYSADMIN
before they have any operational effect on stock or financials.

Existing CONFIRMED/RECEIVED/CANCELLED POs are not touched.

---

## 2. Scope

| In Scope | Out of Scope |
|----------|-------------|
| New PO default status: DRAFT | Bulk-conversion of existing POs |
| `submit_purchase_order` service method (DRAFT → SUBMITTED) | Phase B: Status-aware workspace UI |
| `confirm_purchase_order` service method (SUBMITTED → CONFIRMED) | Phase C: Cancellation UI |
| Audit columns on `purchase_orders` | Phase D: Amendment/revision history |
| `/submit` + `/confirm` API endpoints (RBAC-guarded) | Phase E: Full RBAC matrix |
| Frontend SUBMITTED badge/state | |
| Alembic migration v1508 | |
| 20 Phase A tests | |

---

## 3. Files Created

| File | Purpose |
|------|---------|
| `backend/alembic/versions/v1508_po_lifecycle_submitted_columns.py` | Adds 8 audit columns to `purchase_orders` |

---

## 4. Files Modified

| File | Change Summary |
|------|---------------|
| `backend/app/models/purchase.py` | 8 audit columns added to `PurchaseOrder`; lifecycle docstring updated |
| `backend/app/schemas/purchase.py` | `PurchaseOrderConfirmRequest` added; audit fields added to `PurchaseOrderResponse` |
| `backend/app/services/purchase.py` | `create_purchase_order` defaults to DRAFT; new `submit_purchase_order` + `confirm_purchase_order` methods; `cancel_purchase_order` now writes audit columns |
| `backend/app/api/v1/purchase.py` | `/orders/{id}/submit` endpoint updated to DRAFT→SUBMITTED; new `/orders/{id}/confirm` endpoint |
| `backend/app/tests/test_purchase.py` | 20 Phase A tests added; `test_workflow_submit_purchase_order` assertion updated to expect `SUBMITTED` |
| `src/components/purchase/poLifecycle.ts` | `SUBMITTED` state added with badge colour and label |

---

## 5. Architecture Decisions

### AD-1: Two-Step Lifecycle Instead of Direct DRAFT→CONFIRMED
**Decision:** Insert `SUBMITTED` as an intermediate state.
**Rationale:** Supports maker-checker workflows common in Indian retail/wholesale. A Cashier or Data Entry Operator can draft a PO; only a Manager or Sysadmin can confirm it for fulfillment.

### AD-2: Audit Columns on `purchase_orders`, Not a Separate Table
**Decision:** Add `submitted_by/at`, `confirmed_by/at`, `cancelled_by/at`, `cancellation_reason` directly as nullable columns.
**Rationale:** Query simplicity — fetching a PO returns full audit trail in a single row. A separate audit table adds joins with no benefit at current data volumes. If a full event-sourced log is needed, Phase E will add `po_lifecycle_events`.

### AD-3: Role Guard at API Layer Only
**Decision:** Role check (`MANAGER` or `SYSADMIN`) in the API router via `require_role`; service layer is role-agnostic.
**Rationale:** Services stay testable without auth context. Tests can call service methods directly with explicit `submitted_by`/`confirmed_by` strings.

### AD-4: `parent_order_id` Added Now, Used in Phase D
**Decision:** Include `parent_order_id` FK in v1508 migration even though Phase D (amendment) is not yet implemented.
**Rationale:** Adding the column later would require a second migration disrupting data; adding it now (nullable, no FK enforcement yet) costs nothing and preserves schema evolution path.

---

## 6. Design Rationale

- **Safety first:** New default `status="DRAFT"` means no accidental stock commits.
- **Non-destructive:** `is_nullable=True` on all audit columns ensures existing POs are unaffected.
- **Self-guarded migration:** `_column_exists()` guard prevents double-application on already-migrated DBs.
- **Idempotent service methods:** Both `submit` and `confirm` raise `400` if the PO is already in the target state, preventing double-submit races.

---

## 7. Implementation Summary

1. Migration `v1508` adds 8 nullable columns to `purchase_orders`.
2. `PurchaseOrder` ORM model updated with new columns.
3. `PurchaseService.create_purchase_order()` now defaults `status="DRAFT"`.
4. `PurchaseService.submit_purchase_order()` transitions DRAFT → SUBMITTED and records `submitted_by` / `submitted_at`.
5. `PurchaseService.confirm_purchase_order()` transitions SUBMITTED → CONFIRMED and records `confirmed_by` / `confirmed_at`.
6. `PurchaseService.cancel_purchase_order()` now writes `cancelled_by`, `cancelled_at`, `cancellation_reason` in addition to the existing `notes` append.
7. Two new API endpoints (POST `/submit`, POST `/confirm`) wired with `get_current_user` to capture the actor's identity automatically.
8. Frontend `poLifecycle.ts` updated so the UI renders the `SUBMITTED` badge correctly.

---

## 8. Tests Executed

**Command:** `pytest backend/app/tests/test_purchase.py -v --tb=short`

**Run 1 (pre-workflow fix):** `4 failed, 45 passed in 92.78s`
**Run 2 (post-workflow fix):** `3 failed, 46 passed in 76.90s`

The 3 remaining failures (`parties.merged_into_party_id`) are a pre-existing schema drift fixed separately by migration v1509.

---

## 9. Verification Results

| Check | Evidence | Status |
|-------|----------|--------|
| Migration v1508 on smriti001 | `Running upgrade v1507 -> v1508`, exit 0 | Done |
| Migration v1508 on smriti002/003/004 | `Running upgrade v1507 -> v1508` ×3, exit 0 | Done |
| Column audit (8 columns, correct types) | `post_migration_evidence.py` output — all 8 present | Done |
| Existing PO data untouched | 57 POs; `submitted_by=NULL` on all | Done |
| 20 Phase A tests pass | `pytest` output lines T1–T20 PASSED | Done |
| `test_workflow_submit_purchase_order` | PASSED after assertion fix | Done |
| TypeScript compilation | `npx tsc --noEmit` exit 0 | Done |
| Commit pushed | `49899065` on `smritiNX` branch | Done |

---

## 10. Known Limitations

- `parent_order_id` column added but not yet enforced or used (Phase D).
- `SUBMITTED` state is not yet shown in the frontend PO list filter dropdowns (Phase B UI).
- The workflow bridge (`/workflow/PurchaseOrder/{id}/submit`) now returns `SUBMITTED`; any external integration that previously expected `CONFIRMED` from this endpoint must be updated.

---

## 11. Future Work

| Phase | Description |
|-------|------------|
| Phase B | Status-aware workspace: filter POs by DRAFT/SUBMITTED/CONFIRMED; action buttons per role |
| Phase C | Cancellation UI: reason picker, role-restricted cancel from SUBMITTED state |
| Phase D | Amendment/revision: use `parent_order_id` to link revised PO to predecessor |
| Phase E | Full RBAC matrix: per-tenant configurable approval roles |
| v1509 | `parties.merged_into_party_id` schema drift fix (done in this session) |

---

## 12. Related ADRs

- ADR-PUR-001: Purchase Order Two-Stage Approval Lifecycle (to be created)

---

## 13. Related RFCs

- RFC-PUR-2026-001: DRAFT→SUBMITTED→CONFIRMED Lifecycle (to be created)
