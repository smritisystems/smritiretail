---
title: "Reporting & BI Engine: Phase 1 (Governance & Data Contracts)"
version: "1.0.0"
date: "2026-08-28"
author: "Jawahar Ramkripal Mallah"
designation: "Chief Systems Architect & Creator"
email: "support@smritibooks.com"
copyright: "© SMRITIBooks.com. All Rights Reserved."
license: "Proprietary Commercial Software"
classification: "Internal"
---

# Walkthrough: Reporting & BI Engine — Phase 1 (Governance & Data Contracts)

## 1. Purpose
Establish the foundational data contracts, Central Report Registry, and Governed Metric Dictionary for the SMRITI Retail OS Reporting & BI Engine v1.0.0-GA, enforcing the unidirectional authority chain:
$$\text{Business Policy} \longrightarrow \text{Governed Metric Layer} \longrightarrow \text{Report Registry} \longrightarrow \text{Security Policy} \longrightarrow \text{Query Engine} \longrightarrow \text{UI}$$

## 2. Scope
- Declarative `ReportRegistryEntry` Pydantic schemas with 5-vector version envelopes in `backend/app/schemas/report_registry.py`.
- Governed Metric Dictionary defining canonical formulas for 15+ retail and compliance KPIs in `backend/app/core/metric_dictionary.py`.
- Report Registry Master catalog seeding all 22 canonical reports across 5 retail navigation studios in `backend/app/db/seed_reports_registry.py`.
- Service layer for contract validation, legacy Shoper 9 alias resolution, and forensic execution envelope construction in `backend/app/services/report_registry_svc.py`.
- Comprehensive test suite in `backend/tests/test_report_registry_governance.py`.

## 3. Files Created
- [`backend/app/core/metric_dictionary.py`](file:///F:/SMRITRretailNX/backend/app/core/metric_dictionary.py) — Governed Metric Dictionary.
- [`backend/app/schemas/report_registry.py`](file:///F:/SMRITRretailNX/backend/app/schemas/report_registry.py) — Report Registry and Execution Envelope contracts.
- [`backend/app/db/seed_reports_registry.py`](file:///F:/SMRITRretailNX/backend/app/db/seed_reports_registry.py) — 22 Canonical Reports Catalog.
- [`backend/app/services/report_registry_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/report_registry_svc.py) — Service layer.
- [`backend/tests/test_report_registry_governance.py`](file:///F:/SMRITRretailNX/backend/tests/test_report_registry_governance.py) — Governance test suite.
- [`docs/implementation/reports/Reporting_And_BI_Engine_Phase1_Governance_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/implementation/reports/Reporting_And_BI_Engine_Phase1_Governance_v1.0.0.md) — Implementation plan.
- [`docs/walkthrough/reports/Reporting_And_BI_Engine_Phase1_Governance_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/reports/Reporting_And_BI_Engine_Phase1_Governance_v1.0.0.md) — This walkthrough.

## 4. Files Modified
- [`docs/implementation/README.md`](file:///F:/SMRITRretailNX/docs/implementation/README.md) — Master implementation index.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Master walkthrough index.

## 5. Architecture Decisions
- **Zero Formula Fragmentation (Invariant 2):** Pure mathematical functions (`calculate_net_sales`, `calculate_abv`, `calculate_upt`, `calculate_gross_margin_pct`, `calculate_gmroi`) defined exclusively in the core metric dictionary.
- **Decoupled Legacy Adapter (Invariant 3):** Legacy Shoper 9 menu/EXE codes (`411`, `412`, `SR202000`, `SR236300`) live strictly in registry alias arrays, keeping core domain models pure.
- **Forensic Execution Identity:** Every report execution generates a 5-vector tuple (`contract_version`, `metric_version`, `schema_version`, `security_policy_version`, `data_as_of`) with a unique `audit_trace_id`.

## 6. Design Rationale
Prevents UI components and disparate backend query functions from independently calculating metrics, ensuring a number means the exact same thing across Grids, BI charts, Excel exports, and Print.

## 7. Implementation Summary
- **5 Navigation Studios Defined:**
  1. `sales_studio` (5 canonical reports)
  2. `merchandise_studio` (4 canonical reports)
  3. `inventory_studio` (4 canonical reports)
  4. `tax_studio` (5 canonical reports)
  5. `mis_studio` (4 canonical reports)
- **Total Canonical Reports Seeded:** 22 reports.
- **Forensic Execution Envelope:** Verified generation of `ExecutionEnvelope` with tenant isolation and `data_as_of` snapshot reference.

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python -m pytest tests/test_report_registry_governance.py -v
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
collected 6 items

tests/test_report_registry_governance.py::test_canonical_registry_completeness PASSED [ 16%]
tests/test_report_registry_governance.py::test_governed_metric_dictionary_integrity PASSED [ 33%]
tests/test_report_registry_governance.py::test_pure_metric_calculations PASSED [ 50%]
tests/test_report_registry_governance.py::test_shoper9_legacy_alias_resolution PASSED [ 66%]
tests/test_report_registry_governance.py::test_execution_request_rbac_and_measure_validation PASSED [ 83%]
tests/test_report_registry_governance.py::test_forensic_execution_envelope_generation PASSED [100%]

============================== 6 passed in 1.47s ==============================
```

## 10. Known Limitations
- None for Phase 1. Performance-tier query routing and server-side export masking will be implemented in Phase 2 & 3.

## 11. Future Work
- Phase 2: Server-side RBAC column masking & Query Performance Tier Router (Steps 03 & 04).
- Phase 3: Inventory 3-Tier State & Snapshot Engine (Step 05).

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture
- `ADR-POS-002`: Financial Transaction Forward-Only Integrity

## 13. Related RFCs
- `RFC-RPT-001`: Unified Business Intelligence & Flexi Report Studio Architecture
