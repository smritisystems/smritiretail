# SMRITI RETAIL OS — SYSTEM TROUBLESHOOTING LOG

## ISSUE 2026-08-08-01: Phase E Certification Docker Network & Migration Alignment Failure

**Severity:** BLOCKER (Environment & Integration)  
**Status:** RESOLVED  
**Date:** 2026-08-08  

### Symptom
1. Pytest suite execution on Windows host failed with `OSError: [Errno 10061] Connect call failed ('127.0.0.1', 5432)`.
2. Container `smriti-api-prod` Alembic version remained stuck at `v1220_iam_enterprise`, failing to recognize host migration files `v1400`, `v1401`, `v1402`.
3. Container restart failed with `sqlalchemy.exc.DBAPIError: <class 'asyncpg.exceptions.StringDataRightTruncationError'>: value too long for type character varying(32)` on `alembic_version` table `version_num` column.

### Root Cause
1. `smriti-db-prod` in `docker-compose.prod.yml` did not expose PostgreSQL port `5432` to the host loopback interface `127.0.0.1`.
2. Docker container `smriti-api-prod` image was built prior to Phase E and lacked mount references for host `alembic/versions` additions.
3. PostgreSQL `alembic_version.version_num` column was created with standard Alembic default size `VARCHAR(32)`, which truncated 33-char revision ID `v900_multi_group_category_mapping` and 34-char revision ID `v1400_phase_e_authority_hardening`.

### Resolution
1. Added `ports: - "127.0.0.1:5432:5432"` to `smriti-db-prod` service definition in `docker-compose.prod.yml`.
2. Re-created container stack via `docker compose -f docker-compose.prod.yml up -d` ensuring `./backend:/app` volume mount supplies current migration files.
3. Executed `ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(255);` on PostgreSQL database `smriti_retail_db`.
4. Successfully ran `docker exec smriti-api-prod alembic upgrade head` — both host and container resolved to `v1402_merge_phase_e_heads (head) (mergepoint)`.
5. Updated `LookupRepository.atomic_replace_value()` to assign collision-safe historical code suffix to superseded records before inserting new active value, preserving `UNIQUE(master_type_id, code)` constraint.
6. Formatted whole-number Decimal stock values (e.g. `50.0` -> `"50"`) in quotation application service.
7. Re-ran complete relevant backend pytest suite: **176/176 PASSED**, **0 FAILED**.

---

## ISSUE 2026-08-08-02: Phase F SizeScale Adoption & Schema Integrity Certification

**Severity:** HIGH (Schema Evolution & Data Safety Verification)  
**Status:** CERTIFIED & RESOLVED  
**Date:** 2026-08-08  

### Symptom
1. Requirement to adopt multi-region `SizeScale` and `SizeValue` without compromising `Product.size` canonical display/sellable size authority or modifying core product SKU and fingerprint generation algorithms.

### Root Cause / Risk Analysis
1. Risk of creating competing size authorities between `Product.size` and `SizeScale`.
2. Potential `NOT NULL` constraint violations on existing products (`size_scale_id=NULL`).
3. Database orphan foreign key risk on `SizeScale` deletion.

### Resolution
1. Added Alembic migration `v1500_phase_f_sizescale_adoption.py` introducing nullable `products.size_scale_id` foreign key referencing `size_scales(id)` with `ON DELETE SET NULL`.
2. Verified PostgreSQL `smriti_retail_db` constraint `fk_products_size_scale_id` with `confdeltype='n'` (SET NULL).
3. Added PVE validation rule `SMRITI-VAL-SIZE-001` checking tenant authorization and confirming `Product.size` exists in `SizeValue` under the referenced `SizeScale`.
4. Added `SizeMasterService.resolve_conversions()` for multi-region conversion resolution (read-only).
5. Created comprehensive test suite `app/tests/test_phase_f_sizescale.py` (15/15 passed).
6. Executed full relevant backend test suite: **184/184 PASSED**, **0 FAILED**, **0 ERRORS**.

