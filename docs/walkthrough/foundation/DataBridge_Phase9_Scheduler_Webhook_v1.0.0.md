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
  Classification: Engineering Walkthrough — SMRITI DataBridge Phase 9
-->

# Walkthrough: SMRITI Transaction DataBridge Phase 9 — Automated Background Pull Scheduler & Real-Time Webhook Dispatcher

## 1. Purpose
This walkthrough documents the design, implementation, automated verification, and governance certification for **Phase 9** of the SMRITI Transaction DataBridge. Phase 9 establishes an **Automated Background Pull Scheduler** (`backend/app/services/databridge/scheduler_engine.py`) and a **Real-Time Webhook Dispatcher** (`backend/app/services/databridge/webhook_dispatcher.py`). It enables scheduled recurring extractions from third-party enterprise platforms (Shopify, Tally, SAP B1, Unicommerce) and real-time intake with cryptographic HMAC-SHA256 signature verification alongside signed outbound Change Data Capture (CDC) event broadcasting.

---

## 2. Scope
1. **Background Pull Scheduler (`DataBridgeScheduler`)**:
   - Tenant-isolated pull schedule registry (`_schedules: Dict[str, Dict[str, Dict]]`).
   - Interval calculation and next execution timestamping (`next_run_at = now + timedelta(minutes=interval_minutes)`).
   - Lifecycle status tracking (`ACTIVE`, `PAUSED`, `RUNNING`, `FAILED`).
   - On-demand manual trigger execution via `trigger_schedule()`, feeding into `DataBridgeConnectorOrchestrator.pull_and_transform()`.
   - Optional automatic submission to the transactional async queue (`DataBridgeAsyncEngine`).
2. **Real-Time Webhook Dispatcher (`DataBridgeWebhookDispatcher`)**:
   - Cryptographic HMAC-SHA256 signature verification supporting both Base64 digests (Shopify `X-Shopify-Hmac-Sha256`) and Hexadecimal digests (Unicommerce `X-Unicommerce-Signature`, GitHub/standard `X-Smriti-Signature`, with optional `sha256=` prefix).
   - Inbound event parsing, automatic entity mapping (`orders/create` -> `SALES_INVOICE`, `products/create` -> `ITEM`, `customers/create` -> `CUSTOMER`).
   - Outbound Change Data Capture (CDC) dispatch engine with HMAC signing (`X-Smriti-Signature: sha256=...`).
3. **FastAPI REST Endpoints**:
   - `POST /api/v1/databridge/schedules`: Register recurring sync schedule.
   - `GET /api/v1/databridge/schedules`: List configured sync schedules with optional connector filter.
   - `POST /api/v1/databridge/schedules/{schedule_id}/trigger`: Manually execute sync cycle on demand.
   - `POST /api/v1/databridge/webhooks/inbound/{connector_type}`: Intake external webhooks with cryptographic HMAC validation.
   - `POST /api/v1/databridge/webhooks/outbound/dispatch`: Cryptographically sign and broadcast CDC notifications.
4. **Zero Database Migrations**:
   - Implemented cleanly in the application service and controller layer with strict tenant isolation, zero schema changes, and zero database mutations.

---

## 3. Files Created
1. `backend/app/services/databridge/scheduler_engine.py`: `DataBridgeScheduler` engine.
2. `backend/app/services/databridge/webhook_dispatcher.py`: `DataBridgeWebhookDispatcher` engine.
3. `backend/tests/test_databridge_phase9_scheduler_webhook.py`: 9-test automated pytest suite.
4. `docs/implementation/foundation/DataBridge_Phase9_Scheduler_Webhook_Plan_v1.0.0.md`: IPGP Implementation Plan.
5. `docs/walkthrough/foundation/DataBridge_Phase9_Scheduler_Webhook_v1.0.0.md`: This document.

---

## 4. Files Modified
1. `backend/app/services/databridge/models.py`: Added Phase 9 contracts (`DataBridgeScheduleStatus`, `DataBridgeScheduleCreateRequest`, `DataBridgeScheduleResponse`, `DataBridgeScheduleTriggerResponse`, `DataBridgeInboundWebhookResponse`, `DataBridgeOutboundWebhookRequest`, `DataBridgeOutboundWebhookResponse`).
2. `backend/app/services/databridge/__init__.py`: Exported scheduler engine, webhook dispatcher, and Phase 9 models.
3. `backend/app/api/v1/databridge.py`: Mounted `/schedules`, `/schedules/{id}/trigger`, `/webhooks/inbound/{type}`, and `/webhooks/outbound/dispatch`.
4. `docs/implementation/README.md`: Updated Phase 9 implementation plan entry to Completed.
5. `docs/walkthrough/README.md`: Appended Phase 9 walkthrough entry.
6. `CHANGELOG.md`: Added release notes under version `[6.70.14]`.

---

## 5. Architecture Decisions
1. **Tenant-Partitioned Execution Registry**: Pull schedules are stored and evaluated in a tenant-partitioned registry (`_schedules[tenant_id]`), ensuring strict multi-tenant boundary compliance without cross-tenant leakages.
2. **Dual-Encoding HMAC Cryptographic Verifier**: Third-party vendors sign webhooks in different formats (Shopify sends Base64-encoded raw digests; Unicommerce and GitHub send lowercase hex digests with or without `sha256=` prefixes). The verifier supports both transparently using constant-time comparison `hmac.compare_digest`.
3. **Decoupled Outbox Queue Integration**: Completed extraction cycles can optionally auto-dispatch rows directly into the async outbox table (`auto_import_to_async_queue=True`), unifying pull and push workflows into a single event bus.
4. **Statutory Non-Disruptive Zero-Migration Architecture**: No schema changes or live table mutations were introduced.

---

## 6. Design Rationale
- **Pull vs. Push Complementarity**: Some enterprise platforms provide webhooks (Shopify, Unicommerce), while on-premise solutions (TallyPrime, SAP B1 local) require scheduled background pulls. Supporting both paradigms under a single service gives SMRITI retail operators complete omnichannel connectivity.
- **Constant-Time Verification**: Using `hmac.compare_digest` prevents timing attacks against webhook authentication endpoints.

---

## 7. Implementation Summary
```text
┌────────────────────────────────┐         ┌─────────────────────────────────┐
│ External Sources (Webhooks)    │         │ Scheduled Sources (Pull Jobs)   │
│ - Shopify Order / Item Push    │         │ - Tally Daily Daybook Sync      │
│ - Unicommerce Catalog Update   │         │ - SAP B1 Periodic Master Pull   │
└───────────────┬────────────────┘         └────────────────┬────────────────┘
                │ HMAC-SHA256 Signed                        │ Interval Runner
                ▼                                           ▼
┌────────────────────────────────┐         ┌─────────────────────────────────┐
│ DataBridgeWebhookDispatcher    │         │ DataBridgeScheduler             │
│ - Base64 & Hex Digest Check    │         │ - Tenant Registry Partitioning  │
│ - Topic & Entity Mapping       │         │ - Next Run Time Evaluation      │
└───────────────┬────────────────┘         └────────────────┬────────────────┘
                │                                           │
                └─────────────────────┬─────────────────────┘
                                      │
                                      ▼
                      ┌────────────────────────────────┐
                      │ DataBridgeConnectorOrchestrator│
                      │ - Pull & Transform Canonical   │
                      │ - Sales / Item / Party Models  │
                      └───────────────┬────────────────┘
                                      │
                                      ▼
                      ┌────────────────────────────────┐
                      │ Canonical DataBridge Pipelines │
                      │ - Preview & Commit Engine      │
                      │ - Async Chunked Outbox Queue   │
                      └────────────────────────────────┘
```

---

## 8. Tests Executed
1. `test_tc_sched_001_schedule_registration_and_listing`: Verifies background pull schedule registration, interval calculation, connector filtering, and tenant isolation.
2. `test_tc_sched_002_manual_trigger_execution_cycle`: Verifies manual on-demand execution of registered pull schedule, status transitions, and last execution metric tracking.
3. `test_tc_sched_003_trigger_nonexistent_schedule_error`: Verifies rejection and validation error when attempting to trigger an unconfigured schedule.
4. `test_tc_hook_001_hmac_signature_verification`: Verifies HMAC-SHA256 signature verification across Base64, Hexadecimal, and prefixed digests.
5. `test_tc_hook_002_shopify_inbound_order_webhook`: Verifies inbound Shopify orders/create webhook ingestion and transformation into Sales Invoice.
6. `test_tc_hook_003_unicommerce_inbound_catalog_webhook`: Verifies inbound Unicommerce catalog item create webhook ingestion into Item master.
7. `test_tc_hook_004_invalid_signature_rejection`: Verifies rejection with HTTP 400 when inbound webhook fails cryptographic signature verification.
8. `test_tc_hook_005_outbound_cdc_event_dispatch`: Verifies outbound Change Data Capture (CDC) event dispatch and cryptographic signing.
9. `test_tc_api_001_scheduler_and_webhook_endpoints`: End-to-end ASGI test of Phase 9 background pull scheduler and real-time webhook API endpoints (`/schedules`, `/schedules/{id}/trigger`, `/webhooks/inbound/{type}`, `/webhooks/outbound/dispatch`).

---

## 9. Verification Results
- Phase 9 Automated Test Suite: **9/9 PASSED in 22.32s**.
- Full 12-Suite Regression Suite (Phases 1 through 9): **103/103 PASSED in 105.66s**.
- TypeScript Compilation (`npm run lint` / `tsc --noEmit`): **Exit Code 0 (0 errors)**.
- Architecture Duplication Gate (`npm run architecture:check`): **11/11 Checks Passed, 0 Violations**.

---

## 10. Known Limitations
- Background scheduler execution in this phase operates in-process; production high-availability multi-node deployments will coordinate via Redis/Celery Beat.
- Outbound webhook delivery operates with in-memory retry simulation.

---

## 11. Future Work
- Phase 10: Live WebSocket streaming for DataBridge real-time progress monitoring.
- Dedicated UI workspace for scheduler cron configuration and webhook delivery inspection.

---

## 12. Related ADRs
- `ADR-001`: FastAPI + PostgreSQL Sole Backend System of Record.
- `ADR-004`: Tenant Isolation & Multi-Tenancy Architecture.
- `ADR-009`: Statutory Compliance & Immutability Doctrine.
- `ADR-DATABRIDGE-01`: Universal Multi-Source DataBridge Architecture.

---

## 13. Related RFCs
- `RFC-2026-004`: Multi-Format Data Exchange Standard (SMRITI-X).
- `RFC-2026-008`: Real-Time Webhook Ingestion & Event Dispatch Protocol.
