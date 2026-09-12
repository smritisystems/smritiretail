<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.13.0
  Created      : 2026-09-09
  Modified     : 2026-09-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Universal Item Master 5-Tier Product Resolution Engine & Duplicate Retirement Implementation Plan

**Version:** `v4.13.0`  
**Status:** `Completed`  
**Classification:** Enterprise Tier-1 Core Engine  
**Area:** `inventory`  

---

## 1. Objective
Achieve complete verified status for the Universal Item Master 5-Tier Product Resolution Engine by implementing the 5-bucket enterprise inventory model, temporal and customer-authorized contract pricing checks, empirical latency profiling, tenant schema migration with Rule 12 column-level parity, and complete retirement of legacy duplicate components.

---

## 2. Business Motivation
In high-throughput retail and B2B wholesale environments, product lookup speed and accuracy directly affect checkout latency and order fulfillment reliability. Legacy parallel implementations (`ItemMasterTab.tsx` vs `ItemMasterWs.tsx`, `item_master_service.py` vs `item_master_svc.py`) introduced risk of state divergence. Furthermore, enterprise B2B sales demand real-time Available-to-Promise (ATP) inventory visibility and strict contract price gating based on customer authorization and contract validity dates.

---

## 3. Scope
- 5-Tier product resolution hierarchy in `UniversalItemMasterService`.
- Adopted 5-bucket enterprise inventory computation (`physical_on_hand`, `in_transit_qty`, `reserved_qty`, `committed_qty`, `quarantine_qty`, `available_to_promise`), implementing:
  `available_to_promise = max(0.0, round((physical_on_hand + in_transit_qty) - (reserved_qty + committed_qty + quarantine_qty), 4))`.
- Temporal, customer-group, and currency-checked contract rate evaluation with statutory GST slab validation (0, 5, 12, 18, 28%), intra/inter-state tax splits, and audit trail.
- Negative test suite covering customer authorization rejection, inactive customer fallback, inverted date ranges (`effective_from > effective_to`), currency mismatches, and statutory GST splits.
- Elimination of duplicate files: `src/components/ItemMasterTab.tsx`, `src/components/sales/SalesOrderForm.tsx`, `backend/app/services/item_master_service.py`, `backend/app/services/party_service.py`.
- Stale path cleanup across all imports, registries, scanner scripts, and tests.
- Database migration `v1418_customer_article_mappings.py` applied to `smriti001` and `smriti002` with 100% AST/DB parity.
- Live DDL migration execution and constraint enforcement proof on `smriti002`.
- Benchmark suite execution and latency profiling with single-node developer fixture baseline qualification.

---

## 4. Current State
- `UniversalItemMasterService` (`backend/app/services/item_master_svc.py`) implemented foundational CRUD but lacked ATP calculation and temporal pricing audit logic.
- Four duplicate legacy components were staged for deletion, but code references remained in `src/App.tsx`, `scanner.py`, `audit_ui_ctrl.py`, and `add_registry_fields.js`.
- Tenant migration `v1418_customer_article_mappings.py` was pending verification on secondary tenant databases.

---

## 5. Gap Analysis
1. **Benchmark Suite**: Latency claims were unverified due to lack of a reproducible benchmark script.
2. **5-Bucket Inventory**: Resolver did not aggregate warehouse stock into the 5 canonical buckets.
3. **Temporal Pricing**: Contract rate lookups did not gate by customer ID, effective date ranges, or output pricing audit metadata.
4. **Stale References**: Active references to deleted components broke clean code hygiene.
5. **Rule 12 Parity**: Secondary tenant database lacked verified column-by-column migration lineage.

---

## 6. Architecture Impact
- Enforces `ItemMasterWs.tsx` and `item_master_svc.py` as the sole canonical Item Master implementation.
- Standardizes B2B article code resolution through `CustomerArticleMapping`.
- Formalizes PostgreSQL B-Tree search complexity as $O(\log N)$ tree traversal (depth 2–3) bounded by tree depth.

---

## 7. Proposed Design
- Implement `_compute_inventory_buckets()` querying `ItemWarehouseLocation`, `SalesOrderReservation`, and `StockTransferItem` to compute all 5 canonical buckets and adopted ATP formula.
- Implement `_evaluate_pricing_contract()` executing customer active validation, customer group authorization, transaction currency match, date interval validation (`effective_from <= as_of_date <= effective_to`), invalid date range detection, statutory GST slab splits, and returning `pricing_audit`.
- Construct `benchmark_universal_resolver.py` executing cold-cache, 100-cycle warm-cache, and 10-concurrency burst tests, explicitly qualifying the local developer fixture baseline.
- Construct `verify_customer_article_mappings_schema.py` inspecting all 38 columns, data types, nullabilities, FKs, and partial indexes.
- Construct `verify_smriti002_migration_execution.py` proving live DDL insertion, read-back, foreign key rejection, and partial unique constraint rejection on `smriti002`.

---

## 8. Files Created
- `backend/alembic/versions/v1418_customer_article_mappings.py`
- `backend/app/models/customer_article_mapping.py`
- `backend/tests/benchmark_universal_resolver.py`
- `backend/tests/verify_customer_article_mappings_schema.py`
- `backend/tests/verify_smriti002_migration_execution.py`
- `docs/implementation/inventory/Universal_Item_Master_5Tier_Resolution_And_Retirement_Plan_v4.13.0.md`
- `docs/walkthrough/inventory/Universal_Item_Master_5Tier_Resolution_And_Retirement_v4.13.0.md`

---

## 9. Files Modified
- `backend/app/services/item_master_svc.py`
- `backend/app/schemas/item_master.py`
- `backend/app/api/v1/universal_master.py`
- `backend/app/models/__init__.py`
- `backend/alembic/env.py`
- `backend/app/db/seed_architecture_governance.py`
- `backend/app/dev_tracker/scanner.py`
- `scripts/audit_ui_ctrl.py`
- `scripts/add_registry_fields.cjs`
- `scripts/add_registry_fields.js`
- `src/App.tsx`
- `backend/tests/t_univ_item.py`
- `docs/architecture/ITEM_MASTER.md`

---

## 10. Dependencies
- FastAPI 0.111+
- SQLAlchemy 2.0+ (asyncpg)
- PostgreSQL 15+
- React 18 / Vite 5
- Vitest / Pytest

---

## 11. Risks
- **Test Collision**: Simultaneous test executions inserting static fixture codes can trigger unique constraint collisions on `customer_article_mappings`.
  - *Mitigation*: Used random UUID suffixes and `try...finally` teardown handlers.
- **Tenant Drift**: Schema discrepancies between `smriti001` and other tenants.
  - *Mitigation*: Automated column-by-column Rule 12 verification script executed across all active tenant databases.

---

## 12. Rollback Strategy
If regression occurs:
- Revert commit via `git revert`.
- Downgrade Alembic migration: `alembic -c backend/alembic.ini downgrade -1`.

---

## 13. Verification Plan
- Run automated backend test suite: `pytest backend/tests/t_univ_item.py backend/tests/t_univ_party.py`.
- Run frontend test suite: `npm run test` (Vitest).
- Run TypeScript compiler: `npx tsc --noEmit`.
- Run schema verification: `python backend/tests/verify_customer_article_mappings_schema.py`.
- Run smriti002 DDL execution proof: `python backend/tests/verify_smriti002_migration_execution.py`.
- Run empirical benchmark: `python backend/tests/benchmark_universal_resolver.py`.

---

## 14. Test Plan
- Unit test for 5-bucket inventory and adopted ATP formula calculation (`test_five_bucket_inventory_resolution`, `test_five_bucket_inventory_atp_formula_enterprise_calculation`).
- Negative tests for customer contract authorization, inactive customer fallback, inverted date range detection, currency mismatch, and statutory GST splits (`test_temporal_and_contract_governed_pricing`, `test_pricing_negative_unauthorized_and_inactive_customer`, `test_pricing_negative_invalid_dates_and_currency_mismatch`, `test_pricing_statutory_gst_split_and_slabs`).
- Multi-worker concurrent resolution burst (10 workers).

---

## 15. Documentation Impact
- Update `docs/architecture/ITEM_MASTER.md` to remove stale `ItemMasterTab` references.
- Append Walkthrough to `docs/walkthrough/README.md`.
- Append Plan to `docs/implementation/README.md`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
- Apply Alembic migration `v1418_cust_art_map` on target PostgreSQL instances during maintenance window.
- Deploy updated FastAPI backend service.
- Deploy updated Vite frontend client bundle.

---

## 17. Status
**Completed** — Verified with empirical benchmark, Rule 12 schema parity, clean TypeScript compilation, and 100% test pass rate.

---

## 18. Related ADRs
- `ADR-0042`: Universal Master Data Architecture.
- `ADR-0048`: Elimination of Dual-Service Legacy Duplicates.
- `ADR-EXEMPT-006`: Retired.

---

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Universal_Item_Master_5Tier_Resolution_And_Retirement_v4.13.0.md`
