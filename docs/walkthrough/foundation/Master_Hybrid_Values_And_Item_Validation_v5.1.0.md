<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.1.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Standard
-->

# Hybrid Master Values System & Item Master Field Validation Walkthrough (v5.1.0)

## 1. Purpose
This walkthrough documents the design and implementation of the **Hybrid Master Values System** (`is_system`, `tenant_id`) and the **Item Master Field Validation Engine** (`_validate_master_field`) for SMRITI Retail OS v5.1.0.

The hybrid master system enables SMRITI to seed standard system defaults (e.g., standard apparel colors, sizes, categories) shared globally across all tenants (`is_system=True`, `tenant_id=NULL`) while empowering individual tenants to define custom master lookup entries (`is_system=False`, `tenant_id=tenant_id`). It protects system-seeded records from deletion or modification while validating item creation and updates against normalized master values.

---

## 2. Scope
- **Part A: Hybrid Master Values System**:
  - Database Migration: Alembic revision `add_hybrid_master_values` adding `is_system` (`Boolean`) and `tenant_id` (`String(50)`) to `master_values`.
  - Master Lookup Repositories, Services, and FastAPI endpoints updated to enforce tenant isolation and system protection (`SMRITI-VAL-020`, `SMRITI-VAL-021`).
  - Seed script updated to seed 4 master types (`product_color`, `product_size`, `product_brand`, `product_category`) and standard system default values.
  - Active toggle endpoint `/lookup/{type_code}/values/{id}/toggle-active` added to allow deactivating system values without deleting them.
- **Part B: Item Master Field Validation**:
  - SKU auto-generation helper `_build_sku(p)` in `backend/app/services/inventory.py`.
  - Field validation helper `_validate_master_field` in `backend/app/services/inventory.py`.
  - Canonical casing normalization (Sizes → `UPPER()`, Colors/Brands/Categories → Title Case).
  - Validation enforcement on `create_product` returning structured HREP error `SMRITI-VAL-010` (HTTP 422) listing valid options on validation failure.

---

## 3. Files Created
- `backend/alembic/versions/add_hybrid_columns_to_master_values.py`: Migration revision script adding `is_system` and `tenant_id` columns and indexes.
- `backend/app/tests/test_master_hybrid.py`: Comprehensive test suite containing 10 test cases verifying hybrid values, tenant isolation, system record protection, SKU auto-generation, and item validation.
- `docs/walkthrough/foundation/Master_Hybrid_Values_And_Item_Validation_v5.1.0.md`: This walkthrough document.

---

## 4. Files Modified
- `backend/app/models/master_lookup.py`: Added `is_system` and `tenant_id` columns to `MasterValue` model.
- `backend/app/schemas/master_lookup.py`: Updated `MasterValueResponse` schema to expose `is_system` and `tenant_id`.
- `backend/app/db/seed.py`: Added `product_color`, `product_size`, `product_brand`, `product_category` master types and populated standard colors, sizes, and categories as system defaults.
- `backend/app/repositories/master_lookup.py`: Updated `get_values_by_type_code` to query system defaults (`is_system=True`) OR tenant custom entries (`tenant_id=tenant_id`).
- `backend/app/services/master_lookup.py`: Added system deletion guard (`SMRITI-VAL-020`) and passed tenant context in `create_value` and `search_values`.
- `backend/app/api/v1/master_lookup.py`: Updated API handlers to pass `user.tenant_id`, added system edit guard (`SMRITI-VAL-021`), and exposed toggle-active endpoint.
- `backend/app/services/inventory.py`: Implemented `_build_sku(p)` and `_validate_master_field`, and integrated validation into `create_product`.
- `backend/app/core/errors.py`: Updated `build_error_response` to accept `custom_reference_id`.
- `backend/app/core/error_handlers.py`: Updated `http_exception_handler` to pass `custom_reference_id` from exception details.

---

## 5. Architecture Decisions
1. **Hybrid Multitenancy Pattern**:
   - `tenant_id == NULL` indicates a global system value seeded by SMRITI OS.
   - `tenant_id == <tenant_id>` indicates a tenant-specific custom entry.
   - Queries perform `OR(MasterValue.is_system == True, MasterValue.tenant_id == tenant_id)` to present a unified view.
2. **Immutable System Protection**:
   - System records cannot be deleted (`SMRITI-VAL-020`) or renamed (`SMRITI-VAL-021`).
   - Active status can be toggled via `/toggle-active` if a tenant wants to hide a system value from their active dropdowns.
3. **Graceful Fallback & Canonical Normalization**:
   - If a master type is not seeded yet, `_validate_master_field` gracefully returns the normalized input string.
   - Values are saved in canonical casing from the DB to guarantee data consistency.

---

## 6. Design Rationale
Hardcoding validation choices directly inside inventory operations creates data entry errors (e.g. `"Rede"` vs `"Red"`, `"xxl"` vs `"XXL"`). Normalizing casing and validating against master lookups prevents catalog pollution while permitting tenant customization.

---

## 7. Implementation Summary
- **SKU Auto-Generation**: `_build_sku` concatenates `style_code`, `color`, and `size` with hyphen delimiters when `sku` is blank.
- **Field Normalization**: `_validate_master_field` normalizes input, verifies existence in system/tenant lookup values, and returns the canonical casing.
- **HREP Exception Structure**: Raises `HTTPException(422)` with reference ID `SMRITI-VAL-010` listing valid options when invalid input is provided.

---

## 8. Tests Executed
Command:
```bash
python -m pytest app/tests/test_master_hybrid.py -v
```

Terminal Output:
```text
app/tests/test_master_hybrid.py::test_1_list_colors_returns_system_and_tenant_values PASSED [ 10%]
app/tests/test_master_hybrid.py::test_2_create_custom_color_dusty_rose PASSED [ 20%]
app/tests/test_master_hybrid.py::test_3_delete_system_value_returns_403_smriti_val_020 PASSED [ 30%]
app/tests/test_master_hybrid.py::test_4_update_system_value_name_returns_403_smriti_val_021 PASSED [ 40%]
app/tests/test_master_hybrid.py::test_5_toggle_active_on_beige_flips_active PASSED [ 50%]
app/tests/test_master_hybrid.py::test_6_post_product_with_lowercase_color_normalized_to_title_case PASSED [ 60%]
app/tests/test_master_hybrid.py::test_7_post_product_with_invalid_color_returns_422_smriti_val_010 PASSED [ 70%]
app/tests/test_master_hybrid.py::test_8_post_product_with_lowercase_size_normalized_to_upper_case PASSED [ 80%]
app/tests/test_master_hybrid.py::test_9_post_product_with_invalid_category_returns_422_smriti_val_010 PASSED [ 90%]
app/tests/test_master_hybrid.py::test_10_tenant_a_cannot_see_tenant_b_custom_colors PASSED [100%]

====================== 10 passed, 85 warnings in 56.89s =======================
```

---

## 9. Verification Results
- All 10 tests passed cleanly.
- System value deletion/update guard returns HTTP 403 with `SMRITI-VAL-020` and `SMRITI-VAL-021`.
- Invalid item master field returns HTTP 422 with `SMRITI-VAL-010`.
- Tenant isolation confirmed: Tenant A cannot view Tenant B's custom entries.

---

## 10. Known Limitations
- Master value search is case-insensitive matching; phonetic sound-alike matching (e.g. `"Rdd"` → `"Red"`) is not included.

---

## 11. Future Work
- Implement configurable validation policies (`NONE`, `WARNING`, `STRICT`, `AUTO_CREATE`) per field in `master_types.field_schema`.
- Support multi-field conditional validation rules (e.g. `Category == Footwear` requires `Size`, `Color`, `Brand`).

---

## 12. Related ADRs
- `ADR-014`: Master Lookup Framework & Hybrid Tenant Storage Model.

---

## 13. Related RFCs
- `RFC-022`: Item Master Attribute Standardization & Human-Readable Error Catalog.
