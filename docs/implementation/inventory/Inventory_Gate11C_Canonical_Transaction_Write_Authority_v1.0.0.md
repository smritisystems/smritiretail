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
  Classification: Gate 11C Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Gate 11C Canonical Transaction Write Authority

## 1. Objective
Establish canonical item/variant write authority across all transactional entry points (POS checkout, Sales, Procurement, and WMS) using a dual-key write contract, ensuring 100% financial and inventory invariance.

## 2. Business Motivation
Migrate operational transaction generation from legacy `product_id` to canonical `variant_id` without breaking reporting tools, downstream consumers, or introducing data divergence.

## 3. Scope
- Dual-key write contract implementation.
- Service `CanonicalTransactionWriter` creation.
- POS sale transaction writer patch.
- Multi-domain transactional stress test (500 operations).
- Zero quarantine leakage validation (218 `REQUIRES_REVIEW` items locked).

## 4. Current State
- Gate 11A: PASS (Schema augmented with nullable `variant_id`).
- Gate 11B: PASS & FULLY RECONCILED (24,720 rows mapped with zero delta).
- Gate 11C: IMPLEMENTED & VERIFIED.

## 5. Gap Analysis
Previously, transaction services looked up legacy `products` table directly to populate `product_id`. Gate 11C establishes canonical Item/Variant as write authority and maps to legacy `product_id` via `legacy_id_mappings`.

## 6. Architecture Impact
Transaction models now persist `variant_id` alongside `product_id`. `CanonicalTransactionWriter` validates bidirectional parity and guards against quarantined records.

## 7. Proposed Design
- Resolution flow: `variant_id` / Barcode -> Canonical Variant -> `legacy_id_mappings` -> Legacy `product_id`.
- Dual-Key persistence: Write both keys atomically.
- Flag control: `ENABLE_CANONICAL_TRANSACTION_AUTHORITY`.

## 8. Files Created
- `backend/app/services/canonical_transaction_writer.py`
- `scripts/execute_gate11c_write_authority_pilot.py`
- `scripts/benchmark_gate11c_multi_domain_writes.py`
- `scripts/verify_and_prepare_dual_key_schema.py`
- `docs/walkthrough/inventory/Inventory_Gate11C_Canonical_Transaction_Write_Authority_v1.0.0.md`
- `docs/implementation/inventory/Inventory_Gate11C_Canonical_Transaction_Write_Authority_v1.0.0.md`

## 9. Files Modified
- `backend/app/services/pos.py`
- `backend/app/models/sales.py`
- `backend/app/models/purchase.py`
- `backend/app/models/inventory.py`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- FastAPI Core backend
- PostgreSQL with `legacy_id_mappings`, `canonical_items`, `canonical_item_variants`

## 11. Risks
- Quarantined records attempted to be sold: Mitigated by explicit exception and clear user feedback.
- Identity divergence: Mitigated by in-transaction bidirectional check.

## 12. Rollback Strategy
Set `ENABLE_CANONICAL_TRANSACTION_AUTHORITY=false` in runtime configuration to immediately fall back to legacy lookup without requiring DDL alterations.

## 13. Verification Plan
Execute `scripts/execute_gate11c_write_authority_pilot.py` and `scripts/benchmark_gate11c_multi_domain_writes.py`.

## 14. Test Plan
- Unit tests for dual-key resolution.
- POS sale checkout integration test.
- Multi-domain write stress test (500 operations).
- Atomicity and failure injection tests.

## 15. Documentation Impact
Walkthrough and Implementation Plan updated and registered in master indices.

## 16. Deployment Plan
Deploy backend updates with feature flag enabled. Monitor telemetry for identity parity.

## 17. Status
Completed

## 18. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 19. Related Walkthroughs
- [Gate 11C Walkthrough](../../walkthrough/inventory/Inventory_Gate11C_Canonical_Transaction_Write_Authority_v1.0.0.md)
