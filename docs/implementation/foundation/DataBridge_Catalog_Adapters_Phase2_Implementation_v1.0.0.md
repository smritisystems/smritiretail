<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-06
  Modified     : 2026-10-06
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal — Implementation Plan & Final Execution Report
-->

# SMRITI DataBridge Phase 2 — Catalog Domain Adapters Implementation Plan & Execution Report

## 1. Objective
Deliver the canonical **SMRITI DataBridge Catalog Domain Adapters** (Phase 2), enabling high-integrity, multi-tenant, preview-first data ingestion, update, and reconciliation for Item Masters, Variants, Barcodes, and PriceBook Entries across all supported input formats without duplicating core catalog logic or compromising transactional database constraints.

## 2. Business Motivation
Retailers migrating from legacy POS/ERP software or bulk-uploading seasonal catalogs frequently face corrupted or conflicting master data due to lack of pre-import validation, unverified barcodes, or unapproved master lookup values. SMRITI DataBridge solves this with a 7-stage preview-and-commit lifecycle, strict header aliasing, zero-mutation previews, cryptographic tamper-proofing, and automated reconciliation against existing canonical catalog services.

## 3. Scope
- **Domain Scope:** Catalog entities — `ITEM`, `VARIANT`, `BARCODE`, and `PRICEBOOK`.
- **Service Boundary:** Canonical adapters under `backend/app/services/databridge/adapters/` extending `BaseDataBridgeAdapter`.
- **API Boundary:** Universal and entity-specific `/api/v1/databridge/{entity}/preview` and `/commit` endpoints.
- **Contract Boundary:** Preview tokens with cryptographic SHA-256 payload digests, 30-minute expiry, candidate diffing, and mandatory explicit confirmation.
- **Non-Goals:** Modifying legacy `backend/app/api/v1/exchange.py`, executing database migrations, or altering tenant business records outside governed DataBridge operations.

## 4. Current State
- Phase 1 Core Foundation established security, tenant isolation boundary (`smritisys` prohibition), WORM compliance auditing, and capability entitlement (`cap_databridge`).
- Phase 2A audit verified that Item Master, Variant, Barcode, Validation, and PriceBook services exist and must be reused.
- Canonical services: `ItemCatalogService`, `ItemDomainService`, `IM001ControlledFieldValidator`, `CatalogDimensionValidator`, and `ItemPricingSyncService`.

## 5. Gap Analysis
Prior to Phase 2:
- No preview or commit orchestration existed for catalog bulk imports.
- External formats (e.g., `"Item Code"`, `"Barcode"`, `"Cost"`, `"MRP"`) could not be automatically mapped or validated against controlled master values in `smritisys`.
- Barcode assignment lacked strict cross-SKU collision detection and immutability guards in import pipelines.
- PriceBook import lacked composite matrix validation (`company_id`, `price_book_id`, `variant_id`, `min_quantity`) and statutory pricing checks (`mrp >= selling_price`).

## 6. Architecture Impact
- **Architecture Entities & Capabilities:** Registered capability `databridge.catalog_adapters` under entity `databridge` linked to `ADR-DATABRIDGE-01`.
- **Zero Schema Migrations:** All catalog tables (`items`, `item_variants`, `item_barcodes`, `price_book_entries`, `item_uom_settings`, `item_prices`, `item_tax_profiles`, `item_sales_settings`, `item_supplier_settings`, `item_inventory_policies`) already exist and are strictly reused.
- **Zero Control Plane Contamination:** Catalog data operations execute strictly within tenant databases resolved via `TenantContext` / `get_company_db`.

## 7. Proposed Design
```
External Data (CSV / JSON / API)
         │
         ▼
[BaseDataBridgeAdapter]
  1. Normalize (Header aliases via HeaderAliasRegistry & FIELD_EXTRACTION_MAP)
  2. Validate (IM001ControlledFieldValidator against master_values in smritisys)
  3. Match (Canonical resolution: item_code -> identity_code -> style+brand)
  4. Diff (Detect field additions / updates, produce DataBridgeDiff)
  5. Classify (CREATE, UPDATE, NO_CHANGE, EXISTING_CONFLICT, VALIDATION_ERROR, DEPENDENCY_ERROR)
         │
         ▼
[DataBridgeService.execute_preview]
  - In-memory candidate evaluation (Zero DB mutation)
  - Generate 30-min preview token & SHA-256 payload digest
         │
         ▼
[DataBridgeService.execute_commit]
  - Verify token validity & expiration
  - Verify payload SHA-256 tamper-proof digest
  - Require explicit user confirmation flag (`confirmed=True`)
  - Execute within atomic transaction
  - Write WORM audit entry to `compliance_immutable_audit_logs`
```

## 8. Files Created
1. `backend/app/services/databridge/adapters/__init__.py`: Adapters package facade.
2. `backend/app/services/databridge/adapters/base_adapter.py`: Abstract base adapter with 7-stage lifecycle and header aliasing.
3. `backend/app/services/databridge/adapters/item_adapter.py`: Item Master adapter delegating to `ItemCatalogService` and `IM001ControlledFieldValidator`.
4. `backend/app/services/databridge/adapters/variant_adapter.py`: Variant adapter enforcing parent existence, color/size dimensions, and 6 child policy entities.
5. `backend/app/services/databridge/adapters/barcode_adapter.py`: Barcode adapter enforcing 4-rule barcode lifecycle and cross-SKU clash rejection.
6. `backend/app/services/databridge/adapters/pricebook_adapter.py`: PriceBook adapter enforcing composite uniqueness and `mrp >= selling_price`.
7. `backend/tests/test_databridge_phase2_catalog.py`: Comprehensive test suite containing 16 test cases covering all catalog requirements.
8. `scripts/register_databridge_phase2_architecture.py`: Architecture registration and Preflight certificate issuance script.

## 9. Files Modified
1. `backend/app/services/databridge/models.py`: Added Phase 2 DTOs (`DataBridgeClassification`, diff models, candidate models, preview & commit requests/responses).
2. `backend/app/services/databridge/exceptions.py`: Added Phase 2 exceptions (`DataBridgeCommitConfirmationError`, `DataBridgeStalePreviewError`, `DataBridgeDependencyError`, `DataBridgeAtomicRollbackError`).
3. `backend/app/services/databridge/service.py`: Added adapter resolver, preview execution engine, commit transaction engine, and idempotency cache.
4. `backend/app/api/v1/databridge.py`: Mounted preview and commit endpoints for general and entity-specific catalog ingestion.

## 10. Dependencies
- FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, PostgreSQL (asyncpg & psycopg2).
- Internal: `IM001ControlledFieldValidator`, `ItemCatalogService`, `ItemDomainService`, `ItemPricingSyncService`, `TenantContext`.

## 11. Risks & Mitigations
- **Risk:** Premature database mutation during preview.
  - **Mitigation:** Previews operate in read-only evaluation without committing or flushing dirty entities.
- **Risk:** Concurrent or replayed commit requests corrupting catalog state.
  - **Mitigation:** In-memory preview token verification, SHA-256 payload digest matching, and idempotent response cache.
- **Risk:** Cross-SKU barcode reassignments corrupting retail scanning.
  - **Mitigation:** Rule 2 hard conflict rejection (`EXISTING_CONFLICT`) prevents claiming barcodes assigned to different SKUs.

## 12. Rollback Strategy
All code changes are modular additions inside `backend/app/services/databridge/` and `backend/app/api/v1/databridge.py`. Zero database migrations were created. Rollback requires reverting the Git commit, with zero database schema alterations or migrations required.

## 13. Verification Plan
- Run full Phase 2 Catalog test suite (`backend/tests/test_databridge_phase2_catalog.py`).
- Run regression Phase 1 Core Foundation test suite (`backend/tests/test_databridge_phase1.py`).
- Run architecture preflight enforcement (`scripts/architecture_preflight.py`).
- Run architecture CI duplication gate (`scripts/architecture_duplication_gate.py`).

## 14. Test Plan
- `TC-CAT-001`: Novel Item Creation with controlled master fields.
- `TC-CAT-002`: Existing Item No-Op re-import (`NO_CHANGE`).
- `TC-CAT-003`: Existing Item Metadata Update (`UPDATE` with diff tracking).
- `TC-CAT-004`: New Variant Expansion with parent linkage and child policy provisioning.
- `TC-CAT-005`: Existing Variant Replay (`NO_CHANGE`).
- `TC-CAT-006`: Idempotent Barcode Replay on same SKU (`NO_CHANGE`).
- `TC-CAT-007`: Barcode Cross-SKU Clash Detection (`EXISTING_CONFLICT`).
- `TC-CAT-008`: Unapproved Master Lookup Rejection (`VALIDATION_ERROR`).
- `TC-CAT-009`: In-file Duplicate Row Detection (`EXISTING_CONFLICT`).
- `TC-CAT-010`: Novel PriceBook Entry Creation (`CREATE`).
- `TC-CAT-011`: Existing PriceBook Entry Revision (`UPDATE`).
- `TC-CAT-012`: Statutory Pricing Invariant Violation (`mrp < selling_price` -> `VALIDATION_ERROR`).
- User Confirmation Enforcement (`confirmed=True` required).
- Stale Preview & Tamper Detection (digest mismatch error).
- Idempotent Commit Replay verification.
- Missing Parent Item Dependency Rejection (`DEPENDENCY_ERROR`).

## 15. Documentation Impact
- Added implementation plan: `docs/implementation/foundation/DataBridge_Catalog_Adapters_Phase2_Implementation_v1.0.0.md`.
- Added walkthrough: `docs/walkthrough/foundation/DataBridge_Catalog_Adapters_Phase2_v1.0.0.md`.
- Updated implementation index: `docs/implementation/README.md`.
- Updated walkthrough index: `docs/walkthrough/README.md`.

## 16. Deployment Plan
Standard code deployment. Preflight certificates issued and verified in `.architecture/certificates/` and `smritisys` database. Zero database migrations required.

## 17. Status
**Completed** — Fully verified with 25/25 automated tests green, 0 P0/P1 architecture violations, and 0 debt.

## 18. Related ADRs
- `ADR-DATABRIDGE-01`: SMRITI DataBridge Enterprise Import/Export & Transfer Architecture.

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/DataBridge_Core_Foundation_v1.0.0.md` (Phase 1).
- `docs/walkthrough/foundation/DataBridge_Catalog_Adapters_Phase2_v1.0.0.md` (Phase 2).

## 20. Implementation Summary & Evidence
- **Test Results:** 25/25 tests passing (16 Phase 2, 9 Phase 1).
- **Architecture Gate:** 11/11 checks passed, 0 violations, 0 registered debt.
- **Legacy Integrity:** `backend/app/api/v1/exchange.py` untouched (0 diffs).
- **Control Plane Integrity:** Zero tenant mutations in `smritisys`.
