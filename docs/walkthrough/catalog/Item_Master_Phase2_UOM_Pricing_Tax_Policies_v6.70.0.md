<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.0
  Created      : 2026-10-05
  Modified     : 2026-10-05
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Item Master Phase 2 — UOM, Pricing, Tax & Inventory Policy Architecture v6.70.0

## 1. Purpose
Documents the end-to-end implementation of SMRITI Retail OS Item Master Phase 2, establishing variant-level relational domains for statutory footwear UOM (`PRS`), commercial pricing, tax profiles, supplier procurement settings, sales settings, and inventory replenishment policies, supported by a rule-based Readiness Engine and modernized frontend drawer UX.

## 2. Scope
- Statutory Footwear UOM Master (`PRS`) and legacy alias (`PAIR`) governance in `uoms_ref`.
- 6 domain child tables anchored 1-to-1 to physical variants (`item_variants.id`):
  - `item_uom_settings`
  - `item_prices`
  - `item_tax_profiles`
  - `item_supplier_settings`
  - `item_sales_settings`
  - `item_inventory_policies` (strict replenishment policy only; zero physical stock balances).
- Rule-based `ItemReadinessEngine` assessing variant readiness without exposing raw database exceptions.
- Alembic database migration `v1519_item_master_phase2_uom_pricing_tax_policies` with verified upgrade and downgrade cycles.
- Frontend refactor in `AddProductDrawer.tsx` supporting Simple, Hybrid, and Advanced catalog modes with zero hardcoded commercial defaults and zero synthetic barcodes.
- Core validation dictionary and frontend error element mapper.

## 3. Files Created
- `backend/alembic/versions/v1519_item_master_phase2_uom_pricing_tax_policies.py`
- `backend/app/services/item_readiness_svc.py`
- `backend/app/tests/test_item_master_phase2.py`
- `docs/implementation/catalog/Item_Master_Phase2_UOM_Pricing_Tax_Policies_Plan_v6.70.0.md`
- `docs/walkthrough/catalog/Item_Master_Phase2_UOM_Pricing_Tax_Policies_v6.70.0.md`

## 4. Files Modified
- `backend/app/db/ctrl_seeder.py`
- `backend/app/db/seed_ctrl_ref.py`
- `backend/app/db/ownership.py`
- `backend/app/models/item_master.py`
- `backend/app/models/__init__.py`
- `backend/app/schemas/item_master.py`
- `backend/app/services/item_domain_svc.py`
- `backend/app/api/v1/item_domain.py`
- `backend/app/core/item_master_validation.py`
- `src/services/itemMasterValidationMapper.ts`
- `src/components/itemMaster/AddProductDrawer.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **AD-IM-01: Technical PK Anchoring**: Every Phase 2 child entity uses `item_variant_id` as its primary key and foreign key referencing `item_variants.id ON DELETE CASCADE`.
- **AD-IM-02: Zero Physical Stock in Item Master**: Physical inventory remains strictly decoupled in `product_batch_stocks` and `stock_movements`. `item_inventory_policies` stores replenishment rules only.
- **AD-IM-03: Zero Silent Defaults**: Commercial defaults (`6403`, `2999`, `2499`, `1800`) are eliminated from forms. Missing attributes are surfaced via the Readiness Engine rather than pre-filled with dummy data.
- **AD-IM-04: Non-Failing Historical Constraints**: Database `CHECK` constraints permit `selling_price >= 0` and nullable HSN to preserve historical data integrity. Positive price and valid HSN enforcement is delegated to the Readiness Engine.
- **AD-IM-05: Idempotent Variant Re-Use**: Ingestion of existing physical variants (e.g. secondary barcodes, new MRP points) updates existing child records rather than attempting duplicate primary key insertions.

## 6. Design Rationale
Footwear merchandising requires separating physical identity (Style + Color + Size) from dynamic commercial dimensions (MRP, selling price, discounts, supplier lead times). By establishing variant-anchored 1-to-1 extension tables, SMRITI achieves granular commercial flexibility without bloating the core catalog table or corrupting immutable physical inventory movements.

## 7. Implementation Summary
1. **Statutory UOM Seeding**: Added `PRS` (`uom_prs`, Pairs, `decimal_allowed=False`, `uqc_code='PRS'`) to `ctrl_seeder.py`, `seed_ctrl_ref.py`, and verified in live DB `uoms_ref`.
2. **Schema & ORM Models**: Created SQLAlchemy models for all 6 tables in `app/models/item_master.py` and registered table ownership under `TableOwner.TENANT` in `app/db/ownership.py`.
3. **Readiness Engine**: Implemented `ItemReadinessEngine` in `app/services/item_readiness_svc.py` returning `ItemReadinessStatus` (`DRAFT`, `INCOMPLETE`, `READY_FOR_SALE`, `ACTIVE`, `INACTIVE`, `ARCHIVED`) and granular field-level blocking reasons.
4. **Migration & Rollback**: Created Alembic revision `v1519` and tested symmetrical upgrade/downgrade dry runs on PostgreSQL tenant `smriti001`.
5. **Domain Services & API Gateway**: Wired full serialization, eager loading, and upsert logic into `ItemDomainService`, exposing `/api/v1/item-variants/{id}/readiness` and `/settings`.
6. **Frontend UX Overhaul**: Modernized `AddProductDrawer.tsx` supporting Simple, Hybrid, and Advanced matrix modes with governed lookup gates.

## 8. Tests Executed
1. `backend/app/tests/test_item_master_phase2.py`:
   - `test_uom_master_prs_and_alias_pair`: PASSED
   - `test_item_uom_settings_invariants`: PASSED
   - `test_item_prices_invariants_and_historical_zero_price_compatibility`: PASSED
   - `test_item_tax_profiles_and_legacy_hsn_detection`: PASSED
   - `test_item_supplier_settings_and_purchasing_authority`: PASSED
   - `test_item_sales_settings_commercial_policy`: PASSED
   - `test_item_inventory_policy_strict_policy_only`: PASSED
   - `test_item_readiness_engine_lifecycle_and_blocking_reasons`: PASSED
   - `test_item_master_phase2_e2e_persistence_and_relationships`: PASSED
2. `backend/app/tests/test_item_master_domain_refactor.py`:
   - `test_item_master_domain_migration_and_model_aliases`: PASSED
   - `test_item_style_create_and_tenant_isolation`: PASSED
   - `test_physical_variant_identity_decoupled_from_mrp`: PASSED
   - `test_barcode_uniqueness_enforcement`: PASSED
   - `test_governed_master_lookup_catalog`: PASSED
   - `test_rest_api_item_domain_endpoints`: PASSED
3. Frontend TypeScript Check:
   - `npx tsc --noEmit`: PASSED (0 errors).

## 9. Verification Results
- 15/15 automated tests PASSED across both suites in 53.97s.
- 0 TypeScript compiler errors.
- Live database row counts in `smriti001`:
  - `items`: 1,209 rows (100% intact)
  - `products`: 2,302 rows (100% intact)
  - `sales_invoices`: 2,398 rows (100% intact)
  - `stock_movements`: 9,093 rows (100% intact)
  - `uoms_ref`: 12 rows (including statutory `PRS` and alias `PAIR`)

## 10. Known Limitations
- Supplier lead times currently track days as integer values; calendar-aware working-day offsets will be integrated in Procurement Phase 3.
- Historical variants with price = 0 continue to reside in database; they are classified as `INCOMPLETE` by the Readiness Engine until merchant completes pricing.

## 11. Future Work
- Connect `item_inventory_policies` to automated purchase order generation (`AutoPOModal`).
- Implement batch price update wizard across variant matrix axes.

## 12. Related ADRs
- `docs/adr/ADR_0042_Item_Master_Decomposition.md`
- `docs/adr/ADR_0055_Frozen_SKU_Barcode_Architecture.md`

## 13. Related RFCs
- `docs/rfc/RFC_0019_Variant_Commercial_Policy_Decoupling.md`
