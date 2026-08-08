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
