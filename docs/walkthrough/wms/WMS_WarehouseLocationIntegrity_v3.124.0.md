<!--
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 3.124.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
-->

# WMS Warehouse & Location Integrity Hardening — Walkthrough v3.124.0

**Date:** 2026-10-27  
**Commits:** `ce17e985`, `aaa2d31e`  
**Remediation IDs:** R-001, R-002, R-004, R-006, R-007, R-011, R-012, R-013, R-014  
**Phase:** Implementation (Audit → Approve → Implement)  

---

## 1. Purpose

Apply the eight unambiguous P1/P2 fixes surfaced by the Warehouse & Location Audit
(2026-10-27) that do not require business-decision input. Items requiring business
decisions (R-003 GRN nullable warehouse, R-005 transfer approval gates) are deferred
pending owner sign-off.

---

## 2. Scope

Backend Python services, schemas, and Alembic migrations. One frontend TSX component
(WmsStudioTab GRN form). No database schema was altered directly — all DB changes
are delivered via governed Alembic migrations (v1557, v1558, v1559).

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/alembic/versions/v1557_item_warehouse_location_integrity.py` | R-002 + R-006 migrations |
| `backend/alembic/versions/v1558_warehouse_default_for_branch.py` | R-007 migration |
| `backend/alembic/versions/v1559_pos_parked_cart_branch_fk.py` | R-014 migration |

---

## 4. Files Modified

| File | Remediation(s) | Change Summary |
|---|---|---|
| `backend/app/services/inventory_warehouse_resolver.py` | R-001, R-007 | Prefer `warehouse_id` FK over legacy text; prefer `is_default_for_branch`; remove duplicate fallback block |
| `backend/app/models/inventory.py` | R-007 | Add `is_default_for_branch` column + partial unique index to `Warehouse` |
| `backend/app/models/pos.py` | R-014 | Add `ForeignKey("branches.id", ondelete="RESTRICT")` to `POSParkedCart.branch_id` |
| `backend/app/api/v1/wms.py` | R-012, R-013 | Stock-movement reference guard on location delete; deactivate endpoint with stock-zero gate; add `func` import |
| `backend/app/schemas/wms.py` | R-007 | `is_default_for_branch` in `WarehouseBase`/`WarehouseUpdate`/`WarehouseResponse`; `location_count` in response |
| `backend/app/schemas/pos.py` | R-001 | `warehouse_id` field in `POSProfileCreate`/`POSProfileResponse`; `from_register` populates it |
| `backend/app/services/pos.py` | R-001 | `update_profile` writes `warehouse_id` FK when supplied; legacy text compat retained |
| `src/components/wms/WmsStudioTab.tsx` | R-011 | Remove hardcoded test supplier/qty/cost defaults; add supplier+warehouse validation guards |

---

## 5. Architecture Decisions

- **Backward compatibility first**: All resolver and service changes maintain full backward
  compat with existing `warehouse` text data. The FK path is preferred but the legacy
  path is not removed. Removal is a separate migration task once all registers are backfilled.

- **Partial unique index** for `is_default_for_branch`: Using PostgreSQL conditional unique
  index `WHERE is_default_for_branch = true AND is_deleted = false` rather than a `CHECK`
  constraint. This allows multiple warehouses with `is_default_for_branch = false` per branch
  (the normal case) while enforcing at most one default.

- **R-012 soft-delete guard is a 409 not a 404**: The location exists but the business rule
  prevents the action. Directing operators to use `is_active=false` instead of deleting
  preserves the audit trail without the complexity of hard-delete cascade management.

- **R-013 deactivate as a separate PATCH endpoint**: The existing PUT /warehouses/{id}
  allows setting `is_active=false` without the stock-zero check. Rather than breaking that
  existing API, a new governed PATCH `/warehouses/{id}/deactivate` endpoint is introduced
  that enforces the gate. This follows the strangler-fig migration approach: the new endpoint
  becomes the canonical path; the PUT compat remains for non-destructive field edits.

---

## 6. Design Rationale

- **R-001 resolver fix is highest impact / lowest risk**: Zero business logic change —
  the warehouse returned is still the same warehouse (just found via the FK instead of a
  text match). Risk is near-zero if `warehouse_id` is not populated on existing registers,
  since the fallback to the text field is preserved.

- **R-006 company_id in unique constraint**: A constraint over `(item_id, warehouse_id)`
  with no `company_id` would allow cross-company collision in a shared-DB tenancy model.
  The replacement `(company_id, item_id, warehouse_id)` is strictly more correct and
  non-destructive for existing single-company deployments.

---

## 7. Implementation Summary

**Phase 1 (commit ce17e985):** Core integrity fixes — resolver, model column, migrations,
location delete guard, deactivate endpoint, GRN form hardening, POSParkedCart FK.

**Phase 2 (commit aaa2d31e):** Schema propagation — `is_default_for_branch` and
`warehouse_id` exposed through WMS and POS schemas; POS service dual-column write fix.

---

## 8. Tests Executed

No automated test suite was run in this session (pre-existing baseline — Unverified).
Manual code inspection confirmed:

- `inventory_warehouse_resolver.py` branching logic covers all 4 fallback levels
- Migration downgrade paths are fully reversible
- `func.count` import added before use in R-012 guard
- `ProductBatchStock` arithmetic in R-013 gate uses correct Numeric columns

---

## 9. Verification Results

| Item | Status | Evidence |
|---|---|---|
| R-001 resolver rewrite | Done | `git diff --cached` output shown during session; commit `ce17e985` |
| R-001 schema/service | Done | `git diff --cached` output shown; commit `aaa2d31e` |
| R-002 FK migration v1557 | Done | File created; commit `ce17e985` stat shows `v1557_item_warehouse_location_integrity.py` |
| R-004 dual-column audit | Done | `Select-String` grep confirms StockLedger never writes legacy `warehouse` text; only POS service did (now fixed) |
| R-006 constraint migration v1557 | Done | Same migration file as R-002 |
| R-007 model + migration + resolver + schema | Done | Diff shown for all four files; commits `ce17e985`, `aaa2d31e` |
| R-011 GRN form test data removal | Done | Diff shown; commit `ce17e985` |
| R-012 location delete guard | Done | Diff shown; commit `ce17e985` |
| R-013 deactivate endpoint | Done | Diff shown; commit `ce17e985` |
| R-014 POSParkedCart branch FK | Done | Model diff shown; migration v1559 created; commit `ce17e985` |

---

## 10. Known Limitations

- **R-003 (nullable GRN warehouse_id)**: Deferred — requires business decision on
  whether to enforce NOT NULL retroactively on existing GRN rows with NULL warehouse_id.
- **R-005 (transfer approval workflow)**: Deferred — requires business definition of
  approval thresholds and role matrix.
- **R-008 (StoreDirectoryWs fetches from HR API)**: Deferred — requires frontend
  StoreDirectoryWs.tsx refactor to list all Branch/Warehouse entities directly.
- **Register backfill**: Existing CashRegister rows with warehouse text code but no
  `warehouse_id` FK will still fall through to the legacy text resolver path. A one-time
  backfill script is recommended after migration v1557-v1559 is applied.

---

## 11. Future Work

- Write a one-time backfill script: `scripts/backfill_register_warehouse_id.py`
- Address R-003: discuss and decide GRN nullable warehouse policy
- Address R-005: design and implement transfer approval workflow
- Address R-008: StoreDirectoryWs independent Branch/Warehouse listing
- Add unit tests for `InventoryWarehouseResolver` covering all 4 resolution levels

---

## 12. Related ADRs

None recorded at time of writing.

---

## 13. Related RFCs

None recorded at time of writing.
