<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.47.4
  Created      : 2026-09-30
  Modified     : 2026-09-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Database Bootstrap, Dynamic Trigger Hardening & Multi-Head Remediation Walkthrough

**Walkthrough ID:** WGP-DB-BOOTSTRAP-TRIGGER-REMEDIATION-v6.47.4  
**Area:** Database & Schema Migration Governance  
**Status:** Completed & Verified  

---

## 1. Purpose
Document the definitive root-cause diagnosis, architectural remediation, and automated verification of the soft-deletion failure (`Delete Failed: A database operations conflict occurred or referential integrity check failed`) and container startup errors on fresh installations. This implementation resolves:
1. PostgreSQL PL/pgSQL static query compilation failures in `prevent_referenced_master_value_retirement()` when referenced columns (e.g. `sales_order_items.article_no`) have not yet been migrated.
2. Divergent Alembic heads (`v1497b` on control plane vs `v1504` on tenant plane) by establishing unified canonical merge head `v1505`.
3. Schema drift and unguarded DDL/DML in migrations (`v1497a`, `v1497b`, `v1500`, `v1503`, `v1504`) when executed across diverse control-plane (`smritisys`) and tenant-plane (`smriti001`, `smriti002`, etc.) databases.
4. Tenant isolation violations in baseline seeding (`seed_baseline_users.py`) where hardcoded company ID `COMP-001` violated foreign key constraints in tenant databases scoped to `COMP-002` or `COMP-003`.
5. Human-Readable Error Policy (HREP) compliance in `backend/app/api/v1/master_lookup.py` to gracefully handle database trigger integrity rejections.

---

## 2. Scope
1. **PL/pgSQL Trigger Hardening:**
   - Converted static SQL queries inside `prevent_referenced_master_value_retirement()` to dynamic SQL (`EXECUTE ...`) with defensive table and column existence checks via `to_regclass` and `information_schema.columns`.
2. **Alembic Merge & Linearization:**
   - Created canonical merge migration `backend/alembic/versions/v1505_sales_order_items_article_no_and_trigger_hardening.py` combining `v1504` and `v1497b`.
3. **Migration Self-Guarding:**
   - Hardened `v1497a`, `v1497b`, `v1500`, `v1503`, and `v1504` to be strictly idempotent and schema-aware across control and tenant databases.
4. **Bootstrap Engine Resilience:**
   - Extended `backend/app/db/bootstrap.py` and `backend/app/db/bootstrap_engine.py` with automatic ancestor pruning for divergent heads and pre-migration column/trigger extensions.
5. **Multi-Tenant Seed Parity:**
   - Hardened `backend/app/db/seed_baseline_users.py` to map company IDs dynamically to tenant database contexts (`COMP-001` -> `smriti001`, `COMP-002` -> `smriti002`, `COMP-003` -> `smriti003`), verifying company record existence before seeding CRM dependencies.

---

## 3. Files Created
- `backend/alembic/versions/v1505_sales_order_items_article_no_and_trigger_hardening.py`
- `docs/walkthrough/db/DB_Bootstrap_Dynamic_Trigger_And_MultiHead_Remediation_v6.47.4.md`

---

## 4. Files Modified
- `backend/alembic/versions/v1497a_retire_products_tenant_id.py`
- `backend/alembic/versions/v1497b_retire_ctrl_tenant_id_columns.py`
- `backend/alembic/versions/v1500_sales_ops_fk_hardening_valid.py`
- `backend/alembic/versions/v1503_not_valid_fk_cleanup_schema_drift_003.py`
- `backend/alembic/versions/v1504_tombstone_validate_all_fks.py`
- `backend/app/api/v1/master_lookup.py`
- `backend/app/db/bootstrap.py`
- `backend/app/db/bootstrap_engine.py`
- `backend/app/db/seed_baseline_users.py`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

---

## 5. Architecture Decisions
- **ADR-DB-007: Dynamic SQL Compilation for Cross-Table Integrity Triggers:**
  - *Context:* In PostgreSQL, PL/pgSQL functions statically validate and parse all embedded SQL statements upon initial execution in a transaction. When a function references columns across multiple optional or phased tables, any missing column causes immediate compilation abort, even if the runtime branch condition evaluates to `FALSE`.
  - *Decision:* All cross-table referential integrity and retirement guard triggers must use dynamic SQL (`EXECUTE format(...)`) wrapped in defensive `information_schema.columns` / `to_regclass` existence verification.
- **ADR-DB-008: Strict Alembic DAG Convergence (Single Linear Head):**
  - *Context:* Divergent branch heads (`v1497b` and `v1504`) cause automated startup scripts (`alembic upgrade head`) to fail with multiple-head errors on container launch.
  - *Decision:* All branches must converge onto a single canonical head (`v1505`). CI and startup runners must reject any state with split heads.

---

## 6. Design Rationale
Static PL/pgSQL references created a circular dependency during schema evolution: deleting an unrelated lookup row (such as Department) failed because PostgreSQL attempted to compile queries inspecting `sales_order_items.article_no`. By converting references into dynamic `EXECUTE` queries, PostgreSQL defers statement parsing until the specific branch is reached, and the existence guard ensures that missing extension columns gracefully evaluate to zero references without throwing fatal exceptions.

---

## 7. Implementation Summary
1. **Trigger Transformation:**
   Replaced static `SELECT 1 FROM sales_order_items WHERE article_no = OLD.code` with:
   ```sql
   IF EXISTS (
       SELECT 1 FROM information_schema.columns 
       WHERE table_name = 'sales_order_items' AND column_name = 'article_no'
   ) THEN
       EXECUTE 'SELECT EXISTS (SELECT 1 FROM sales_order_items WHERE article_no = $1 AND is_deleted = false)'
       INTO v_ref_exists USING OLD.code;
       IF v_ref_exists THEN
           RAISE EXCEPTION 'Cannot retire master value %: referenced in active Sales Orders (sales_order_items.article_no)', OLD.code;
       END IF;
   END IF;
   ```
2. **Merge Migration `v1505`:**
   Created Alembic version `v1505` with `down_revision = ("v1504", "v1497b")`. It ensures `sales_order_items` columns (`article_no`, `vendor_style`, etc.) exist and installs the hardened trigger function.
3. **Migration Idempotency:**
   Guarded table alterations and constraint validation with metadata catalog checks across `v1497a`, `v1497b`, `v1500`, `v1503`, and `v1504`.
4. **CRM Seeding Guard:**
   Updated `seed_baseline_users.py` to lookup the corresponding company entity for each tenant database before inserting dependent customer/vendor records.

---

## 8. Tests Executed
1. `backend/tests/test_master_lookup_compliance_audit.py`
2. `scratch/test_delete_repro.py` (deleting lookup values on `smritisys` and `smriti001`)
3. `backend/app/db/bootstrap_engine.py` (full multi-tenant bootstrap across `smritisys`, `smriti001`, `smriti002`, `smriti003`, `smriti004`)
4. Python bytecode compilation across all 10 modified/created files.

---

## 9. Verification Results
- `alembic heads`: Single head `v1505 (head)`.
- `test_master_lookup_compliance_audit.py`: 1/1 PASSED [100%].
- `test_delete_repro.py`: Both `smritisys` and `smriti001` test deletions succeeded with `{'success': True}` and `is_deleted = True`.
- `bootstrap_engine.py`: Exit code 0 across control plane and all 4 tenant databases.

---

## 10. Known Limitations
None. All database mutations and trigger validations are idempotent.

---

## 11. Future Work
Incorporate automated migration DAG linting into the CI pre-commit pipeline to immediately flag divergent heads before merge.

---

## 12. Related ADRs
- `ADR-DB-006: Child Table Tenant Isolation Model`
- `ADR-DB-007: Dynamic SQL Compilation for Cross-Table Integrity Triggers`
- `ADR-DB-008: Strict Alembic DAG Convergence`

---

## 13. Related RFCs
- `RFC-DB-2026-004: Multi-Tenant Bootstrap and Dynamic Trigger Hardening`
