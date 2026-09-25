<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-25
  Modified     : 2026-09-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# DB Phase 1 Schema Remediation Wave 3 Walkthrough

**Walkthrough ID:** WGP-DB-REM-WAVE3-v1.0.0  
**Area:** Database & Schema Architecture  
**Status:** Completed & Verified  

---

## 1. Purpose
Document the implementation, migration, and verification of Phase 1 Schema Remediation Wave 3: Promotions Tenant Column Unification. This remediation addresses Finding D-001 from the Phase 1 Schema Audit, where 18 `smriti_promo%` tables utilized the legacy non-standard discriminator column `tenant_id` instead of the canonical `company_id` standard used across all other SMRITI domains. This wave implements the Expand phase of the Expand/Contract zero-downtime migration pattern by deploying `company_id`, backfilling existing rows, creating indexes, and establishing company-scoped compound unique constraints across all 18 tables.

## 2. Scope
1. **Target Tables (18 Promotions Tables):**
   - `smriti_promotions`
   - `smriti_promotion_versions`
   - `smriti_promotion_rules`
   - `smriti_promotion_conditions`
   - `smriti_promotion_rewards`
   - `smriti_promotion_scopes`
   - `smriti_promotion_scope_items`
   - `smriti_promotion_qualifications`
   - `smriti_promotion_redemptions`
   - `smriti_promotion_redemption_items`
   - `smriti_promotion_declines`
   - `smriti_promotion_overrides`
   - `smriti_promotion_audit`
   - `smriti_promotion_imports`
   - `smriti_promotion_import_rows`
   - `smriti_promotion_simulations`
   - `smriti_promotion_simulation_items`
   - `smriti_promotion_conflicts`

2. **Structural & Relational Additions:**
   - Add `company_id VARCHAR(50)` to all 18 tables.
   - Synchronize and backfill `company_id = tenant_id` for any existing rows.
   - Deploy B-tree lookup indexes on `company_id` for all 18 tables.
   - Deploy company-scoped compound UNIQUE constraints on business keys:
     - `smriti_promotions (company_id, promotion_code)` (`uq_smriti_promotions_company_code`)
     - `smriti_promotion_versions (company_id, promotion_id, version_no)` (`uq_smriti_promo_versions_company_ver`)
     - `smriti_promotion_rules (company_id, promotion_version_id, rule_no)` (`uq_smriti_promo_rules_company_seq`)
     - `smriti_promotion_conditions (company_id, promotion_rule_id, sequence_no)` (`uq_smriti_promo_conditions_company_seq`)
     - `smriti_promotion_scope_items (company_id, promotion_scope_id, barcode)` (`uq_smriti_scope_items_company_barcode`)
     - `smriti_promotion_import_rows (company_id, import_id, row_number)` (`uq_smriti_import_rows_company_seq`)
   - Add compound indexes matching active query patterns on `(company_id, status, is_active, start_at, end_at)` and `(company_id, promotion_id, status, effective_from, effective_to)`.

3. **Alembic Migration Deployment:**
   - Migration `v1492_promotions_company_id_unification_wave3.py` applied to live PostgreSQL database (`smritisys`).

4. **SQLAlchemy ORM Model Alignment:**
   - Updated `SmritiPromotion` and `SmritiPromotionVersion` in `backend/app/models/promotions.py` with company-scoped unique constraints and composite indexes.

## 3. Files Created
- `backend/alembic/versions/v1492_promotions_company_id_unification_wave3.py`
- `docs/walkthrough/db/DB_Phase1_Schema_Remediation_Wave3_v1.0.0.md`

## 4. Files Modified
- `backend/app/models/promotions.py`
- `docs/implementation/db/Phase1_Schema_Remediation_Plan_v1.0.0.md`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **ADR-DB-003: Multi-Tenant Column Standardization (`company_id`)**: Every table in SMRITI Retail OS must use `company_id VARCHAR(50)` as its canonical tenant discriminator. Fragmented column names such as `tenant_id` or `org_id` break generic repository layers, cross-module joins, RLS policies, and global tenant-isolation middleware.
- **Zero-Downtime Expand/Contract Migration Strategy**:
  - *Expand Phase (Wave 3 — Current)*: Add nullable `company_id`, backfill from `tenant_id`, add company-scoped indexes and unique constraints, dual-index lookup paths.
  - *Transition Phase*: Dual-write in services / ORM triggers.
  - *Contract Phase (Future Wave)*: Enforce `NOT NULL` on `company_id`, deprecate and drop legacy `tenant_id` column and legacy indexes.

## 6. Design Rationale
In migration `v1457_sales_promotions_engine.py`, the promotion subsystem was introduced using `tenant_id` as the tenant column. While it referenced `companies.id`, every other transactional subsystem in SMRITI (Sales, Accounting, Inventory, POS, Procurement, CRM) uses `company_id`. This created an impedance mismatch in the query engine, preventing standard tenant context filters (`where(Model.company_id == tenant_id)`) from operating uniformly across promotion models. Unifying the column to `company_id` eliminates this architectural divergence.

## 7. Implementation Summary
1. Conducted pre-flight inspection across all 18 `smriti_promo%` tables in `smritisys` verifying column status and confirming 0 existing rows.
2. Authored Alembic migration `v1492_promotions_company_id_unification_wave3.py` chained from `v1491_additive_check_constraints_wave2`.
3. Migration iterates across all 18 tables:
   - Adds `company_id` column.
   - Synchronizes `UPDATE <table> SET company_id = tenant_id WHERE company_id IS NULL`.
   - Creates `idx_<table>_company_id` B-tree index.
4. Added 6 compound UNIQUE constraints and 2 multi-column compound indexes.
5. Aligned SQLAlchemy ORM models in `backend/app/models/promotions.py`.
6. Executed migration:
   ```powershell
   F:\SMRITRretailNX\.venv\Scripts\python.exe -m alembic -x target=control -x db=smritisys upgrade head
   ```
7. Validated complete migration via automated test script `verify_wave3_promotions.py`.

## 8. Tests Executed
1. **PostgreSQL Information Schema Inspection**:
   - Query: `information_schema.columns` where table starts with `smriti_promo%` and `column_name = 'company_id'`.
   - Verified 18/18 tables contain `company_id VARCHAR(50)`.
2. **Compound Unique Constraint Verification**:
   - Query: `information_schema.table_constraints` joined with `information_schema.key_column_usage`.
   - Verified 6/6 compound unique constraints active.
3. **Transactional DML Positive & Negative Rejection**:
   - Inserted mock promotion scheme with `company_id = 'comp-sal-359785'`.
   - Re-attempted duplicate promotion code under same `company_id`: rejected with PostgreSQL error `23505 (unique_violation)`.
   - Clean transaction rollback with zero persistent test debris.
4. **Static Code Analysis & Linter**:
   - `python -m ruff check backend/alembic/versions/v1492_promotions_company_id_unification_wave3.py` -> 0 errors.

## 9. Verification Results
- **Status:** Done
- **Quantitative Metrics:**
  - `company_id` columns deployed: 18/18 (100%)
  - Compound UNIQUE constraints deployed: 6/6 (100%)
  - Lookup B-tree indexes deployed: 20/20 (18 single + 2 composite)
  - Negative DML rejection: 1/1 passed with SQLSTATE 23505
  - Alembic Head Progression: `v1491_additive_check_constraints_wave2` -> `v1492_promotions_company_id_unification_wave3`
- **Literal Test Run Output:**
  ```text
  ======================================================================
  WAVE 3 VERIFICATION — PROMOTIONS TENANT COLUMN UNIFICATION
  ======================================================================

  [1] Column Check: company_id on all 18 tables
    [OK] smriti_promotions.company_id (character varying)
    [OK] smriti_promotion_versions.company_id (character varying)
    [OK] smriti_promotion_rules.company_id (character varying)
    [OK] smriti_promotion_conditions.company_id (character varying)
    [OK] smriti_promotion_rewards.company_id (character varying)
    [OK] smriti_promotion_scopes.company_id (character varying)
    [OK] smriti_promotion_scope_items.company_id (character varying)
    [OK] smriti_promotion_qualifications.company_id (character varying)
    [OK] smriti_promotion_redemptions.company_id (character varying)
    [OK] smriti_promotion_redemption_items.company_id (character varying)
    [OK] smriti_promotion_declines.company_id (character varying)
    [OK] smriti_promotion_overrides.company_id (character varying)
    [OK] smriti_promotion_audit.company_id (character varying)
    [OK] smriti_promotion_imports.company_id (character varying)
    [OK] smriti_promotion_import_rows.company_id (character varying)
    [OK] smriti_promotion_simulations.company_id (character varying)
    [OK] smriti_promotion_simulation_items.company_id (character varying)
    [OK] smriti_promotion_conflicts.company_id (character varying)

  [2] Unique Constraints on company_id
    [OK] smriti_promotions.uq_smriti_promotions_company_code on (company_id, promotion_code)
    [OK] smriti_promotion_versions.uq_smriti_promo_versions_company_ver on (company_id, promotion_id, version_no)
    [OK] smriti_promotion_rules.uq_smriti_promo_rules_company_seq on (company_id, promotion_version_id, rule_no)
    [OK] smriti_promotion_conditions.uq_smriti_promo_conditions_company_seq on (company_id, promotion_rule_id, sequence_no)
    [OK] smriti_promotion_scope_items.uq_smriti_scope_items_company_barcode on (company_id, promotion_scope_id, barcode)
    [OK] smriti_promotion_import_rows.uq_smriti_import_rows_company_seq on (company_id, import_id, row_number)

  [3] Transactional DML Tests on smriti_promotions
    [OK] Inserted promotion 549edb6c-ede6-4e5e-8140-018a048a3bdb with company_id=comp-sal-359785
    [OK] Duplicate (company_id, promotion_code) rejected: 23505 - ERROR:  duplicate key value violates unique constraint "uq_smriti_promotions_company_code"

  [4] Alembic version: ['v1492_promotions_company_id_unification_wave3']
    [OK] v1492 is head: True

  ======================================================================
  WAVE 3 VERIFICATION: ALL 100% PASSED
  ======================================================================
  ```

## 10. Known Limitations
- The legacy `tenant_id` column remains on all 18 tables in nullable state alongside `company_id` to allow zero-downtime transition for any existing promotion calculation services.
- Removal of `tenant_id` will occur in the Contract phase after full service-layer migration.

## 11. Future Work
- Wave 4: Stock Source-of-Truth Consolidation (`product_batch_stocks` vs `products.stock` cache).
- Wave 5: PSV tables `company_id` + FK hardening (`v1493`).
- Contract Phase: Drop `tenant_id` from promotions tables once service queries are 100% migrated.

## 12. Related ADRs
- ADR-0012: Database Relational Integrity and Financial Immutability Policy
- ADR-DB-002: Storage-Level Invariant Enforcement
- ADR-DB-003: Multi-Tenant Column Standardization (`company_id`)

## 13. Related RFCs
- RFC-DB-001: SMRITI Multi-Tenant Schema Consolidation & Immutability Standard
