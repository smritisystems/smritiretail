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
  Classification: Internal — Technical Walkthrough
-->

# SMRITI DataBridge Phase 2 — Catalog Domain Adapters Walkthrough

## 1. Purpose
This walkthrough documents the end-to-end design, implementation, and automated verification of **SMRITI DataBridge Phase 2: Catalog Domain Adapters**. Phase 2 delivers preview-and-commit adapters for `ITEM`, `VARIANT`, `BARCODE`, and `PRICEBOOK` master entities, featuring full header normalization, controlled field lookup validation, strict barcode immutability, and statutory pricing invariant enforcement.

## 2. Scope
- Adapters under `backend/app/services/databridge/adapters/`:
  - `BaseDataBridgeAdapter`: Unified 7-stage lifecycle (`normalize`, `validate`, `match`, `diff`, `classify`, `preview`, `commit`) and header alias mapping.
  - `DataBridgeItemAdapter`: Canonical Item Master matching and controlled field validation.
  - `DataBridgeVariantAdapter`: Variant dimension resolution, parent item linkage, and 6-policy child entity provisioning.
  - `DataBridgeBarcodeAdapter`: 4-rule barcode assignment, idempotent same-SKU replay, and cross-SKU collision rejection.
  - `DataBridgePriceBookAdapter`: Composite uniqueness (`uq_pbe_matrix`) and statutory pricing constraint (`mrp >= selling_price`).
- Service Engine in `backend/app/services/databridge/service.py`:
  - `execute_preview`: Zero-mutation in-memory evaluation producing 30-minute tokens with SHA-256 payload digests.
  - `execute_commit`: Atomic execution enforcing mandatory user confirmation (`confirmed=True`), tamper verification, and WORM audit logging.
- API Endpoints in `backend/app/api/v1/databridge.py`:
  - `/api/v1/databridge/preview` and `/commit`
  - `/api/v1/databridge/{item,variant,barcode,pricebook}/preview` and `/commit`
- Automated verification via 16 catalog test cases in `backend/tests/test_databridge_phase2_catalog.py`.

## 3. Files Created
- `backend/app/services/databridge/adapters/__init__.py`
- `backend/app/services/databridge/adapters/base_adapter.py`
- `backend/app/services/databridge/adapters/item_adapter.py`
- `backend/app/services/databridge/adapters/variant_adapter.py`
- `backend/app/services/databridge/adapters/barcode_adapter.py`
- `backend/app/services/databridge/adapters/pricebook_adapter.py`
- `backend/tests/test_databridge_phase2_catalog.py`
- `scripts/register_databridge_phase2_architecture.py`
- `docs/implementation/foundation/DataBridge_Catalog_Adapters_Phase2_Implementation_v1.0.0.md`
- `docs/walkthrough/foundation/DataBridge_Catalog_Adapters_Phase2_v1.0.0.md`

## 4. Files Modified
- `backend/app/services/databridge/models.py`: Added Phase 2 contracts and classification enums.
- `backend/app/services/databridge/exceptions.py`: Added confirmation, token stale, dependency, and rollback exceptions.
- `backend/app/services/databridge/service.py`: Added adapter orchestration, preview token cache, and commit engine.
- `backend/app/api/v1/databridge.py`: Mounted catalog preview and commit endpoints.
- `docs/implementation/README.md`: Appended Phase 2 implementation plan.
- `docs/walkthrough/README.md`: Appended Phase 2 walkthrough.

## 5. Architecture Decisions
1. **Reuse Existing Canonical Services:** The adapters do not introduce duplicate item creation or validation paths; they delegate directly to `ItemCatalogService.create_item`, `IM001ControlledFieldValidator`, and `ItemPricingSyncService`.
2. **Zero Schema Migrations:** All catalog tables (`items`, `item_variants`, `item_barcodes`, `price_book_entries`, and extension tables) already provide the necessary storage fields; no Alembic migrations were needed.
3. **Control Plane Isolation:** All catalog entities are stored exclusively in tenant databases (`smritiXXX`); `smritisys` is strictly isolated for control-plane master value validation.
4. **Strangler-Fig Boundary:** Legacy `backend/app/api/v1/exchange.py` was left completely untouched, allowing existing legacy flows to continue uninterrupted until later retirement phases.

## 6. Design Rationale
- **Zero-Mutation Previews:** Bulk data can contain malformed rows or unintentional duplicates. By evaluating rows entirely in-memory and computing diffs against the tenant database without committing, users can preview additions, updates, and conflicts safely.
- **Cryptographic Tamper-Proofing:** Previews issue a SHA-256 payload digest. On commit, the payload digest is re-verified, ensuring that clients cannot tamper with or submit a different batch under an approved token.
- **Explicit Confirmation Enforcement:** Commits without `confirmed=True` raise `DataBridgeCommitConfirmationError`, guaranteeing intentional user acknowledgment of preview diffs.

## 7. Implementation Summary
The implementation follows the canonical 7-stage pipeline:
1. **Header Normalization:** Matches loose aliases (`"Product Name"`, `"MRP (Rs)"`, `"Code"`) to canonical schema keys.
2. **Controlled Field Validation:** Evaluates `brand`, `category`, `department`, `uom`, `color`, and `size` against `smritisys.master_values`.
3. **Entity Matching:** Queries canonical database indices (`item_code`, `identity_code`, `variant_sku`, `barcode`).
4. **Field Diffing:** Compares incoming attributes with existing records to generate detailed `DataBridgeDiffField` lists.
5. **Candidate Classification:** Labels each row as `CREATE`, `UPDATE`, `NO_CHANGE`, `EXISTING_CONFLICT`, `VALIDATION_ERROR`, or `DEPENDENCY_ERROR`.
6. **Preview Synthesis:** Computes candidate summaries, generates preview tokens, and verifies blocking criteria.
7. **Atomic Commit:** Persists modifications within a managed transaction and logs immutable WORM audit records.

## 8. Tests Executed
- `backend/tests/test_databridge_phase2_catalog.py`: 16/16 test cases passing.
- `backend/tests/test_databridge_phase1.py`: 9/9 test cases passing.
- Combined execution: 25/25 automated tests green (100% pass rate).

## 9. Verification Results
```text
backend\tests\test_databridge_phase2_catalog.py::test_tc_cat_001_new_item_master PASSED
backend\tests\test_databridge_phase2_catalog.py::test_tc_cat_002_existing_item_no_op PASSED
backend\tests\test_databridge_phase2_catalog.py::test_tc_cat_003_existing_item_metadata_update PASSED
backend\tests\test_databridge_phase2_catalog.py::test_tc_cat_004_new_variant_expansion PASSED
backend\tests\test_databridge_phase2_catalog.py::test_tc_cat_005_existing_variant_replay PASSED
backend\tests\test_databridge_phase2_catalog.py::test_tc_cat_006_idempotent_barcode_replay PASSED
backend\tests\test_databridge_phase2_catalog.py::test_tc_cat_007_barcode_cross_sku_clash PASSED
backend\tests\test_databridge_phase2_catalog.py::test_tc_cat_008_missing_mandatory_lookup PASSED
backend\tests\test_databridge_phase2_catalog.py::test_tc_cat_009_in_file_duplicate_row PASSED
backend\tests\test_databridge_phase2_catalog.py::test_tc_cat_010_pricebook_entry_creation PASSED
backend\tests\test_databridge_phase2_catalog.py::test_tc_cat_011_pricebook_entry_update PASSED
backend\tests\test_databridge_phase2_catalog.py::test_tc_cat_012_invalid_pricing_invariant PASSED
backend\tests\test_databridge_phase2_catalog.py::test_databridge_commit_requires_user_confirmation PASSED
backend\tests\test_databridge_phase2_catalog.py::test_databridge_stale_preview_tamper_detection PASSED
backend\tests\test_databridge_phase2_catalog.py::test_databridge_idempotent_replay PASSED
backend\tests\test_databridge_phase2_catalog.py::test_databridge_variant_missing_parent_dependency PASSED

====================== 25 passed, 22 warnings in 40.67s =======================
```
- **CI Duplication Gate:** 11/11 checks passed, 0 P0/P1 violations, 0 registered debt.

## 10. Known Limitations
- Background job processing for massive CSV files (>50,000 lines) will be implemented in Phase 7 via the asynchronous ingestion worker.
- Format converters for Excel (.xlsx) binary streams are scheduled for Phase 6.

## 11. Future Work
- **Phase 3:** Party Domain Adapters (Customer & Supplier).
- **Phase 4:** Inventory & Stock Opening Balance Adapters.
- **Phase 5:** Financial & Opening Balances (Chart of Accounts & Ledgers).
- **Phase 6:** Format Converters (CSV, JSON, XML, Excel).
- **Phase 7:** Asynchronous Worker & Large-File Streaming.
- **Phase 8:** Bi-Directional SMRITI-X Replication.
- **Phase 9:** Strangler-Fig Decommissioning of legacy `exchange.py`.

## 12. Related ADRs
- `ADR-DATABRIDGE-01`: SMRITI DataBridge Enterprise Import/Export & Transfer Architecture.

## 13. Related RFCs
- `RFC-DATABRIDGE-001`: Universal Enterprise Data Ingestion and Synchronization Framework.
