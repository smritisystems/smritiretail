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
  Classification: Gate 11E Phase 3B Pre-Flight Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Gate 11E Phase 3B Pre-Flight Finite Legacy Dependency & Deprecation Audit

## 1. Objective
Establish the finite, exhaustive catalog of all remaining legacy dependencies across the SMRITI platform, classifying every object into exactly one of four objective tiers (`RETIRE_NOW`, `DEPRECATE_FIRST`, `RETAIN_FOR_COMPATIBILITY`, `PERMANENT_LINEAGE`) with zero schema mutations, and proving the architectural integrity of the Single Workspace canonical model (`Item` -> `ItemVariant` -> `ItemBarcode`).

## 2. Business Motivation
Provide complete transparency into legacy retirement, decoupling operational and statutory audit needs from transient schema artifacts, and outlining the exact sunset roadmap for legacy APIs.

## 3. Scope
- Audit all 13 remaining tables carrying `product_id`.
- Audit the `products` table and its 10 internal indexes.
- Audit the `Product` ORM model, `ProductRepository`, and `/api/v1/products/*` endpoints.
- Classify permanent lineage mechanisms (`legacy_id_mappings`, `transaction_identity_migration_ledger`).
- Formulate the finite retirement, deprecation, and compatibility lists.
- Zero schema mutations executed.

## 4. Current State
- Gate 11E Phase 3A: PASS & CLOSED (7 Auxiliary Dead Columns Retired)
- Gate 11E Phase 3B Pre-Flight: COMPLETE (Finite Dependency Enumeration Done)

## 5. Gap Analysis
Catalogued exactly 19 remaining legacy objects, proving that zero unknown or unclassified dependencies remain in the repository.

## 6. Architecture Impact
Locks the final architectural state: physical transaction write authority rests entirely on `variant_id`, parent catalog on `item_id`, barcodes on `item_barcodes`, and forensic lineage on immutable ledgers.

## 7. Proposed Design
- Retain core transactional columns as read-only forensic attributes.
- Mark `/api/v1/products` endpoints with HTTP `Deprecation` and `Sunset` headers.
- Permanently protect `legacy_id_mappings` and `transaction_identity_migration_ledger`.

## 8. Files Created
- `scripts/execute_gate11e_phase3b_preflight_audit.py`
- `docs/walkthrough/inventory/Inventory_Gate11E_Phase3B_Preflight_v1.0.0.md`
- `docs/implementation/inventory/Inventory_Gate11E_Phase3B_Preflight_v1.0.0.md`

## 9. Files Modified
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- PostgreSQL database `smriti001`
- Canonical tables `items`, `item_variants`, `legacy_id_mappings`

## 11. Risks
- API breakage: Mitigated by `DEPRECATE_FIRST` policy (no endpoints removed).

## 12. Rollback Strategy
Zero DDL executed during pre-flight.

## 13. Verification Plan
Execute `scripts/execute_gate11e_phase3b_preflight_audit.py`.

## 14. Test Plan
- Dependency count validation.
- Classification tier verification.
- Invariance baseline check.

## 15. Documentation Impact
Master indices updated.

## 16. Deployment Plan
Pre-flight audit complete. Await user review.

## 17. Status
Completed (Pre-Flight)

## 18. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 19. Related Walkthroughs
- [Gate 11E Phase 3B Pre-Flight Walkthrough](../../walkthrough/inventory/Inventory_Gate11E_Phase3B_Preflight_v1.0.0.md)
