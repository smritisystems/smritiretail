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
  Classification: Gate 11E Phase 1 Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Gate 11E Phase 1 Preflight & Change-Safety Checkpoint

## 1. Objective
Establish a preflight baseline, safety manifest, and dependency classification across all 17 legacy foreign keys and 24 indexes referencing `products` / `product_id`, verifying that all preconditions for Phase 2 (schema hardening) are documented without executing any destructive DDL.

## 2. Business Motivation
Guarantee zero disruption to production transactions, reporting, or statutory compliance during the final strangler-fig retirement of legacy product schema elements.

## 3. Scope
- Generate machine-readable migration manifest `gate11e_phase1_migration_manifest.json`.
- Classify all 17 FK constraints and 24 indexes into individual risk and action tiers.
- Audit row population across 17 target tables to identify backfill preconditions.
- Verify migration ledger and mapping integrity (681 total mappings, 0 duplicates, 218 quarantined review items guarded).
- Establish financial and tax baselines (INR 10,619,693.59 revenue, 0.0000 delta).

## 4. Current State
- Gate 11A: PASS
- Gate 11B: PASS & FULLY RECONCILED
- Gate 11C: PASS & VERIFIED
- Gate 11D: PASS & VERIFIED
- Gate 11D.1: PASS & AUDITED
- Gate 11E Phase 1: COMPLETE (Preflight Only)

## 5. Gap Analysis
Identified 20 legacy transaction rows across 3 auxiliary tables (`product_batch_stocks`: 16, `sales_invoice_lines`: 3, `sales_order_items`: 1) that require canonical variant mapping backfill prior to dropping foreign key constraints in Phase 2.

## 6. Architecture Impact
Establishes the preflight safety harness and rollback DDL definitions for every foreign key and index.

## 7. Proposed Design
Phased execution:
- Phase 1: Preflight & Safety Checkpoint (No DDL executed).
- Phase 2 (Pending authorization): Backfill 20 auxiliary rows, drop 17 legacy FK constraints, drop unused legacy indexes.
- Phase 3 (Pending authorization): Nullable column deprecation and API transition.

## 8. Files Created
- `backend/app/db/gate11e_phase1_migration_manifest.json`
- `scripts/execute_gate11e_phase1_preflight.py`
- `docs/walkthrough/inventory/Inventory_Gate11E_Phase1_Preflight_v1.0.0.md`
- `docs/implementation/inventory/Inventory_Gate11E_Phase1_Preflight_v1.0.0.md`

## 9. Files Modified
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- PostgreSQL schema `smriti001`
- Canonical tables: `items`, `item_variants`, `legacy_id_mappings`

## 11. Risks
- Dropping FKs on auxiliary tables before backfill: Mitigated by Phase 1 gating.

## 12. Rollback Strategy
Every FK constraint in the manifest contains an explicit reverse DDL statement (`ALTER TABLE ... ADD CONSTRAINT ...`).

## 13. Verification Plan
Execute `scripts/execute_gate11e_phase1_preflight.py`.

## 14. Test Plan
- Machine-readable manifest validation.
- Migration ledger checksum validation.
- Financial baseline invariance verification.

## 15. Documentation Impact
Master indices updated.

## 16. Deployment Plan
Phase 1 complete. Await user authorization for Phase 2.

## 17. Status
Completed (Phase 1)

## 18. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 19. Related Walkthroughs
- [Gate 11E Phase 1 Walkthrough](../../walkthrough/inventory/Inventory_Gate11E_Phase1_Preflight_v1.0.0.md)
