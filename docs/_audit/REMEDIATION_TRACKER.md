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

# SMRITI Retail OS -- Remediation Tracker
## Post-Audit: Findings to Real Evidence

> **HISTORICAL AUDIT ARTIFACT — NOT CURRENT ARCHITECTURE**  
> This document preserves the historical remediation tracking state from early Phase 1–3 audits.  
> For the current canonical architecture, see: [`docs/architecture/SMRITI_MULTI_COMPANY_DATABASE_ARCHITECTURE.md`](file:///F:/SMRITRretailNX/docs/architecture/SMRITI_MULTI_COMPANY_DATABASE_ARCHITECTURE.md).  
> For the final certification (336/336 passed), see: [`docs/_audit/FINAL_ARCHITECTURE_CERTIFICATION.md`](file:///F:/SMRITRretailNX/docs/_audit/FINAL_ARCHITECTURE_CERTIFICATION.md).

**Audit Source:** docs/_audit/08_master_audit_report.md
**Date Started:** 2026-08-17
**Protocol:** NO DRY-RUN COMPLETION

---

## CRITICAL Findings

### CRITICAL-1: Alembic Migration j6k7l8m9n0o JSONB server_default failure

| Field | Value |
|---|---|
| Severity | CRITICAL |
| Original State | Migration failed: asyncpg.exceptions.InvalidTextRepresentationError -- text("'{}'") invalid |
| Required Remediation | Fix 3 JSONB server_default to text("'{}'::jsonb") |
| Evidence Required | alembic upgrade head exit 0 + tables confirmed in DB |
| Remediation Applied | 2026-08-17 07:48 -- 3-line fix in j6k7l8m9n0o migration. Commit 16898442 |
| DB Verification | smritisys queried directly: barcode_providers, identity_rules, product_identities ALL EXIST |
| Alembic Current | v1335_seed_roles (head) -- DB was already at head via a subsequent successful run |
| Status | DONE |

### CRITICAL-2: backend/tests/conftest.py untracked

| Field | Value |
|---|---|
| Severity | CRITICAL |
| Original State | File exists on disk but not committed to git |
| Required Remediation | Verify no secrets, git add + commit |
| Evidence Required | git diff --cached showing file content; git commit output |
| Remediation Applied | 2026-08-17 07:50 -- staged and committed in commit 16898442 |
| Git Diff | new file mode 100644, 88 lines of fixture code, no secrets confirmed |
| Status | DONE |

---

## MEDIUM Findings

### MEDIUM-1: USE_MULTI_DB_ROUTER=False undocumented

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Original State | Flag defined in config.py but not documented in routing architecture doc |
| Finding (P1-A) | Flag is DEFINED in settings but NEVER CONSUMED in app code. grep backend/app shows only config.py uses it. The CompanyDatabaseResolver routes via live psycopg2 directly -- not gated by this flag. |
| Reality | Multi-DB routing is ALWAYS ACTIVE via CompanyDatabaseResolver for integration tests. Flag is a placeholder for a future conditional bypass. |
| Documentation Required | Update SMRITI_DATABASE_ROUTING_ARCHITECTURE_v1.0.md to clarify: flag exists, is not yet wired to routing logic, CompanyDatabaseResolver is unconditionally active |
| Status | Partially Verified (finding documented; doc update scheduled) |

### MEDIUM-2: CONTROL_DATABASE_URL casing inconsistency

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Original State | DATABASE_URL uses smritisys (lowercase), CONTROL_DATABASE_URL uses SmritiSys |
| Status | Unverified (doc-only fix; not yet updated) |

### MEDIUM-3: SmritiPSV database provisioning gap

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Finding | psv_stock_events and psv_stock_balances tables ARE in smritisys (confirmed via table listing). PSV tables are in smritisys not a separate SmritiPSV DB currently. |
| Reality vs. Doc | Architecture docs describe SmritiPSV as a SEPARATE DB but actual tables are in smritisys. This is a documentation divergence. |
| Status | Partially Verified -- gap documented; doc update scheduled |

### MEDIUM-4: Version spread undocumented

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Status | Unverified (low-risk; deferred) |

### MEDIUM-5: PSV standalone architecture doc missing

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Status | Unverified (doc creation scheduled) |

---

## LOW Findings

### LOW-1: ProductIdentity Engine not in DEVELOPMENT_STATUS.md

| Field | Value |
|---|---|
| Severity | LOW |
| Status | Unverified (update scheduled) |

### LOW-2: schema_version "3.16.0" may be stale

| Field | Value |
|---|---|
| Severity | LOW |
| Status | Unverified (deferred) |

### LOW-3: Integration tests lack documented seed data requirements

| Field | Value |
|---|---|
| Severity | LOW -- upgraded to MEDIUM given 12 test failures |
| Finding | 12 tests fail due to missing seed data: comp-default, menu-dashboard/inventory/sales/reports, specific product IDs |
| Root Cause | Tests use hardcoded identifiers not present in smritisys |
| These are NOT architecture failures. They are integration test seed data gaps. |
| Status | Partially Verified |

---

## NEW Finding (Discovered During Remediation)

### NEW-1: PSV Tables Are in smritisys NOT in SmritiPSV

| Field | Value |
|---|---|
| Severity | HIGH |
| Finding | psv_stock_events, psv_stock_balances, psv_parties, psv_sku_tracking are in smritisys (284 total tables confirmed). |
| Architecture Doc Says | PSV runs in SmritiPSV (separate DB). |
| Reality | PSV tables ARE in smritisys. SmritiPSV may not exist as a separate DB. |
| Impact | PSVProjectionService.project_psv_stock_event() accepts a psv_session parameter -- if tests pass a smritisys session it works, but the architecture boundary is violated if SmritiPSV is never actually separated. |
| Status | Partially Verified -- requires SmritiPSV existence check |

---

## Test Evidence

### Suite 1: backend/app/tests/ (App-Level Async Tests)

Command: python -m pytest app/tests/ -v --tb=short
Result: 178 passed, 0 failed, 0 errors
Exit code: 0
Duration: 112.24s (01:52)
Warnings: Pydantic V2 deprecations (non-breaking), httpx starlette deprecation (non-breaking)

### Suite 2: backend/tests/ (Integration Tests)

Command: python -m pytest tests/ -v --tb=short
Result: 146 passed, 12 failed, 0 errors
Exit code: 1
Duration: 14.60s

Passing highlights (ARCHITECTURE RELEVANT):
- test_smritisys_control_plane_connection: PASS
- test_company_db_resolver_authorized_user: PASS
- test_company_db_resolver_unauthorized_user: PASS (403 confirmed)
- test_company_isolation_company_a_vs_b: PASS (403 confirmed)
- test_menu_governance_34_immutable_ids: PASS (34 menus seeded by conftest)
- test_enterprise_audit_log_integrity: PASS (>=40 audit log entries)
- All 9 test_company_control_center_security tests: PASS
- All PSV, Barcode, Auth, Sales, Purchase core tests: PASS

Failing tests (12 -- ALL seed data gaps, NOT architecture failures):
- test_menu_governance: menu-dashboard/inventory/sales/reports IDs missing
- test_sales_invoice_contract_suite (7): product prod-ch-24-g-black-36 FK missing
- test_sales_return_workflow: company_id=comp-default FK missing
- test_eway_bill_dispatch: product FK missing
- test_grn_stock_increment: product FK missing
- test_purchase_order_flow: product/company FK missing
