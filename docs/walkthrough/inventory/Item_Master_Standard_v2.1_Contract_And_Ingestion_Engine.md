<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 2.1.0
  Created      : 2026-09-26
  Modified     : 2026-09-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Item Master Creation Standard v2.1 Contract & Ingestion Engine

## 1. Purpose
This document ratifies and formalizes the **SMRITI Universal Item Master Ingestion Contract (Standard v2.1)** and its corresponding backend ingestion pipeline. It replaces unstandardized, flat spreadsheet ingestion with an authoritative 3-tier product catalog hierarchy (`Item` parent style $\rightarrow$ `ItemVariant` child SKU $\rightarrow$ `ItemBarcode` scanning optical identity $\rightarrow$ `ItemWarehouseLocation` stock policy / `PriceBookEntry` rate governance), backed by pre-flight reconciliation validation, footwear taxonomy normalization, and atomic sequential identity numbering.

---

## 2. Scope
- **Excel Spreadsheet Standard:** Generation of `assets/Itemmasters/SMRITI_Item_Master_Creation_Standard_v2.1.xlsx` featuring 36 governed columns, dynamic Excel formula SKU preview (`=IF(C5="","",C5&"-"&F5&"-"&G5&"-"&Q5)`), governed `WAREHOUSE_CODE` dropdown validation linked to named range `List_WAREHOUSE_CODE`, and snapshot audit metadata block (`MASTER_SNAPSHOT_DATE: 2026-09-26 | MASTER_SNAPSHOT_VERSION: SMRITI-MASTER-v2.1`).
- **Validation Engine:** Extension of `backend/app/services/catalog_validation.py` with dimension validators for HSN, UOM, and Footwear attributes (`gender`, `product_type`, `heel_type`, `upper_material`, `outsole_material`, `purchase_class`, `collection_type`), with resilient clean-string fallbacks.
- **Universal Import API:** Enhancement of `backend/app/api/v1/universal_import.py`:
  - `ImportCommitRequest` support for `price_mode` (`DO_NOT_CREATE`, `CREATE_AS_DRAFT`, `CREATE_LIVE_RETAIL`).
  - Pre-flight `POST /api/v1/universal-import/preview` returning a full Reconciliation Manifest (`total_rows`, `valid_rows`, `duplicate_barcodes`, `duplicate_skus`, `pricing_conflicts`, `distinct_styles`, `status`).
  - Hierarchical atomic commit `POST /api/v1/universal-import/commit` executing the 3-tier cascade (`Item` parent style $\rightarrow$ `ItemVariant` $\rightarrow$ `ItemBarcode` $\rightarrow$ `ItemWarehouseLocation` $\rightarrow$ `PriceBookEntry`).
- **Identity Allocation Hardening:** Remediation of `backend/app/services/identity/code_generator.py` to prevent duplicate key sequence collisions (`uq_items_identity_code`) by anchoring counter initialization to `MAX(sequence_value) + 1`.
- **Client Dump Reconciliation:** Execution of a dry-run ingestion audit against the 616-row client dataset `TATTLY THREADS ITEM MASTER 2026.xlsx`.

---

## 3. Files Created
1. `assets/Itemmasters/SMRITI_Item_Master_Creation_Standard_v2.1.xlsx` — Canonical governed Excel Item Master Standard template with 36 columns, formulas, dropdowns, and metadata.
2. `scratch/generate_v2_1.py` — High-fidelity generator script constructing v2.1 with openpyxl data validations and formula rules.
3. `backend/tests/test_universal_import_item_master.py` — Automated test suite covering dry-run valid previews, duplicate/pricing error detection, and 3-tier cascade commits with idempotency.
4. `scratch/reconcile_client_dump.py` — Reconciliation audit tool evaluating the 616-row client master dump.
5. `docs/walkthrough/inventory/Item_Master_Standard_v2.1_Contract_And_Ingestion_Engine.md` — This governance walkthrough.

---

## 4. Files Modified
1. `backend/app/services/catalog_validation.py` — Added HSN, UOM, and footwear attribute normalization.
2. `backend/app/api/v1/universal_import.py` — Added `ITEM_MASTER` target handling, pre-flight dry-run manifest, 3-tier cascade commit, and `price_mode` handling.
3. `backend/app/services/identity/code_generator.py` — Hardened atomic sequence initialization using `max_existing_seq + 1`.
4. `docs/walkthrough/README.md` — Appended chronological master index table entry.

---

## 5. Architecture Decisions
- **ADR-CAT-001: 3-Tier Catalog Ingestion Model:**
  The flat spreadsheet row represents a physical SKU and optical barcode, but the system of record requires strict normalization. `ARTICLE_STYLE_CODE` maps to canonical `Item` (Style parent); `COLOR` + `SIZE` + attributes map to `ItemVariant`; and `BARCODE_NO` maps to `ItemBarcode`.
- **ADR-CAT-002: Price Book Decoupling (`price_mode`):**
  Prices in the spreadsheet (`SELLING_PRICE`, `MRP`) are captured as initial catalog values, but formal retail pricing authority belongs to `PriceBookEntry`. By default, imports create price entries in `DRAFT` status unless explicitly flagged as `CREATE_LIVE_RETAIL`.
- **ADR-CAT-003: Pre-Flight Dry Run Before Commit:**
  Every bulk ingestion must first pass through `/api/v1/universal-import/preview`. The API returns a Reconciliation Manifest detailing duplicate barcodes (both intra-batch and against PostgreSQL), duplicate SKUs, pricing conflicts ($Selling > MRP$), and planned actions (`CREATE_ITEM_AND_VARIANT`, `ATTACH_VARIANT_TO_STYLE`, `BLOCK`).
- **ADR-CAT-004: Identity Sequence Global Resilience:**
  In multi-company or newly provisioned tenant contexts sharing a database, `SmritiNumberingRegistry` initializes new sequence counters to `MAX(existing sequence) + 1` across that entity prefix, preventing unique constraint violations on `items.identity_code`.

---

## 6. Design Rationale
- **Dynamic SKU Formula:** Previously, manual SKU entry in spreadsheets led to naming inconsistencies (e.g. spaces, lower case, non-standard order). The v2.1 Excel formula `=IF(C5="","",C5&"-"&F5&"-"&G5&"-"&Q5)` guarantees immediate visual parity between what the merchandiser types and what the system ingests.
- **Warehouse Code Dropdown:** Tying `WAREHOUSE_CODE` to `List_WAREHOUSE_CODE` ensures that reorder levels and default stock locations map directly to active WMS nodes (e.g. `WH-MAIN`, `WH-SHOP`), preventing unroutable inventory policies.
- **Fail-Safe Footwear Validation:** When dimension tables are unseeded during bootstrapping, `CatalogDimensionValidator` normalizes strings cleanly (strip, title case, upper case) rather than aborting, preserving workflow continuity while maintaining data cleanliness.

---

## 7. Implementation Summary
The ingestion engine executes in three distinct phases:

```
[ Excel / UI Payload ]
         │
         ▼
[ POST /preview ] ────────► Catalog Dimension Validation & Pre-Flight Conflict Detection
         │                  (Intra-batch & DB duplicate barcodes, duplicate SKUs, Selling > MRP)
         ▼
[ Reconciliation Manifest ] ──► Returns counts: valid, invalid, duplicate_barcodes, distinct_styles
         │
         ▼
[ POST /commit ]  ────────► Idempotency Guard (SHA-256 payload check in ComplianceAuditLog)
         │
         ├────────────────► 1. Parent Item: Lookup or create style parent via UniversalItemMasterService
         ├────────────────► 2. Child ItemVariant: Create or resolve variant with attributes JSON
         ├────────────────► 3. ItemBarcode: Insert primary EAN/custom barcode tied to variant
         ├────────────────► 4. ItemWarehouseLocation: Set reorder level & minimum stock
         └────────────────► 5. PriceBookEntry: Create draft or live retail price entry
```

---

## 8. Tests Executed
The test suite `backend/tests/test_universal_import_item_master.py` was executed:
- `test_item_master_dry_run_preview_valid`: Ingests two valid rows sharing a parent style, asserting `counts.valid == 2`, `distinct_styles == 1`, `duplicate_barcodes == 0`, and hierarchical action `ATTACH_VARIANT_TO_STYLE`.
- `test_item_master_dry_run_detects_conflicts`: Ingests a duplicate barcode and a pricing violation ($Selling > MRP$), asserting error detection, row-level `INVALID` status, and `VALIDATION_ISSUES_FOUND` summary.
- `test_item_master_commit_3tier_cascade`: Ingests a 2-row multi-variant batch, asserting:
  - Exactly 1 parent `Item` created.
  - Exactly 2 child `ItemVariant` records with normalized attributes.
  - Exactly 2 variant `ItemBarcode` records matching imported barcodes.
  - Exactly 1 `ItemWarehouseLocation` record with configured reorder level.
  - Exactly 2 `PriceBookEntry` records in Draft mode.
  - Idempotency replay verification: re-sending the same idempotency key returns `idempotent_replay: True` without creating duplicate records.

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
collecting ... collected 3 items

backend\tests\test_universal_import_item_master.py::test_item_master_dry_run_preview_valid PASSED [ 33%]
backend\tests\test_universal_import_item_master.py::test_item_master_dry_run_detects_conflicts PASSED [ 66%]
backend\tests\test_universal_import_item_master.py::test_item_master_commit_3tier_cascade PASSED [100%]

======================== 3 passed, 9 warnings in 9.79s ========================
```

### 616-Row Client Dataset Reconciliation Dry Run (Literal Output)
```text
============================================================
SMRITI RECONCILIATION MANIFEST (DRY RUN REPORT)
============================================================
Total Rows Ingested     : 615
Valid Rows              : 138
Invalid Rows            : 477
Distinct Parent Styles  : 42
Duplicate Barcodes      : 477
Duplicate SKUs          : 349
Pricing Conflicts       : 0
Batch Readiness Status  : VALIDATION_ISSUES_FOUND
============================================================
Action Breakdown:
  - BLOCK: 477
  - ATTACH_VARIANT_TO_STYLE: 131
  - CREATE_ITEM_AND_VARIANT: 7

Sample Invalid Rows (up to 5):
  Row 2: 8904551000002 - ['Barcode already exists in database (Item: TATTLY THREADS BASIC CHAPPAL, CREAM, 36)']
  Row 3: 8904551000019 - ['Barcode already exists in database (Item: TATTLY THREADS BASIC CHAPPAL, CREAM, 36)']
  Row 4: 8904551000026 - ['Barcode already exists in database (Item: TATTLY THREADS BASIC CHAPPAL, CREAM, 36)']
  Row 5: 8904551000033 - ['Barcode already exists in database (Item: TATTLY THREADS BASIC CHAPPAL, CREAM, 36)']
  Row 6: 8904551000040 - ['Barcode already exists in database (Item: TATTLY THREADS BASIC CHAPPAL, CREAM, 36)']
```

---

## 10. Known Limitations
- The Excel standard contains static lookup sheets (`Lookup_Data`) for offline reference. Future iterations will support dynamic lookup synchronization via REST API export.
- Tax policy ownership remains governed at the Item/HSN level; line-level tax rate overrides in Excel are validated against Indian GST slabs (0%, 5%, 12%, 18%, 28%).

---

## 11. Future Work
- Add Excel macro or web add-in to dynamically fetch live warehouse codes and brands directly from SMRITI Retail OS REST API.
- Support multi-barcode attachment per SKU line in the ingestion payload.

---

## 12. Related ADRs
- `ADR-CAT-001`: 3-Tier Product Catalog Hierarchy (Item $\rightarrow$ Variant $\rightarrow$ Barcode).
- `ADR-CAT-002`: Decoupled Price Book Architecture and Draft Lifecycle.
- `ADR-IDN-001`: SMRITI Universal Identity Engine & Sequential Allocation.

---

## 13. Related RFCs
- `RFC-INV-2026-09`: Universal Ingestion Contract for Enterprise Retail Master Data.
