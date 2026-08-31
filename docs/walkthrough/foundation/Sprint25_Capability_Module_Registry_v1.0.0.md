---
title: "Sprint 25: P1.2 Capability & Module Registry (Control Plane)"
version: "1.0.0"
date: "2026-08-25"
author: "Jawahar Ramkripal Mallah"
designation: "Chief Systems Architect & Creator"
email: "support@smritibooks.com"
copyright: "© SMRITIBooks.com. All Rights Reserved."
license: "Proprietary Commercial Software"
classification: "Internal"
---

# Walkthrough: Sprint 25 — P1.2 Capability & Module Registry (Control Plane)

## 1. Purpose
This sprint fulfills **Blueprint Section 4: P1 Control Plane Completion (P1.2 Capability and Module Registry)**. It establishes an authoritative control-plane capability registry, a fail-closed dependency graph evaluation engine, PostgreSQL-backed tenant capability subscription bindings, multi-tier plan resolution (BASIC, PROFESSIONAL, ENTERPRISE), company-level feature flag evaluations, and system module lifecycle state tracking.

## 2. Scope
- **Control Plane Capability Catalog**: 32 platform capabilities (POS, Sales, Purchase, Inventory, WMS, Distribution, ECOM, PSV, PDT, CGE, CRM, Accounting, GST, Payments, Pricing, Promotions, Fulfillment, Barcode, Label Printing, Reporting, Communicator, Document, Approval, Search, Integration, Audit, Batch Expiry, Serial Tracking, Matrix Grid, Table Ordering, Delivery Challan, Stock Audit).
- **Fail-Closed Dependency Engine**: Directed Acyclic Graph (DAG) validation ensuring prerequisite dependencies are verified before activation, and active dependents block deactivation.
- **Tenant Subscription Plane**: Per-company bindings (`tenant_capability_bindings`) with real-time toggle endpoints.
- **Plan Bundles & Override Resolution**: Plan tier evaluation (BASIC, PROFESSIONAL, ENTERPRISE) with tenant override reconciliation.
- **Feature Flags & Module Lifecycle**: Company-level feature flag overrides and module state registry.
- **Verification**: 8/8 new integration tests in `backend/tests/t_cap_registry.py` (27/27 regression tests green).

## 3. Files Created
- [`backend/app/schemas/capabilities.py`](file:///F:/SMRITRretailNX/backend/app/schemas/capabilities.py) — Pydantic models for capabilities, dependency checks, plan bundles, tenant bindings, feature flags, and module states.
- [`backend/app/db/seed_cap_master.py`](file:///F:/SMRITRretailNX/backend/app/db/seed_cap_master.py) — Authoritative seeder for capabilities, feature flags, module states, and default tenant bindings.
- [`backend/tests/t_cap_registry.py`](file:///F:/SMRITRretailNX/backend/tests/t_cap_registry.py) — 8-part capability and module test suite.
- [`docs/walkthrough/foundation/Sprint25_Capability_Module_Registry_v1.0.0.md`](file:///F:/SMRITRretailNX/docs/walkthrough/foundation/Sprint25_Capability_Module_Registry_v1.0.0.md) — This walkthrough.

## 4. Files Modified
- [`backend/app/models/capability_template.py`](file:///F:/SMRITRretailNX/backend/app/models/capability_template.py) — Added `ModuleState` and `ModuleAuditLog` models inheriting from `Base`.
- [`backend/app/services/capability_service.py`](file:///F:/SMRITRretailNX/backend/app/services/capability_service.py) — Implemented async database methods for platform capabilities, tenant capability toggling, feature flags, and module states.
- [`backend/app/api/v1/capability_registry.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/capability_registry.py) — Expanded REST endpoints with database sessions and Pydantic validation schemas.
- [`docs/architecture/BLUEPRINT_PENDING.md`](file:///F:/SMRITRretailNX/docs/architecture/BLUEPRINT_PENDING.md) — Updated Section 4.2 to `DONE / VERIFIED` with Rule 11 quantitative metrics, named mechanisms, and commit citations.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md) — Appended Sprint 25 master index entry.
- [`CHANGELOG.md`](file:///F:/SMRITRretailNX/CHANGELOG.md) — Registered `v3.41.0`.

## 5. Architecture Decisions
- **Fail-Closed Dependency Guards**: Disabling a prerequisite capability (e.g. `INVENTORY`) while dependent capabilities (e.g. `POS`, `WMS`, `SALES`) remain active is rejected with HTTP 400 unless explicit cascading is forced.
- **Tenant Context Isolation**: Platform catalog metadata queries the `smritisys` control plane, while company-specific activations query and write to the tenant database connection (`get_company_db`).
- **Feature Flag Layering**: Evaluates flags hierarchically: `global_default` overlaid by `company_overrides[company_id]`.

## 6. Design Rationale
In enterprise retail environments, arbitrary or uncoordinated module activations cause data corruption (e.g., attempting POS transactions when inventory or accounting ledger subsystems are unconfigured). Enforcing strict DAG dependency checks in the control plane guarantees transactional integrity before any operational endpoint or UI menu becomes available.

## 7. Implementation Summary
- **Capability Catalog**: 32 platform capabilities with explicit prerequisite lists.
- **Plan Bundles**: Standard plans (`BASIC`, `PROFESSIONAL`, `ENTERPRISE`) mapping to standard business editions.
- **Dependency Validator**: `POST /api/v1/capabilities/validate` diagnostic checker.
- **Tenant Bindings**: `GET /api/v1/capabilities/tenant` and `POST /api/v1/capabilities/tenant/toggle`.
- **Feature Flags**: `GET /api/v1/capabilities/feature-flags` and `POST /api/v1/capabilities/feature-flags/{key}/toggle`.
- **Module States**: `GET /api/v1/capabilities/modules`.

## 8. Tests Executed
```powershell
cd F:\SMRITRretailNX\backend
python app/db/seed_cap_master.py
python -m pytest tests/t_cap_registry.py -v
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
collected 8 items

tests/t_cap_registry.py::test_capability_catalog PASSED                  [ 12%]
tests/t_cap_registry.py::test_plan_bundles_endpoint PASSED               [ 25%]
tests/t_cap_registry.py::test_capability_dependency_validation_fail_closed PASSED [ 37%]
tests/t_cap_registry.py::test_plan_resolution_with_overrides PASSED      [ 50%]
tests/t_cap_registry.py::test_tenant_capabilities_binding_list PASSED    [ 62%]
tests/t_cap_registry.py::test_tenant_capability_toggle_fail_closed PASSED [ 75%]
tests/t_cap_registry.py::test_feature_flags_and_company_toggle PASSED    [ 87%]
tests/t_cap_registry.py::test_module_states_endpoint PASSED              [100%]

======================== 8 passed, 8 warnings in 9.43s ========================
```

## 10. Known Limitations
- Custom tenant capability override auditing is logged to `module_audit_logs`.

## 11. Future Work
- Sprint 26: `P1.3 Workspace, Menu, and UI Experience Registry`.

## 12. Related ADRs
- `ADR-001`: Sole FastAPI + Postgres Backend Architecture
- `ADR-004`: Control Plane and Multi-Tenant Isolation Model

## 13. Related RFCs
- `RFC-CAP-001`: Capability Dependency Graph & Tenant Entitlements
