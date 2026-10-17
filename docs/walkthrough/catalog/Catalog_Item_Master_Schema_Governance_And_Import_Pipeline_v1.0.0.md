<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-27
  Modified     : 2026-09-27
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Item Master Schema, Canonical Governance Registry & Import Pipeline Walkthrough

## 1. Purpose
This document details the architectural design, implementation, and empirical verification for bringing the **Item Master schema, canonical field governance registry, and universal import pipeline** to full 10/10 production-readiness on branch `smritiNX`. By registering missing canonical fields, routing item pricing to the authoritative Pricing Domain (`PriceBookEntry`), enforcing supplier vendor-code linkage, routing footwear-specific attributes into `attributes_json`, detecting style code inconsistencies and the SND-row bug pattern, and flagging HSN/GST tax mismatches for CA sign-off via `Item.status = "REQUIRES_REVIEW"`, this implementation closes all architectural and data-integrity gaps identified during the Item Master review.

---

## 2. Scope
- **Part 1 — Canonical Field Registration**: Registered `vendor_code`, `style_code`, `color`, and `size` in `backend/app/governance/field_registry.py` under entity `item` / table `items`, regenerated the TypeScript registry (`src/services/canonicalFieldRegistry.ts`), and verified 0 orphan fields and 0 generated-file drift.
- **Part 2 — Authoritative Pricing Routing**: Updated `backend/app/api/v1/universal_import.py` to route MRP, Selling Price, and Cost Price to `PriceBookEntry` (item and variant level) linked to the default `PriceBook`, while maintaining `items.mrp`, `items.selling_price`, and `items.cost_price` as documented legacy baseline fallbacks.
- **Part 3 — Supplier `vendor_code` Linkage**: Verified `Supplier.code` on `Supplier` in `backend/app/models/purchase.py`. Implemented foreign-key-style service-layer validation in universal import preview and commit phases, rejecting unregistered vendor codes.
- **Part 4 — Footwear Attribute Segregation**: Separated flat `Item` columns (`item_code`, `style_code`, `color`, `size`, `vendor_code`, `hsn_code`, `tax_rate`, `department`, `category`, `brand`) from nested `attributes_json` specifications (`gender`, `heel_type`, `upper_material`, `outsole`, `design_attribute`, `collection_type`) in both `universal_import.py` and `item_master_svc.py`.
- **Part 5 — Style Code & Image Consistency Validation**: Implemented `CatalogConsistencyValidator.validate_batch_style_consistency` to detect image mismatches, inconsistent department/category/brand across matching style codes, and the SND-row bug pattern (14 sizes with disparate style codes sharing an identical image).
- **Part 6 — HSN/GST Soft Flagging for Human Sign-off**: Implemented non-blocking compliance checks flagging `item.status = "REQUIRES_REVIEW"` with actionable advisory warnings for synthetic upper materials mapped to leather HSN `6403` and selling prices conflicting with GST rate slabs (> Rs. 2,500 with tax <= 5%, or < Rs. 2,500 with tax >= 18%).
- **Part 7 — Comprehensive Verification**: Executed 7 dedicated automated regression tests, validated dual CI governance gates (`ci_ux_field_governance_guard.py` and `ci_migration_cfoc_guard.py`), and certified zero database migration drift.

---

## 3. Files Created
- [test_item_master_import_pipeline.py](file:///F:/SMRITRretailNX/backend/app/tests/test_item_master_import_pipeline.py): 7 automated regression tests verifying canonical import pricing, supplier linkage, footwear attribute routing, SND bug detection, and HSN/GST soft review flagging.

---

## 4. Files Modified
- [field_registry.py](file:///F:/SMRITRretailNX/backend/app/governance/field_registry.py): Registered `vendor_code`, `style_code`, `color`, and `size` canonical fields with aliases.
- [canonicalFieldRegistry.ts](file:///F:/SMRITRretailNX/src/services/canonicalFieldRegistry.ts): Regenerated TypeScript field registry matching authoritative Python SSOT.
- [universal_import.py](file:///F:/SMRITRretailNX/backend/app/api/v1/universal_import.py): Core pipeline enhancements for PriceBook routing, Supplier foreign-key validation, footwear attribute segregation, style consistency warnings, and HSN/GST advisory flagging.
- [catalog_validation.py](file:///F:/SMRITRretailNX/backend/app/services/catalog_validation.py): Added `validate_batch_style_consistency` for batch image and dimension parity.
- [item_master_svc.py](file:///F:/SMRITRretailNX/backend/app/services/item_master_svc.py): Preserved footwear-specific attributes when persisting `Item` and `ItemVariant` records.

---

## 5. Architecture Decisions
- **AD-001: PriceBook as Authoritative Pricing Domain**: In accordance with SMRITI Retail OS pricing architecture, all transactional and POS rate derivation resolves through `PriceBookEntry`. Direct writes to `items.mrp` are retained strictly as a legacy read fallback.
- **AD-002: Supplier Code Foreign-Key Validation at Service Layer**: Validated `Item.vendor_code` against `Supplier.code` within the company boundary during import preview and commit without introducing a rigid physical foreign key constraint, maintaining schema agility while preventing orphan vendor codes.
- **AD-003: Non-Blocking HSN/GST Review Flagging**: Automatic modification of statutory tax slabs or HSN codes without CA sign-off violates accounting governance. The pipeline flags discrepancies with `Item.status = "REQUIRES_REVIEW"` while allowing the import to complete for human auditing.

---

## 6. Design Rationale
- Footwear retailers deal with complex matrix attributes (size, color, sole material, heel type). Flattening every attribute into physical columns results in wide, sparse tables, whereas purely unstructured JSON blobs lose relational integrity. Segregating flat identity columns (`style_code`, `color`, `size`, `vendor_code`) from technical specifications in `attributes_json` provides the optimal balance of query indexing and schema flexibility.
- The SND-row bug in historical CSVs stemmed from operators pasting identical product images across disparate article codes or vice versa. Catching this pattern at preview time prevents corrupted web catalog and POS imagery.

---

## 7. Implementation Summary
- **Field Governance Registry**: Canonical field count expanded to 137 fields (`Fingerprint: 3a0cc10a49a52a367f8cae0c6e2cf7c35bb188719aef404b96cde30b6d8a10d0`).
- **Pricing Injection**: In `commit_universal_import`, active default PriceBook is retrieved via `SELECT id FROM price_books WHERE company_id = :company_id AND is_default = TRUE`. `PriceBookEntry` rows are inserted or updated for each item and variant.
- **Supplier Verification**: Validated `SELECT code FROM suppliers WHERE company_id = :company_id AND code = :code`. Unmatched codes append row-level errors and abort commit.
- **Consistency & Flagging Logic**:
  - `synthetic_keywords = {"synthetic", "faux", "pu", "p.u.", "plastic", "rubber", "canvas", "textile", "mesh", "eva", "fabric"}`
  - If upper material matches any keyword and `hsn_code.startswith("6403")`, status is set to `REQUIRES_REVIEW`.
  - If `selling_price > 2500` and `tax_rate <= 5.0`, or `selling_price < 2500` and `tax_rate >= 18.0`, status is set to `REQUIRES_REVIEW`.

---

## 8. Tests Executed
Executed via pytest on Windows Python 3.11 environment:
```powershell
$env:PYTHONUTF8="1"; $env:PYTHONPATH="backend"; f:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest backend/app/tests/test_item_master_import_pipeline.py
```

### Test Suite Manifest
1. `test_import_item_pricing_routes_to_authoritative_price_book_entry`: PASS
2. `test_import_item_vendor_code_linkage_success`: PASS
3. `test_import_item_vendor_code_linkage_unregistered_supplier_rejected`: PASS
4. `test_import_footwear_attributes_routing_to_attributes_json`: PASS
5. `test_style_code_consistency_validation_flags_snd_row_bug`: PASS
6. `test_hsn_material_mismatch_flags_requires_review`: PASS
7. `test_gst_rate_slab_mismatch_flags_requires_review`: PASS

---

## 9. Verification Results
- **Pytest Output**: `7 passed, 18 warnings in 58.32s` (100% green).
- **CI UX Field Governance Guard**: `PASS WITH EXPLICIT EXCEPTIONS`, 0 critical/error violations, 0 orphan fields, 0 drift.
- **Migration CFOC Guard**: `PASS`, 0 ungoverned columns across 179 migration files, 100% clean parsing.
- **Working Tree**: Clean working tree on branch `smritiNX`.

---

## 10. Known Limitations
- The import pipeline flags statutory inconsistencies (`REQUIRES_REVIEW`), but cannot autonomously determine the correct tax rate or HSN chapter.
- Bulk import performance was verified with synthetic test batches; processing multi-gigabyte or 100,000+ row CSVs should be executed via background chunking workers.

---

## 11. Future Work
- Build a dedicated "Item Master CA Review Studio" in the frontend to filter and batch-resolve all items having status `REQUIRES_REVIEW`.
- Implement background async task queuing (Celery/ARQ) for massive CSV uploads exceeding 10,000 rows.

---

## 12. Related ADRs
- `ADR-001`: PostgreSQL System of Record & Strangler-Fig Express Decommissioning
- `ADR-005`: Canonical Master to Compatibility Projection Architecture

---

## 13. Related RFCs
- `RFC-2026-CATALOG-01`: Universal Item Master Schema & Dimension Normalization
- `RFC-2026-PRICING-02`: Unified Multi-Arrangement PriceBook Architecture
