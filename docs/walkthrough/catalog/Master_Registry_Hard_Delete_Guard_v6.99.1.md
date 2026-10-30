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

# Walkthrough: Master Registry Hard Delete Guard & Active Reference Governance (v6.99.1)

## 1. Purpose
This walkthrough documents the design, implementation, and verification of the Hard Delete Safety Guard for SMRITI Retail OS Master Registry and lookup systems. The guard strictly prohibits deletion (neither hard nor soft deletion) of any master value, size group, or attribute definition if active operational references exist in Universal Item Master, Item Variants (SKUs), Barcodes, Legacy Catalog, Variant Templates, or Child Master Values.

## 2. Scope
- Guard service: `backend/app/services/master_delete_guard.py`
- Endpoints guarded:
  - `DELETE /api/v1/master-lookup/lookup/{type_code}/values/{id}`
  - `DELETE /api/v1/master-lookup/size-groups/{group_id}`
  - `DELETE /api/v1/attributes/definitions/{id}`
  - `DELETE /api/v1/attributes/groups/{id}`
- Frontend UI: `src/components/global/master/MasterListScreen.tsx` (reference conflict modal)
- Regression test suites: `backend/tests/test_master_lookup_delete_guard.py` and `src/tests/masterLookupDeleteGuardUI.test.ts`.

## 3. Files Created
1. `backend/app/services/master_delete_guard.py`: Core `MasterValueDeleteGuard` scanning active references across all catalog and registry entities.
2. `backend/tests/test_master_lookup_delete_guard.py`: 9-case pytest suite validating all reference blocker triggers.
3. `src/tests/masterLookupDeleteGuardUI.test.ts`: 5-case Vitest suite verifying UI modal rendering and reference parsing.
4. `docs/implementation/catalog/Master_Registry_Hard_Delete_Guard_Plan_v6.99.1.md`: IPGP implementation plan.
5. `docs/walkthrough/catalog/Master_Registry_Hard_Delete_Guard_v6.99.1.md`: WGP walkthrough document.

## 4. Files Modified
1. `backend/app/api/v1/master_lookup.py`: Integrated `MasterValueDeleteGuard.check_references` into `delete_lookup_value` and `delete_size_group`.
2. `backend/app/services/attributes.py`: Added checks for `Item` and `ItemVariant` attributes before deleting attribute definitions and groups.
3. `src/components/global/master/MasterListScreen.tsx`: Added `blockedDeleteError` modal displaying linked operational records and suggested actions.
4. `docs/implementation/README.md`: Appended plan entry to master implementation index.
5. `docs/walkthrough/README.md`: Appended walkthrough entry to master walkthrough index.
6. `CHANGELOG.md`: Added release summary for version `6.99.1`.

## 5. Architecture Decisions
- **Fail-Closed Execution**: If any active (non-soft-deleted) record references the master value, deletion is unconditionally refused.
- **Structured Conflict Payload (`SMRITI-VAL-003`)**: Replaced vague error strings with a structured dictionary containing error code, human-friendly explanation, total reference count, array of linked records (capped at 25), and suggested resolution.
- **Tenant Scope Awareness**: When checking tenant-scoped lookups (`company_id`), checks target the specific tenant, while global lookups are validated across all tenant datasets to prevent cross-tenant breakage.
- **Multi-Entity Surface Scanning**: Rather than checking only a single table, the guard scans Universal Item Master (`items`), SKUs (`item_variants`), Barcodes (`item_barcodes`), Legacy Products (`products`), Variant Templates (`variant_templates`), Size Groups (`size_groups`), Child Values (`master_values`), and Sales Orders.

## 6. Design Rationale
Allowing silent or unverified deletion of master registry entries leaves orphan foreign keys, disrupts POS barcode lookups, and corrupts transactional reports. Returning HTTP 409 Conflict with structured evidence empowers users and administrators to understand exactly which records are utilizing the master value and provides actionable steps to reassign or retire those records first.

## 7. Implementation Summary
```
                                 [DELETE Request]
                                        ↓
                       [MasterValueDeleteGuard.check_references]
                                        ↓
   ┌────────────────────────────────────┼────────────────────────────────────┐
   ↓                                    ↓                                    ↓
[Child Master Values]         [Universal Item Master]              [Item Variants (SKU)]
(parent_value_id == id)       (brand/category/dept/etc.)           (color/size/hsn/sku)
   │                                    │                                    │
   ├────────────────────────────────────┼────────────────────────────────────┤
   ↓                                    ↓                                    ↓
[Universal Barcodes]           [Variant Templates]                 [Legacy Products]
(barcode == code)             (template links)                     (product attributes)
   └────────────────────────────────────┬────────────────────────────────────┘
                                        ↓
                         Are active references found?
                                ├── YES → Raise HTTP 409 (SMRITI-VAL-003)
                                │         Return linked_records array
                                └── NO  → Proceed with deletion & audit event
```

## 8. Tests Executed
1. **Pytest (`backend/tests/test_master_lookup_delete_guard.py`)**:
   - `test_guard_permits_delete_when_no_active_references_exist`: PASSED
   - `test_guard_blocks_delete_when_item_master_references_brand`: PASSED
   - `test_guard_blocks_delete_when_item_variant_references_color`: PASSED
   - `test_guard_blocks_delete_when_barcode_references_value`: PASSED
   - `test_guard_blocks_delete_when_variant_template_references_style`: PASSED
   - `test_guard_blocks_delete_when_child_master_values_exist`: PASSED
   - `test_size_group_guard_blocks_delete_when_referenced_by_sku`: PASSED
   - `test_size_group_guard_blocks_delete_when_referenced_by_attribute_group`: PASSED
   - `test_api_endpoint_raises_409_with_structured_guard_payload`: PASSED
2. **Vitest (`src/tests/masterLookupDeleteGuardUI.test.ts`)**:
   - State capture, error parsing, modal presentation, linked records listing, suggested action callout: 5/5 PASSED.
3. **Vitest Full Regression**:
   - `headerMap.test.ts` (14 tests): PASSED
   - `itemAttrs.test.ts` (12 tests): PASSED
   - `masterLookupDeleteGuardUI.test.ts` (5 tests): PASSED

## 9. Verification Results
- **Pytest Output**: 9 passed, 16 warnings in 14.12s
- **Vitest Output**: 31 passed across 3 test files in 663ms
- **Python Syntax Check**: `py_compile` exited with code 0 across all modified files.

## 10. Known Limitations
- Deletion checks inspect active records (`is_deleted == False`). Soft-deleted records do not block master value deletion.
- JSON attribute bag checks perform case-insensitive substring matching on JSON string representations.

## 11. Future Work
- Add bulk re-assignment workflow directly from the deletion blocked modal (e.g., "Reassign all 5 items to Brand 'Puma' and delete 'Nike'").
- Add background async reference scanner for ultra-high-volume catalogs (>1,000,000 items).

## 12. Related ADRs
- `ADR-0021`: Universal Item Master & Variant Architecture
- `ADR-0044`: Control Plane Master Registry Governance

## 13. Related RFCs
- `RFC-0089`: Fail-Closed Master Data Integrity & Delete Guards
