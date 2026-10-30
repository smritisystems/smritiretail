<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.3
  Created      : 2026-10-05
  Modified     : 2026-10-05
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Item Master Phase 8 — Multi-Tenant Scope Hardening & Company ID Integrity Backfill v6.70.3

## 1. Objective
Eliminate all multi-tenant isolation leaks across SMRITI catalog child tables by backfilling `company_id` on 320 orphaned records (`item_variants`, `item_barcodes`, `item_batches`, `item_serials`, `item_warehouse_locations`) directly from their parent `items.company_id`. Enforce database-level `NOT NULL` constraints on `company_id` for catalog entities, and resolve 47 legacy unassigned items stuck in `REQUIRES_REVIEW` status due to missing statutory UOM attributes, transitioning them to `ACTIVE` while preserving legitimate quarantine test boundaries.

## 2. Business Motivation
In a multi-tenant retail ERP, queries explicitly filter by `company_id = :tenant_id` to prevent cross-tenant data leakage. When child records (such as variants, barcodes, or batches) carry `company_id = NULL`, tenant-scoped queries silently omit them. This causes:
- Barcodes failing to resolve at POS for active tenants even though the barcode exists in the database.
- Variant stock and physical tracking failing to display in tenant inventory views.
- 58 items trapped in `REQUIRES_REVIEW`, blocking operational use for 47 legitimate merchandise styles that already have variants and customer sales records.

## 3. Scope
- **Child Record Backfill**:
  - `item_variants`: Backfill 100 rows where `company_id IS NULL` using `items.company_id`.
  - `item_barcodes`: Backfill 100 rows where `company_id IS NULL` using `items.company_id`.
  - `item_batches`: Backfill 39 rows where `company_id IS NULL` using `items.company_id`.
  - `item_serials`: Backfill 40 rows where `company_id IS NULL` using `items.company_id`.
  - `item_warehouse_locations`: Backfill 41 rows where `company_id IS NULL` using `items.company_id`.
- **Database Schema Hardening**:
  - Author and apply Alembic migration `v1521_item_master_phase8_company_id_not_null.py` setting `company_id NOT NULL` across all 5 catalog child tables.
- **Catalog Review Triage Engine**:
  - Author `ItemReviewTriageService` (`backend/app/services/item/item_review_triage_svc.py`) to audit and resolve `REQUIRES_REVIEW` items.
  - Automatically populate standard statutory UOM (`PRS` for Footwear, `PCS` for general/apparel) on unassigned legacy items and transition them to `ACTIVE`.
  - Retain `QUAR-*` items in `REQUIRES_REVIEW` / `QUARANTINED` status.
- **Operational Tooling**:
  - Build `scripts/harden_multitenant_catalog.py` with `--dry-run` and `--execute` modes.
- **Automated Verification**:
  - Pytest test suite `backend/app/tests/test_item_master_phase8_multitenant_hardening.py`.

## 4. Current State
- `items`: 2,727 total rows, 0 with `company_id IS NULL` (100% tenant-linked).
- `item_variants`: 3,425 total rows, 100 with `company_id IS NULL` (2.9% orphaned).
- `item_barcodes`: 3,305 total rows, 100 with `company_id IS NULL` (3.0% orphaned).
- `item_batches`: 53 total rows, 39 with `company_id IS NULL` (73.6% orphaned).
- `item_serials`: 50 total rows, 40 with `company_id IS NULL` (80.0% orphaned).
- `item_warehouse_locations`: 1,713 total rows, 41 with `company_id IS NULL` (2.4% orphaned).
- `items` status distribution: 2,669 `ACTIVE`, 58 `REQUIRES_REVIEW` (47 unassigned legacy items with missing UOM + 11 quarantined test items).

## 5. Gap Analysis
| Aspect | Current State | Required Target State |
| :--- | :--- | :--- |
| `item_variants.company_id` | 100 NULL rows; nullable schema | 0 NULL rows; `NOT NULL` constraint enforced |
| `item_barcodes.company_id` | 100 NULL rows; nullable schema | 0 NULL rows; `NOT NULL` constraint enforced |
| `item_batches.company_id` | 39 NULL rows; nullable schema | 0 NULL rows; `NOT NULL` constraint enforced |
| `item_serials.company_id` | 40 NULL rows; nullable schema | 0 NULL rows; `NOT NULL` constraint enforced |
| `item_warehouse_locations.company_id` | 41 NULL rows; nullable schema | 0 NULL rows; `NOT NULL` constraint enforced |
| `REQUIRES_REVIEW` Items | 58 items blocked (47 have missing UOM) | 47 unassigned items transitioned to `ACTIVE`; 11 test quarantine items preserved |
| Multi-Tenant Leakage Risk | High (NULL company rows excluded from tenant queries) | Zero (Every catalog record strictly tied to its tenant) |

## 6. Architecture Impact
- **Strict Tenant Boundary Invariant**: Guarantees that every variant, barcode, batch, serial, and warehouse location row inherits and permanently maintains its parent item's `company_id`.
- **Zero Query Exclusion**: Standard queries of the form `SELECT ... WHERE company_id = :cid` will never silently miss variants or barcodes.
- **Reversible Schema Migration**: The Alembic migration `v1521` revises `v1520` with full `upgrade()` and `downgrade()` methods.

## 7. Proposed Design

```text
Parent Item (items)
  ├── id: "itm_..."
  ├── company_id: "COMP-001" (NOT NULL)
  │
  ├──► item_variants.company_id: "COMP-001" (Backfilled & NOT NULL)
  ├──► item_barcodes.company_id: "COMP-001" (Backfilled & NOT NULL)
  ├──► item_batches.company_id:  "COMP-001" (Backfilled & NOT NULL)
  ├──► item_serials.company_id:  "COMP-001" (Backfilled & NOT NULL)
  └──► item_warehouse_locations.company_id: "COMP-001" (Backfilled & NOT NULL)

Review Triage Cascade:
  items.status == 'REQUIRES_REVIEW'
    ├── If item_code LIKE 'QUAR-%' ──────────► KEEP 'REQUIRES_REVIEW' (Preserve quarantine)
    └── If item_code LIKE 'ITM-UNASSIGNED-%'
          ├── Set primary_uom = 'PRS' (if footwear) or 'PCS' (other)
          ├── Set uom = primary_uom
          └── Transition status = 'ACTIVE'
```

## 8. Files Created
1. `backend/alembic/versions/v1521_item_master_phase8_company_id_not_null.py`: Reversible Alembic migration.
2. `backend/app/services/item/item_review_triage_svc.py`: Domain review triage service.
3. `scripts/harden_multitenant_catalog.py`: CLI multi-tenant hardening runner.
4. `backend/app/tests/test_item_master_phase8_multitenant_hardening.py`: Automated pytest test suite.
5. `docs/implementation/catalog/Item_Master_Phase8_MultiTenant_Scope_Hardening_Plan_v6.70.3.md`: This 19-section plan.
6. `docs/walkthrough/catalog/Item_Master_Phase8_MultiTenant_Scope_Hardening_v6.70.3.md`: 13-section walkthrough.

## 9. Files Modified
1. `package.json`: Version bumped to `6.70.3`.
2. `backend/app/core/config.py`: Version bumped to `6.70.3`.
3. `src/config/version.ts`: Version bumped to `6.70.3`.
4. `CHANGELOG.md`: Added Phase 8 changelog entry under `6.70.3`.
5. `backend/app/models/item_master.py`: Ensure `company_id` is defined as `nullable=False` on `ItemVariant`, `ItemBarcode`, `ItemBatch`, `ItemSerial`, `ItemWarehouseLocation`.
6. `backend/app/services/item/__init__.py`: Export `ItemReviewTriageService`.
7. `docs/implementation/README.md`: Register Phase 8 plan.
8. `docs/walkthrough/README.md`: Register Phase 8 walkthrough.

## 10. Dependencies
- PostgreSQL 15 on port 2781 (`smriti001`).
- SQLAlchemy 2.0 with asyncpg session engine.
- Alembic head migration `v1520`.

## 11. Risks
- **Pre-existing NULLs blocking NOT NULL constraint**: If any row remains NULL when `ALTER TABLE ... ALTER COLUMN company_id SET NOT NULL` is executed, the migration will abort. Mitigated by executing the `UPDATE ... FROM items` backfill inside the migration before altering column nullability.
- **Quarantine Violation**: Inadvertently activating quarantined security/test items. Mitigated by strictly checking `item_code.startswith("QUAR-")` and skipping them.

## 12. Rollback Strategy
- Alembic `downgrade()` drops the `NOT NULL` constraint (`ALTER TABLE ... ALTER COLUMN company_id DROP NOT NULL`).
- Triage status changes are logged and reversible by updating `status = 'REQUIRES_REVIEW'` for the affected item IDs.

## 13. Verification Plan
- Dry-run script execution validating 320 backfill candidates and 47 triage candidates.
- Alembic migration run (`alembic upgrade head`) and constraint verification via `pg_constraint`.
- Post-migration count verification confirming 0 NULLs across all 5 tables.
- Post-triage status count verification confirming 2,716 `ACTIVE` items and 11 `REQUIRES_REVIEW` items.
- Execution of automated test suite `test_item_master_phase8_multitenant_hardening.py`.
- Clean TypeScript compiler check (`npx tsc --noEmit`).
- Version SSOT validator (`scripts/validate_version_ssot.py`).

## 14. Test Plan
- Run `pytest backend/app/tests/test_item_master_phase8_multitenant_hardening.py -v`.
- Run regression tests on `test_item_master_phase7_legacy_reconciliation.py` and `test_item_master_phase6_pos_grn_tracking_wiring.py`.

## 15. Documentation Impact
- Implementation Plan in `docs/implementation/catalog/`.
- Walkthrough in `docs/walkthrough/catalog/`.
- Indices in `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- Release notes in `CHANGELOG.md`.

## 16. Deployment Plan
1. Validate database connection and take snapshot/backup if applicable.
2. Run `scripts/harden_multitenant_catalog.py --dry-run` to preview backfills and triage.
3. Run `scripts/harden_multitenant_catalog.py --execute` to perform transactional backfills and triage.
4. Run `alembic upgrade head` to apply schema constraint hardening.
5. Deploy code updates via `git pull` on test node `F:\Smriti9`.

## 17. Status
Completed

## 18. Related ADRs
- `docs/adr/ADR-0045_Universal_Item_Master_Architecture.md`
- `docs/adr/ADR-0046_FastAPI_Postgres_Sole_System_of_Record.md`

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Item_Master_Phase7_Legacy_Products_Reconciliation_v6.70.2.md`
- `docs/walkthrough/catalog/Item_Master_Phase8_MultiTenant_Scope_Hardening_v6.70.3.md`
