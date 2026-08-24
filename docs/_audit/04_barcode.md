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

# SMRITI Retail OS -- Barcode Subsystem Audit
## Phase 4: Barcode Generation / Import / Lookup / Printing

**Audit Date:** 2026-08-17
**Scope:** Barcode models, ProductIdentity engine, BarcodeProvider, print infrastructure, tests

---

## 1. Barcode Models Reality (backend/app/models/barcode.py)

### Models found:
- BarcodeLayout: barcode_layouts table -- template_id (FK barcode_templates.id), name, layout_json (JSONB), version, is_active
- BarcodeTemplate: barcode_templates table -- code, label, field_schema (JSONB), supported_types, default_format, is_active
- PrintProfile: print_profiles table -- code, label, paper_size, cols, rows, margins (JSONB), renderer, is_active
- PrintHistory: print_histories table -- product_id, layout_id, label_count, print_source, printed_by, print_job_ref, format_used

### Documentation claim (PRODUCT_IDENTITY_ENGINE.md + SMRITI_COMPANY_DATABASE_PROVISIONING_ENGINE_v1.0.md):
- Tables described: barcode_providers, identity_rules, product_identities -- SEPARATE from barcode_layouts/templates

### Status: ALIGNED (models exist in code)

---

## 2. ProductIdentity Engine (backend/app/models/product_identity.py)

### Models found:
- BarcodeProvider: barcode_providers -- name, provider_type, pool_code, priority, config (JSONB), is_active
- IdentityRule: identity_rules -- name, code, scope (JSONB), expression, priority, is_active
- ProductIdentity: product_identities -- product_id, business_key, fingerprint, barcode, state, identity_metadata (JSONB), rule_id, assigned_at
  - Unique constraints: company_id+branch_id+product_id+business_key, company_id+branch_id+barcode

### Status: ALIGNED (models exist in code)

---

## 3. Migration Status for Barcode Tables (CRITICAL)

### Evidence from alembic_status.txt:
- Migration i1j2k3l4m5n (add_user_assignment_tables) -- SUCCEEDED
- Migration j6k7l8m9n0o (add product identity engine tables) -- FAILED
  Error: asyncpg.exceptions.InvalidTextRepresentationError: invalid input syntax for type json
  Cause: JSONB server_default=text("'{}'") -- missing ::jsonb cast

### Therefore:
- barcode_layouts, barcode_templates, print_profiles, print_histories: Status of their migrations is UNKNOWN (depends on which migration number they were in)
- barcode_providers, identity_rules, product_identities: LIKELY NOT IN DB (migration failed)

### Status: FAILED (product identity tables migration broken; barcode core tables status unconfirmed)

---

## 4. Test Evidence (backend/app/tests/test_barcode.py)

Tests confirmed present:
- test_create_barcode_layout: POST /api/v1/barcodes/layouts 201
- test_list_barcode_layouts: GET /api/v1/barcodes/layouts 200
- test_update_barcode_layout: PUT /api/v1/barcodes/layouts/{id} 200
- test_delete_barcode_layout: DELETE /api/v1/barcodes/layouts/{id} 200
- test_print_history_log: POST /api/v1/barcodes/print/history 201
- test_print_history_list: GET /api/v1/barcodes/print/history 200

### Status (test file existence): ALIGNED
### Status (test execution against live DB): UNVERIFIED (no live pytest run output available for barcode tests specifically)

---

## 5. GS1 / EAN-13 Barcode Generation

### Claim (if any in docs): ProductIdentity Engine handles barcode assignment (pool_code, provider_type)
### Evidence: No GS1_COMPANY_PREFIX, EAN13, or ean_13 constants found in backend Python code via grep
### Finding: GS1/EAN-13 standard is NOT implemented in code. Barcode format is provider_type + pool_code string-based. The documentation does NOT claim GS1 implementation.
### Status: ALIGNED (no claim, no implementation -- consistent)

---

## 6. Barcode Lookup

### Evidence:
- backend/app/api/v1/ should contain barcode routes -- not directly inspected but test file imports confirm /api/v1/barcodes/ prefix is active
- ProductIdentity has barcode column with index + uniqueness per company/branch

### Status: ALIGNED (by model and test evidence)

---

## 7. Print Studio (DEVELOPMENT_STATUS.md)

| Item | Frontend | Backend | Database | API | Tests | Overall |
|---|---|---|---|---|---|---|
| Barcode Studio | No | Yes | No | Yes | Yes | 44% |
| Print Studio | Yes | Yes | No | Yes | Yes | 68% |
| Print History Logs | Yes | Yes | No | Yes | Yes | 72% |

### FINDING: DEVELOPMENT_STATUS.md marks Database=No for Barcode Studio and Print Studio, but barcode models DO define DB tables. This is likely a data migration status indicator (tables defined but NOT migrated in test/dev DB) rather than a model absence.
### Status: PARTIALLY_VERIFIED (model exists; database state on device depends on migration success)

---

## 8. Documentation Accuracy for Barcode

### Documents checked:
- PRODUCT_IDENTITY_ENGINE.md: Documents BarcodeProvider, IdentityRule, ProductIdentity -- ALIGNED with models
- PRODUCT_IDENTITY_ENGINE_API_SPEC.md: API spec for identity routes
- System_Master_Barcode_Refactor_v3.28.0.md: walkthrough for barcode refactor

### DISCREPANCY: Documentation claims barcode subsystem is IMPLEMENTED. Migration for product identity tables FAILED. Documentation should be updated to reflect MIGRATION_FAILED state.
### Status: PARTIALLY_VERIFIED (code implemented; DB migration incomplete)
