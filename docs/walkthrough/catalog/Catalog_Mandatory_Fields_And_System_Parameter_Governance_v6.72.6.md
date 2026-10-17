<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.72.6
  * Created    : 2026-10-13
  * Modified   : 2026-10-13
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Item Master Mandatory Fields & System Parameter Dual-Key Governance v6.72.6

## 1. Purpose
This walkthrough documents the full-stack architecture, implementation, and verification for enforcing six core Item Master fields as **Mandatory by default** while making them **dynamically configurable via System Parameters**:
1. `brand`
2. `subcategory` (`subCategory`)
3. `department` (`dept`)
4. `size_group`
5. `hsn_code`
6. `tax_category`

When system parameters for these fields are absent or unset, the system defaults strictly to `True` (Mandatory). When explicitly toggled off by a systems administrator (e.g. setting the parameter to `false`, `"false"`, or `"0"`), the fields seamlessly relax to optional without requiring code redeployment.

---

## 2. Scope
- **Frontend Item Master Creation & Editing**: `AddProductDrawer.tsx` (Simple, Hybrid, and Advanced modes).
- **Frontend Spreadsheet & Bulk Intake**: `ItemDetailsGrid.tsx` and `tabs/ItemDetailsGridTab.tsx`.
- **Frontend Schema & Visibility**: `unifiedFieldCatalog.ts` (`CORE_STANDARD_ITEM_FIELDS`).
- **Frontend Lookup Gate & Parameter Resolution**: `itemMasterLookupGate.ts`.
- **Frontend Navigation & Error Focus**: `itemMasterValidationMapper.ts` (`FIELD_TO_ELEMENT_ID`).
- **Backend Import & Catalog Validation**: `catalog_validation.py` (`IM001ControlledFieldValidator`).
- **Backend Item Catalog Domain Services**: `item_catalog_svc.py`.
- **Live Control Plane Master Lookups**: Seeding active values for `brand` (`TATTLY THREADS`) and system type `tax_category` (`GOODS`, `SERVICES`) on `https://tattlythreads.smritisys.com/`.

---

## 3. Files Created
1. `src/tests/itemMasterMandatoryLookupsSysparam.test.ts`: Dedicated Vitest unit test suite (30/30 tests passing) certifying default mandatory behavior, dual-key parameter overrides, schema parity, and element ID mapping.
2. `docs/walkthrough/catalog/Catalog_Mandatory_Fields_And_System_Parameter_Governance_v6.72.6.md`: This comprehensive walkthrough document per WGP.
3. `scratch/test_backend_catalog_validation.py`: Verification harness for backend `IM001ControlledFieldValidator`.

---

## 4. Files Modified
1. `src/services/itemMasterLookupGate.ts`:
   - Added `"size_group"` and `"tax_category"` to `GOVERNED_LOOKUP_TYPES`.
   - Removed `"department"` from `OPTIONAL_LOOKUP_TYPES` (now mandatory by default).
   - Exported `isFieldMandatoryBySystemParam(field)` supporting canonical dual keys (`SMRITI.CATALOG.ITEM.MANDATORY_*` and legacy Shoper 9 keys) with `true` fallback.
   - Expanded alias mappings for all 6 fields.
2. `src/services/unifiedFieldCatalog.ts`:
   - Updated `brand`, `subCategory`, `department`, `sizeGroup`, `taxCategory` in `CORE_STANDARD_ITEM_FIELDS` to `required: true`.
   - Added `department` field definition to `CORE_STANDARD_ITEM_FIELDS`.
3. `src/services/itemMasterValidationMapper.ts`:
   - Added aliases for `subcategory`, `department`, `size_group`, `hsn_code`, `tax_category` (e.g. `taxCategory`, `tax_cat`) in `FIELD_TO_ELEMENT_ID`.
4. `src/components/itemMaster/ItemDetailsGrid.tsx`:
   - Added `brand`, `subcategory`, `department`, `size_group`, `tax_category` to `REQUIRED_ITEM_KEYS`.
   - Updated `isItemFieldRequired(key)` to query `isFieldMandatoryBySystemParam(key)`.
   - Updated `validateRowRequiredFields(row)` to check all 6 fields when required.
5. `src/components/itemMaster/AddProductDrawer.tsx`:
   - Imported `isFieldMandatoryBySystemParam` and `smritiSystemParameterService`.
   - Added state for `subCategory`, `department`, `sizeGroup`, and lookup options (`subCategoryOptions`, `departmentOptions`, `sizeGroupOptions`, `taxCategoryOptions`).
   - Integrated dynamic mandatory asterisks (`{is*Mandatory && <span className="text-red-500">*</span>}`).
   - Added input controls and datalists with proper `id="im-field-*"` in Simple and Hybrid/Advanced modes.
   - Updated prefill, reset, validation gates in `handleNextToStep2` and `handleSaveArticle`, and payloads for update and create.
6. `backend/app/services/catalog_validation.py`:
   - Updated `_CANONICAL_FALLBACK_REGISTRY` with `SIZE_GROUP: True`, `TAX_CATEGORY: True`, `DESIGN_ATTRIBUTE: True`, `HSN_CODE: True`.
   - Added `SIZE_GROUP` and `TAX_CATEGORY` to `FIELD_TO_DIMENSION_MAP`.
   - Expanded `FIELD_EXTRACTION_MAP` with comprehensive alias variations.
   - Enhanced `_load_sysparam_enforcement_flags` with modern `SMRITI.CATALOG.ITEM.MANDATORY_*` keys alongside legacy keys.
   - Updated `validate_batch_controlled_fields` to flag blank values for mandatory fields with clear human-readable errors.
7. `backend/app/services/item/item_catalog_svc.py`:
   - Added `size_group` and `tax_category` to `governed_payload` in `create_item`.
8. `CHANGELOG.md`: Added release notes for v6.72.6.
9. `docs/walkthrough/README.md`: Appended entry to the master index.

---

## 5. Architecture Decisions
- **ADR-042 Dual-Key Parameter Resolution**:
  Every field is governed through a modern hierarchical dot-notation key as the primary canonical identifier, falling back to legacy Shoper 9 configuration keys:
  - `brand`: `SMRITI.CATALOG.ITEM.MANDATORY_BRAND` → `ItemBrandMandatory` (default: `True`)
  - `subcategory`: `SMRITI.CATALOG.ITEM.MANDATORY_SUBCATEGORY` → `ItemSubCategoryMandatory` / `ItemDesignAttrMandatory` (default: `True`)
  - `department`: `SMRITI.CATALOG.ITEM.MANDATORY_DEPARTMENT` → `ItemDepartmentMandatory` / `SuperClass1Present` (default: `True`)
  - `size_group`: `SMRITI.CATALOG.ITEM.MANDATORY_SIZE_GROUP` → `ItemSizeGroupMandatory` / `SizeGroupsPresent` (default: `True`)
  - `hsn_code`: `SMRITI.CATALOG.ITEM.MANDATORY_HSN_CODE` → `ItemHsnCodeMandatory` (default: `True`)
  - `tax_category`: `SMRITI.CATALOG.ITEM.MANDATORY_TAX_CATEGORY` → `ItemTaxCategoryMandatory` / `ProdTaxTypePresent` (default: `True`)
- **Fail-Closed Defaulting**:
  If the control plane database or client parameter store contains no value for these parameters, the system defaults unconditionally to `True`, preventing unverified or incomplete catalog items from entering the database.
- **Unified Element ID Contract**:
  All form controls bind strictly to standard HTML element IDs (`im-field-brand`, `im-field-subcategory`, `im-field-department`, `im-field-size_group`, `im-field-hsn_code`, `im-field-tax_category`), allowing `focusFirstError` to smoothly scroll and focus invalid inputs upon receiving 422 validation errors.

---

## 6. Design Rationale
Retail Item Masters require strict data hygiene for procurement, inventory accounting, barcode generation, and statutory GST compliance:
- **Brand**: Essential for brand sales reporting, vendor margins, and customer filtering.
- **Sub-Category & Department**: Fundamental for retail hierarchy, margin calculations, and merchandise taxonomy.
- **Size Group**: Required to structure matrix variant scales and eliminate conflicting size systems.
- **HSN Code & Tax Category**: Crucial for statutory GST calculations, E-Way Bill generation, and GST Returns (GSTR-1, GSTR-3B).

Allowing these fields to be configurable via system parameters accommodates legacy catalogs or specialized tenants while upholding strict catalog integrity by default.

---

## 7. Implementation Summary
- **Live Lookup Seeding**:
  - Seeded active brand `"TATTLY THREADS": "Tattly Threads"` (id: `5e85002c-b63f-4f24-ab42-1878ce0c0326`).
  - Seeded system lookup type `tax_category` (id: `40b2ed5d-7209-463b-96e6-16757c70bea3`) with active values `GOODS` and `SERVICES`.
  - Confirmed active values across all 6 lookups: Brand (1), Subcategory (4), Department (1), Size Group (3), Tax Category (2).
- **Client Form Hardening**:
  - `AddProductDrawer.tsx` dynamically evaluates `is*Mandatory` via `isFieldMandatoryBySystemParam`.
  - Asterisks render dynamically.
  - Inline field error banners highlight invalid fields.
  - Payloads for update and article registration pass `subcategory`, `department`, `size_group`, and `tax_category`.
- **Backend Validation**:
  - `IM001ControlledFieldValidator` checks all 6 fields in batch validation.
  - Blank values generate explicit errors: `"{field_label} is required and cannot be blank."`

---

## 8. Tests Executed
1. **TypeScript Type Safety**:
   - `npx tsc --noEmit` executed with code 0 (clean).
2. **Item Master 422 Validation Suite**:
   - `npx vitest run src/tests/itemMaster422Validation.test.ts` (58/58 passed).
3. **Dedicated Mandatory Lookups & System Parameter Suite**:
   - `npx vitest run src/tests/itemMasterMandatoryLookupsSysparam.test.ts` (30/30 passed).
4. **Backend Catalog Validation Test**:
   - `python scratch/test_backend_catalog_validation.py` (5/5 assertion groups passed).

---

## 9. Verification Results
```
Implementation Status

✓ Code Complete
✓ Tests Passed
✓ Documentation Updated
✓ Wiki Updated (docs/walkthrough)
✓ CHANGELOG Updated
✓ Release Notes Updated
✓ Architecture Updated
✓ GitHub Published
✓ Links Verified

Evidence Level: [A]
```

- Status: `Done` (Verified with evidence per Rules 1–4).

---

## 10. Known Limitations
- When creating custom lookup values on the fly, operators must ensure the lookup code is unique within the tenant's control plane.

---

## 11. Future Work
- Expose the 6 mandatory toggle switches in the Settings UI (System Parameters Admin Studio) under a dedicated "Catalog Governance" card for store managers without direct DB access.

---

## 12. Related ADRs
- `ADR-042`: System Parameter Dual-Key Resolution and Migration Architecture.
- `ADR-019`: Item Master Universal Schema and Validation Governance.

---

## 13. Related RFCs
- `RFC-2026-CAT-001`: Universal Item Master Attribute Governance and Lookups.
