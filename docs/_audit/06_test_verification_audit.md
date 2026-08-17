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

# SMRITI Retail OS -- Test & Verification Audit
## Phase 6: Tests and Verification Evidence

**Audit Date:** 2026-08-17
**Scope:** Test file inventory, test content vs. claim alignment, pytest execution evidence

---

## 1. Test File Inventory

### backend/app/tests/ (async API tests)
| File | Test Count (approx.) | Scope |
|---|---|---|
| conftest.py | N/A (fixtures) | Test infrastructure |
| test_barcode.py | ~6 | Barcode CRUD + print history |
| test_psv.py | ~4 | PSV projection + idempotency |
| test_masters_consolidation.py | 3 | Company/Branch/Store/Warehouse CRUD + Lookup validation |
| test_auth.py | ~5 | JWT auth endpoints |
| test_sales.py | ~8 | Sales invoice lifecycle |
| test_purchase.py | ~6 | Purchase order lifecycle |
| test_pos.py | ~6 | POS shift/register lifecycle |
| test_inventory.py | ~5 | Product + stock movement |
| test_crm.py | ~4 | Customer + group |
| test_report_schedule.py | ~3 | Report scheduling |
| test_data_exchange.py | ~3 | Data exchange tasks |
| (additional) | ~15+ | Various modules |

### backend/tests/ (integration/runtime tests)
| File | Test Count | Scope |
|---|---|---|
| test_multi_company_database_architecture.py | 5 | Control plane DB, resolver, menu count, audit log |
| test_company_control_center_security.py | 9 | Auth, role enforcement, cross-company isolation |
| test_barcode.py | (unknown) | Barcode runtime integration |
| conftest.py | N/A (untracked file) | Test infrastructure for backend/tests/ |

---

## 2. Test Execution Evidence

### CRITICAL: No successful live pytest run captured during this audit session.

### Evidence available:
- backend/alembic_status.txt: Shows migration run output (NOT pytest output)
- The file backend/pytest_output.txt exists but is UTF-16 encoded and could not be parsed by view_file

### Status: UNVERIFIED (test run terminal output not captured)

---

## 3. Test Content vs. Documentation Claims

### Claim: "CompanyDatabaseResolver rejects unauthorized users with 403"
Evidence: test_multi_company_database_architecture.py test_company_db_resolver_unauthorized_user (line 40-44): raises HTTPException status 403
Status: ALIGNED (test assertion matches claim)

### Claim: "34 immutable smriti_menus rows in smritisys"
Evidence: test_multi_company_database_architecture.py test_menu_governance_34_immutable_ids (line 52-59): SELECT COUNT(*) FROM smriti_menus; asserts == 34
Status: PARTIALLY_VERIFIED (test asserts it; live execution result not confirmed in this session)

### Claim: "Anonymous requests to control center return 401"
Evidence: test_company_control_center_security.py test_01_anonymous_request_rejected_401: asserts 401 on /api/v1/control-center/companies, /api/v1/control-center/lifecycle/action, /api/v1/dev-tracker
Status: ALIGNED (test assertion matches claim)

### Claim: "SYSADMIN can access any company; non-SYSADMIN needs assignment row"
Evidence: test_08 (unassigned cashier -> 403), test_09 (unassigned sysadmin -> 200)
Status: ALIGNED

### Claim: "PSV events are idempotent on source_event_id"
Evidence: test_psv_idempotency in test_psv.py: second projection of same ID returns SKIPPED_ALREADY_PROJECTED
Status: ALIGNED

### Claim: "Lookup validation enforces JSON schema"
Evidence: test_masters_consolidation.py test_lookups_validation_and_soft_delete: invalid type -> 400, additionalProperties violation -> 400
Status: ALIGNED

---

## 4. Migration Bug Impact on Tests

### Finding: The JSONB server_default bug in migration j6k7l8m9n0o means:
- backend/app/tests/conftest.py line 85: "from app.models.product_identity import BarcodeProvider, IdentityRule, ProductIdentity"
- clear_db executes DELETE on these tables (lines 97-99)
- If migration FAILED and tables do not exist, any test that uses clear_db will error at runtime on the DELETE statements

### This means the ENTIRE test suite in backend/app/tests/ may fail to run until the migration bug is fixed.
### Status: FAILED (migration bug blocks test suite)

---

## 5. conftest.py Versions (Two Test Roots)

### backend/app/tests/conftest.py:
- Modified: 2026-08-17 (most recent)
- Uses AsyncSession, settings.DATABASE_URL (smritisys)
- Creates tables via Base.metadata.create_all -- bypasses Alembic
- Therefore: tables are created from ORM models directly. ProductIdentity tables WILL exist in the in-memory/test DB even if migration is broken.
- This means the JSONB migration bug does NOT block the app-level tests (backend/app/tests/) because they use create_all, not Alembic.

### backend/tests/conftest.py:
- Status: UNTRACKED (not committed)
- This means the backend/tests/ integration suite has no committed test configuration.

### FINDING: Backend integration tests (backend/tests/) may have configuration drift -- conftest.py is untracked.
### Status: PARTIALLY_VERIFIED
