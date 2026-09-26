<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 2.2.0
  Created      : 2026-09-26
  Modified     : 2026-09-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Item Master Creation Standard v2.1 Contract & Ingestion Engine

## 1. Purpose
This document ratifies and formalizes the **SMRITI Universal Item Master Ingestion Contract (Standard v2.1)**, its **6-State Reconciliation Decision Engine**, and its **Dynamic Live Template Generator**. It replaces unstandardized, flat spreadsheet ingestion with an authoritative 3-tier product catalog hierarchy (`Item` parent style $\rightarrow$ `ItemVariant` child SKU $\rightarrow$ `ItemBarcode` scanning optical identity $\rightarrow$ `ItemWarehouseLocation` stock policy / `PriceBookEntry` rate governance), backed by pre-flight reconciliation validation, 6-state conflict discrimination (`NEW`, `EXISTING_MATCH`, `EXISTING_CONFLICT`, `DUPLICATE_IN_FILE`, `INVALID`), dynamic streaming workbook generation with live database lookups, footwear taxonomy normalization, and atomic sequential identity numbering.

---

## 2. Scope
- **Excel Spreadsheet Standard:** Generation of `assets/Itemmasters/SMRITI_Item_Master_Creation_Standard_v2.1.xlsx` featuring 36 governed columns, dynamic Excel formula SKU preview (`=IF(C5="","",C5&"-"&F5&"-"&G5&"-"&Q5)`), governed `WAREHOUSE_CODE` dropdown validation linked to named range `List_WAREHOUSE_CODE`, and snapshot audit metadata block (`MASTER_SNAPSHOT_DATE: 2026-09-26 | MASTER_SNAPSHOT_VERSION: SMRITI-MASTER-v2.1`).
- **Dynamic Template Generation:** Implementation of `GET /api/v1/universal-import/templates/item-master.xlsx` streaming a live governed `.xlsx` workbook where dropdown validation sheets are populated directly from PostgreSQL tenant data (`warehouses`, `brands`, `categories`, `departments`), eliminating stale static lookup lists.
- **Validation Engine:** Extension of `backend/app/services/catalog_validation.py` with dimension validators for HSN, UOM, and Footwear attributes (`gender`, `product_type`, `heel_type`, `upper_material`, `outsole_material`, `purchase_class`, `collection_type`), with resilient clean-string fallbacks.
- **6-State Reconciliation Engine:** Enhancement of `backend/app/api/v1/universal_import.py`:
  - Discrimination of existing database records:
    - Same barcode + Same parent style + Same variant attributes $\rightarrow$ `EXISTING_MATCH` (Safe for `SKIP` or `UPDATE_METADATA_AND_PRICE`).
    - Same barcode + Different parent style or variant attributes $\rightarrow$ `EXISTING_CONFLICT` (Hard `BLOCK`).
    - Barcode or SKU repeated multiple times in input batch $\rightarrow$ `DUPLICATE_IN_FILE` (Hard `BLOCK`).
    - Missing required keys or invalid values ($Selling > MRP$, missing item name) $\rightarrow$ `INVALID` (Hard `BLOCK`).
    - Fresh parent style or new variant $\rightarrow$ `NEW` (Ready for creation / attachment).
  - `ImportCommitRequest` support for `existing_match_mode` (`SKIP`, `UPDATE_METADATA_AND_PRICE`, `FAIL_ON_EXISTING`) and `price_mode` (`DO_NOT_CREATE`, `CREATE_AS_DRAFT`, `CREATE_LIVE_RETAIL`).
  - Pre-flight `POST /api/v1/universal-import/preview` returning a full Reconciliation Manifest (`total`, `valid`, `invalid`, `new`, `existing_match`, `existing_conflict`, `duplicate_in_file`, `distinct_styles`, `pricing_conflicts`, `status`).
  - Hierarchical atomic commit `POST /api/v1/universal-import/commit` executing the 3-tier cascade (`Item` parent style $\rightarrow$ `ItemVariant` $\rightarrow$ `ItemBarcode` $\rightarrow$ `ItemWarehouseLocation` $\rightarrow$ `PriceBookEntry`).
- **Identity Allocation Hardening:** Remediation of `backend/app/services/identity/code_generator.py` to prevent duplicate key sequence collisions (`uq_items_identity_code`) by anchoring counter initialization to `MAX(sequence_value) + 1`.
- **Client Dump Reconciliation:** Execution of a dry-run ingestion audit against the 615-row client dataset `TATTLY THREADS ITEM MASTER 2026.xlsx`.

---

## 3. Files Created
1. `assets/Itemmasters/SMRITI_Item_Master_Creation_Standard_v2.1.xlsx` — Canonical governed Excel Item Master Standard template with 36 columns, formulas, dropdowns, and metadata.
2. `scratch/generate_v2_1.py` — High-fidelity generator script constructing v2.1 with openpyxl data validations and formula rules.
3. `backend/tests/test_universal_import_item_master.py` — Automated test suite covering dry-run valid previews, duplicate/pricing error detection, 3-tier cascade commits with idempotency, 6-state reconciliation, pricing modes, multi-variant matrices, and dynamic template streaming.
4. `scratch/reconcile_client_dump.py` — Reconciliation audit tool evaluating the 615-row client master dump.
5. `docs/walkthrough/inventory/Item_Master_Standard_v2.1_Contract_And_Ingestion_Engine.md` — This governance walkthrough.

---

## 4. Files Modified
1. `backend/app/services/catalog_validation.py` — Added HSN, UOM, and footwear attribute normalization.
2. `backend/app/api/v1/universal_import.py` — Added `ITEM_MASTER` target handling, pre-flight dry-run manifest with 6 reconciliation states, dynamic live template generation endpoint, 3-tier cascade commit, and `existing_match_mode` / `price_mode` controls.
3. `backend/app/services/identity/code_generator.py` — Hardened atomic sequence initialization using `max_existing_seq + 1`.
4. `docs/walkthrough/README.md` — Appended chronological master index table entry.

---

## 5. Architecture Decisions
- **ADR-CAT-001: 3-Tier Catalog Ingestion Model:**
  The flat spreadsheet row represents a physical SKU and optical barcode, but the system of record requires strict normalization. `ARTICLE_STYLE_CODE` maps to canonical `Item` (Style parent); `COLOR` + `SIZE` + attributes map to `ItemVariant`; and `BARCODE_NO` maps to `ItemBarcode`.
- **ADR-CAT-002: Price Book Decoupling (`price_mode`):**
  Prices in the spreadsheet (`SELLING_PRICE`, `MRP`) are captured as initial catalog values, but formal retail pricing authority belongs to `PriceBookEntry`. By default, imports create price entries in `DRAFT` status unless explicitly flagged as `CREATE_LIVE_RETAIL`.
- **ADR-CAT-003: Pre-Flight Dry Run Before Commit:**
  Every bulk ingestion must first pass through `/api/v1/universal-import/preview`. The API returns a Reconciliation Manifest detailing row counts across all 6 reconciliation states, distinct styles, pricing conflicts ($Selling > MRP$), and planned actions (`CREATE_ITEM_AND_VARIANT`, `ATTACH_VARIANT_TO_STYLE`, `UPDATE_PRICING`, `SKIP`, `BLOCK`).
- **ADR-CAT-004: Identity Sequence Global Resilience:**
  In multi-company or newly provisioned tenant contexts sharing a database, `SmritiNumberingRegistry` initializes new sequence counters to `MAX(existing sequence) + 1` across that entity prefix, preventing unique constraint violations on `items.identity_code`.
- **ADR-CAT-005: 6-State Reconciliation Decision Hierarchy:**
  Rather than treating existing database barcodes as flat "DUPLICATE = BLOCK", the engine cross-references the existing variant's parent item and attributes. Identical matches are categorized as `EXISTING_MATCH` allowing safe client migrations with either `SKIP` or `UPDATE_METADATA_AND_PRICE`. Different parent items sharing a barcode are flagged as `EXISTING_CONFLICT` and blocked immediately.
- **ADR-CAT-006: Dynamic Server-Side Template Generation:**
  To prevent stale Excel validation dropdowns, `GET /api/v1/universal-import/templates/item-master.xlsx` dynamically streams an `.xlsx` workbook with data validation dropdowns queried in real time from the tenant's PostgreSQL database (`warehouses`, `brands`, `categories`, `departments`).

---

## 6. Design Rationale
- **6-State Reconciliation vs Binary Duplicate Flagging:** In real-world enterprise retail onboarding, re-uploading an item master spreadsheet or synchronizing an updated price list previously failed completely because barcodes already existed. The 6-state model cleanly separates benign re-imports (`EXISTING_MATCH`) from dangerous cross-product collisions (`EXISTING_CONFLICT`) and in-file data entry duplicates (`DUPLICATE_IN_FILE`).
- **Dynamic SKU Formula:** Previously, manual SKU entry in spreadsheets led to naming inconsistencies (e.g. spaces, lower case, non-standard order). The v2.1 Excel formula `=IF(C5="","",C5&"-"&F5&"-"&G5&"-"&Q5)` guarantees immediate visual parity between what the merchandiser types and what the system ingests.
- **Warehouse Code Dropdown:** Tying `WAREHOUSE_CODE` to `List_WAREHOUSE_CODE` ensures that reorder levels and default stock locations map directly to active WMS nodes (e.g. `WH-MAIN`, `WH-SHOP`), preventing unroutable inventory policies.
- **Fail-Safe Footwear Validation:** When dimension tables are unseeded during bootstrapping, `CatalogDimensionValidator` normalizes strings cleanly (strip, title case, upper case) rather than aborting, preserving workflow continuity while maintaining data cleanliness.

---

## 7. Implementation Summary
The ingestion engine executes in three distinct phases:

```text
[ Dynamic Template Download ] ◄── GET /templates/item-master.xlsx (Live Warehouses, Brands, Categories)
          │
          ▼
[ Merchandiser Fills Excel ]
          │
          ▼
[ POST /preview ] ─────────────► Catalog Dimension Validation & 6-State Conflict Detection
          │                       • NEW (Fresh style / variant)
          │                       • EXISTING_MATCH (Same item + variant in DB)
          │                       • EXISTING_CONFLICT (Different item/variant sharing barcode)
          │                       • DUPLICATE_IN_FILE (Repeated in upload batch)
          │                       • INVALID (Selling > MRP, missing required keys)
          ▼
[ Reconciliation Manifest ] ───► Summary Counts: total, valid, invalid, new, existing_match,
          │                      existing_conflict, duplicate_in_file, distinct_styles
          ▼
[ POST /commit ]  ─────────────► Idempotency Guard (SHA-256 payload check in ComplianceAuditLog)
          │
          ├─────────────────────► Honors existing_match_mode (SKIP, UPDATE_METADATA_AND_PRICE, FAIL_ON_EXISTING)
          ├─────────────────────► 1. Parent Item: Lookup or create style parent via UniversalItemMasterService
          ├─────────────────────► 2. Child ItemVariant: Create or resolve variant with attributes JSON
          ├─────────────────────► 3. ItemBarcode: Insert primary EAN/custom barcode tied to variant
          ├─────────────────────► 4. ItemWarehouseLocation: Set reorder level & minimum stock
          └─────────────────────► 5. PriceBookEntry: Create draft or live retail price entry per price_mode
```

---

## 8. Tests Executed
The test suite `backend/tests/test_universal_import_item_master.py` was executed across 8 comprehensive scenarios:
1. `test_item_master_dry_run_preview_valid`: Ingests two valid rows sharing a parent style, asserting `counts.valid == 2`, `distinct_styles == 1`, `counts.duplicate_in_file == 0`, and hierarchical action `ATTACH_VARIANT_TO_STYLE`.
2. `test_item_master_dry_run_detects_conflicts`: Ingests a duplicate barcode within file and a pricing violation ($Selling > MRP$), asserting error detection, row-level `INVALID` status, and `VALIDATION_ISSUES_FOUND` summary.
3. `test_item_master_commit_3tier_cascade`: Ingests a 2-row multi-variant batch, asserting:
   - Exactly 1 parent `Item` created.
   - Exactly 2 child `ItemVariant` records with normalized attributes.
   - Exactly 2 variant `ItemBarcode` records matching imported barcodes.
   - Exactly 1 `ItemWarehouseLocation` record with configured reorder level.
   - Exactly 2 `PriceBookEntry` records in Draft mode.
   - Idempotency replay verification: re-sending the same idempotency key returns `idempotent_replay: True` without creating duplicate records.
4. `test_reconciliation_states_existing_match_vs_conflict`: Verifies that an existing barcode matching the same style and attributes receives `EXISTING_MATCH`, whereas the same barcode mapped to a different style receives `EXISTING_CONFLICT`.
5. `test_commit_existing_match_modes`: Verifies `existing_match_mode="SKIP"` skips existing items without error, `UPDATE_METADATA_AND_PRICE` updates prices on existing items, and `FAIL_ON_EXISTING` rejects existing barcodes with HTTP 409.
6. `test_pricing_modes_coverage`: Verifies all three pricing modes (`DO_NOT_CREATE`, `CREATE_AS_DRAFT`, `CREATE_LIVE_RETAIL`) correctly govern price book entry creation and active status.
7. `test_multi_variant_matrix_colors_and_sizes`: Ingests a 4-variant matrix across 2 colors (Navy, Olive) and 2 sizes (38, 40) under a single style, asserting 1 parent Item and 4 child variants attached cleanly.
8. `test_dynamic_template_generation_endpoint`: Verifies `GET /api/v1/universal-import/templates/item-master.xlsx` returns a valid Excel workbook with live database lookup sheets (`Lookup_Data`) and 36 header columns.

---

## 9. Verification Results

### Terminal Test Output (Literal)
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 8 items

backend\tests\test_universal_import_item_master.py::test_item_master_dry_run_preview_valid PASSED [ 12%]
backend\tests\test_universal_import_item_master.py::test_item_master_dry_run_detects_conflicts PASSED [ 25%]
backend\tests\test_universal_import_item_master.py::test_item_master_commit_3tier_cascade PASSED [ 37%]
backend\tests\test_universal_import_item_master.py::test_reconciliation_states_existing_match_vs_conflict PASSED [ 50%]
backend\tests\test_universal_import_item_master.py::test_commit_existing_match_modes PASSED [ 62%]
backend\tests\test_universal_import_item_master.py::test_pricing_modes_coverage PASSED [ 75%]
backend\tests\test_universal_import_item_master.py::test_multi_variant_matrix_colors_and_sizes PASSED [ 87%]
backend\tests\test_universal_import_item_master.py::test_dynamic_template_generation_endpoint PASSED [100%]

======================= 8 passed, 24 warnings in 16.60s =======================
```

### 615-Row Client Dataset Reconciliation Dry Run (Literal Output)
```text
============================================================
SMRITI 6-STATE RECONCILIATION MANIFEST (DRY RUN REPORT)
============================================================
Total Rows Ingested     : 615
Valid Rows (Ready/Safe) : 588
  |-- New Items/Variants: 138
  \-- Existing Matches  : 450 (Safe to SKIP or UPDATE)
Invalid Rows (Blocked)  : 27
  |-- Existing Conflicts: 0
  |-- Duplicates in File: 0
  \-- Validation Errors : 27 (Missing legacy required fields)
Distinct Parent Styles  : 42
Pricing Conflicts       : 0
Batch Readiness Status  : VALIDATION_ISSUES_FOUND
============================================================
Reconciliation States Breakdown:
  - EXISTING_MATCH: 450
  - ATTACH_VARIANT_TO_STYLE: 131
  - INVALID: 27
  - CREATE_ITEM_AND_VARIANT: 7

Sample Invalid Rows (up to 5):
  Row 463: - ['Missing required fields: item_name']
  Row 464: - ['Missing required fields: item_name']
  Row 465: - ['Missing required fields: item_name']
  Row 466: - ['Missing required fields: item_name']
  Row 467: - ['Missing required fields: item_name']
```

---

## 10. Known Limitations
- Footwear attribute validations accept clean string fallbacks if master dimension tables (`footwear_attribute_options`) are unseeded, logging warnings rather than hard failing.
- Tax policy ownership remains governed at the Item/HSN level; line-level tax rate overrides in Excel are validated against Indian GST slabs (0%, 5%, 12%, 18%, 28%).

---

## 11. Future Work
- Add client-side Excel web add-in / Office.js task pane for direct authenticated sync from inside Microsoft Excel desktop/web.
- Support multi-barcode attachment (e.g. secondary UPC + tertiary retailer barcode) per SKU line in the ingestion payload.

---

## 12. Related ADRs
- `ADR-CAT-001`: 3-Tier Product Catalog Hierarchy (Item $\rightarrow$ Variant $\rightarrow$ Barcode).
- `ADR-CAT-002`: Decoupled Price Book Architecture and Draft Lifecycle.
- `ADR-CAT-005`: 6-State Reconciliation Decision Hierarchy.
- `ADR-CAT-006`: Dynamic Server-Side Template Generation with Live Database Lookups.
- `ADR-IDN-001`: SMRITI Universal Identity Engine & Sequential Allocation.

---

## 13. Related RFCs
- `RFC-INV-2026-09`: Universal Ingestion Contract for Enterprise Retail Master Data.
