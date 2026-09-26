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
  Classification: Gate 11C Walkthrough Document
-->

# SMRITI Retail OS — Gate 11C Walkthrough: Canonical Transaction Write Authority

## 1. Purpose
This document provides the formal engineering walkthrough for **Gate 11C: Canonical Transaction Write Authority**, establishing the dual-key transaction write architecture where canonical item/variant identities serve as the primary write authority while maintaining legacy `product_id` continuity across all transactional workflows.

## 2. Scope
- Dual-key transactional write contract across POS, Sales, Procurement, and WMS/Inventory domains.
- Implementation of `CanonicalTransactionWriter` service (`backend/app/services/canonical_transaction_writer.py`).
- Integration of canonical-first dual-key resolution into `POSService` (`backend/app/services/pos.py`).
- Strict quarantine enforcement preventing any transaction on the 218 `REQUIRES_REVIEW` items.
- 500-transaction multi-domain stress and consistency benchmark.
- Instant rollback and atomicity verification.

## 3. Files Created
1. `backend/app/services/canonical_transaction_writer.py`: Canonical-first transaction writer service with dual-key resolution and quarantine protection.
2. `scripts/execute_gate11c_write_authority_pilot.py`: Gate 11C pilot verification engine for POS checkout and multi-domain workflows.
3. `scripts/benchmark_gate11c_multi_domain_writes.py`: 500-transaction stress and performance benchmark engine.
4. `scripts/verify_and_prepare_dual_key_schema.py`: Schema inspection and preparation utility for transactional tables.
5. `docs/walkthrough/inventory/Inventory_Gate11C_Canonical_Transaction_Write_Authority_v1.0.0.md`: This walkthrough document.
6. `docs/implementation/inventory/Inventory_Gate11C_Canonical_Transaction_Write_Authority_v1.0.0.md`: Gate 11C implementation plan.

## 4. Files Modified
1. `backend/app/services/pos.py`: Integrated `CanonicalTransactionWriter.resolve_dual_key_for_line` into POS checkout.
2. `backend/app/models/sales.py`: Added `variant_id` ORM column definitions across sales transaction models.
3. `backend/app/models/purchase.py`: Added `variant_id` ORM column definitions across purchase models.
4. `backend/app/models/inventory.py`: Added `variant_id` ORM column definitions across stock models.
5. `docs/walkthrough/README.md`: Master index updated with Gate 11C entry.
6. `docs/implementation/README.md`: Master index updated with Gate 11C entry.

## 5. Architecture Decisions
- **Canonical-First Write Authority**: All transactional writes resolve the canonical Item/Variant first, then look up the legacy `product_id` via `legacy_id_mappings`.
- **Dual-Key Write Contract**: Both `variant_id` (canonical) and `product_id` (legacy) are committed in the same database transaction.
- **Conditional Nullability**: Non-inventory fee lines, roundoff lines, and service charges allow `variant_id = NULL` and `product_id = NULL`.
- **Zero-Downtime Rollback Mechanism**: Governed by the `ENABLE_CANONICAL_TRANSACTION_AUTHORITY` feature flag.

## 6. Design Rationale
Transitioning transactional write authority before removing legacy columns or modifying read views ensures zero business interruption. The dual-key model guarantees full backward compatibility for reporting queries while establishing canonical integrity.

## 7. Implementation Summary
The `CanonicalTransactionWriter` provides high-speed dual-key resolution with in-memory caching and direct SQL lookups. It automatically validates bidirectional key parity and enforces strict catalog locks on quarantined records.

## 8. Tests Executed
1. `python scripts/execute_gate11c_write_authority_pilot.py` (Pilot verification suite)
2. `python scripts/benchmark_gate11c_multi_domain_writes.py` (500-transaction stress benchmark)
3. Failure injection and transactional rollback tests.

## 9. Verification Results
- 500/500 requests executed successfully (379 physical writes, 59 fee lines, 62 quarantined rejections).
- 0 identity divergences (0.00%).
- Financial invariance delta = 0.0000.
- Stock invariance verified.
- Quarantined leakage = 0.

## 10. Known Limitations
- Read reporting consumers still query `product_id` directly (scheduled for migration in Gate 11D).
- 218 quarantined catalog records remain locked pending manual master data governance.

## 11. Future Work
- Gate 11D: Read and reporting consumer canonical migration.
- Gate 11E: Legacy column deprecation and final schema hardening.

## 12. Related ADRs
- `ADR-0042`: Canonical Item-Variant Data Model
- `ADR-0043`: Dual-Key Transactional Migration Strategy

## 13. Related RFCs
- `RFC-2026-08`: Transaction Authority Migration & Strangler-Fig Decoupling
