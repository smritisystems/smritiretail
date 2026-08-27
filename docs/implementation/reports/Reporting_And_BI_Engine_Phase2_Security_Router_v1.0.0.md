<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.35.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Reporting & BI Engine — Phase 2 (Security Masking & Query Performance Router)

## 1. Objective
Implement **Phase 2** (Steps 03 and 04 of the 12-stage roadmap) for the SMRITI Retail OS Reporting & BI Engine v1.0.0-GA:
1. **Server-Side RBAC & Data Masking Engine** (Enforcing Invariant 4: Zero frontend security trust).
2. **Query Performance-Tier Router** (Enforcing Invariant 5: Workload isolation preventing heavy analytical/export jobs from degrading interactive POS queries).

## 2. Business Motivation
- Prevent leakages of sensitive financial metrics (COGS, Landed Cost, Margin %, GMROI) to frontline staff, cashiers, or floor supervisors across API payloads, Grid renders, and Excel/CSV exports.
- Guarantee query predictability and sub-50ms latency for interactive point-of-sale shift summaries while safely offloading multi-store historical aggregations.

## 3. Scope
- Server-side field-level masking transformer in `backend/app/core/report_security.py`.
- Query performance-tier classifier and execution router in `backend/app/core/performance_router.py`.
- Integration test suite in `backend/tests/test_report_security_and_performance.py`.

## 4. Architecture Invariants Enforced
- **Invariant 4:** No authorization or masking is trusted to the frontend.
- **Invariant 5:** No heavy analytical/export workload blocks interactive POS/reporting queries.
- **Invariant 6:** Predictable memory footprint via streaming generators for exports.
- **Invariant 9:** All report views consume identical security masking rules.

## 5. Proposed Design

### A. Server-Side Security & Masking Layer (`report_security.py`)
- Role capabilities matrix defining permissions:
  - `VIEW_REVENUE` (Cashier, Supervisor, Manager, Accountant, CEO)
  - `VIEW_TAX_COMPLIANCE` (Accountant, Manager, CEO)
  - `VIEW_COST_AND_MARGIN` (Accountant, Admin, CEO only — strictly hidden from Cashier/Supervisor)
  - `VIEW_ALL_BRANCHES` (Accountant, Admin, CEO)
- Masking engine `mask_report_dataset(report_id, dataset, user_role)`:
  - Sanitizes dictionaries, tabular lists, or Pydantic models by replacing sensitive fields with `None` or `[RESTRICTED]` before wire transmission.

### B. Query Performance-Tier Router (`performance_router.py`)
- 4 Performance Tiers:
  - `TIER_1_INTERACTIVE`: Target < 50ms (Single-day shift close, daily sales, invoice lookup).
  - `TIER_2_ANALYTICAL`: Target < 300ms (Size $\times$ Color matrix, category/brand aggregates, date-range summaries).
  - `TIER_3_HISTORICAL`: Async / Chunked (Quarterly/Yearly store-vs-store comparisons).
  - `TIER_4_STREAMING_EXPORT`: Streaming directly to file/network.
- Router inspects date range, branch count, and export format to assign performance tier and enforce query timeouts / concurrency limits.

## 6. Files Created
- `backend/app/core/report_security.py`
- `backend/app/core/performance_router.py`
- `backend/tests/test_report_security_and_performance.py`
- `docs/implementation/reports/Reporting_And_BI_Engine_Phase2_Security_Router_v1.0.0.md`

## 7. Files Modified
- `docs/implementation/README.md`

## 8. Verification Plan
- Run `pytest backend/tests/test_report_security_and_performance.py -v`.
- Test masking across Cashier, Store Manager, and CEO roles.
- Test performance tier classification and timeout allocation.

## 9. Status
In Progress (Phase 2 Execution)
