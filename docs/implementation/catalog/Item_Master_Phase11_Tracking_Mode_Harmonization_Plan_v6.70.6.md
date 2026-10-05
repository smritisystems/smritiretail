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

# Implementation Plan: Item Master Phase 11 — Tracking Mode Harmonization & Database Constraint Enactment

**Document ID:** `PLAN-CATALOG-P11-TRACKING-v6.70.6`  
**Area:** Catalog, Inventory Tracking, Batch, Serial, Database Integrity  
**Status:** Completed  
**Version:** `6.70.6`  
**Related Walkthrough:** [`Item_Master_Phase11_Tracking_Mode_Harmonization_v6.70.6.md`](../../walkthrough/catalog/Item_Master_Phase11_Tracking_Mode_Harmonization_v6.70.6.md)

---

## 1. Objective
Establish complete semantic and structural harmonization across physical inventory tracking dimensions on `items`. Reconcile `tracking_mode` (`NONE`, `BATCH`, `SERIAL`), `tracking_type`, `is_batch_tracked`, and `is_serial_tracked` across all 2,727 items in `smriti001`, eliminate 1,274 tracking discrepancies, and enact database-level CHECK constraints (`chk_no_dual_tracking` and `chk_tracking_mode_matches_flags`) preventing invalid tracking states.

---

## 2. Business Motivation
In retail warehouse management (WMS) and counter POS operations, an item's tracking discipline dictates checkout scanning and inventory inwarding:
1. **BATCH**: Requires lot/batch allocation, expiry date validation, and FIFO valuation.
2. **SERIAL**: Requires individual unique identifier capture (e.g. IMEI, serial tag) per unit sold.
3. **NONE**: Standard discrete inventory tracking by quantity.

When tracking fields diverge (e.g. 1,148 items with NULL `tracking_type`, 39 items with `is_batch_tracked=True` but no batch tracking mode, or 40 items with `is_serial_tracked=True` without serial tracking mode), POS checkout handlers and GRN inwarding engines can misroute line items, fail to prompt cashiers for required batch tags, or silently skip stock movement tracking. Enforcing strict database-level constraints ensures that no item can enter an inconsistent or dual-tracked state.

---

## 3. Scope
1. **Catalog Audit & Reconciliation**:
   - Audit 2,727 items in `smriti001`.
   - Reconcile 615 batch-tracked items to `tracking_mode='BATCH'`, `tracking_type='BATCH'`, `is_batch_tracked=True`, `is_serial_tracked=False`.
   - Reconcile 40 serial-tracked items to `tracking_mode='SERIAL'`, `tracking_type='SERIAL'`, `is_serial_tracked=True`, `is_batch_tracked=False`.
   - Reconcile 2,072 standard items to `tracking_mode='NONE'`, `tracking_type='NONE'`, `is_batch_tracked=False`, `is_serial_tracked=False`.
2. **Database Migration (`v1522`)**:
   - Create reversible Alembic migration `v1522_item_master_phase11_tracking_mode_harmonization.py`.
   - Include idempotent data repair in migration script to guarantee migration safety on clean replays.
   - Add database CHECK constraints:
     - `chk_no_dual_tracking`: `CHECK (NOT (is_batch_tracked = TRUE AND is_serial_tracked = TRUE))`
     - `chk_tracking_mode_matches_flags`:
       `CHECK ((tracking_mode = 'BATCH' AND is_batch_tracked = TRUE AND is_serial_tracked = FALSE) OR (tracking_mode = 'SERIAL' AND is_serial_tracked = TRUE AND is_batch_tracked = FALSE) OR (tracking_mode = 'NONE' AND is_batch_tracked = FALSE AND is_serial_tracked = FALSE))`
3. **Domain Service & CLI Tooling**:
   - Create `backend/app/services/item/item_tracking_sync_svc.py` (`ItemTrackingSyncService`).
   - Create operational CLI tool `scripts/harmonize_tracking_modes.py` with `--dry-run` and `--execute`.
   - Create automated verification test suite `backend/app/tests/test_item_master_phase11_tracking_mode_harmonization.py`.

---

## 4. Current State
- Total catalog items: 2,727 in `smriti001`.
- Items with tracking divergence: 1,274 / 2,727:
  - 39 batch items diverging (`is_batch_tracked=True` but `tracking_mode` or `tracking_type` not BATCH).
  - 40 serial items diverging (`is_serial_tracked=True` but `tracking_mode` or `tracking_type` not SERIAL).
  - 1,195 non-tracked items diverging (`is_batch_tracked=False`, `is_serial_tracked=False` but `tracking_type` is NULL or STANDARD).
- Dual tracking count: 0 (no items have both True).

---

## 5. Gap Analysis
| Area | Current State | Required Target State |
|---|---|---|
| `tracking_type` | 1,148 NULLs, 126 STANDARD | 0 NULLs, 0 STANDARD; exactly aligned with tracking_mode |
| `tracking_mode` | 30 SERIAL, 605 BATCH, 2092 NONE | 40 SERIAL, 615 BATCH, 2072 NONE |
| Dual Tracking Guard | Enforced in app logic only | Enforced in PostgreSQL schema via `chk_no_dual_tracking` |
| Mode / Flag Consistency | Discrepancies allowed by schema | Enforced in PostgreSQL schema via `chk_tracking_mode_matches_flags` |

---

## 6. Architecture Impact
- Enforces relational guarantee that inventory tracking policies are mutually exclusive and internally consistent.
- POS and GRN engines (`POSService`, `PurchaseService`, `HeadlessBillingCore`) can rely on either `tracking_mode` or the boolean flags with 100% parity.

---

## 7. Proposed Design
### Synchronizer Logic (`ItemTrackingSyncService`):
1. Harmonize batch items:
   ```sql
   UPDATE items
   SET tracking_mode = 'BATCH', tracking_type = 'BATCH', is_batch_tracked = TRUE, is_serial_tracked = FALSE, modified_at = NOW()
   WHERE is_batch_tracked = TRUE OR tracking_mode = 'BATCH' OR tracking_type = 'BATCH';
   ```
2. Harmonize serial items:
   ```sql
   UPDATE items
   SET tracking_mode = 'SERIAL', tracking_type = 'SERIAL', is_serial_tracked = TRUE, is_batch_tracked = FALSE, modified_at = NOW()
   WHERE is_serial_tracked = TRUE OR tracking_mode = 'SERIAL' OR tracking_type = 'SERIAL';
   ```
3. Harmonize non-tracked items:
   ```sql
   UPDATE items
   SET tracking_mode = 'NONE', tracking_type = 'NONE', is_batch_tracked = FALSE, is_serial_tracked = FALSE, modified_at = NOW()
   WHERE (is_batch_tracked IS NOT TRUE AND is_serial_tracked IS NOT TRUE)
      OR (tracking_mode = 'NONE' AND (tracking_type != 'NONE' OR tracking_type IS NULL));
   ```

---

## 8. Files Created
1. `backend/alembic/versions/v1522_item_master_phase11_tracking_mode_harmonization.py`
2. `backend/app/services/item/item_tracking_sync_svc.py`
3. `scripts/harmonize_tracking_modes.py`
4. `backend/app/tests/test_item_master_phase11_tracking_mode_harmonization.py`
5. `docs/implementation/catalog/Item_Master_Phase11_Tracking_Mode_Harmonization_Plan_v6.70.6.md`
6. `docs/walkthrough/catalog/Item_Master_Phase11_Tracking_Mode_Harmonization_v6.70.6.md`

---

## 9. Files Modified
1. `package.json`
2. `backend/app/core/config.py`
3. `src/config/version.ts`
4. `CHANGELOG.md`
5. `backend/app/models/item_master.py`
6. `backend/app/services/item/__init__.py`
7. `docs/implementation/README.md`
8. `docs/walkthrough/README.md`

---

## 10. Dependencies
- PostgreSQL async session (`app.db.session.get_company_sessionmaker`).
- Alembic database migration runner.
- Domain models: `Item` (`app.models.item_master`).

---

## 11. Risks
- *Risk:* Adding CHECK constraints could fail if unharmonized rows exist in other tenant databases.  
  *Mitigation:* Migration `v1522` executes the SQL backfill prior to creating the constraints, guaranteeing schema migration safety across any target database.

---

## 12. Rollback Strategy
Migration `v1522` includes `downgrade()` dropping constraints `chk_no_dual_tracking` and `chk_tracking_mode_matches_flags`.

---

## 13. Verification Plan
1. Check count of tracking discrepancies before (1,274) and after (0).
2. Check database schema constraints in `information_schema.table_constraints`.
3. Attempt inserting an invalid dual-tracked item and verify DB rejects with `CheckViolationError`.
4. Attempt inserting an item with mismatched mode/flags and verify DB rejects with `CheckViolationError`.
5. Run `python scripts/validate_version_ssot.py` (Rule 3).
6. Run `npx tsc --noEmit` (Rule 3).
7. Run `pytest backend/app/tests/test_item_master_phase11_tracking_mode_harmonization.py -v` (Rule 2).

---

## 14. Test Plan
- `test_chk_no_dual_tracking_constraint_rejection`: Asserts DB rejects `is_batch_tracked=True AND is_serial_tracked=True`.
- `test_chk_tracking_mode_matches_flags_constraint_rejection`: Asserts DB rejects `tracking_mode='BATCH' AND is_batch_tracked=False`.
- `test_harmonize_item_tracking_modes_domain_service`: Tests synchronization logic repair on test items.
- `test_valid_tracking_configurations_accepted`: Tests valid `BATCH`, `SERIAL`, and `NONE` items succeed.

---

## 15. Documentation Impact
- Updated Walkthrough (`docs/walkthrough/catalog/Item_Master_Phase11_Tracking_Mode_Harmonization_v6.70.6.md`).
- Master indexes updated in `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- `CHANGELOG.md` updated with `6.70.6` release notes.

---

## 16. Deployment Plan
1. Deploy backend code updates.
2. Run `alembic upgrade head` to apply migration `v1522`.
3. Run `python scripts/harmonize_tracking_modes.py --execute` to audit and confirm live parity.

---

## 17. Status
In Progress

---

## 18. Related ADRs
- `ADR-0022: Physical Inventory Tracking Modes & Integrity Guarantees`

---

## 19. Related Walkthroughs
- [`docs/walkthrough/catalog/Item_Master_Phase11_Tracking_Mode_Harmonization_v6.70.6.md`](../../walkthrough/catalog/Item_Master_Phase11_Tracking_Mode_Harmonization_v6.70.6.md)
- [`docs/walkthrough/catalog/Item_Master_Phase10_Variant_Attribute_Deduplication_v6.70.5.md`](../../walkthrough/catalog/Item_Master_Phase10_Variant_Attribute_Deduplication_v6.70.5.md)
