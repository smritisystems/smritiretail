<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-02
  Modified     : 2026-09-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Gate 11E Phase 2B-2 Pre-Flight Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Gate 11E Phase 2B-2 Pre-Flight & Change-Safety Audit

## 1. Objective
Establish the pre-flight baseline and change-safety design for Gate 11E Phase 2B-2 (Transitional Index Pruning & Column Nullability Hardening) with zero schema mutations, proving index usage classifications, evaluating product_id nullability semantics, and preparing reversible DDL scripts.

## 2. Business Motivation
Ensure that pruning obsolete transitional indexes and relaxing foreign key nullability constraints will not impact database query plans, fee/service billing lines, or historical reporting integrity.

## 3. Scope
- Audit all 25 database indexes on `products` / `product_id` and classify into `RETAIN_REQUIRED` vs `SAFE_TO_DROP`.
- Audit nullability and row semantics across all 18 target transaction tables.
- Verify canonical authority safety and quarantine isolation.
- Design proposed DROP INDEX and ALTER COLUMN DDL alongside corresponding rollback DDL.
- Zero DDL executed during pre-flight.

## 4. Current State
- Gate 11E Phase 2B-1: PASS & CLOSED (All 18 FK targets resolved: 16 dropped, 2 already absent; 0 remain)
- Gate 11E Phase 2B-2 Pre-Flight: COMPLETE (Audit Complete, Zero DDL Executed)

## 5. Gap Analysis
Identified 8 obsolete non-unique indexes on transitional `product_id` columns across transaction tables that can be safely pruned, and confirmed that `product_id` must be fully nullable to accommodate fee/service and non-inventory lines.

## 6. Architecture Impact
Establishes the exact DDL execution plan for Phase 2B-2 schema hardening.

## 7. Proposed Design
- Index Pruning: Drop 8 non-unique indexes on transitional `product_id` columns while preserving all 10 internal indexes on `products` and unique constraint indexes.
- Nullability Hardening: `DROP NOT NULL` on tables where `product_id` remains restricted, ensuring new canonical-only transactions are never blocked.

## 8. Files Created
- `scripts/execute_gate11e_phase2b2_preflight.py`
- `docs/walkthrough/inventory/Inventory_Gate11E_Phase2B2_Preflight_v1.0.0.md`
- `docs/implementation/inventory/Inventory_Gate11E_Phase2B2_Preflight_v1.0.0.md`

## 9. Files Modified
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- PostgreSQL database `smriti001`
- Canonical tables `items`, `item_variants`, `legacy_id_mappings`

## 11. Risks
- Dropping active query indexes: Mitigated by `pg_stat_user_indexes` scan verification.

## 12. Rollback Strategy
Every proposed DDL statement has an exact reverse DDL statement (`CREATE INDEX` / `SET NOT NULL`).

## 13. Verification Plan
Execute `scripts/execute_gate11e_phase2b2_preflight.py`.

## 14. Test Plan
- Index classification audit.
- Table nullability audit.
- Financial baseline invariance check.

## 15. Documentation Impact
Master indices updated.

## 16. Deployment Plan
Pre-flight complete. Await user review and authorization for Phase 2B-2 Execution.

## 17. Status
Completed (Pre-Flight)

## 18. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 19. Related Walkthroughs
- [Gate 11E Phase 2B-2 Pre-Flight Walkthrough](../../walkthrough/inventory/Inventory_Gate11E_Phase2B2_Preflight_v1.0.0.md)
