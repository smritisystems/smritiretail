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
  Classification: Gate 11D Implementation Plan
-->

# SMRITI Retail OS — Implementation Plan: Gate 11D Canonical Read & Reporting Consumer Migration

## 1. Objective
Migrate all operational read queries, reporting pipelines, BI aggregations, and statutory GST exports from legacy `products` / `product_id` to canonical Item Master entities (`items`, `item_variants`, `item_barcodes`) with zero financial or tax drift.

## 2. Business Motivation
Eliminate reliance on legacy `products` for read and reporting operations, ensuring business intelligence reflects canonical item/variant master data while preserving historical transaction integrity.

## 3. Scope
- Inventory and classification of all remaining `products` consumers.
- Canonical query migration across reporting services (`reports.py`, `analytics_svc.py`).
- 50-iteration performance benchmarking for all report types.
- Verification of zero financial, tax, or quantity drift.
- Preservation of historical and lineage identifiers.

## 4. Current State
- Gate 11A: PASS (Schema augmented with nullable `variant_id`).
- Gate 11B: PASS & FULLY RECONCILED (24,720 rows mapped).
- Gate 11C: PASS & VERIFIED (Canonical write authority active).
- Gate 11D: IMPLEMENTED & VERIFIED.

## 5. Gap Analysis
Prior to Gate 11D, reporting queries and BI fact aggregations joined against `products` on `product_id`, creating an ongoing operational dependency on legacy tables despite canonical write authority being active.

## 6. Architecture Impact
Reporting and analytics services now outer join `item_variants` and `items` based on `variant_id`, falling back to `products` only when `variant_id` is null (for legacy non-inventory lines or unmigrated records).

## 7. Proposed Design
- Read Authority: `items` and `item_variants`.
- Fallback Model: `COALESCE(Item.name, Product.name)`, `COALESCE(ItemVariant.cost_price, Product.cost_price)`.
- Performance Target: < 20ms p95 latency.

## 8. Files Created
- `scripts/audit_gate11d_read_reporting_consumers.py`
- `scripts/benchmark_gate11d_reporting_performance.py`
- `docs/walkthrough/inventory/Inventory_Gate11D_Canonical_Read_And_Reporting_Migration_v1.0.0.md`
- `docs/implementation/inventory/Inventory_Gate11D_Canonical_Read_And_Reporting_Migration_v1.0.0.md`

## 9. Files Modified
- `backend/app/services/reports.py`
- `backend/app/services/analytics_svc.py`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 10. Dependencies
- PostgreSQL with `items`, `item_variants`, `legacy_id_mappings`
- FastAPI Core backend

## 11. Risks
- Potential N+1 query patterns: Mitigated by batch joins and indexed foreign keys.
- Divergence in historical reports: Mitigated by explicit dual-key fallback semantics.

## 12. Rollback Strategy
Revert report query joins to legacy `products` directly via service layer patches without requiring database schema alterations.

## 13. Verification Plan
Execute `scripts/audit_gate11d_read_reporting_consumers.py` and `scripts/benchmark_gate11d_reporting_performance.py`.

## 14. Test Plan
- Reconciliation audit comparing legacy vs canonical report outputs.
- 50-iteration performance benchmark testing p50, p90, p95, p99 latencies.
- Pytest reporting test suite execution.

## 15. Documentation Impact
Walkthrough and Implementation Plan updated and registered in master indices.

## 16. Deployment Plan
Deploy reporting service updates. Monitor query execution times and ensure latencies remain under 20ms.

## 17. Status
Completed

## 18. Related ADRs
- ADR-0042: Canonical Item-Variant Data Model
- ADR-0043: Dual-Key Transactional Migration Strategy

## 19. Related Walkthroughs
- [Gate 11D Walkthrough](../../walkthrough/inventory/Inventory_Gate11D_Canonical_Read_And_Reporting_Migration_v1.0.0.md)
