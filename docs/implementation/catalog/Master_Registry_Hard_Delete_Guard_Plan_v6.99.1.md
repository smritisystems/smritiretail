<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.1
  Created      : 2026-10-30
  Modified     : 2026-10-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Master Registry Hard Delete Guard & Active Reference Governance (v6.99.1)

## 1. Objective
Implement a hard delete safety guard for the Master Registry and lookup system. Ensure that no master lookup value (`MasterValue`), size group (`SizeGroup`), or master attribute definition (`AttributeDefinition`, `AttributeGroup`) can be deleted or soft-deleted if active operational references exist anywhere in Universal Item Master (`items`), Universal Item Variants / SKUs (`item_variants`), Universal Barcodes (`item_barcodes`), Legacy Catalog (`products`), Variant Templates (`variant_templates`), Child Lookup Values, or Master Registry Mappings. When active references exist, deletion is blocked, returning HTTP 409 Conflict with structured evidence and a human-readable explanation displaying the linked operational records.

## 2. Business Motivation
In retail operations (POS, Billing, Inventory, WMS, and B2B Dispatch), master data values (Brand, Category, Sub-Category, Department, Product Type, Color, Size, Barcode, UOM, HSN Code) provide the foundational schema and compliance anchors for all transactions. Deleting or soft-retiring an actively referenced lookup value causes:
- Corrupted or orphan references in Item Master, POS checkout, and inventory reports.
- Broken barcode resolution and scanner failure at checkout counters.
- GST/statutory compliance errors when HSN codes or tax classifications are orphaned.
- Inconsistent product categorization and missing filters across retail and corporate analytics.
A fail-closed guard is mandatory to ensure data integrity across all operational workflows.

## 3. Scope
- **Backend Service**: `backend/app/services/master_delete_guard.py` (`MasterValueDeleteGuard`).
- **Master Lookup API Endpoints**:
  - `DELETE /api/v1/master-lookup/lookup/{type_code}/values/{id}`
  - `DELETE /api/v1/master-lookup/size-groups/{group_id}`
- **Master Attributes API Endpoints**:
  - `DELETE /api/v1/attributes/definitions/{id}`
  - `DELETE /api/v1/attributes/groups/{id}`
- **Frontend UI Integration**: `src/components/global/master/MasterListScreen.tsx` (active references conflict modal).
- **Test Suites**:
  - `backend/tests/test_master_lookup_delete_guard.py` (9 unit/integration test cases).
  - `src/tests/masterLookupDeleteGuardUI.test.ts` (5 UI contract test cases).

## 4. Current State
Previously, `delete_lookup_value` in `backend/app/api/v1/master_lookup.py` used `_master_value_reference_reason`, which only checked references for `style_article` and `vendor_code`. For all other 15+ dimension types (`brand`, `category`, `department`, `gender`, `color`, `size`, `heel_type`, `upper_material`, etc.), references were completely unchecked, allowing active brands and categories to be deleted. `delete_size_group` performed soft deletes with zero reference checks against `item_variants` or `attribute_groups`.

## 5. Gap Analysis
| Entity / Field | Prior State | Remediated State |
| :--- | :--- | :--- |
| `Item` (brand, category, department, etc.) | Ignored | Checked across all columns + `attributes_json` |
| `ItemVariant` (color, size, SKU, HSN) | Ignored | Checked across columns + `attributes_json` |
| `ItemBarcode` (barcode) | Ignored | Checked before barcode lookup deletion |
| `SizeGroup` / `SizeGroupValue` | Deleted without check | Checked against `ItemVariant`, `Item`, `Product`, `AttributeGroup` |
| Conflict Feedback | Plain text or silent delete | HTTP 409 Conflict with structured payload & linked records |
| UI Experience | Generic delete failure toast | Interactive modal displaying linked records and suggested actions |

## 6. Architecture Impact
- **Transactional Data Plane**: Zero schema migrations required; queries execute against existing indices on `items`, `item_variants`, `item_barcodes`, and `products`.
- **Control Plane**: `MasterValueDeleteGuard` executes fail-closed checks before any deletion or state transition.
- **API Contract**: Standardized SMRITI HREP error shape `SMRITI-VAL-003` with `linked_records` array.

## 7. Proposed Design
1. **MasterValueDeleteGuard**:
   - `check_references(db, item, type_code, company_id)` scans:
     1. Child lookup values (`parent_value_id == item.id`)
     2. Vendor-linked articles (`vendor_code == item.code`)
     3. Variant templates (`master_value_id`, `style_code`, `brand`, `category`, `hsn_code`)
     4. Universal Item Master (`items`: canonical columns and `attributes_json`)
     5. Universal Item Variants (`item_variants`: `color`, `size`, `variant_sku`, `hsn_code`, `attributes_json`)
     6. Universal Barcodes (`item_barcodes`: `barcode`)
     7. Legacy Catalog (`products`: columns and `attributes`)
     8. Category Attribute Group Mappings & Size Groups
     9. Sales Order Items and Sales Orders
   - `check_size_group_references(db, group_id, group_code, group_name, group_values, company_id)`
2. **FastAPI Endpoints**:
   - Query guard before soft or hard deletion. If blocked, raise `HTTPException(status_code=409, detail=guard_result)`.
3. **MasterListScreen UI**:
   - Intercept 409 error with `linked_records`.
   - Render structured "Deletion Blocked: Active References Detected" modal with list of linked records, matched fields, and suggested resolution.

## 8. Files Created
- `backend/app/services/master_delete_guard.py`
- `backend/tests/test_master_lookup_delete_guard.py`
- `src/tests/masterLookupDeleteGuardUI.test.ts`
- `docs/implementation/catalog/Master_Registry_Hard_Delete_Guard_Plan_v6.99.1.md`
- `docs/walkthrough/catalog/Master_Registry_Hard_Delete_Guard_v6.99.1.md`

## 9. Files Modified
- `backend/app/api/v1/master_lookup.py`
- `backend/app/services/attributes.py`
- `src/components/global/master/MasterListScreen.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- SQLAlchemy 2.0 async engine (`AsyncSession`).
- FastAPI `HTTPException`.
- React 18, Lucide React, Framer Motion (`motion/react`).

## 11. Risks
- *Risk:* Performance impact when deleting unlinked lookup values if table scans are unindexed.
- *Mitigation:* Queries use existing indexed columns (`brand`, `category`, `department`, `color`, `size`, `barcode`, `style_code`, `vendor_code`) with low query limits (`limit=10` per entity type).

## 12. Rollback Strategy
- Changes are fully application-level and require no database rollback or migration backfill. Reverting git commits restores prior deletion behavior.

## 13. Verification Plan
- Unit tests via `pytest` for all guard methods and API endpoints.
- UI contract tests via `vitest` for modal presentation and reference parsing.
- Linter and syntax verification via `py_compile`.

## 14. Test Plan
- Verify delete allowed when references = 0.
- Verify delete blocked when `Item` references brand, category, department, or gender.
- Verify delete blocked when `ItemVariant` references color or size.
- Verify delete blocked when `ItemBarcode` references barcode.
- Verify delete blocked when `VariantTemplate` references template style or master value.
- Verify delete blocked when Child Lookup Values reference parent.
- Verify delete blocked when Size Group values are referenced by SKUs.
- Verify structured error payload includes `code`, `message`, `total_references`, `linked_records`, `suggested_action`.

## 15. Documentation Impact
- Updated Implementation Index (`docs/implementation/README.md`).
- Master Walkthrough document created (`docs/walkthrough/catalog/Master_Registry_Hard_Delete_Guard_v6.99.1.md`) and indexed.
- Repository `CHANGELOG.md` updated under version `[6.99.1]`.

## 16. Deployment Plan
- Deploy backend service and API router updates.
- Deploy frontend bundle via standard Vite build.
- No database migrations required.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0021`: Universal Item Master & Variant Decoupling Architecture
- `ADR-0044`: Master Registry Single Source of Truth & Control Plane Isolation

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Master_Registry_Hard_Delete_Guard_v6.99.1.md`
