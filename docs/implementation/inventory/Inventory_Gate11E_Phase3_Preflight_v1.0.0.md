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
  Classification: Gate 11E Phase 3 Pre-Flight Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Gate 11E Phase 3 Pre-Flight Legacy Retirement Matrix Audit

## 1. Objective
Establish the exhaustive Legacy Retirement Matrix across all 12 architectural dimensions (columns, tables, ORM models, repositories, APIs, lineage ledgers, remaining constraints, reports, external clients, audit requirements, and migrations) with zero schema mutations, classifying every legacy object into RETIRE_NOW, DEPRECATE_FIRST, RETAIN_FOR_COMPATIBILITY, or RETAIN_PERMANENTLY_FOR_LINEAGE/AUDIT.

## 2. Business Motivation
Provide an unambiguous, auditable roadmap for transitional column retirement and legacy table decoupling that ensures 100% statutory tax compliance, prevents breaking external client integrations, and protects forensic audit lineage.

## 3. Scope
- Audit all 18 `product_id` columns across transactional and auxiliary tables.
- Audit the `products` table and its 10 internal indexes.
- Audit the `Product` ORM model, `ProductRepository`, and `/api/v1/products/*` API layer.
- Classify permanent lineage mechanisms (`legacy_id_mappings`, `transaction_identity_migration_ledger`).
- Formulate the phased retirement sequence, risk mitigations, and final recommendations.
- Zero schema mutations executed.

## 4. Current State
- Gate 11E Phase 2B-1: PASS & CLOSED (0 FKs on `products`)
- Gate 11E Phase 2B-2: PASS & CLOSED (8 Indexes Pruned, 11 Nullabilities Relaxed)
- Gate 11E Phase 3 Pre-Flight: COMPLETE (Audit Complete, Zero DDL Executed)

## 5. Gap Analysis
Identified that core transaction tables (`sales_invoice_items`, `sales_order_items`) must retain `product_id` for dual-read compatibility and statutory 7-year audit requirements, auxiliary WMS tables can be safely pruned, and permanent lineage tables must remain intact permanently.

## 6. Architecture Impact
Lays down the architectural boundaries for legacy decoupling, separating forensic audit trails from active transactional write paths.

## 7. Proposed Design
- Phased retirement: Prune empty auxiliary columns first (`RETIRE_NOW`), deprecate master/WMS auxiliary links (`DEPRECATE_FIRST`), and retain transactional columns for backward compatibility (`RETAIN_FOR_COMPATIBILITY`).
- Permanent Lineage: Permanently protect `legacy_id_mappings` and `transaction_identity_migration_ledger`.

## 8. Files Created
- `scripts/execute_gate11e_phase3_preflight_audit.py`
- `docs/walkthrough/inventory/Inventory_Gate11E_Phase3_Preflight_v1.0.0.md`
- `docs/implementation/inventory/Inventory_Gate11E_Phase3_Preflight_v1.0.0.md`

## 9. Files Modified
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- PostgreSQL database `smriti001`
- Canonical tables `items`, `item_variants`, `legacy_id_mappings`, `transaction_identity_migration_ledger`

## 11. Risks
- Premature column dropping causing external POS failure: Mitigated by `RETAIN_FOR_COMPATIBILITY` classification on transactional columns.

## 12. Rollback Strategy
All audit plans maintain explicit reverse DDL specifications.

## 13. Verification Plan
Execute `scripts/execute_gate11e_phase3_preflight_audit.py`.

## 14. Test Plan
- Dependency classification verification.
- Lineage ledger immutability check.
- Financial baseline invariance verification.

## 15. Documentation Impact
Master indices updated.

## 16. Deployment Plan
Pre-flight complete. Await user review and business decision.

## 17. Status
Completed (Pre-Flight)

## 18. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 19. Related Walkthroughs
- [Gate 11E Phase 3 Pre-Flight Walkthrough](../../walkthrough/inventory/Inventory_Gate11E_Phase3_Preflight_v1.0.0.md)
