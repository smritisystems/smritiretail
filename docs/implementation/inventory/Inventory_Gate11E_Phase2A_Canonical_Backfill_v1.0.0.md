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
  Classification: Gate 11E Phase 2A Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Gate 11E Phase 2A Canonical Backfill & Semantic Resolution

## 1. Objective
Deterministically resolve the 20 exceptional historical rows identified during Gate 11E Phase 1 Preflight across `product_batch_stocks` (16 rows), `sales_invoice_lines` (3 rows), and `sales_order_items` (1 row) via `legacy_id_mappings`, while preserving strict quarantine isolation for synthetic test fixtures and catalog review items.

## 2. Business Motivation
Ensure that all legitimate historical physical transaction rows carry canonical `variant_id` identities prior to the removal of legacy foreign keys in Phase 2B, preventing any orphaned data or broken relational integrity.

## 3. Scope
- Inspect and resolve all 20 exceptional rows.
- Populate canonical `variant_id` for rows with `MIGRATED` disposition (`pbs-8cc15ba015cc` and `32fab214-0055-41e1-8`).
- Maintain explicit `QUARANTINED_EXCLUDED` status for 18 synthetic benchmark and test fixture rows without heuristic mapping.
- Verify financial, tax, and stock invariance (0.0000 delta).
- Prove 100% idempotency across multiple execution runs.

## 4. Current State
- Gate 11E Phase 1: PASS
- Gate 11E Phase 2A: COMPLETE (Backfill & Resolution Verified)

## 5. Gap Analysis
Prior to Phase 2A, 20 rows lacked `variant_id`. Phase 2A audited every row deterministically, backfilling legitimate catalog records and locking quarantined fixtures.

## 6. Architecture Impact
Establishes clean relational parity between historical auxiliary tables and the canonical `item_variants` domain.

## 7. Proposed Design
- Deterministic Mapping SQL Join: `UPDATE ... FROM legacy_id_mappings WHERE lim.disposition = 'MIGRATED'`.
- Strict Exclusion: Quarantined records remain untouched.

## 8. Files Created
- `scripts/audit_phase2a_row_mappings.py`
- `scripts/execute_gate11e_phase2a_backfill.py`
- `docs/walkthrough/inventory/Inventory_Gate11E_Phase2A_Canonical_Backfill_v1.0.0.md`
- `docs/implementation/inventory/Inventory_Gate11E_Phase2A_Canonical_Backfill_v1.0.0.md`

## 9. Files Modified
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- PostgreSQL table `legacy_id_mappings`
- Canonical tables `items` and `item_variants`

## 11. Risks
- Heuristic mapping: Prevented by strict deterministic mapping requirement (0 heuristics used).

## 12. Rollback Strategy
All updates occurred against nullable columns (`variant_id`), leaving `product_id` and legacy foreign keys completely intact.

## 13. Verification Plan
Execute `scripts/execute_gate11e_phase2a_backfill.py`.

## 14. Test Plan
- Row-by-row reconciliation.
- Double-execution idempotency test.
- Historical lineage reconstruction test.

## 15. Documentation Impact
Master indices updated.

## 16. Deployment Plan
Phase 2A complete. Await user authorization for Phase 2B (FK Removal).

## 17. Status
Completed (Phase 2A)

## 18. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 19. Related Walkthroughs
- [Gate 11E Phase 2A Walkthrough](../../walkthrough/inventory/Inventory_Gate11E_Phase2A_Canonical_Backfill_v1.0.0.md)
