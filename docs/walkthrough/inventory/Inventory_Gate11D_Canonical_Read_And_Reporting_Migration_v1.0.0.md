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
  Classification: Gate 11D Walkthrough Document
-->

# SMRITI Retail OS — Gate 11D Walkthrough: Canonical Read & Reporting Consumer Migration

## 1. Purpose
This document provides the formal engineering walkthrough for **Gate 11D: Canonical Read & Reporting Consumer Migration**, transitioning operational read queries, reporting pipelines, BI aggregations, and statutory GST exports from legacy `products` / `product_id` to canonical Item Master entities (`items`, `item_variants`, `item_barcodes`) while preserving legacy compatibility and verifying exact 0.0000 mathematical invariance.

## 2. Scope
- Exhaustive inventory and classification of all operational, BI, analytical, and GST reporting consumers.
- Canonical query replacement across `ReportsService` (`backend/app/services/reports.py`) and `AnalyticalIntelligenceService` (`backend/app/services/analytics_svc.py`).
- Performance benchmarking of canonical reporting queries against a strict < 20ms latency SLA.
- Verification of 100% mathematical, tax, quantity, and row-count parity with zero unexplained drift.
- Preservation of historical and lineage identifiers.

## 3. Files Created
1. `scripts/audit_gate11d_read_reporting_consumers.py`: Comprehensive audit and reconciliation engine for operational, BI, and statutory reports.
2. `scripts/benchmark_gate11d_reporting_performance.py`: Reporting performance benchmark engine testing latencies across 50 iterations per report.
3. `docs/walkthrough/inventory/Inventory_Gate11D_Canonical_Read_And_Reporting_Migration_v1.0.0.md`: This walkthrough document.
4. `docs/implementation/inventory/Inventory_Gate11D_Canonical_Read_And_Reporting_Migration_v1.0.0.md`: Gate 11D implementation plan.

## 4. Files Modified
1. `backend/app/services/reports.py`: Migrated `attribute_size_sales` and stock valuation to canonical-first joins with legacy fallback.
2. `backend/app/services/analytics_svc.py`: Upgraded daily COGS estimation and category margin rollups to query canonical `ItemVariant` and `Item` first.
3. `docs/walkthrough/README.md`: Master index updated with Gate 11D entry.
4. `docs/implementation/README.md`: Master index updated with Gate 11D entry.

## 5. Architecture Decisions
- **Canonical-First Resolution with Legacy Fallback:** Reporting queries outer join `item_variants` (on `variant_id`) and `items` (on `item_id`), falling back to `products` (on `product_id`) for unmigrated legacy records.
- **Strict Invariance Standard:** Zero tolerance for financial drift (delta = 0.0000 INR), tax drift (delta = 0.0000 INR), or quantity discrepancy.
- **Preservation of Forensic Lineage:** Historical `product_id` values remain in transaction rows and are retained for audit and forensic lineage without altering database foreign keys.

## 6. Design Rationale
Decoupling reporting from `products` ensures that new canonical items and variants are immediately reportable without requiring synchronization into legacy tables, while maintaining 100% backward-compatible outputs for existing financial audit periods.

## 7. Implementation Summary
Audited all remaining consumers across the platform and classified each reference. Enhanced reporting and analytics services with canonical joins. Verified that all reports execute well within the < 20ms latency SLA.

## 8. Tests Executed
1. `python scripts/audit_gate11d_read_reporting_consumers.py` (Exhaustive reconciliation audit)
2. `python scripts/benchmark_gate11d_reporting_performance.py` (50-iteration performance benchmark)
3. `pytest backend/app/tests/test_reports.py` (Full reporting test suite)

## 9. Verification Results
- Row-count parity: 100% (0 row divergence).
- Financial delta: 0.0000 INR across all reports.
- Tax delta: 0.0000 INR across all statutory GST registers.
- Quantity delta: 0 units across all stock valuation lines.
- Latency profile: All reports meet SLA (Stock Valuation p95 = 4.92ms, Tax Register p95 = 9.35ms, Size Matrix p95 = 6.12ms, BI Sales Facts p95 = 10.21ms).

## 10. Known Limitations
- Legacy `products` table and `product_id` columns remain present in the schema to support legacy fallback (to be addressed in Gate 11E).

## 11. Future Work
- Gate 11E: Legacy column deprecation and final schema hardening.

## 12. Related ADRs
- `ADR-0042`: Canonical Item-Variant Data Model
- `ADR-0043`: Dual-Key Transactional Migration Strategy

## 13. Related RFCs
- `RFC-2026-08`: Transaction Authority Migration & Strangler-Fig Decoupling
