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
  Classification: Gate 11E Phase 2B-2 Evidence Audit Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Gate 11E Phase 2B-2 Index Obsolescence & Invariant Evidence Audit

## 1. Objective
Provide comprehensive, query-plan (EXPLAIN) backed evidence of index obsolescence for 8 transitional `product_id` indexes, reconcile the internal `products` table index count (10 indexes verified), establish the table-by-table canonical identity invariant matrix, and maintain a locked reconciliation baseline with zero schema mutations.

## 2. Business Motivation
Ensure that transitional index pruning and nullability alterations will not introduce sequential table scans, degrade reporting latency, or compromise non-inventory fee/service line handling.

## 3. Scope
- Deep index obsolescence analysis with query paths and EXPLAIN plans for 8 proposed indexes.
- Complete canonical identity invariant matrix across all 14 physical/inventory transaction tables.
- Reconciliation of the 10 internal index objects on the `products` table.
- Formulation of proposed DDL and rollback DDL with preconditions and postconditions.
- Zero schema mutations executed.

## 4. Current State
- Gate 11E Phase 2B-1: PASS & CLOSED (0 FKs on products)
- Gate 11E Phase 2B-2 Pre-Flight: PASS
- Gate 11E Phase 2B-2 Evidence Audit: COMPLETE (Ready for Review)

## 5. Gap Analysis
Addressed all 3 evidence gaps identified in pre-flight review: query plan proof of index obsolescence, canonical identity invariant definitions, and physical index relation count reconciliation.

## 6. Architecture Impact
Proves conclusively that transactional queries execute via canonical indexes (`order_id`, `variant_id`, `item_id`) without needing transitional `product_id` indexes.

## 7. Proposed Design
- Index Pruning: Drop 8 non-unique indexes on transitional `product_id` columns when authorized.
- Nullability Hardening: `DROP NOT NULL` on tables where `product_id` remains restricted, ensuring canonical writes are unblocked.

## 8. Files Created
- `scripts/execute_gate11e_phase2b2_evidence_audit.py`
- `scripts/reconcile_products_indexes.py`
- `docs/walkthrough/inventory/Inventory_Gate11E_Phase2B2_Evidence_Audit_v1.0.0.md`
- `docs/implementation/inventory/Inventory_Gate11E_Phase2B2_Evidence_Audit_v1.0.0.md`

## 9. Files Modified
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- PostgreSQL database `smriti001`
- Canonical tables `items`, `item_variants`, `legacy_id_mappings`

## 11. Risks
- Performance regression: Mitigated by EXPLAIN query plan validation confirming index scans on canonical paths.

## 12. Rollback Strategy
Every proposed DDL statement has an exact reverse DDL statement recorded and verified.

## 13. Verification Plan
Execute `scripts/execute_gate11e_phase2b2_evidence_audit.py`.

## 14. Test Plan
- Query plan inspection (`EXPLAIN`).
- Invariant matrix validation.
- Index definition verification.

## 15. Documentation Impact
Master indices updated.

## 16. Deployment Plan
Audit complete. Await user review and authorization for Phase 2B-2 Execution.

## 17. Status
Completed (Audit & Verification)

## 18. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 19. Related Walkthroughs
- [Gate 11E Phase 2B-2 Evidence Audit Walkthrough](../../walkthrough/inventory/Inventory_Gate11E_Phase2B2_Evidence_Audit_v1.0.0.md)
