<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.6
  Created      : 2026-10-05
  Modified     : 2026-10-05
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Item Master Phase 11 — Tracking Mode Harmonization & Database Constraint Enactment

**Document ID:** `WTR-CATALOG-P11-TRACKING-v6.70.6`  
**Area:** Catalog, Inventory Tracking, Batch, Serial, Database Integrity  
**Status:** Completed  
**Version:** `6.70.6`  
**Related Plan:** [`Item_Master_Phase11_Tracking_Mode_Harmonization_Plan_v6.70.6.md`](../../implementation/catalog/Item_Master_Phase11_Tracking_Mode_Harmonization_Plan_v6.70.6.md)

---

## 1. Purpose
This walkthrough documents the design, implementation, and verification of **Item Master Phase 11: Tracking Mode Harmonization & Database Constraint Enactment**. Phase 11 establishes complete relational and semantic synchronization across inventory tracking fields (`tracking_mode`, `tracking_type`, `is_batch_tracked`, `is_serial_tracked`), resolves 1,274 tracking discrepancies across 2,727 catalog items in `smriti001`, and enacts database-level CHECK constraints (`chk_no_dual_tracking` and `chk_tracking_mode_matches_flags`) via reversible Alembic migration `v1522`.

---

## 2. Scope
1. **Catalog Tracking Audit & Reconciliation**:
   - Reconcile 615 batch-tracked items to `tracking_mode='BATCH'`, `tracking_type='BATCH'`, `is_batch_tracked=True`, `is_serial_tracked=False`.
   - Reconcile 40 serial-tracked items to `tracking_mode='SERIAL'`, `tracking_type='SERIAL'`, `is_serial_tracked=True`, `is_batch_tracked=False`.
   - Reconcile 2,072 standard items to `tracking_mode='NONE'`, `tracking_type='NONE'`, `is_batch_tracked=False`, `is_serial_tracked=False`.
2. **Database Migration (`v1522`)**:
   - Apply migration `v1522_item_master_phase11_tracking_mode_harmonization.py`.
   - Set `items.tracking_type` and `items.tracking_mode` to `NOT NULL` with default `'NONE'`.
   - Create database CHECK constraints:
     - `chk_no_dual_tracking`: Guarantees an item cannot be simultaneously batch-tracked and serial-tracked.
     - `chk_tracking_mode_matches_flags`: Enforces exact enum parity between `tracking_mode` and boolean tracking flags.
3. **Domain Service & CLI Tooling**:
   - Create `ItemTrackingSyncService` in `backend/app/services/item/item_tracking_sync_svc.py`.
   - Create operational CLI tool `scripts/harmonize_tracking_modes.py` supporting `--dry-run` and `--execute`.
4. **Automated Test Suite**:
   - Create `backend/app/tests/test_item_master_phase11_tracking_mode_harmonization.py` testing database constraint enforcement and service idempotency.

---

## 3. Files Created
1. `backend/alembic/versions/v1522_item_master_phase11_tracking_mode_harmonization.py` — Reversible Alembic migration.
2. `backend/app/services/item/item_tracking_sync_svc.py` — Multi-tenant tracking harmonization domain service.
3. `scripts/harmonize_tracking_modes.py` — Operational CLI runner for dry-run and live database execution.
4. `backend/app/tests/test_item_master_phase11_tracking_mode_harmonization.py` — Pytest verification suite (4 tests, 100% pass).
5. `docs/implementation/catalog/Item_Master_Phase11_Tracking_Mode_Harmonization_Plan_v6.70.6.md` — 19-section formal implementation plan.
6. `docs/walkthrough/catalog/Item_Master_Phase11_Tracking_Mode_Harmonization_v6.70.6.md` — 13-section formal walkthrough document.

---

## 4. Files Modified
1. `package.json` — Bumped version SSOT to `6.70.6`.
2. `backend/app/core/config.py` — `Settings.VERSION` bumped to `6.70.6`.
3. `src/config/version.ts` — `APP_VERSION` and `ENTERPRISE_BILLING_SUITE_VERSION` bumped to `6.70.6`.
4. `CHANGELOG.md` — Documented Phase 11 release notes.
5. `backend/app/models/item_master.py` — Declared `chk_no_dual_tracking` and `chk_tracking_mode_matches_flags` in `Item.__table_args__`; updated `tracking_type` to `nullable=False`.
6. `backend/app/services/item/__init__.py` — Re-exported `ItemTrackingSyncService` in unified facade.
7. `docs/implementation/README.md` — Registered Phase 11 plan.
8. `docs/walkthrough/README.md` — Registered Phase 11 walkthrough.

---

## 5. Architecture Decisions
1. **Database-Enforced Mutual Exclusivity (ADR-0022)**:
   Physical inventory tracking modes (batch vs. serial) are fundamentally incompatible at the unit tracking layer. An item cannot simultaneously allocate batch lots and require individual unique serial IDs. Enforcing `chk_no_dual_tracking` at the database level guarantees that application bugs or raw SQL imports cannot corrupt this operational invariant.
2. **Enum / Boolean Flag Parity**:
   Historically, `tracking_mode`, `tracking_type`, `is_batch_tracked`, and `is_serial_tracked` evolved across different phases. Phase 11 locks their parity with `chk_tracking_mode_matches_flags` so that downstream services querying either the string enum or boolean flags receive 100% consistent results.

---

## 6. Design Rationale
Prior to Phase 11, 1,148 catalog items had `NULL` tracking types, 39 batch items lacked `tracking_mode='BATCH'`, and 40 serial items lacked `tracking_mode='SERIAL'`. By executing the SQL repair directly inside migration `v1522` before adding the constraints, we ensure that the migration succeeds deterministically across all environments, with zero manual prep required.

---

## 7. Implementation Summary
- **Migration `v1522`**:
  - Upgraded live database `smriti001` (`v1521` -> `v1522`).
  - Added CHECK constraints `chk_no_dual_tracking` and `chk_tracking_mode_matches_flags`.
  - Configured `tracking_type` and `tracking_mode` columns to `NOT NULL` with default `'NONE'`.
- **Domain Service**:
  - Implemented `ItemTrackingSyncService.harmonize_tracking_modes` providing multi-tenant scoped execution and resolution of edge-case dual tracking.
- **Operational CLI**:
  - Implemented `scripts/harmonize_tracking_modes.py` with schema constraint inspection.

---

## 8. Tests Executed
```powershell
.venv\Scripts\python.exe -m pytest backend/app/tests/test_item_master_phase11_tracking_mode_harmonization.py -v
```
**Output:**
- `test_chk_no_dual_tracking_constraint_rejection` — PASSED
- `test_chk_tracking_mode_matches_flags_constraint_rejection` — PASSED
- `test_valid_tracking_configurations_accepted` — PASSED
- `test_item_tracking_sync_service_idempotence` — PASSED

**Result:** 4/4 passed (100% green in 50.18s).

---

## 9. Verification Results

### Live Database (`smriti001`) Before vs. After Measurements:
| Metric | Pre-Harmonization | Post-Harmonization | Improvement / Delta |
|---|---|---|---|
| Total Catalog Items | 2,727 | 2,727 | Stable |
| Tracking Discrepancies | 1,274 | **0** | **-1,274 (100% resolved)** |
| Items with NULL tracking_type | 1,148 | **0** | **-1,148 (100% NOT NULL)** |
| Batch-Tracked Items (Mode & Flags) | 576 | **615** | **+39 batch items fully aligned** |
| Serial-Tracked Items (Mode & Flags) | 0 | **40** | **+40 serial items fully aligned** |
| Standard / None Items | 877 | **2,072** | **+1,195 standard items fully aligned** |
| Dual-Tracking Violations | 0 | **0** | **0 violations (guaranteed by DB constraint)** |
| `chk_no_dual_tracking` Constraint | Missing | **Enforced** | Active in PostgreSQL `information_schema` |
| `chk_tracking_mode_matches_flags` Constraint | Missing | **Enforced** | Active in PostgreSQL `information_schema` |

### Governance & Linter Verification:
- `validate_version_ssot.py`: [PASS] 6.70.6 across all 4 boundaries.
- `npx tsc --noEmit`: Exit Code 0 (0 errors).

---

## 10. Known Limitations
- If a business tenant decides to change an item from `BATCH` to `SERIAL`, any existing batch stock movements must be decommissioned or transferred before the item configuration update is permitted.

---

## 11. Future Work
- **Item Master Phase 12: End-to-End Operational Pipeline Validation**:
  - Execute integrated end-to-end POS counter checkout and purchase inwarding (GRN) test runs validating catalog items with `BATCH`, `SERIAL`, and `NONE` tracking modes.

---

## 12. Related ADRs
- `ADR-0022: Physical Inventory Tracking Modes & Integrity Guarantees`

---

## 13. Related RFCs
- `RFC-2026-CATALOG-011: Database-Level Tracking Mode Constraints and Parity Enforcement`
