---
title: "Reporting & BI Engine: Phase 2 (Security Masking & Query Performance Router)"
version: "1.0.0"
date: "2026-08-28"
author: "Jawahar Ramkripal Mallah"
designation: "Chief Systems Architect & Creator"
email: "support@smritibooks.com"
copyright: "© SMRITIBooks.com. All Rights Reserved."
license: "Proprietary Commercial Software"
classification: "Internal"
---

# Walkthrough: Reporting & BI Engine — Phase 2 (Security Masking & Query Performance Router)

## 1. Purpose
Implement Phase 2 (Steps 03 and 04 of the 12-stage roadmap) for the SMRITI Retail OS Reporting & BI Engine v1.0.0-GA:
1. **Server-Side RBAC & Data Masking Engine** (Enforcing Invariant 4: Zero frontend security trust).
2. **Query Performance-Tier Router** (Enforcing Invariant 5: Workload isolation preventing heavy analytical/export jobs from degrading interactive POS queries).

## 2. Scope
- Role capabilities matrix and recursive record/dataset masking in `backend/app/core/report_security.py`.
- 4-Tier Query Performance Router with latency targets and strategy allocation in `backend/app/core/performance_router.py`.
- Automated test suite in `backend/tests/test_report_security_and_performance.py`.

## 3. Files Created
- [`backend/app/core/report_security.py`](file:///F:/SMRITRretailNX/backend/app/core/report_security.py) — Server-Side RBAC & Data Masking Engine.
- [`backend/app/core/performance_router.py`](file:///F:/SMRITRretailNX/backend/app/core/performance_router.py) — Query Performance-Tier Router.
- [`backend/tests/test_report_security_and_performance.py`](file:///F:/SMRITRretailNX/backend/tests/test_report_security_and_performance.py) — Phase 2 test suite.
- [`docs/implementation/reports/Reporting_And_BI_Engine_Phase2_Security_Router_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/implementation/reports/Reporting_And_BI_Engine_Phase2_Security_Router_v1.0.0.md) — Implementation plan.
- [`docs/walkthrough/reports/Reporting_And_BI_Engine_Phase2_Security_Router_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/reports/Reporting_And_BI_Engine_Phase2_Security_Router_v1.0.0.md) — This walkthrough.

## 4. Files Modified
- [`docs/implementation/README.md`](file:///F:/SMRITRretailNX/docs/implementation/README.md) — Master implementation index.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Master walkthrough index.

## 5. Architecture Decisions
- **Zero Frontend Trust (Invariant 4):** Sensitive fields (`cogs`, `cost_price`, `gross_margin_amt`, `gross_margin_pct`, `gmroi`, `unit_cost`, `stock_valuation_amt`) are sanitized at the server layer. Restricted roles receive `None` values regardless of whether they consume via REST, Grid, Excel, or CSV.
- **Workload Isolation (Invariant 5):** 4 distinct performance tiers:
  1. `TIER_1_INTERACTIVE`: Target < 50ms (Single-day shift close, daily sales, bill lookup).
  2. `TIER_2_ANALYTICAL`: Target < 300ms (Size $\times$ Color matrix, category/brand aggregates, date-range summaries).
  3. `TIER_3_HISTORICAL`: Async / Chunked (Quarterly/Yearly store-vs-store comparisons).
  4. `TIER_4_STREAMING_EXPORT`: Streaming writer for Excel/CSV exports without memory buffering.

## 6. Design Rationale
Prevents confidential commercial purchase rates and gross margins from leaking to frontline staff or export files while ensuring heavy historical runs cannot lock or starve interactive checkout terminals.

## 7. Implementation Summary
- Verified masking across `CASHIER`, `STORE_SUPERVISOR`, `ACCOUNTANT`, and `CEO` roles.
- Verified recursive masking on nested line item arrays.
- Verified query tier classification across single-day, multi-month, matrix, and export workloads.

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python -m pytest tests/test_report_registry_governance.py tests/test_report_security_and_performance.py -v
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
collected 14 items

tests/test_report_registry_governance.py::test_canonical_registry_completeness PASSED [  7%]
tests/test_report_registry_governance.py::test_governed_metric_dictionary_integrity PASSED [ 14%]
tests/test_report_registry_governance.py::test_pure_metric_calculations PASSED [ 21%]
tests/test_report_registry_governance.py::test_shoper9_legacy_alias_resolution PASSED [ 28%]
tests/test_report_registry_governance.py::test_execution_request_rbac_and_measure_validation PASSED [ 35%]
tests/test_report_registry_governance.py::test_forensic_execution_envelope_generation PASSED [ 42%]
tests/test_report_security_and_performance.py::test_cashier_field_masking PASSED [ 50%]
tests/test_report_security_and_performance.py::test_supervisor_field_masking PASSED [ 57%]
tests/test_report_security_and_performance.py::test_accountant_and_ceo_full_financial_visibility PASSED [ 64%]
tests/test_report_security_and_performance.py::test_nested_dataset_masking PASSED [ 71%]
tests/test_report_security_and_performance.py::test_router_tier1_interactive_pos PASSED [ 78%]
tests/test_report_security_and_performance.py::test_router_tier2_analytical_matrix PASSED [ 85%]
tests/test_report_security_and_performance.py::test_router_tier3_heavy_historical PASSED [ 92%]
tests/test_report_security_and_performance.py::test_router_tier4_streaming_export PASSED [100%]

============================= 14 passed in 2.41s ==============================
```

## 10. Known Limitations
- Background task queues for Tier 3 long-running async queries will be wired into the Celery/async background worker in Phase 3.

## 11. Future Work
- Phase 3: Inventory 3-Tier State & Snapshot Engine (Step 05).
- Phase 4: Universal Drill-Down Pipeline & Audit Lineage (Step 06).

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture
- `ADR-POS-002`: Financial Transaction Forward-Only Integrity

## 13. Related RFCs
- `RFC-RPT-001`: Unified Business Intelligence & Flexi Report Studio Architecture
