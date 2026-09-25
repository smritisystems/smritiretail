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

# DB Phase 1 Schema Remediation Wave 5 Walkthrough

**Walkthrough ID:** WGP-DB-REM-WAVE5-v1.0.0  
**Area:** Database & Partner Stock Visibility (PSV) Architecture  
**Status:** Completed & Verified  

---

## 1. Purpose
Document the architectural implementation and verification of Phase 1 Schema Remediation Wave 5: PSV Tables Tenant Isolation & Foreign Key Hardening. This wave addresses Category C tenant isolation and referential integrity findings from the Phase 1 Schema Audit by hardening `psv_stock_balances` and `psv_stock_events`. It introduces sovereign tenant reference columns (`company_id`) referencing `companies(id)` with `ON DELETE RESTRICT`, internal catalog links (`product_id`) referencing `products(id)` with `ON DELETE RESTRICT`, multi-column performance indexes, and a composite unique constraint preventing duplicate balance projections per partner and SKU.

## 2. Scope
1. **Alembic Migration (`backend/alembic/versions/v1493_psv_tenant_and_fk_hardening_wave5.py`):**
   - Added `company_id VARCHAR(50)` and `product_id VARCHAR(50)` to `psv_stock_balances` and `psv_stock_events`.
   - Zero-downtime expand migration backfilling `company_id` from existing `company_code` / `companies` table, and `product_id` from matching SKU / code in `products`.
   - Created B-tree indexes:
     - `idx_psv_balances_company_id` on `psv_stock_balances(company_id)`
     - `idx_psv_balances_product_id` on `psv_stock_balances(product_id)`
     - `idx_psv_balances_company_party_sku` on `psv_stock_balances(company_id, psv_party_id, sku)`
     - `idx_psv_events_company_id` on `psv_stock_events(company_id)`
     - `idx_psv_events_product_id` on `psv_stock_events(product_id)`
     - `idx_psv_events_company_party_sku` on `psv_stock_events(company_id, psv_party_id, sku)`
   - Created unique constraint `uq_psv_stock_balances_party_sku` on `psv_stock_balances(company_code, psv_party_id, sku)`.
   - Created foreign key constraints with `ON DELETE RESTRICT`:
     - `fk_psv_balances_company_id_restrict` (`psv_stock_balances.company_id` -> `companies.id`)
     - `fk_psv_balances_product_id_restrict` (`psv_stock_balances.product_id` -> `products.id`)
     - `fk_psv_events_company_id_restrict` (`psv_stock_events.company_id` -> `companies.id`)
     - `fk_psv_events_product_id_restrict` (`psv_stock_events.product_id` -> `products.id`)
   - Fully reversible `downgrade()` drop operations.
2. **SQLAlchemy ORM Model Synchronization (`backend/app/models/psv.py`):**
   - Synchronized `PSVStockBalance` and `PSVStockEvent` classes to declare `company_id`, `product_id`, `Index`, and `UniqueConstraint`.
   - Declared relationships to `Company` and `Product`.
3. **Automated Verification Suite (`scratch/verify_wave5_psv_hardening.py`):**
   - Programmatic verification of schema AST, foreign keys, unique constraint, indexes, and transactional DML integrity.

## 3. Files Created
- `backend/alembic/versions/v1493_psv_tenant_and_fk_hardening_wave5.py`
- `docs/walkthrough/db/DB_Phase1_Schema_Remediation_Wave5_v1.0.0.md`

## 4. Files Modified
- `backend/app/models/psv.py`
- `docs/implementation/db/Phase1_Schema_Remediation_Plan_v1.0.0.md`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **ADR-DB-005: Tenant Isolation and Catalog Decoupling in PSV Projections**:
  1. *Direct Tenant Isolation:* Both PSV balance projections and event ledgers carry `company_id` with strict referential integrity to `companies(id)`.
  2. *Asynchronous Catalog Resolution:* `product_id` is nullable. In external retail partner integrations, feeds ingest vendor/partner SKUs that may not immediately exist in the local product catalog. Making `product_id` nullable allows ingestion to succeed while maintaining referential safety (`RESTRICT`) once resolved.
  3. *Balance Projection Uniqueness:* Multiple events update the same partner balance, but each `(company_code, psv_party_id, sku)` tuple must map to exactly one projected balance record. The `uq_psv_stock_balances_party_sku` constraint enforces this invariant at the database level.
  4. *Anti-Cascade Protection:* Master tenant records in `companies` and catalog items in `products` cannot be deleted if active partner balances or audit events reference them (`ON DELETE RESTRICT`).

## 6. Design Rationale
In earlier versions, PSV tables used unconstrained string identifiers (`company_code`, `sku`) without foreign key enforcement. This posed two risks:
1. Orphaned projection records if a company was restructured or deleted.
2. Silent duplicate projection rows for the same partner and SKU when partner feeds arrived out of order.
Adding `company_id` and `product_id` with `RESTRICT` and adding the compound unique constraint resolves both risks while maintaining backward compatibility with the existing `company_code` string fields.

## 7. Implementation Summary
1. **Migration Creation & Formatting:** Created `v1493_psv_tenant_and_fk_hardening_wave5.py` following Alembic conventions and validated against Ruff linter.
2. **Migration Execution:** Executed `alembic upgrade head` on `smritisys` (control) and `smriti001` (tenant).
3. **Reversibility Testing:** Tested downgrade to `v1492` and re-upgrade to `v1493` on live PostgreSQL instance; confirmed zero-error execution.
4. **ORM Model Alignment:** Updated `backend/app/models/psv.py` with `company_id`, `product_id`, composite indexes, and `uq_psv_stock_balances_party_sku`.

## 8. Tests Executed
1. **Linter & Code Formatting:**
   ```bash
   python -m ruff check backend/alembic/versions/v1493_psv_tenant_and_fk_hardening_wave5.py backend/app/models/psv.py
   ```
2. **Alembic Reversibility Test:**
   ```bash
   python -m alembic -x target=control -x db=smritisys downgrade v1492_promotions_company_id_unification_wave3
   python -m alembic -x target=control -x db=smritisys upgrade head
   ```
3. **Tenant Migration Execution:**
   ```bash
   python -m alembic -x target=tenant -x db=smriti001 upgrade head
   ```
4. **Automated Verification Suite:**
   ```bash
   python scratch/verify_wave5_psv_hardening.py
   ```

## 9. Verification Results

### Linter Output
```text
All checks passed!
```

### Alembic Current Heads
```text
Control (smritisys): v1493_psv_tenant_and_fk_hardening_wave5 (head)
Tenant (smriti001) : v1493_psv_tenant_and_fk_hardening_wave5 (head)
```

### Automated Verification Terminal Output
```text
======================================================================
WAVE 5 VERIFICATION — PSV TENANT & FK HARDENING
======================================================================

[1] Column Checks: company_id & product_id
  [OK] psv_stock_balances.company_id (character varying, nullable=YES)
  [OK] psv_stock_balances.product_id (character varying, nullable=YES)
  [OK] psv_stock_events.company_id (character varying, nullable=YES)
  [OK] psv_stock_events.product_id (character varying, nullable=YES)

[2] Foreign Key Constraints (RESTRICT)
  [OK] psv_stock_balances.fk_psv_balances_company_id_restrict -> companies (ON DELETE RESTRICT)
  [OK] psv_stock_balances.fk_psv_balances_product_id_restrict -> products (ON DELETE RESTRICT)
  [OK] psv_stock_events.fk_psv_events_company_id_restrict -> companies (ON DELETE RESTRICT)
  [OK] psv_stock_events.fk_psv_events_product_id_restrict -> products (ON DELETE RESTRICT)

[3] Unique Constraint: uq_psv_stock_balances_party_sku
  [OK] psv_stock_balances.uq_psv_stock_balances_party_sku on (company_code, psv_party_id, sku)

[4] Index Verification
  [OK] psv_stock_balances.idx_psv_balances_company_id
  [OK] psv_stock_balances.idx_psv_balances_product_id
  [OK] psv_stock_balances.idx_psv_balances_company_party_sku
  [OK] psv_stock_events.idx_psv_events_company_id
  [OK] psv_stock_events.idx_psv_events_product_id
  [OK] psv_stock_events.idx_psv_events_company_party_sku

[5] Transactional DML Integrity Tests
  [OK] Inserted valid psv_stock_balances row BAL-cdcff64d
  [OK] Duplicate (company_code, psv_party_id, sku) rejected: 23505
  [OK] Product deletion blocked by RESTRICT: 23503
  [OK] Company deletion blocked by RESTRICT: 23503

[6] Alembic Version Check
  Current DB version: ['v1493_psv_tenant_and_fk_hardening_wave5']
  [OK] v1493_psv_tenant_and_fk_hardening_wave5 is active in database

======================================================================
WAVE 5 VERIFICATION: ALL 100% PASSED (STATUS: DONE)
======================================================================
```

**Status:** Done (100% verified with literal output)

## 10. Known Limitations
- When external partner feeds contain new SKUs unmapped in `products`, `product_id` remains NULL until background mapping reconciler runs.

## 11. Future Work
- **Wave 6:** Child table tenant enforcement decision across Category C tables (evaluating RLS with session variables vs. explicit `company_id` propagation).
- Implement automated SKU auto-discovery background task mapping newly registered partner SKUs to catalog `products.id`.

## 12. Related ADRs
- `ADR-DB-001`: Zero-Downtime Expand/Contract Migrations
- `ADR-DB-005`: Tenant Isolation and Catalog Decoupling in PSV Projections

## 13. Related RFCs
- `RFC-DB-001`: Database Schema Audit & Remediation Standard
