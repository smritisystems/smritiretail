<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.8.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — Structured JSON Logging, Tracing Middleware & Operational Dashboard (v4.8.0)

## 1. Objective
To implement **v4.8.0 — Structured JSON Logging, Tracing Middleware & Operational Dashboard**, adding `X-Request-ID` correlation tracing middleware, structured JSON log formatting, Prometheus-compatible metrics exports (`/api/v1/diagnostics/metrics`), and an interactive React Operational Health Dashboard component.

## 2. Business Motivation
Enterprise IT operations, DevOps teams, and support engineers require end-to-end correlation tracing across API chains, structured JSON logs for ELK/Datadog ingestion, Prometheus metrics for Grafana dashboards, and visual health monitoring.

## 3. Scope
- **Backend Correlation Tracing Middleware**:
  - `RequestContextMiddleware` in `backend/app/middleware/request_context.py` generating `X-Request-ID` for every HTTP request.
- **Structured JSON Logger**:
  - `JSONFormatter` in `backend/app/core/logging_config.py`.
- **Prometheus Metrics Export Endpoint**:
  - `/api/v1/diagnostics/metrics` in `backend/app/api/v1/diagnostics.py`.
- **Frontend Operational Health Dashboard**:
  - `src/components/OperationalHealthDashboard.tsx`.
- **Automated Test Suite**:
  - `backend/app/tests/test_v4_8_structured_logging_and_metrics.py`.

## 4. Current State
v4.6 established system diagnostics endpoints (`/health`, `/benchmark`, `/backup-verify`). v4.8.0 completes enterprise observability with correlation tracing, JSON logs, Prometheus metrics, and a visual dashboard.

## 5. Gap Analysis
Without correlation IDs, tracing an invoice request across POS ➔ Inventory ➔ GST APIs requires manual log scanning. `X-Request-ID` ties the entire chain together.

## 6. Architecture Impact
```text
HTTP Request (X-Request-ID) ──> RequestContextMiddleware
                                         │
 ┌───────────────────────────────────────┼──────────────────────────────────────┐
 ▼                                       ▼                                      ▼
Structured JSON Logger        Prometheus Metrics Export           Operational Health Dashboard
(Timestamp, Request ID,       (/api/v1/diagnostics/metrics)      (React Real-Time Visual Probes)
 User, Company, Duration)
```

## 7. Proposed Design
1. **`RequestContextMiddleware`**: Intercepts requests, assigns `X-Request-ID` header, and logs execution latency.
2. **`OperationalHealthDashboard.tsx`**: Visual admin panel rendering active database probes, Prometheus metrics, hardware specs, and backup hashes.

## 8. Files Created
- [NEW] [request_context.py](file:///f:/SMRITRretailNXmgrt/backend/app/middleware/request_context.py)
- [NEW] [logging_config.py](file:///f:/SMRITRretailNXmgrt/backend/app/core/logging_config.py)
- [NEW] [OperationalHealthDashboard.tsx](file:///f:/SMRITRretailNXmgrt/src/components/OperationalHealthDashboard.tsx)
- [NEW] [test_v4_8_structured_logging_and_metrics.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_v4_8_structured_logging_and_metrics.py)
- [NEW] [v4_8_Structured_Logging_And_Metrics_Plan.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/v4_8_Structured_Logging_And_Metrics_Plan.md)

## 9. Files Modified
- [MODIFY] [backend/app/services/telemetry_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/telemetry_service.py)
- [MODIFY] [backend/app/api/v1/diagnostics.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/diagnostics.py)
- [MODIFY] [backend/app/main.py](file:///f:/SMRITRretailNXmgrt/backend/app/main.py)
- [MODIFY] [docs/implementation/README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)
- [MODIFY] [docs/walkthrough/README.md](file:///f:/SMRITRretailNXmgrt/docs/walkthrough/README.md)

## 10. Dependencies
FastAPI, AsyncSession, Pytest, Python `logging`, React 18.

## 11. Risks
Log overhead on ultra-high throughput endpoints. Mitigation: High-performance string formatting and async logging handlers.

## 12. Rollback Strategy
Remove middleware registration in `main.py`.

## 13. Verification Plan
Run automated pytest suite verifying `X-Request-ID` header generation, JSON log format, and Prometheus metrics output.

## 14. Test Plan
Run `python -m pytest app/tests/test_v4_8_structured_logging_and_metrics.py -v`.

## 15. Documentation Impact
Update master implementation index, walkthrough index, and produce v4.8.0 Walkthrough.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
In Progress

## 18. Related ADRs
- ADR-001: Platform Architecture Overview
- ADR-003: Platform Abstraction Layer

## 19. Related Walkthroughs
- `v4_6_Operational_Excellence_And_Telemetry_Walkthrough.md`
