<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.11.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — Machine Error Catalog, Probabilistic Sampling & Capability Matrix (v4.11.0)

## 1. Objective
To implement **v4.11.0 — Machine Error Catalog, Probabilistic Trace Sampling & Connector Capability Matrix**, establishing a central machine error catalog with HTTP status codes and retryability flags, probabilistic trace sampling in RequestContextMiddleware, metric naming governance, and a Communicator Connector Capability Matrix.

## 2. Business Motivation
High-volume retail networks need controlled trace logging via sampling, standardized metric namespaces (`smriti_system_*`, `smriti_pos_*`, `smriti_inventory_*`, `smriti_security_*`, `smriti_sync_*`), automated error retry classification (`VAL-001` non-retryable vs `DB-205` retryable), and clear integration capability disclosure.

## 3. Scope
- **Central Machine Error Code Catalog**:
  - `SMRITI_ERROR_CATALOG` in `backend/app/core/error_catalog.py` mapping error codes to HTTP status, explanation, and `is_retryable` flag.
- **Probabilistic Trace Sampling**:
  - `RequestContextMiddleware` in `backend/app/middleware/request_context.py` using `trace_sample_rate` setting.
- **Metrics Naming Governance**:
  - Standardized metric prefixes (`smriti_system_*`, `smriti_pos_*`, `smriti_inventory_*`, `smriti_security_*`, `smriti_sync_*`) in `backend/app/services/telemetry_service.py`.
- **Connector Observability Capability Matrix**:
  - `get_connector_capabilities()` in `backend/app/services/communicator_service.py`.
- **Automated Test Suite**:
  - `backend/app/tests/test_v4_11_error_catalog_and_sampling.py`.

## 4. Current State
v4.10 established machine error codes and multi-tenant metric labels. v4.11.0 completes operational maturity with an error catalog, trace sampling controls, metric governance, and connector capability matrices.

## 5. Gap Analysis
Without trace sampling, 100% trace recording in high-throughput production stores can cause log disk exhaustion. Probabilistic sampling controls log volume while preserving error traces.

## 6. Architecture Impact
```text
HTTP Request ──> RequestContextMiddleware (Trace Sampling Rate: 1.0 DEV / 0.1 PROD)
                        │
 ┌──────────────────────┼────────────────────────┬────────────────────────┐
 ▼                      ▼                        ▼                        ▼
Central Error Catalog  Standardized Metrics     Connector Capability     W3C Tracing
(HTTP Status, Retry)   (smriti_pos_*,            Matrix (Tally XML,       (Trace & Span IDs)
                        smriti_sync_*)           REST API, Busy)
```

## 7. Proposed Design
1. **Error Catalog**: `SMRITI_ERROR_CATALOG` dictionary containing metadata per error code.
2. **Sampling Logic**: `should_sample_trace(sample_rate)` evaluated during request dispatch.

## 8. Files Created
- [NEW] [error_catalog.py](file:///f:/SMRITRretailNXmgrt/backend/app/core/error_catalog.py)
- [NEW] [test_v4_11_error_catalog_and_sampling.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_v4_11_error_catalog_and_sampling.py)
- [NEW] [v4_11_Error_Catalog_And_Sampling_Plan.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/v4_11_Error_Catalog_And_Sampling_Plan.md)

## 9. Files Modified
- [MODIFY] [backend/app/middleware/request_context.py](file:///f:/SMRITRretailNXmgrt/backend/app/middleware/request_context.py)
- [MODIFY] [backend/app/services/telemetry_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/telemetry_service.py)
- [MODIFY] [backend/app/services/communicator_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/communicator_service.py)
- [MODIFY] [docs/implementation/README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)
- [MODIFY] [docs/walkthrough/README.md](file:///f:/SMRITRretailNXmgrt/docs/walkthrough/README.md)

## 10. Dependencies
FastAPI, AsyncSession, Pytest, Python `logging`, `random`.

## 11. Risks
Dropping critical error traces during low sample rates. Mitigation: Requests encountering HTTP 5xx errors bypass sampling and are always sampled (100% error sample policy).

## 12. Rollback Strategy
Revert sampling filter and retain 100% trace recording.

## 13. Verification Plan
Run automated pytest suite verifying error catalog lookups, 100% error sampling bypass, and connector capability matrix outputs.

## 14. Test Plan
Run `python -m pytest app/tests/test_v4_11_error_catalog_and_sampling.py -v`.

## 15. Documentation Impact
Update master implementation index, walkthrough index, and produce v4.11.0 Walkthrough.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
In Progress

## 18. Related ADRs
- ADR-001: Platform Architecture Overview
- ADR-003: Platform Abstraction Layer

## 19. Related Walkthroughs
- `v4_10_MultiTenant_Metrics_And_Trace_Propagation_Walkthrough.md`
