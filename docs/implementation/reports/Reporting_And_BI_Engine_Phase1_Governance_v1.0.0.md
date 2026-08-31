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

# Implementation Plan: Reporting & BI Engine — Phase 1 (Governance & Data Contracts)

## 1. Objective
Establish the foundational data contracts, Central Report Registry, and Governed Metric Dictionary for the SMRITI Retail OS Reporting & BI Engine v1.0.0-GA. Enforce the unidirectional authority chain:
$$\text{Business Policy} \longrightarrow \text{Governed Metric Layer} \longrightarrow \text{Report Registry} \longrightarrow \text{Security Policy} \longrightarrow \text{Query Engine} \longrightarrow \text{UI}$$

## 2. Business Motivation
Prevent BI metric calculation drift, duplicate query logic, and unexplainable historical reporting across retail stores. Ensure legacy Shoper 9 operators retain full jump-code search speed without contaminating core domain models.

## 3. Scope
- Central Report Registry model and Pydantic validation schemas (`backend/app/schemas/report_registry.py`, `backend/app/models/reporting.py`).
- Governed Metric Dictionary with canonical formulas for 15+ retail KPIs (`backend/app/core/metric_dictionary.py`).
- Registry service layer for contract validation, legacy alias resolution, and execution envelope generation (`backend/app/services/report_registry_svc.py`).
- Seeder for all 21 canonical reports across 5 retail studios (`backend/app/db/seed_reports_registry.py`).
- Verification test suite (`backend/tests/test_report_registry_governance.py`).

## 4. Current State
Previous reports were rendered via disparate helper endpoints and queries in `reports.py` and `sales_reports.py`. While functional, KPI calculations lacked a single declarative dictionary and 5-vector temporal execution envelopes.

## 5. Gap Analysis
- No unified `ReportRegistryMaster` containing all 5 version vectors (`contract_version`, `metric_version`, `schema_version`, `security_policy_version`, `audit_lineage`).
- Shoper 9 aliases were stored in a separate legacy menu map rather than seamlessly bound to report metadata.
- No central mathematical formula registry preventing multiple reports from calculating Net Sales or Margin differently.

## 6. Architecture Impact
- Enforces strict server-side contract generation.
- Decouples legacy search aliases from core relational entities.
- Establishes the 4 Pillars of Integrity (Horizontal, Vertical, Temporal, Security).

## 7. Proposed Design
- Implement `GovernedMetricDictionary` as an immutable catalog of formula definitions and computation routines.
- Implement `ReportRegistryMaster` containing metadata, studio mapping, dimensions, measures, and Shoper 9 aliases.
- Implement `ReportRegistryService` to resolve aliases, validate measure requests, and produce `ReportExecutionEnvelope`.

## 8. Files Created
- `backend/app/core/metric_dictionary.py`
- `backend/app/schemas/report_registry.py`
- `backend/app/services/report_registry_svc.py`
- `backend/app/db/seed_reports_registry.py`
- `backend/tests/test_report_registry_governance.py`
- `docs/implementation/reports/Reporting_And_BI_Engine_Phase1_Governance_v1.0.0.md`

## 9. Files Modified
- `backend/app/models/reporting.py`
- `docs/implementation/README.md`

## 10. Dependencies
- FastAPI, Pydantic v2, SQLAlchemy 2.0 (asyncio).

## 11. Risks
- Zero breaking changes to existing endpoints; Phase 1 introduces pure governance contracts and registries.

## 12. Rollback Strategy
- Remove created files and revert `models/reporting.py`.

## 13. Verification Plan
- Run `pytest backend/tests/test_report_registry_governance.py -v`.

## 14. Test Plan
- Verify all 21 canonical reports load with valid schemas.
- Verify Shoper 9 alias resolution.
- Verify Governed Metric Dictionary calculations.
- Verify forensic execution fingerprint generation.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Generate Walkthrough upon completion.

## 16. Deployment Plan
- Deploy to development environment `D:\Smriti_Retail_OS`, run test suite, sync to test `F:\Smriti9`.

## 17. Status
In Progress (Phase 1 Execution)

## 18. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture

## 19. Related Walkthroughs
- `docs/walkthrough/reports/Sprint23_Reports_Portal_Gap_Closure_v1.0.0.md`
