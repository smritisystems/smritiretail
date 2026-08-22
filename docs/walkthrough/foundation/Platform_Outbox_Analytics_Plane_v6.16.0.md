<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Vertical Slice 7 — Consolidated Transactional Outbox & Operational Analytics

## 1. Purpose
Consolidate all transactional outbox event capture across the repository onto the single canonical ledger `integration_outbox_events` in the tenant data plane (`smritiXXX`), register an authoritative Alembic migration (`v1342_canonical_outbox`), implement an asynchronous row-locking dispatcher (`SKIP LOCKED`) with publisher adapter callbacks, retry backoff, and Dead-Letter Queue (DLQ) support, and establish an Authoritative Operational KPI Service querying PostgreSQL system-of-record ledgers directly.

---

## 2. Scope
- **Tenant Data Plane (`smritiXXX`) Consolidated Outbox**: Single canonical `IntegrationOutboxEvent` (aliased as `OutboxEvent`) capturing domain events (`INVOICE_CONFIRMED`, `STOCK_ADJUSTED`, `PAYMENT_SETTLED`, `APPROVAL_DECISION`) inside active database transactions alongside domain entity mutations.
- **Alembic Migration Chain**: `backend/alembic/versions/v1342_canonical_outbox.py` upgrading tenant databases (`smritiXXX`) and `alembic/env.py` supporting dynamic multi-database execution via `-x db=<database_name>`.
- **Asynchronous Concurrent Dispatch Engine**: Worker queue polling with `SELECT ... FOR UPDATE SKIP LOCKED`, external publisher adapter callbacks, retry count incrementation on failure, and automatic transition to `DEAD_LETTER` after max retries.
- **Authoritative Operational KPI Service**: Real-time KPI summaries (confirmed revenue, invoice counts, stock movements, settled payment volumes, pending outbox queues) queried directly against PostgreSQL system-of-record ledgers.
- **Strict Physical Tenancy**: Outbox events and operational metrics strictly isolated per company database.

---

## 3. Files Created
1. `backend/alembic/versions/v1342_canonical_outbox.py`: Authoritative Alembic migration consolidating outbox columns on `integration_outbox_events` and dropping deprecated tables.
2. `docs/implementation/foundation/Platform_Refactor_Slice7_Outbox_Analytics_Plan_v1.0.md`: Master 19-section implementation plan for Slice 7.

---

## 4. Files Modified
1. `backend/app/models/outbox.py`: Consolidated `IntegrationOutboxEvent` with canonical fields (`event_type`, `aggregate_type`, `aggregate_id`, `company_id`, `branch_id`, `error_message`), `synonym` aliases, and `OutboxEvent` alias.
2. `backend/alembic/env.py`: Added dynamic target database URL resolution via `-x db=<name>` or `-x db_url=<url>`.
3. `backend/app/services/outbox_service.py`: Added `event_type`, `aggregate_type`, `aggregate_id`, `company_id`, `branch_id` parameters to `record_event()`.
4. `backend/app/services/unified_outbox_analytics_service.py`: Updated `stage_outbox_event()` and `get_authoritative_operational_summary()` with `IntegrationOutboxEvent`, added `dispatcher_callback` and channel filtering in `dispatch_pending_outbox_events()`.
5. `backend/tests/test_unified_outbox_analytics.py`: Comprehensive test suite certifying domain transaction atomicity, rollback guarantees, dispatcher callbacks, DLQ transitions, and tenant isolation.
6. `docs/implementation/README.md`: Appended Slice 7 implementation plan to master index.
7. `docs/walkthrough/README.md`: Appended Slice 7 walkthrough to chronological master index.

---

## 5. Architecture Decisions
- **ADR-012: Consolidated Transactional Outbox Pattern**: External streaming or messaging must never participate in distributed 2PC transactions. Events are written to `integration_outbox_events` in the same local ACID transaction as the business entity and published asynchronously.
- **ADR-013: Authoritative Single-Source Operational KPIs**: Real-time operational metrics derive exclusively from PostgreSQL ledgers (`sales_invoices`, `payment_transactions`, `stock_movements`) rather than unverified cache approximations.

---

## 6. Design Rationale
Consolidating existing disparate outbox references into a unified model eliminates dual-write hazards and ensures newly provisioned tenant databases receive schema updates deterministically through Alembic.

---

## 7. Implementation Summary
- **Transactional Staging**:
  - `OutboxService.record_event()` and `stage_outbox_event()` register `IntegrationOutboxEvent` instances in `PENDING` state within the caller's active database transaction without premature commit.
- **Locked Batch Dispatching & DLQ**:
  - `dispatch_pending_outbox_events()` grabs batches of events with `with_for_update(skip_locked=True)`, executes external publisher callbacks, increments `retry_count` on failure, and transitions to `DEAD_LETTER` once `retry_count >= max_retries`.
- **Authoritative Operational KPI Service**:
  - `get_authoritative_operational_summary()` performs real-time SQL aggregations over confirmed invoices, payments, stock movements, and pending outbox queues.

---

## 8. Tests Executed
1. `backend/tests/test_unified_outbox_analytics.py`:
   - `test_real_domain_transaction_outbox_atomicity` (Passed)
   - `test_outbox_transaction_rollback_guarantee` (Passed)
   - `test_outbox_dispatcher_with_external_adapter_and_retry_backoff` (Passed)
   - `test_outbox_dead_letter_queue_transition` (Passed)
   - `test_authoritative_operational_analytics_summary` (Passed)
   - `test_outbox_and_analytics_tenant_isolation` (Passed)
2. Platform Regression Suite (41 tests):
   - 41/41 automated tests passed in 26.24s across Routing Boundary, Universal Party/Item Masters, Sales/POS Ledger, Pricing/Payments, Approvals/Communicator, Capabilities/Workspaces, and Consolidated Outbox/Analytics.

---

## 9. Verification Results

```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 41 items

tests/test_routing_boundary_canonical.py .............                  [ 31%]
tests/test_universal_party_master.py ...                                [ 39%]
tests/test_universal_item_master.py ...                                 [ 46%]
tests/test_unified_sales_ledger.py ....                                 [ 56%]
tests/test_unified_pricing_payment_engine.py ....                       [ 65%]
tests/test_unified_approval_communicator.py ....                        [ 75%]
tests/test_unified_workspace_capability.py ....                         [ 85%]
tests/test_unified_outbox_analytics.py ......                           [100%]

============================= 41 passed in 26.24s =============================
```

---

## 10. Known Limitations
- Standalone analytical storage, CDC ingestion pipeline (e.g. Debezium / Kafka Connect), and analytical workload isolation represent the future decoupled Analytics Plane.

---

## 11. Future Work
- Decoupled event consumption streaming into analytics read-replicas.
- External webhook retry scheduling daemon.

---

## 12. Related ADRs
- `ADR-001`: Multi-Company Database Architecture.
- `ADR-012`: Consolidated Transactional Outbox Pattern.

---

## 13. Related RFCs
- `RFC-014`: Transactional Outbox Event Ledger and Single-Source Operational Analytics.

