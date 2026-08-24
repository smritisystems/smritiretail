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

# SMRITI Retail OS -- Architecture Audit
## Phase 2: Multi-Company Database Architecture

**Audit Date:** 2026-08-17
**Verification Method:** Direct source code inspection via grep + view_file
**Scope:** Multi-company DB topology, control plane identity, naming convention, routing, isolation

---

## 1. Architecture Claim vs. Reality

### Claim (from SMRITI_MULTI_COMPANY_DATABASE_ARCHITECTURE_v1.0.md):
"smritisys is the single Control Plane database. Each company gets a physically isolated database named smriti<3-digit-code> (e.g. smriti001)."

### Evidence (Code):
- backend/app/core/config.py line 35-40: DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys"
- backend/app/core/config.py line 161: PSV_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/SmritiPSV"
- backend/app/models/control/control_models.py line 91: psv_database_name = Column(String(100), nullable=False, default="SmritiPSV")
- backend/app/services/company_database_resolver.py (CompanyDatabaseResolver): Resolves smriti<code> per company

### Status: ALIGNED

---

## 2. smritisys Control Plane Identity

### Claim: smritisys holds companies, company_database_registries, smriti_menus, smriti_audit_log, roles, users
### Evidence:
- backend/app/models/tenant.py: Company, Branch models with __tablename__ = "companies", "branches"
- backend/tests/test_multi_company_database_architecture.py line 22: CONTROL_PLANE_URL = "postgresql://postgres:postgres@localhost:5432/smritisys"
- backend/tests/test_multi_company_database_architecture.py lines 54-59: SELECT COUNT(*) FROM smriti_menus asserts count == 34
- backend/tests/test_multi_company_database_architecture.py lines 61-68: SELECT COUNT(*) FROM smriti_audit_log asserts count >= 40
- backend/app/tests/conftest.py line 141-142: DELETE FROM smriti_menus; DELETE FROM smriti_audit_log; (test teardown)

### Status: ALIGNED

---

## 3. Company Database Naming Convention

### Claim: smriti<3-digit-code> (e.g. smriti001)
### Evidence:
- SMRITI_COMPANY_DATABASE_PROVISIONING_ENGINE_v1.0.md Dry-Run Step 3: "database_name": "smriti001"
- backend/app/api/v1/company_control_center.py line 43: ValidateCodeRequest field description "3-character alphanumeric code [A-Z0-9]"
- backend/app/services/company_database_resolver.py: function generate_company_database_name(company_code) -> str

### Status: ALIGNED

---

## 4. CompanyDatabaseResolver

### Claim: Single authoritative resolver at app.services.company_database_resolver.CompanyDatabaseResolver
### Evidence:
- backend/app/services/company_database_resolver.py: CompanyDatabaseResolver class exists
- backend/app/api/v1/company_control_center.py lines 19-23: imports CompanyDatabaseResolver, generate_company_database_name, validate_company_database_name
- backend/tests/test_multi_company_database_architecture.py line 35-36: CompanyDatabaseResolver.resolve_company_database("usr_sysadmin","COMP-001") asserts company_id == "COMP-001"
- backend/tests/test_multi_company_database_architecture.py line 40-44: unauthorized user gets HTTPException 403

### Status: ALIGNED

---

## 5. LRU Connection Pool Manager

### Claim: LRUConnectionPoolManager caches per-company AsyncEngine instances with LRU eviction
### Evidence:
- backend/app/db/connection_manager.py: LRUConnectionPoolManager using OrderedDict
- Max pool size configurable; LRU eviction disposes least-recently-used engine

### Status: ALIGNED

---

## 6. Multi-DB Router Feature Flag

### Claim: USE_MULTI_DB_ROUTER controls whether cross-company DB routing is active
### Evidence:
- backend/app/core/config.py: USE_MULTI_DB_ROUTER: bool = False (DEFAULT = DISABLED)
- The router guard logic in backend/app/db/company_router.py references this flag

### DISCREPANCY: Feature flag defaults OFF. Documentation does NOT prominently state that multi-DB routing is currently DISABLED by default.
### Status: PARTIALLY_VERIFIED

---

## 7. JSONB Server Default Migration Bug (CRITICAL FINDING)

### Evidence:
- backend/alembic_status.txt shows migration j6k7l8m9n0o (product identity engine tables) errored:
  asyncpg.exceptions.InvalidTextRepresentationError: invalid input syntax for type json
  DETAIL: Token "'" is invalid.
- Root cause: server_default=text("'{}'") is not valid asyncpg JSONB syntax; should use server_default=text("'{}'::jsonb") or cast("{}","jsonb")
- Affected tables: barcode_providers, identity_rules, product_identities
- These tables may NOT exist in current database smritisys

### Status: FAILED (Migration incomplete)

---

## 8. Cross-Company Isolation Enforcement

### Claim: Company A user cannot access Company B data
### Evidence (tests):
- backend/tests/test_company_control_center_security.py test_05_company_a_user_accessing_company_b_returns_403: asserts 403 for /api/v1/control-center/companies/COMP-002
- backend/tests/test_company_control_center_security.py test_08: unassigned user gets 403 with "not authorized to access Company"
- backend/app/db/company_router.py: guards API-level routing

### Status: ALIGNED (by test evidence; cannot confirm DB-level isolation without live DB connection)

---

## 9. Database Naming Inconsistency (FINDING)

### Evidence:
- backend/app/core/config.py line 35: DATABASE_URL = ".../smritisys" (lowercase)
- backend/app/core/config.py line 155: CONTROL_DATABASE_URL = ".../SmritiSys" (mixed case)
- PostgreSQL is case-insensitive for DB names by default, but this inconsistency is undocumented

### Documentation impact: None of the architecture docs acknowledge this dual-casing.
### Status: PARTIALLY_VERIFIED (inconsistency not acknowledged in docs)
