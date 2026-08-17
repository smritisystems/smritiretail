<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Version      : 3.16.0
  Created      : 2026-08-17
  Modified     : 2026-08-17
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal -- Audit Artifact
-->

# SMRITI POST-AUDIT REMEDIATION REPORT
## ANTIGRAVITY MASTER COMMAND v2.0 -- Real Verification Phase

**Date:** 2026-08-17
**Branch:** smritiNX | **Commit:** 16898442
**Protocol:** NO DRY-RUN COMPLETION -- All claims backed by real executable evidence

---

## Previous Audit (Baseline)

Audit performed same session. 9 audit checkpoint files in docs/_audit/. Found 2 critical, 5 medium, 3 low findings.

---

## Findings Addressed

### CRITICAL-1: Migration j6k7l8m9n0o JSONB server_default
DONE

Evidence:
- Fix applied: text("'{}'") -> text("'{}'::jsonb") on lines 28, 51, 80
- Committed in 16898442
- DB queried: barcode_providers, identity_rules, product_identities confirmed in smritisys
- alembic current: v1335_seed_roles (head)

### CRITICAL-2: backend/tests/conftest.py untracked
DONE

Evidence:
- git diff --cached showed 88-line fixture file, no secrets
- Committed in 16898442 as new file mode 100644

---

## NEW Findings Discovered During Remediation

### NEW-1: smriti001 Already Exists (Physical Company DB CONFIRMED)
DONE (Better than expected)

Evidence:
SELECT datname FROM pg_database WHERE datname ILIKE 'smriti*':
  smriti001  -- 99 tables
  smritisys  -- 284 tables
  smriti_test_fresh

SELECT company_id, database_name, status, schema_version FROM company_database_registries:
  ('COMP-001', 'smriti001', 'READY', '3.16.0')

Reality: Physical multi-company isolation IS achieved. smriti001 is provisioned and registered READY.

### NEW-2: SmritiPSV Does NOT Exist as Separate Database
PARTIALLY_VERIFIED

Evidence:
pg_database query for SmritiPSV: NOT FOUND

Reality: PSV tables (psv_stock_events, psv_stock_balances, psv_parties, psv_sku_tracking) are in smritisys (284-table count confirmed). SmritiPSV as a separate database does not exist.

Architecture documents describe SmritiPSV as separate -- this is DOCUMENTATION DIVERGENCE.
PSV is functionally working (tests pass) but is currently co-located in smritisys.

### NEW-3: USE_MULTI_DB_ROUTER is a Placeholder Flag
PARTIALLY_VERIFIED

Evidence:
grep backend/app for USE_MULTI_DB_ROUTER: found ONLY in config.py (definition) + test_production_certification_suite.py (assertion)
Flag is NOT consumed anywhere in routing logic.

Reality: CompanyDatabaseResolver routes unconditionally by querying smritisys.company_database_registries.
Multi-DB routing IS functional (smriti001 exists and is registered).
The flag exists as documentation placeholder -- not a gating mechanism.

---

## Database Migration
PASS

Command: python -m alembic current
Output: v1335_seed_roles (head)
Exit code: 0

Tables confirmed in smritisys:
barcode_providers -- PRESENT
identity_rules -- PRESENT
product_identities -- PRESENT

---

## Real Company DB Provisioning
PASS

Evidence:
smriti001 database: EXISTS (99 tables)
company_database_registries entry: ('COMP-001', 'smriti001', 'READY', '3.16.0')

This is NOT a dry-run result. smriti001 is a real PostgreSQL database.

---

## Multi-DB Router
PARTIALLY_VERIFIED

The routing infrastructure IS functional:
- CompanyDatabaseResolver queries smritisys live and resolves to smriti001
- company_database_registries confirms COMP-001 -> smriti001 -> READY

The USE_MULTI_DB_ROUTER flag is a placeholder (not wired to routing logic).
Physical routing works without the flag.

---

## Physical Company Isolation
PASS (by test + DB evidence)

Evidence:
test_company_isolation_company_a_vs_b: PASSED
test_company_db_resolver_unauthorized_user: PASSED (403)
test_05_company_a_user_accessing_company_b_returns_403: PASSED

smriti001 is a separate PostgreSQL database with its own schema.
Cross-company data access is rejected at resolver level.

---

## Cross-Company Security
PASS

Evidence:
test_01 through test_09 in test_company_control_center_security.py: ALL PASSED
Anonymous: 401
Spoofed header: 401
Invalid token: 401
Company A token accessing Company B: 403
Non-SYSADMIN lifecycle action: 403
Unassigned user: 403

---

## Barcode
PASS (code + DB tables confirmed; runtime API tests passing)

Evidence:
barcode_providers, identity_rules, product_identities: CONFIRMED IN smritisys
test_barcode.py: PASSED (in app/tests/ suite)
test_product_identity.py: PASSED

Note: GS1/EAN-13 NOT implemented -- confirmed by grep; no claim was made for it.

---

## PSV
PARTIALLY_VERIFIED

Evidence:
psv_stock_events, psv_stock_balances, psv_parties, psv_sku_tracking: CONFIRMED IN smritisys
test_psv.py: PASSED (in app/tests/ suite)
PSV boundary respected: service writes only to PSVStockEvent/PSVStockBalance, not to products/stock_movements

Gap: SmritiPSV as separate database does NOT exist.
PSV is co-located in smritisys. Architecture docs should be updated to reflect this.

PSV ARCHITECTURE BOUNDARY: Not violated. PSV does not modify core inventory. ALIGNED.

---

## Test Infrastructure
PASS

Evidence:
backend/tests/conftest.py: committed (16898442)
All architecture-relevant tests pass (control plane, resolver, security, isolation, PSV, barcode)

---

## Test Execution

### Suite 1: backend/app/tests/ (178 tests)

Command: python -m pytest app/tests/ -v --tb=short
Exit code: 0
Result: 178 passed, 0 failed, 0 errors
Duration: 112.24s

### Suite 2: backend/tests/ (158 tests)

Command: python -m pytest tests/ -v --tb=short
Exit code: 1
Result: 146 passed, 12 failed, 0 errors
Duration: 14.60s

Architecture-relevant tests ALL PASSED:
- test_smritisys_control_plane_connection: PASS
- test_company_db_resolver_authorized_user: PASS
- test_company_db_resolver_unauthorized_user: PASS
- test_company_isolation_company_a_vs_b: PASS
- test_menu_governance_34_immutable_ids: PASS
- test_enterprise_audit_log_integrity: PASS
- test_01 through test_09 (company_control_center_security): ALL PASS

12 failures -- ALL seed data gaps (NOT architecture failures):
- test_menu_governance: missing menu-dashboard, menu-inventory, menu-sales, menu-reports IDs
- test_sales_invoice_contract_suite (7 tests): missing product prod-ch-24-g-black-36
- test_sales_return_workflow: company_id=comp-default not in companies table
- test_eway_bill_dispatch: product FK violation
- test_grn_stock_increment: product FK violation
- test_purchase_order_flow: product/company FK violation

These 12 tests reference hardcoded IDs not seeded by conftest.py.
They require a dedicated seed data script or are designed to run against a pre-seeded state.

---

## Documentation
PARTIAL

Updated/Created:
- docs/_audit/ (9 files): DONE (committed 16898442)
- docs/_audit/REMEDIATION_TRACKER.md: DONE (this session)
- docs/_audit/FINAL_REMEDIATION_REPORT.md: DONE (this file)

Pending (MEDIUM priority):
- PRODUCT_IDENTITY_ENGINE.md: update migration status to PASS (tables confirmed)
- SMRITI_DATABASE_ROUTING_ARCHITECTURE_v1.0.md: document flag as placeholder
- Create SMRITI_PSV_ARCHITECTURE_v1.0.md with co-location finding
- DEVELOPMENT_STATUS.md: add Product Identity Engine row

---

## Unverified Items

| Item | Reason |
|---|---|
| SmritiPSV separate DB provisioning | DB does not exist; PSV works in smritisys currently |
| 12 integration test seed data gaps | Hardcoded IDs not in smritisys; need dedicated seed script |
| Pydantic V2 deprecation warnings | Non-breaking; 5 uses of parse_raw in user.py need updating |
| PSV architecture document | Creation pending |

---

## Critical Blockers
NONE for architecture correctness.

12 test failures are seed data gaps, not architecture failures.
Architecture, resolver, isolation, PSV boundary, barcode, auth all verified.

---

## Production Readiness

NOT PRODUCTION READY

Reason: 12 integration tests fail due to missing seed data.

Certification gate status:
[x] Product Identity migration -- PASS (tables confirmed in DB)
[x] Actual PostgreSQL tables exist -- PASS (284 in smritisys)
[x] Control Plane verified -- PASS (smritisys + company_database_registries)
[x] Company DBs physically exist -- PASS (smriti001 confirmed)
[x] CompanyDatabaseResolver routes correctly -- PASS (test evidence)
[~] Multi-DB router -- PARTIALLY_VERIFIED (routing works; flag is placeholder)
[x] Company A/B isolation passes -- PASS (test evidence)
[x] Cross-company attack tests pass -- PASS (403 confirmed)
[ ] Connection/context leak tests -- UNVERIFIED (no concurrent test run)
[x] Barcode DB structures exist -- PASS (tables confirmed)
[x] Barcode core tests pass -- PASS (app tests)
[ ] Barcode company isolation (A vs B operational) -- UNVERIFIED
[~] PSV provisioning -- PARTIAL (tables in smritisys, not separate SmritiPSV)
[x] PSV ledger tests pass -- PASS (app tests)
[ ] PSV isolation (A vs B) -- UNVERIFIED
[x] Core Inventory boundary -- PASS (PSV does not modify core)
[x] Test infrastructure reproducible -- PASS (conftest committed)
[~] Test suites pass -- PARTIAL (178/178 app; 146/158 integration)
[~] Documentation reflects actual results -- PARTIAL (pending 4 doc updates)
[ ] Git working tree clean -- UNVERIFIED (some unstaged working tree changes remain)

Blockers to PRODUCTION READY:
1. 12 seed data gaps in integration tests
2. PSV runs in smritisys not SmritiPSV (doc/arch gap)
3. Connection pool leak test not executed
4. 4 pending documentation updates

---

## Evidence Summary

| Item | Evidence Type | Command |
|---|---|---|
| Migration fix | git diff in commit 16898442 | git commit output |
| Tables in smritisys (284) | Live DB query | psycopg2 SELECT table_name |
| barcode/identity tables | Live DB query | psycopg2 IN clause |
| smriti001 exists (99 tables) | Live DB query | pg_database + information_schema |
| company_database_registries | Live DB query | SELECT company_id, database_name, status |
| App tests 178/178 | pytest stdout | python -m pytest app/tests/ |
| Integration tests 146/158 | pytest stdout | python -m pytest tests/ |
| Security tests 9/9 | pytest stdout | subset of integration tests |
| conftest.py committed | git diff --cached | 88-line diff shown |
| Alembic at head | CLI output | python -m alembic current |
