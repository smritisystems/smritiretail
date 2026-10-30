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

# Implementation Plan: Master Delete Guard Expansion & Schema Parity Governance (v6.99.3)

## 1. Objective
Expand the Hard Delete Safety Guard across all Master Registry dimensions, Variant Style Templates, and Organizational Masters (Warehouses and Branches), while resolving schema drift between `MasterValueDeleteGuard` and the canonical `Product` catalog model.

## 2. Business Motivation
Operational integrity in multi-tenant retail ERP requires that master records (such as Brands, Categories, Variant Templates, Warehouses, and Branches) can never be deleted—either through hard deletion or soft retirement—when they are actively referenced in Item Master, SKUs, inventory batches, stock movements, or parent-child structures. Preventing unauthorized deletion avoids orphaned foreign keys, POS barcode scan failures, stock balance corruption, and audit trail breakage.

## 3. Scope
- **Catalog Model Parity:** Eliminate non-existent columns (`Product.department`, `Product.product_type`) from `MasterValueDeleteGuard.prod_field_map` to prevent runtime attribute errors.
- **Variant Template Deletion Guard:** Enforce pre-delete checks in `AttributesService.delete_template` against `Product` records (via `variant_template_id` or `style_code`) and `Item` records (via `style_code`).
- **Warehouse Deletion Guard:** Prevent warehouse deletion in `backend/app/api/v1/masters.py` if positive stock quantity exists in `ProductBatchStock` or if historical records exist in `StockMovement`.
- **Branch Deletion Guard:** Prevent branch deletion in `backend/app/api/v1/masters.py` if active warehouses remain assigned to the branch.
- **Automated Regression Testing:** Expand `backend/tests/test_master_lookup_delete_guard.py` from 9 to 11 test cases validating the expanded guard boundaries.

## 4. Current State
- `MasterValueDeleteGuard.check_references` scanned `Item`, `ItemVariant`, `ItemBarcode`, `Product`, `VariantTemplate`, and `SizeGroup`.
- `prod_field_map` referenced non-existent columns `Product.department` and `Product.product_type`, causing caught `AttributeError` warnings.
- `AttributesService.delete_template` soft-deleted templates without inspecting active product or item style usage.
- `masters.py` soft-deleted warehouses and branches without checking inventory levels or assigned facilities.

## 5. Gap Analysis
| Entity | Previous Delete Behavior | Target Protected Behavior |
| :--- | :--- | :--- |
| **Catalog Mapping** | `Product.department` and `product_type` raised runtime `AttributeError` | Only canonical `Product` columns mapped; clean AST parity |
| **Variant Templates** | Allowed deletion regardless of item/product references | Blocks deletion with HTTP 409 if active `Product` or `Item` references exist |
| **Warehouses** | Allowed deletion even with on-hand inventory | Blocks deletion with HTTP 409 if positive on-hand stock or stock movements exist |
| **Branches** | Allowed deletion with active warehouses attached | Blocks deletion with HTTP 409 if active warehouses are still assigned |

## 6. Architecture Impact
- **Decoupled Reference Analysis:** Keeps all reference-checking logic aligned with fail-closed governance.
- **Unified Error Protocol:** Standardizes error responses using HTTP 409 Conflict with human-readable explanations per the SMRITI Human-Readable Error Policy (HREP).
- **Zero Schema Migrations Required:** Utilizes existing PostgreSQL columns, foreign keys, and indexes on `items`, `products`, `variant_templates`, `warehouses`, and `stock_movements`.

## 7. Proposed Design
1. **Attribute Mapping Sanitization:**
   Remove `department` and `product_type` from `prod_field_map` in `backend/app/services/master_delete_guard.py`.
2. **Variant Template Guard:**
   Query `Product.variant_template_id` and `Product.style_code`, plus `Item.style_code`. If matching non-deleted rows exist, raise HTTP 409 Conflict.
3. **Warehouse Stock Guard:**
   Query `ProductBatchStock.quantity > 0` and `StockMovement.warehouse_id`. If active stock or historical movements exist, raise HTTP 409 Conflict.
4. **Branch Facility Guard:**
   Query `Warehouse.branch_id` for active facilities. If found, raise HTTP 409 Conflict.

## 8. Files Created
- `docs/implementation/catalog/Master_Delete_Guard_Expansion_And_Schema_Parity_Plan_v6.99.3.md`
- `docs/walkthrough/catalog/Master_Delete_Guard_Expansion_And_Schema_Parity_v6.99.3.md`

## 9. Files Modified
- `backend/app/services/master_delete_guard.py`: Cleaned `prod_field_map`.
- `backend/app/services/attributes.py`: Added active item/product check to `delete_template`.
- `backend/app/api/v1/masters.py`: Added stock/movement guard to warehouse deletion and facility guard to branch deletion.
- `backend/tests/test_master_lookup_delete_guard.py`: Added 2 unit tests covering variant template and warehouse delete blockers.
- `docs/implementation/README.md`: Appended entry to master implementation index.
- `docs/walkthrough/README.md`: Appended entry to master walkthrough index.
- `CHANGELOG.md`: Documented release updates.

## 10. Dependencies
- SQLAlchemy 2.0 async session queries.
- FastAPI HTTP exception handler.
- PostgreSQL indexed foreign keys on `items`, `products`, `variant_templates`, and `warehouses`.

## 11. Risks
- **Risk:** Existing tests or scripts attempting to delete dummy warehouses or templates with mock data could receive 409.
- **Mitigation:** Unit tests use isolated mock sessions, and integration test cleanup scripts deactivate rather than delete transacted entities.

## 12. Rollback Strategy
If any regressions occur, revert commit `33689d50` via `git revert 33689d50` and push to `origin/smritiNX`.

## 13. Verification Plan
- Run `python -m pytest backend/tests/test_master_lookup_delete_guard.py` ensuring all 11 test cases pass.
- Run `npx tsc --noEmit` ensuring zero frontend compilation issues.
- Verify live database records using interactive verification scripts.

## 14. Test Plan
- `test_guard_permits_delete_when_no_active_references_exist`
- `test_guard_blocks_delete_when_item_master_references_brand`
- `test_guard_blocks_delete_when_sku_variant_references_color`
- `test_guard_blocks_delete_when_barcode_references_code`
- `test_guard_blocks_delete_when_catalog_product_references_brand`
- `test_guard_blocks_delete_when_variant_template_references_brand`
- `test_size_group_guard_blocks_delete_when_referenced_by_sku_size`
- `test_size_group_guard_blocks_delete_when_referenced_by_attribute_group`
- `test_api_endpoint_raises_409_with_structured_guard_payload`
- `test_variant_template_delete_guard_blocks_when_linked_to_item`
- `test_warehouse_delete_guard_blocks_when_positive_stock_exists`

## 15. Documentation Impact
- Update Walkthrough Master Index (`docs/walkthrough/README.md`).
- Update Implementation Master Index (`docs/implementation/README.md`).
- Update `CHANGELOG.md`.

## 16. Deployment Plan
1. Commit changes to `origin/smritiNX`.
2. On live servers (`tattlythreads.smritisys.com`), run `git pull origin smritiNX`.
3. Restart uvicorn / backend service to load new guard interceptors.

## 17. Status
**Completed** (Commit `33689d50` pushed to `origin/smritiNX`).

## 18. Related ADRs
- `ADR-001`: Sole FastAPI + PostgreSQL Backend System of Record.
- `ADR-004`: Fail-Closed Master Data Integrity.

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Master_Delete_Guard_Expansion_And_Schema_Parity_v6.99.3.md`
- `docs/walkthrough/catalog/Master_Registry_Hard_Delete_Guard_v6.99.1.md`

