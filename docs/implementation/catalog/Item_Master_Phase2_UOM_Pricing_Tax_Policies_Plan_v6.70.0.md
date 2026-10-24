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

# Implementation Plan: Item Master Phase 2 — UOM, Pricing, Tax & Inventory Policy Architecture v6.70.0

## 1. Objective
Establish complete Phase 2 domain capabilities for the SMRITI Retail OS Item Master:
1. Official statutory footwear UOM master (`PRS`) and legacy alias (`PAIR`) governance in `uoms_ref`.
2. Dedicated domain child tables (`item_uom_settings`, `item_prices`, `item_tax_profiles`, `item_supplier_settings`, `item_sales_settings`, `item_inventory_policies`) bound 1-to-1 to physical variants (`item_variants.id`).
3. Readiness Engine (`ItemReadinessEngine`) returning structured lifecycle states (`DRAFT`, `INCOMPLETE`, `READY_FOR_SALE`, `ACTIVE`, `INACTIVE`, `ARCHIVED`) and granular blocking reasons without raw exception exposure.
4. Modernized frontend drawer (`AddProductDrawer.tsx`) supporting Simple, Hybrid, and Advanced catalog modes with zero hardcoded commercial defaults and zero synthetic barcodes.
5. Strict adherence to frozen SKU / Barcode architecture: `item_variants.id` = technical PK, `item_variants.variant_sku` = canonical business identity, `item_barcodes` = optical lookup only.

## 2. Business Motivation
The Phase 0 forensic audit revealed critical architectural gaps across the catalog domain:
- Footwear statutory UQC `PRS` was missing from `uoms_ref` (only legacy `PAIR` was seeded).
- Pricing, tax, and replenishment policies were conflated inside legacy `products` or flat parent items, lacking variant-level precision.
- Hardcoded defaults (`6403`, `2999`, `2499`, `1800`) were silently auto-populated, concealing missing merchant data.
- 849 historical variants possessed zero selling prices or NULL HSN codes; rigid DB-level `CHECK (selling_price > 0)` would abort historical data operations. A lifecycle Readiness Engine was required to evaluate merchant readiness gracefully.

## 3. Scope
- **Phase 1: UOM Master**: Seed `PRS` (`decimal_allowed=False`, `uqc_code='PRS'`) and `PAIR` into `uoms_ref`, `ctrl_seeder.py`, and `seed_ctrl_ref.py`.
- **Phases 2–7: Relational Schema & Models**:
  - `item_uom_settings`: Stock, sales, and purchase UOM mapping with positive conversion factor.
  - `item_prices`: Variant commercial pricing, cost, MRP, dealer/wholesale rates, and discount thresholds.
  - `item_tax_profiles`: GST rate, HSN/SAC code, tax category, sales/purchase tax rates, and tax inclusive flag.
  - `item_supplier_settings`: Preferred supplier binding, supplier item code, purchase lead time, and min purchase qty.
  - `item_sales_settings`: Sales commercial terms, selling price, wholesale rate, allow discount, and billable flags.
  - `item_inventory_policies`: Replenishment policy only (`minimum_stock`, `reorder_level`, `reorder_quantity`, `maximum_stock`, `safety_stock`, `lead_time`); zero physical stock fields.
- **Phase 8: Readiness Engine**: `ItemReadinessEngine` assessing completeness and commercial viability.
- **Phase 9: Alembic Migration**: `v1519_item_master_phase2_uom_pricing_tax_policies` with dry-run verified downgrade and upgrade cycles.
- **Phases 10 & 11: Frontend Drawer**: `AddProductDrawer.tsx` refactored with Simple, Hybrid, and Advanced creation modes, live governed lookup integration, and zero synthetic barcodes.
- **Phases 12–14: Validation & Testing**: Core validation dictionary, mapper element wiring, and automated pytest suite.

## 4. Current State
- PostgreSQL tenant databases on port 2781 (`smriti001`) operating with Alembic head `v1518`.
- 1,209 parent items, 1,845 item variants, 1,738 barcodes, 2,302 products, 2,398 sales invoices, 9,093 stock movements.
- Physical stock movements strictly managed by `stock_movements` and `product_batch_stocks`.

## 5. Gap Analysis
| Domain Area | Pre-Phase 2 State | Post-Phase 2 State |
|---|---|---|
| Statutory Footwear UOM | Missing official `PRS` UQC | `PRS` seeded (`decimal_allowed=False`), `PAIR` alias linked |
| Variant Pricing & Cost | Conflated in legacy tables or single float | Dedicated `item_prices` with temporal dates, MSP, dealer rates |
| Tax Profile | Flat string tax rate | Dedicated `item_tax_profiles` with HSN/SAC, GST, exempt flag |
| Supplier Procurement | Unlinked or ad-hoc supplier code | Dedicated `item_supplier_settings` referencing `suppliers.id` |
| Inventory Policy | Conflated with physical balance | Dedicated `item_inventory_policies` with zero stock fields |
| Catalog Readiness | Binary active/inactive | 6-state `ItemReadinessEngine` with structured blocking reasons |
| Frontend Drawer | Hardcoded defaults (6403, 2999) | Governed lookups, zero hardcoded defaults, multi-mode UX |

## 6. Architecture Impact
- Enforces strict Single Source of Truth: technical primary key `item_variants.id` acts as the foreign key anchor for all 6 child policy entities.
- Table ownership registered under `TableOwner.TENANT` in `backend/app/db/ownership.py`.
- Full backward-compatibility: legacy `products` sync hooks remain active via `ItemDomainService.save_variant_phase2_settings()`.

## 7. Proposed Design
1. **Model Layer (`app.models.item_master`)**: 6 SQLAlchemy ORM models with 1-to-1 relationships on `ItemVariant` and bidirectional backrefs.
2. **Readiness Engine (`app.services.item_readiness_svc`)**: Pure rule-based evaluation returning `ready_for_sale: bool` and list of `blocking_reasons`.
3. **Domain Service (`app.services.item_domain_svc`)**: Idempotent persistence on `create_variant()` and `save_variant_phase2_settings()`.
4. **API Endpoints (`app.api.v1.item_domain`)**:
   - `POST /api/v1/item-variants`: Variant creation with child domain payloads.
   - `GET /api/v1/item-variants/{id}`: Detailed variant fetch with eagerly-loaded Phase 2 child records.
   - `GET /api/v1/item-variants/{id}/readiness`: Live readiness evaluation.
   - `PUT /api/v1/item-variants/{id}/settings`: Child settings update and cache sync.

## 8. Files Created
- `backend/alembic/versions/v1519_item_master_phase2_uom_pricing_tax_policies.py`
- `backend/app/services/item_readiness_svc.py`
- `backend/app/tests/test_item_master_phase2.py`
- `docs/implementation/catalog/Item_Master_Phase2_UOM_Pricing_Tax_Policies_Plan_v6.70.0.md`
- `docs/walkthrough/catalog/Item_Master_Phase2_UOM_Pricing_Tax_Policies_v6.70.0.md`

## 9. Files Modified
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

## 10. Dependencies
- PostgreSQL 15+ multi-tenant database engine on port 2781.
- SQLAlchemy 2.0+ async engine with `asyncpg`.
- Alembic migration framework.
- React 18 frontend runtime with Lucide icons.

## 11. Risks
- **Risk:** Existing production rows failing new non-null or positive price constraints.
  - **Mitigation:** CHECK constraints allow `selling_price >= 0` and nullable HSN; strict positive rules enforced only at Readiness Engine level for `READY_FOR_SALE`.
- **Risk:** High frontend form complexity leading to empty or unmapped fields.
  - **Mitigation:** Three progressive disclosure modes (Simple, Hybrid, Advanced) with governed lookup integration.

## 12. Rollback Strategy
- Alembic symmetrical downgrade supported: `alembic downgrade -1` cleanly removes all 6 child tables and foreign keys without dropping core variant data.
- Tested and verified during dry-run in Phase 9.

## 13. Verification Plan
- Live DB dry-run upgrade and downgrade execution via Alembic.
- Column-by-column schema and constraint verification against live database catalogs.
- Frontend compilation check via `npx tsc --noEmit`.
- Automated test execution via `pytest`.

## 14. Test Plan
- `backend/app/tests/test_item_master_phase2.py` (9 comprehensive test scenarios).
- `backend/app/tests/test_item_master_domain_refactor.py` (6 regression test scenarios).
- Full live database row count parity check before and after execution.

## 15. Documentation Impact
- `docs/walkthrough/catalog/Item_Master_Phase2_UOM_Pricing_Tax_Policies_v6.70.0.md`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 16. Deployment Plan
1. Seed `uoms_ref` with `PRS` and `PAIR` in control plane and tenant databases.
2. Run `alembic upgrade head` to apply `v1519` migration.
3. Deploy updated FastAPI backend.
4. Deploy updated React frontend bundle.

## 17. Status
Completed

## 18. Related ADRs
- `docs/adr/ADR_0042_Item_Master_Decomposition.md`
- `docs/adr/ADR_0055_Frozen_SKU_Barcode_Architecture.md`

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/SKU_Barcode_Architecture_Refactor_v6.70.0.md`
- `docs/walkthrough/catalog/Item_Master_Phase2_UOM_Pricing_Tax_Policies_v6.70.0.md`
