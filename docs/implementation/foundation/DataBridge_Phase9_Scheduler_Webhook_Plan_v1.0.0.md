<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-06
  Modified     : 2026-10-06
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture & Implementation Plan — SMRITI DataBridge Phase 9
-->

# SMRITI Transaction DataBridge Phase 9: Automated Background Pull Scheduler & Real-Time Webhook Dispatcher Implementation Plan

## 1. Objective
Design and implement **Phase 9** of the SMRITI Transaction DataBridge. Phase 9 delivers an automated background pull scheduler (`DataBridgeScheduler` / `backend/app/services/databridge/scheduler_engine.py`) and a real-time webhook intake and CDC egress dispatcher (`DataBridgeWebhookDispatcher` / `backend/app/services/databridge/webhook_dispatcher.py`). The subsystem automates recurring data synchronization from external connectors (TallyPrime, Shopify, SAP B1, Unicommerce), verifies cryptographic HMAC signatures on inbound webhook events, and dispatches signed outbound Change Data Capture (CDC) events to external ERP and subscriber endpoints.

---

## 2. Business Motivation
1. **Continuous Hands-Free Synchronization**: Retail operations require continuous catalog updates, inventory level adjustments, and order synchronizations. Relying on manual UI file uploads causes operational latency and inventory stockouts.
2. **Real-Time E-Commerce Order Intake**: When an online order is placed on Shopify or Unicommerce, SMRITI POS must receive the order in near-real-time to reserve stock and avoid double-selling across counter terminals.
3. **Cryptographic Ingress Security (HMAC-SHA256)**: Public webhook intake endpoints must strictly verify authenticity headers (e.g. `X-Shopify-Hmac-Sha256`, `X-Smriti-Signature`) before processing external payloads to prevent spoofing and denial-of-service attacks.
4. **Outbound CDC Event Egress**: Accounting and logistics partners require instant webhook alerts when sales invoices are finalized, stock reconciliations are completed, or items are price-adjusted.

---

## 3. Scope
- **Automated Pull Scheduler (`DataBridgeScheduler`)**:
  - Tenant-isolated job management for recurring connector extraction.
  - Lifecycle state tracking: `ACTIVE`, `PAUSED`, `RUNNING`, `FAILED`.
  - Configurable execution intervals (in minutes) with automatic `next_run_at` calculation.
  - Automated pull execution piping transformed rows into preview or chunked async task queue (`DataBridgeAsyncEngine`).
- **Real-Time Inbound Webhook Dispatcher (`DataBridgeWebhookDispatcher`)**:
  - HMAC-SHA256 signature verification supporting Shopify, Unicommerce, and custom webhook secrets.
  - Automatic event topic extraction (`orders/create`, `products/update`, `inventory/adjust`).
  - Connector normalization converting nested webhook JSON payloads into canonical SMRITI DataBridge rows.
- **Outbound Webhook Egress Dispatcher**:
  - Cryptographically signed outbound HTTP webhook dispatch (`X-Smriti-Signature: sha256=...`).
  - Delivery receipt tracking, status code recording, and latency measurement.
- **REST Endpoints (`backend/app/api/v1/databridge.py`)**:
  - `POST /api/v1/databridge/schedules`: Register a sync schedule.
  - `GET /api/v1/databridge/schedules`: List active schedules for tenant.
  - `POST /api/v1/databridge/schedules/{schedule_id}/trigger`: Manually trigger schedule execution immediately.
  - `POST /api/v1/databridge/webhooks/inbound/{connector_type}`: Headless webhook ingress endpoint.
  - `POST /api/v1/databridge/webhooks/outbound/dispatch`: Manual/system trigger for outbound webhook transmission.
- **Models and Contracts**:
  - `DataBridgeScheduleStatus`, `DataBridgeScheduleCreateRequest`, `DataBridgeScheduleResponse`, `DataBridgeScheduleTriggerResponse`.
  - `DataBridgeInboundWebhookResponse`, `DataBridgeOutboundWebhookRequest`, `DataBridgeOutboundWebhookResponse`.
- **Zero Live Database Schema Drift**: Operates within existing database structures and tenant context isolation.

---

## 4. Current State
- Phases 1 through 8 are complete, verified, committed, and pushed to `smritiNX` (commit `44e069d8`, 94/94 regression tests green).
- Phase 8 connector framework exists with full support for TallyPrime XML, Shopify REST, SAP B1, and Unicommerce.
- No automated scheduling engine or webhook ingress/egress dispatcher exists in DataBridge.

---

## 5. Gap Analysis
| Capability | Current State | Phase 9 Target State |
|---|---|---|
| Background Pull Scheduling | Manual on-demand only | `DataBridgeScheduler` with intervals & next run math |
| Webhook HMAC Verification | Handled in legacy ecom | Canonical `DataBridgeWebhookDispatcher` verifying HMAC-SHA256 |
| Automated Inbound Ingestion | Manual API calls | Direct webhook ingress routing to connector + DataBridge queue |
| Outbound CDC Egress Dispatch | None | Signed outbound webhook delivery with delivery telemetry |
| Scheduler & Webhook REST APIs | None | Dedicated endpoints under `/api/v1/databridge/` |

---

## 6. Architecture Impact
```text
  External Platforms (Shopify, Unicommerce, Tally, Custom)
         │                                       ▲
         │ Inbound Webhooks                      │ Outbound CDC Events
         ▼                                       │ (HMAC Signed)
┌────────────────────────────────────────────────────────┐
│               DataBridge Phase 9 Engine                │
│  ┌───────────────────────┐   ┌───────────────────────┐ │
│  │  DataBridgeScheduler  │   │  Webhook Dispatcher   │ │
│  │ (Recurring Pull Sync) │   │ (Inbound / Outbound)  │ │
│  └───────────┬───────────┘   └───────────┬───────────┘ │
└──────────────┼───────────────────────────┼─────────────┘
               ▼                           ▼
       DataBridge Connector Orchestrator (Phase 8)
               │
               ▼
       Canonical SMRITI DataBridge Tabular Rows
               │
   ┌───────────┴───────────┐
   ▼                       ▼
DataBridge Preview      DataBridge Async Engine
(Immediate Inspection)  (Chunked Outbox Worker - Phase 4)
```

---

## 7. Proposed Design
1. **Scheduler State & Execution Engine**:
   - `DataBridgeScheduler` maintains schedules partitioned by `tenant_id`.
   - On execution, pulls records via `DataBridgeConnectorOrchestrator.pull_and_transform(...)`.
   - Automatically enqueues results or saves preview dataset; updates `last_run_at`, `next_run_at`, and `last_records_count`.
2. **Cryptographic HMAC Security**:
   - Inbound webhooks compute `base64(hmac-sha256(secret, raw_body))` or hex digest and compare using constant-time `hmac.compare_digest`.
   - Outbound webhooks attach `X-Smriti-Signature: sha256={hexdigest}`.
3. **Event Normalization**:
   - Webhook payloads are automatically mapped to `DataBridgeEntityType` (`SALES_INVOICE`, `ITEM`, `CUSTOMER`).

---

## 8. Files Created
1. `backend/app/services/databridge/scheduler_engine.py`: `DataBridgeScheduler` engine.
2. `backend/app/services/databridge/webhook_dispatcher.py`: `DataBridgeWebhookDispatcher` engine.
3. `backend/tests/test_databridge_phase9_scheduler_webhook.py`: Comprehensive automated pytest suite.
4. `scripts/register_databridge_phase9_architecture.py`: Architecture capability registrar for CI duplication gate.
5. `docs/implementation/foundation/DataBridge_Phase9_Scheduler_Webhook_Plan_v1.0.0.md`: This document.
6. `docs/walkthrough/foundation/DataBridge_Phase9_Scheduler_Webhook_v1.0.0.md`: WGP Walkthrough document.

---

## 9. Files Modified
1. `backend/app/services/databridge/models.py`: Added scheduler and webhook models and enums.
2. `backend/app/services/databridge/__init__.py`: Exported scheduler and webhook dispatcher classes.
3. `backend/app/api/v1/databridge.py`: Mounted scheduler and webhook endpoints (`/schedules`, `/schedules/{id}/trigger`, `/webhooks/inbound/{type}`, `/webhooks/outbound/dispatch`).
4. `docs/implementation/README.md`: Registered Phase 9 implementation plan.
5. `docs/walkthrough/README.md`: Registered Phase 9 walkthrough.
6. `CHANGELOG.md`: Added release notes under version `[6.70.14]`.

---

## 10. Dependencies
- Python standard library (`hmac`, `hashlib`, `base64`, `json`, `datetime`, `uuid`).
- FastAPI, Pydantic v2.
- DataBridge Core & Connectors (`service.py`, `models.py`, `connectors`).

---

## 11. Risks
| Risk | Severity | Mitigation |
|---|---|---|
| Replay attacks on webhook ingress | Medium | Timestamp header validation and idempotency hash logging |
| Clock drift in schedule triggering | Low | Next run calculated via UTC timezone timestamps |
| External endpoint downtime on outbound webhook | Medium | Non-blocking execution, timeout guards, and delivery status recording |

---

## 12. Rollback Strategy
- Additive service layer with zero schema modifications.
- Disabling endpoints or pausing schedules completely ceases background network calls.

---

## 13. Verification Plan
1. **Automated Unit & Integration Tests**:
   - Run dedicated test suite `backend/tests/test_databridge_phase9_scheduler_webhook.py`.
   - Validate schedule creation, listing, interval calculation, and manual trigger.
   - Validate Shopify and Unicommerce webhook parsing and HMAC validation.
   - Validate invalid signature rejection.
   - Validate outbound webhook signature signing and dispatch response.
   - Validate FastAPI REST endpoints.
2. **Full Regression Suite**:
   - Run all 12 test suites across DataBridge Phases 1 through 9.
3. **Architecture & Lint Gates**:
   - Issue preflight certificates via `scripts/register_databridge_phase9_architecture.py`.
   - Run `npm run architecture:check` (11/11 passed).
   - Run `npm run lint` (`tsc --noEmit` exit 0).

---

## 14. Test Plan
- `test_tc_sched_001_schedule_creation_and_listing`: Verifies creating and listing sync schedules.
- `test_tc_sched_002_schedule_trigger_execution`: Triggers schedule and verifies pull & transform execution.
- `test_tc_sched_003_inbound_shopify_webhook_hmac_verification`: Ingests Shopify order webhook with valid HMAC signature.
- `test_tc_sched_004_inbound_unicommerce_webhook_ingestion`: Ingests Unicommerce order notification webhook.
- `test_tc_sched_005_inbound_webhook_invalid_signature_rejection`: Rejects forged webhook payload with HTTP 401/400.
- `test_tc_sched_006_outbound_webhook_signing_and_dispatch`: Signs payload with HMAC-SHA256 and validates delivery receipt.
- `test_tc_sched_007_fastapi_rest_scheduler_and_webhook_endpoints`: Tests REST endpoints with authentication.

---

## 15. Documentation Impact
- Implementation Plan: `docs/implementation/foundation/DataBridge_Phase9_Scheduler_Webhook_Plan_v1.0.0.md`.
- Implementation Index: `docs/implementation/README.md`.
- Walkthrough: `docs/walkthrough/foundation/DataBridge_Phase9_Scheduler_Webhook_v1.0.0.md`.
- Walkthrough Index: `docs/walkthrough/README.md`.
- CHANGELOG: `CHANGELOG.md` under `[6.70.14]`.

---

## 16. Deployment Plan
1. Add scheduler and webhook contracts to `models.py`.
2. Implement `DataBridgeScheduler` in `scheduler_engine.py`.
3. Implement `DataBridgeWebhookDispatcher` in `webhook_dispatcher.py`.
4. Export classes in `__init__.py`.
5. Mount REST endpoints in `backend/app/api/v1/databridge.py`.
6. Issue preflight certificates and pass architecture check.
7. Run test suites and verify 100% green.
8. Commit and push to GitHub `smritiNX`.

---

## 17. Status
**In Progress**

---

## 18. Related ADRs
- `ADR-001`: FastAPI + PostgreSQL Sole Backend System of Record.
- `ADR-004`: Tenant Isolation & Multi-Tenancy Architecture.
- `ADR-009`: Statutory Compliance & Immutability Doctrine.
- `ADR-DATABRIDGE-01`: Universal Multi-Source DataBridge Architecture.

---

## 19. Related Walkthroughs
- `DataBridge_Core_Foundation_v1.0.0.md`
- `DataBridge_Phase4_Async_Queue_v1.0.0.md`
- `DataBridge_Phase6_Migration_Rollback_v1.0.0.md`
- `DataBridge_Phase7_Schema_Mapping_v1.0.0.md`
- `DataBridge_Phase8_Connector_Framework_v1.0.0.md`
