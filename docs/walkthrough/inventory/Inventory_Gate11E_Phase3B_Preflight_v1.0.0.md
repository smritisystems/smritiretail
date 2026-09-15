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
  Classification: Gate 11E Phase 3B Pre-Flight Walkthrough Document
-->

# SMRITI Retail OS — Gate 11E Phase 3B Walkthrough: Finite Legacy Dependency & Deprecation Audit

## 1. Purpose
This document provides the formal engineering walkthrough for **Gate 11E — Phase 3B Pre-Flight: Finite Legacy Dependency & Deprecation Audit**, cataloguing the exact 19 remaining legacy objects across the platform with zero schema mutations.

## 2. Scope
- Enumeration and classification of all 13 remaining database tables containing `product_id`.
- Retention of the `products` table (682 rows) and 10 internal indexes as a read-only compatibility store.
- Classification of the `Product` ORM model, repository, and `/api/v1/products/*` API router.
- Permanent preservation of `legacy_id_mappings` (681 records, 218 quarantined) and `transaction_identity_migration_ledger`.
- Zero DDL executed.

## 3. Files Created
1. `scripts/execute_gate11e_phase3b_preflight_audit.py`: Pre-flight audit engine.
2. `docs/walkthrough/inventory/Inventory_Gate11E_Phase3B_Preflight_v1.0.0.md`: This walkthrough document.
3. `docs/implementation/inventory/Inventory_Gate11E_Phase3B_Preflight_v1.0.0.md`: Gate 11E Phase 3B pre-flight implementation plan.

## 5. Architecture Decisions
- **Finite Boundary Established:** Exactly 19 legacy dependencies identified across the entire repository.
- **Permanent Forensic Lineage:** Confirmed that `legacy_id_mappings` and `transaction_identity_migration_ledger` will never be deleted.
- **Dual-Read Compatibility:** Core transactional `product_id` columns remain intact as read-only compatibility attributes.
- **Deprecation Governance:** Legacy APIs and ORM models are placed under a formal deprecation schedule without abrupt deletion.

## 6. Design Rationale
A finite, multi-tier classification ensures that the core codebase is fully canonical while preserving backward compatibility for legacy clients and tax audits.

## 7. Implementation Summary
Executed `scripts/execute_gate11e_phase3b_preflight_audit.py`. Catalogued all 19 dependencies, verified index retention on `products`, confirmed quarantine isolation, and locked the reconciliation baseline.

## 8. Tests Executed
1. `python scripts/execute_gate11e_phase3b_preflight_audit.py`
2. Information schema metadata verification.
3. Lineage mapping integrity checks.

## 9. Verification Results
- Total remaining legacy dependencies: Exactly 19 objects.
- `A. RETIRE_NOW`: 2 objects.
- `B. DEPRECATE_FIRST`: 7 objects.
- `C. RETAIN_FOR_COMPATIBILITY`: 8 objects.
- `D. PERMANENT_LINEAGE`: 2 objects.
- 0 DDL executed.

## 10. Known Limitations
- Schema mutations deferred until explicit user authorization.

## 11. Future Work
- Gate 11E Closure & Final Hand-Off.

## 12. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 13. Related RFCs
- RFC-2026-08: Transaction Authority Migration & Strangler-Fig Decoupling
