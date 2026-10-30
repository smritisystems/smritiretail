<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.3
  Created      : 2026-10-30
  Modified     : 2026-10-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Master Delete Guard Expansion & Schema Parity Governance (v6.99.3)

## 1. Purpose
This walkthrough documents the expansion of the Hard Delete Safety Guard across Variant Templates, Warehouses, and Branches, as well as the resolution of schema drift in `MasterValueDeleteGuard`. These safeguards ensure that no operational master or configuration entity can be retired or deleted while active inventory, items, products, or child structures depend on it.

## 2. Scope
- Guard enhancements in `backend/app/services/master_delete_guard.py`: Sanitized `prod_field_map` to remove non-existent columns `Product.department` and `Product.product_type`.
- Variant Template protection in `backend/app/services/attributes.py`: Extended `delete_template` to block deletion when styles or template IDs are referenced in `Product` or `Item`.
- Organizational Master protection in `backend/app/api/v1/masters.py`:
  - Warehouses: Block deletion if positive physical stock exists in `ProductBatchStock` or if historical records exist in `StockMovement`.
  - Branches: Block deletion if active facilities exist in `Warehouse`.
- Regression verification: Expanded `backend/tests/test_master_lookup_delete_guard.py` from 9 to 11 unit tests.

## 3. Files Created
1. `docs/implementation/catalog/Master_Delete_Guard_Expansion_And_Schema_Parity_Plan_v6.99.3.md`
2. `docs/walkthrough/catalog/Master_Delete_Guard_Expansion_And_Schema_Parity_v6.99.3.md`

## 4. Files Modified
1. `backend/app/services/master_delete_guard.py`: Fixed `prod_field_map` column mappings.
2. `backend/app/services/attributes.py`: Added `Product` and `Item` reference checks to `delete_template`.
3. `backend/app/api/v1/masters.py`: Added stock/movement and facility checks to warehouse and branch deletion routes.
4. `backend/tests/test_master_lookup_delete_guard.py`: Added 2 unit tests covering variant template and warehouse blockers.
5. `docs/implementation/README.md`: Appended entry to master implementation index.
6. `docs/walkthrough/README.md`: Appended entry to master walkthrough index.
7. `CHANGELOG.md`: Appended release entry for version 6.99.3.

## 5. Architecture Decisions
- **Strict AST Schema Alignment**: Guaranteed that `prod_field_map` in `MasterValueDeleteGuard` references only physical, declared columns on the `Product` SQLAlchemy model (`brand`, `category`, `style_code`, `vendor_code`, `color`, `size`, `barcode`, `hsn_code`, `sku`).
- **Fail-Closed Facility Lifecycle**: Warehouses with physical inventory or audit histories cannot be deleted; operators must clear stock and deactivate rather than delete.
- **Hierarchical Branch Preservation**: Branches containing active warehouse facilities cannot be removed until facilities are migrated or reassigned.
- **Fail-Closed Template Protection**: Style templates linked to catalog items cannot be deleted to prevent broken variant generation pipelines.

## 6. Design Rationale
Prior to this release, soft-deleting a warehouse with positive inventory could hide stock from operational dashboards while leaving orphan batches in the database. Similarly, deleting a style template that was actively in use broke downstream variant generation. By checking database references at the API and service boundary before setting `is_deleted = True`, the system enforces transactional consistency without depending solely on database foreign key triggers.

## 7. Implementation Summary
```text
┌────────────────────────────────────────────────────────┐
│               DELETE Request Interception              │
└───────────────────────────┬────────────────────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       ↓                    ↓                    ↓
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│Master Lookup │     │Variant Templ.│     │Warehouse/Br. │
│(DeleteGuard) │     │(AttributesSvc│     │ (masters.py) │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       ↓                    ↓                    ↓
Item / SKU / Barcode   Product / Item       Stock / Movement
  References Exist?    References Exist?    References Exist?
       │                    │                    │
       ├────────────────────┴────────────────────┤
       ↓                                         ↓
   [ YES ]                                    [ NO ]
Return HTTP 409 Conflict               Execute Soft-Delete &
with Business-Friendly Detail          Audit Event
```

## 8. Tests Executed
1. `python -m pytest backend/tests/test_master_lookup_delete_guard.py -q`
   - All 11 unit tests passed in 63.74s.
2. `npx tsc --noEmit`
   - TypeScript compilation passed with 0 errors.

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-9.2.0, pluggy-1.7.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-1.4.1
collected 11 items

backend\tests\test_master_lookup_delete_guard.py ...........             [100%]
================= 11 passed, 16 warnings in 63.74s (0:01:03) ==================
```

## 10. Known Limitations
- Deletion checks query live PostgreSQL database tables. In multi-million row tables without partial indexes on specific text fields, queries rely on standard B-Tree indexes on `style_code`, `brand`, and `category`.

## 11. Future Work
- Add dedicated bulk reference checker endpoint allowing UI to preview delete eligibility for multiple master records simultaneously.

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + PostgreSQL Backend System of Record.
- `ADR-004`: Fail-Closed Master Data Integrity.

## 13. Related RFCs
- `RFC-009`: Universal Catalog and Taxonomy Validation Engine.
