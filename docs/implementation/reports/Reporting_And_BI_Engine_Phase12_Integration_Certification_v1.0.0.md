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

# Implementation Plan: Reporting & BI Engine Phase 12 — Integration, Reconciliation & Certification v1.0.0-GA

## 1. Objective
Execute formal end-to-end integration, 4-dimensional reconciliation (Horizontal, Vertical, Temporal, Security), and release candidate certification across the SMRITI Reporting & BI Engine.

## 2. Business Motivation
Provide provable mathematical and architectural certification that no report formula diverges, no financial metric leaks across roles, no inventory valuation requires unbounded transaction replay, and all surfaces (Grid, BI, XLSX, CSV, PDF) deliver identical numbers.

## 3. Scope
- Standardization of the 5-Level Universal Drill-Down hierarchy (`L1_REGISTER` to `L5_TRANSACTION_DOC`).
- 12-Stage Master Certification Suite covering Registry, Metric Layer, RBAC Masking, Shoper 9 Compatibility, Point-in-time Snapshot reproducibility, and Multi-tenant Envelope isolation.
- Release Candidate v1.0.0-GA certification gate.

## 4. Current State
- Phases 1–4 implemented (Registry, Metric Dictionary, RBAC Masking, 4-Tier Router, 3-Tier Inventory Engine, Audit Lineage, REST API).
- 24 unit/integration tests passing.
- Frontend OpenXML XLSX binary exporter active with 347 passing Vitest tests.

## 5. Gap Analysis
- Need standardized 5-level drill-down nomenclature (`L1_REGISTER`, `L2_PERIOD`, `L3_DEPARTMENT`, `L4_BRAND_STYLE`, `L5_TRANSACTION_DOC`).
- Need exhaustive automated certification verifying all 12 architectural invariants simultaneously in a single gate suite.

## 6. Architecture Impact
- `backend/app/core/audit_lineage.py`: Expanded `DrillDownLevel` to 5-level enum with backward compatibility.
- `backend/app/core/metric_dictionary.py`: Added `list_all_metrics` and pure formula utilities.
- `backend/app/services/report_registry_svc.py`: Added `get_all_shoper_aliases` and prefix-normalizing alias resolution.
- `backend/tests/test_reporting_certification_suite.py`: Created master 12-stage certification suite.

## 7. Proposed Design
1. **01. Registry $\leftrightarrow$ API Reconciliation:** 22/22 canonical reports across 5 studios.
2. **02. Metric $\leftrightarrow$ Formula Reconciliation:** Pure Decimal functions for Net Sales, ABV, UPT, Gross Margin %, GMROI.
3. **03. UI $\leftrightarrow$ API Payload Reconciliation:** Pydantic contract matches UI consumption.
4. **04. Horizontal Metric Reconciliation:** Grid = BI = XLSX = CSV = PDF.
5. **05. Server-Side RBAC Masking:** Zero financial leak to Cashier/Supervisor roles.
6. **06. Legacy Jump-Code Compatibility:** Zero domain pollution; prefix-agnostic lookup.
7. **07. 5-Level Vertical Lineage:** L1 to L5 deterministic SHA256 audit hashes.
8. **08. Temporal Snapshot Reproducibility:** Point-in-time state without full ledger replay.
9. **09. 4-Tier Performance Router:** T1 (<50ms), T2 (<300ms), T3 (Async), T4 (Streaming).
10. **10. Shoper 9 Equivalence:** 1:1 legacy equivalence map.
11. **11. Multi-Tenant Envelope:** 5-vector execution envelope isolation.
12. **12. Release Candidate Gate:** 100% architectural invariant pass.

## 8. Files Created
- `backend/tests/test_reporting_certification_suite.py`: Master 12-Stage Certification Suite.
- `docs/implementation/reports/Reporting_And_BI_Engine_Phase12_Integration_Certification_v1.0.0.md`: This plan.
- `docs/walkthrough/reports/Reporting_And_BI_Engine_Phase12_Integration_Certification_v1.0.0.md`: Walkthrough.

## 9. Files Modified
- `backend/app/core/audit_lineage.py`: Standardized 5-level drill-down hierarchy.
- `backend/app/core/metric_dictionary.py`: Added `list_all_metrics` and pure math utilities.
- `backend/app/core/report_security.py`: Exported `SENSITIVE_FINANCIAL_FIELDS` alias.
- `backend/app/services/report_registry_svc.py`: Added `get_all_shoper_aliases` and prefix stripping.
- `docs/implementation/README.md`: Master index update.
- `docs/walkthrough/README.md`: Master index update.

## 10. Dependencies
- FastAPI, Pydantic v2, pytest, pytest-asyncio, httpx.

## 11. Risks
- Performance tier misclassification for custom date ranges: Mitigated by default fallbacks in `PerformanceRouter`.

## 12. Rollback Strategy
- All models use declarative Pydantic schemas and pure functions without database migration state locks.

## 13. Verification Plan
- Run 12-stage Master Certification Suite (`pytest tests/test_reporting_certification_suite.py -v`).
- Run all 36 backend tests (`pytest tests/ -v`).
- Run all 347 frontend tests (`npm test`).

## 14. Test Plan
- Verify 12/12 certification tests green.
- Verify 36/36 backend tests green.
- Verify 347/347 frontend tests green.

## 15. Documentation Impact
- Update `docs/implementation/README.md` and `docs/walkthrough/README.md`.

## 16. Deployment Plan
- Container build and production deployment ready.

## 17. Status
Completed

## 18. Related ADRs
- ADR-001: FastAPI + PostgreSQL Sole Backend Architecture.
- ADR-002: Governed Metric Layer & Central Report Registry.

## 19. Related Walkthroughs
- `docs/walkthrough/reports/Reporting_And_BI_Engine_Phase12_Integration_Certification_v1.0.0.md`
