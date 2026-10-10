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
  Classification: Gate 11E Phase 3 Pre-Flight Walkthrough Document
-->

# SMRITI Retail OS — Gate 11E Phase 3 Walkthrough: Transitional Column Retirement & Table Decoupling Audit

## 1. Purpose
This document provides the formal walkthrough for **Gate 11E — Phase 3 Pre-Flight: Transitional Column Retirement & Table Decoupling Audit**, establishing the exhaustive Legacy Retirement Matrix across all 12 architectural dimensions with zero schema mutations.

## 2. Scope
- Audit and classification of all 18 `product_id` columns across transactional and auxiliary tables.
- Classification of the `products` table and its 10 internal indexes.
- Classification of the `Product` ORM model, `ProductRepository`, and `/api/v1/products/*` APIs.
- Permanent preservation of `legacy_id_mappings` (681 mappings, 218 quarantined) and `transaction_identity_migration_ledger`.
- Zero DDL executed.

## 3. Files Created
1. `scripts/execute_gate11e_phase3_preflight_audit.py`: Pre-flight audit engine.
2. `docs/walkthrough/inventory/Inventory_Gate11E_Phase3_Preflight_v1.0.0.md`: This walkthrough document.
3. `docs/implementation/inventory/Inventory_Gate11E_Phase3_Preflight_v1.0.0.md`: Gate 11E Phase 3 pre-flight implementation plan.

## 5. Architecture Decisions
- **Permanent Lineage Protection:** Confirmed that `legacy_id_mappings` and `transaction_identity_migration_ledger` are permanent architectural components (`RETAIN_PERMANENTLY_FOR_LINEAGE/AUDIT`) that are never retired.
- **Transitional Read Compatibility:** Classified core transaction `product_id` columns as `RETAIN_FOR_COMPATIBILITY` to serve external POS, statutory audit, and historical lookup requirements.
- **Auxiliary Column Pruning:** Classified 7 empty auxiliary tables' `product_id` columns as `RETIRE_NOW`.
- **Legacy API Deprecation:** Classified `/api/v1/products/*` and `Product` models as `DEPRECATE_FIRST`.

## 6. Design Rationale
Establishing an explicit, multi-dimensional matrix prevents premature deletion of columns needed for historical audits and external compatibility.

## 7. Implementation Summary
Executed `scripts/execute_gate11e_phase3_preflight_audit.py`. Completed the dependency inventory, classified all 18 tables, verified permanent lineage ledgers, and locked the reconciliation baseline.

## 8. Tests Executed
1. `python scripts/execute_gate11e_phase3_preflight_audit.py`
2. Lineage mapping integrity verification.
3. Database metadata inspection.

## 9. Verification Results
- 18/18 tables classified across 5 objective tiers.
- 681 legacy mappings verified intact (218 review items protected).
- 682 rows in `products` table intact.
- 10 internal `products` indexes intact.
- 0 DDL executed.

## 10. Known Limitations
- DDL execution deferred until explicit user authorization.

## 11. Future Work
- Gate 11E Phase 3 Execution: Proceed with staged retirement as authorized by the business.

## 12. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 13. Related RFCs
- RFC-2026-08: Transaction Authority Migration & Strangler-Fig Decoupling
