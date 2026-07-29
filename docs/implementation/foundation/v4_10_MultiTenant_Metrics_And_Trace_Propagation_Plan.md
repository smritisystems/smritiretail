<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.10.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan — Multi-Tenant Metrics, Error Codes & Outbound Trace Propagation (v4.10.0)

## 1. Objective
To implement **v4.10.0 — Multi-Tenant Labeled Metrics, Machine Error Codes & Outbound Trace Propagation**, adding machine-readable error codes (`VAL-001`, `DB-205`), multi-tenant metric labels (`company_id`, `branch_id`, `terminal_id`), outbound W3C `traceparent` propagation in HTTP clients, and realistic operational limitation disclosures.

## 2. Business Motivation
Enterprise multi-store retailers require granular per-company and per-branch transaction telemetry, standardized machine-readable error codes for automated support ticket routing, and end-to-end outbound W3C trace propagation when connecting to external GST or ERP platforms.

## 3. Scope
- **Machine-Readable Error Codes**:
  - `ErrorCategoryTaxonomy` in `backend/app/core/logging_config.py` assigning machine codes (`VAL-001`, `AUTH-101`, `DB-205`, `NET-301`, `BUS-501`, `SYS-999`).
- **Multi-Tenant Prometheus Metric Labels**:
  - `SystemTelemetryService.get_prometheus_metrics()` in `backend/app/services/telemetry_service.py` with `company_id`, `branch_id`, `terminal_id` labels.
- **Outbound Trace Propagation**:
  - `backend/app/services/communicator_service.py` and `src/lib/apiFetchV1.ts` appending W3C `traceparent` headers to outbound requests.
- **Realistic Limitations Documentation**:
  - Update `docs/walkthrough/foundation/v4_9_Distributed_Tracing_And_Business_Metrics_Walkthrough.md` and `v4_10_MultiTenant_Metrics_And_Trace_Propagation_Walkthrough.md`.
- **Automated Test Suite**:
  - `backend/app/tests/test_v4_10_multitenant_metrics_and_error_codes.py`.

## 4. Current State
v4.9 established W3C distributed tracing (`traceparent`) and basic business metrics. v4.10.0 adds multi-tenant labels, machine error codes, outbound trace propagation, and explicit operational scope boundaries.

## 5. Gap Analysis
Unlabeled Prometheus metrics do not distinguish between Company A vs Company B sales. Multi-tenant labels enable per-tenant Grafana dashboards. Outbound trace propagation maintains trace continuity when contacting third-party systems.

## 6. Architecture Impact
```text
Client (apiFetchV1) ──traceparent──> FastAPI Middleware ──traceparent──> Communicator / Third-Party API
                                            │
 ┌──────────────────────────────────────────┼──────────────────────────────────────────┐
 ▼                                          ▼                                         ▼
Multi-Tenant Prometheus Metrics    Machine Error Codes                      Realistic Limitations
(smriti_pos_transactions_total     (VAL-001, DB-205,                        (Documented Integration
 {company="CO-01", branch="B-01"})  SYS-999 taxonomy)                        Scope Boundaries)
```

## 7. Proposed Design
1. **Multi-Tenant Labels**: Prometheus metric exposition uses `smriti_pos_transactions_total{company_id="...", branch_id="..."}`.
2. **Outbound Header Propagation**: Client and connector gateway forward `traceparent`.

## 8. Files Created
- [NEW] [test_v4_10_multitenant_metrics_and_error_codes.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_v4_10_multitenant_metrics_and_error_codes.py)
- [NEW] [v4_10_MultiTenant_Metrics_And_Trace_Propagation_Plan.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/foundation/v4_10_MultiTenant_Metrics_And_Trace_Propagation_Plan.md)

## 9. Files Modified
- [MODIFY] [backend/app/core/logging_config.py](file:///f:/SMRITRretailNXmgrt/backend/app/core/logging_config.py)
- [MODIFY] [backend/app/services/telemetry_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/telemetry_service.py)
- [MODIFY] [backend/app/services/communicator_service.py](file:///f:/SMRITRretailNXmgrt/backend/app/services/communicator_service.py)
- [MODIFY] [src/lib/apiFetchV1.ts](file:///f:/SMRITRretailNXmgrt/src/lib/apiFetchV1.ts)
- [MODIFY] [docs/walkthrough/foundation/v4_9_Distributed_Tracing_And_Business_Metrics_Walkthrough.md](file:///f:/SMRITRretailNXmgrt/docs/walkthrough/foundation/v4_9_Distributed_Tracing_And_Business_Metrics_Walkthrough.md)
- [MODIFY] [docs/implementation/README.md](file:///f:/SMRITRretailNXmgrt/docs/implementation/README.md)
- [MODIFY] [docs/walkthrough/README.md](file:///f:/SMRITRretailNXmgrt/docs/walkthrough/README.md)

## 10. Dependencies
FastAPI, AsyncSession, Pytest, Python `logging`.

## 11. Risks
High label cardinality if unique transaction IDs are used as labels. Mitigation: Restrict labels strictly to high-level tenant boundaries (`company_id`, `branch_id`, `terminal_id`).

## 12. Rollback Strategy
Revert schema and logging additions.

## 13. Verification Plan
Run automated pytest suite verifying labeled Prometheus metric output, machine error code mapping, and outbound `traceparent` propagation.

## 14. Test Plan
Run `python -m pytest app/tests/test_v4_10_multitenant_metrics_and_error_codes.py -v`.

## 15. Documentation Impact
Update master implementation index, walkthrough index, and produce v4.10.0 Walkthrough with explicit operational scope boundaries.

## 16. Deployment Plan
Commit and push to `target` (`smritiNX` branch).

## 17. Status
In Progress

## 18. Related ADRs
- ADR-001: Platform Architecture Overview
- ADR-003: Platform Abstraction Layer

## 19. Related Walkthroughs
- `v4_9_Distributed_Tracing_And_Business_Metrics_Walkthrough.md`
