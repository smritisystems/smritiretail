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
  Classification: Gate 11D.1 Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Gate 11D.1 Legacy Dependency Closure & Gate 11E Prerequisite Audit

## 1. Objective
Audit and close all remaining operational, reporting, statutory, and analytical dependencies on `products`, `Product`, and `product_id`, establishing that all remaining references are classified as historical/lineage, compatibility, or emergency fallback, and proving that zero active business dependency prevents Gate 11E.

## 2. Business Motivation
Ensure complete safety, financial correctness, and zero risk of regression prior to retiring legacy columns and foreign key constraints in Gate 11E.

## 3. Scope
- Audit all 17 FK constraints and 24 indexes on `products` / `product_id`.
- Test reporting fallback reliance and prove zero financial delta when fallback is omitted.
- Prove historical lineage reconstruction without `sales_invoice_items.product_id`.
- Audit `/api/v1/products/*` API callers and design a non-breaking deprecation roadmap.
- Verify quarantine protection for the 218 `REQUIRES_REVIEW` items.

## 4. Current State
- Gate 11A: PASS
- Gate 11B: PASS & FULLY RECONCILED
- Gate 11C: PASS & VERIFIED
- Gate 11D: PASS & VERIFIED
- Gate 11D.1: IMPLEMENTED & VERIFIED

## 5. Gap Analysis
Prior to Gate 11D.1, the persistence of `product_id` was misconstrued as a permanent column requirement. Gate 11D.1 establishes that permanent lineage is maintained via `legacy_id_mappings` and `transaction_identity_migration_ledger`, proving `product_id` is merely transitional.

## 6. Architecture Impact
Establishes the permanent lineage model and certifies that pure canonical queries achieve 100% parity with legacy/fallback queries.

## 7. Proposed Design
- Lineage Architecture: `txn.variant_id -> item_variants -> legacy_id_mappings -> legacy_id`.
- Fallback Strategy: Safe outer joins during transition, zero reliance on legacy tables for core business facts.

## 8. Files Created
- `scripts/execute_gate11d1_dependency_closure_audit.py`
- `docs/walkthrough/inventory/Inventory_Gate11D1_Legacy_Dependency_Closure_v1.0.0.md`
- `docs/implementation/inventory/Inventory_Gate11D1_Legacy_Dependency_Closure_v1.0.0.md`

## 9. Files Modified
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- PostgreSQL with `items`, `item_variants`, `legacy_id_mappings`
- FastAPI Core backend

## 11. Risks
- External integrations calling `/api/v1/products`: Mitigated by retaining endpoints in compatibility mode during Gate 11E.

## 12. Rollback Strategy
No schema changes performed in Gate 11D.1. Fallback paths remain active.

## 13. Verification Plan
Execute `scripts/execute_gate11d1_dependency_closure_audit.py`.

## 14. Test Plan
- Database FK and index audit.
- Fallback reliance verification with live query deltas.
- Historical lineage reconstruction test.
- Quarantined record protection check.

## 15. Documentation Impact
Walkthrough and Implementation Plan updated and registered in master indices.

## 16. Deployment Plan
Audit completed. Prepare migration scripts for Gate 11E under separate authorization.

## 17. Status
Completed

## 18. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 19. Related Walkthroughs
- [Gate 11D.1 Walkthrough](../../walkthrough/inventory/Inventory_Gate11D1_Legacy_Dependency_Closure_v1.0.0.md)
