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

# SMRITI Retail OS -- Database Audit
## Phase 3: Database & Multi-Company Audit

**Audit Date:** 2026-08-17
**Scope:** schema model reality, company_database_registries, master ownership, schema governance, consolidation

---

## 1. Company Database Registry

### Source: backend/app/models/company_database_registry.py

Schema fields confirmed present:
- company_id (FK -> companies.id)
- database_name (e.g. "smriti001")
- database_status (PROVISIONING / READY / SUSPENDED / ARCHIVED / DECOMMISSIONED / PROVISION_FAILED)
- schema_version
- health_check_at

### Documentation alignment: ALIGNED with SMRITI_COMPANY_DATABASE_LIFECYCLE_v1.0.md lifecycle states

### Status: ALIGNED

---

## 2. Control Plane Tables (smritisys)

### Claim: 248 total tables classified in SMRITI_CONTROL_PLANE_AUDIT_v1.0.md
### Evidence: SMRITI_CONTROL_PLANE_AUDIT_v1.0.md states "Total Tables Classified: 248 tables" "ZERO database mutations verified"
### Note: The Excel workbook SMRITI_Control_Plane_Architecture_Review.xlsx is referenced as source of evidence but binary -- not parseable in audit.
### Cannot verify 248-table claim from code inspection alone.
### Status: PARTIALLY_VERIFIED

---

## 3. Master Ownership Boundary

### Claim: Masters (Company, Branch, Store, Warehouse, Product, Supplier, Customer) live in smritisys
### Evidence:
- backend/app/models/tenant.py: Company, Branch with company_id/branch_id scope columns
- backend/app/tests/test_masters_consolidation.py: tests /api/v1/masters/companies, /api/v1/masters/branches, /api/v1/masters/stores, /api/v1/masters/warehouses via AsyncClient against smritisys DATABASE_URL
- backend/app/tests/conftest.py db_engine fixture uses settings.DATABASE_URL = smritisys

### Documentation claims: SMRITI_CONFIGURATION_OWNERSHIP_MATRIX_v1.0.md Row "COMPANY SETTINGS": "REUSE companies table for enterprise identity & setup -- smritisys"
### Status: ALIGNED

---

## 4. Operational (Business) Data Boundary

### Claim: Sales, POS, Stock, Purchases, Ledgers live in Company DB (smriti<code>)
### Evidence:
- backend/app/models/sales.py, pos.py, purchase.py, inventory.py: All have company_id + branch_id columns enforced in unique constraints
- backend/app/db/company_router.py: routes requests to company-specific DB
- conftest.py clear_db function clears all these tables from a single test engine -- consistent with single-DB test mode

### FINDING: In test mode (USE_MULTI_DB_ROUTER=False), ALL models including operational data are in smritisys. The documentation does not explicitly state this test-mode behavior.
### Status: PARTIALLY_VERIFIED (test behavior diverges from production architecture intent)

---

## 5. smriti_menus Governance

### Claim: 34 immutable menu IDs in smritisys; menu IDs must never change
### Evidence:
- backend/tests/test_multi_company_database_architecture.py line 56-59: SELECT COUNT(*) FROM smriti_menus asserts count == 34
- backend/app/tests/conftest.py line 141: DELETE FROM smriti_menus (test teardown -- clears menus in test DB)

### DISCREPANCY: Test teardown clears smriti_menus. If test runs against smritisys (not a test-specific DB), this would destroy production data. The test uses a separate in-memory/test-only DB engine -- this is safe.
### However, the test count assertion (== 34) only passes if seed data is present. Whether seed migrations inject 34 menu rows is not verifiable from code alone.
### Status: PARTIALLY_VERIFIED

---

## 6. Schema Governance / Versioning

### Claim: schema_version = "3.16.0" in company_database_registries
### Evidence:
- SMRITI_COMPANY_DATABASE_PROVISIONING_ENGINE_v1.0.md Dry-Run Step 6: "schema_version": "3.16.0"
- SMRITI_COMPANY_DATABASE_LIFECYCLE_v1.0.md line 43: health check verifies "schema_version (3.16.0)"
- backend/app/models/company_database_registry.py: schema_version column exists

### FINDING: DEVELOPMENT_STATUS.md generated date 2026-08-17 and CHANGELOG records version 3.25.0+ in some walkthroughs, but schema_version docs still reference 3.16.0. This version may be stale.
### Status: PARTIALLY_VERIFIED

---

## 7. Consolidation (Multi-table Reduction)

### Claim: Masters consolidation reduced tables via REUSE strategy; ZERO new Control Plane tables required
### Evidence:
- SMRITI_CONTROL_PLANE_AUDIT_v1.0.md: "ZERO new database tables are required"
- SMRITI_CONFIGURATION_OWNERSHIP_MATRIX_v1.0.md: All 25 configuration areas mapped to existing tables
- Walkthrough Foundation_Master_Data_Consolidation_v3.17.0.md: existence confirmed in file inventory

### Status: ALIGNED (by documentation; DB state unverifiable without live connection)

---

## 8. Migration Failures (CRITICAL OPEN ITEM)

### Finding from Phase 0:
- Migration j6k7l8m9n0o (add product identity engine tables) FAILED in alembic_status.txt
- Tables barcode_providers, identity_rules, product_identities may NOT exist in smritisys
- The PRODUCT_IDENTITY_ENGINE.md architecture doc claims these tables are IMPLEMENTED
- This is a DOCUMENTATION vs REALITY DISCREPANCY

### Status: FAILED (documentation claims IMPLEMENTED but migration is broken)
