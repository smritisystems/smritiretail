<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.26.0
  Created      : 2026-09-16
  Modified     : 2026-09-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: System Architecture Walkthrough
-->

# Stage 4 Platform Event Service & Canonical Table Convergence

**Walkthrough ID:** WLK-ARCH-007  
**Version:** v6.26.0  
**Date:** 2026-09-16  
**Sprint:** Platform Kernel Stage 4 & Master Data Convergence  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  

---

## 1. Purpose

Establish the foundational Stage 4 Platform Event Service contract and execute the first phase of canonical master data convergence. This document records:
1. Rejection of bidirectional synchronization in favor of **One-Way Canonical Master → Compatibility Projection**.
2. Implementation of the contract-first **Platform Event Service** (replacing raw "Event Bus"), isolating infrastructure brokers behind `IEventTransport` with `MemoryTransport`.
3. Enforcement of the permanent **Statutory Transaction Snapshot Immutability Rule**.
4. Formal execution of the 5-gate retirement of the obsolete `stores` and `user_store_assignments` tables via Alembic migration `v1454_retire_stores_table.py`.
5. Publication of the binding `docs/_audit/CANONICAL_TABLE_DEPENDENCY_MATRIX_2026.md`.

---

## 2. Scope

| Area | Component | Action | Verification |
| :--- | :--- | :--- | :--- |
| **Audit & Governance** | `CANONICAL_TABLE_DEPENDENCY_MATRIX_2026.md` | Created comprehensive inventory of all 201 mapped models | Verified against live PostgreSQL DBs (`smriti001`, `smritisys`) |
| **Architecture Decision** | `ADR-005` | Formalized One-Way Projection & Statutory Snapshot Rule | Accepted & Published |
| **Platform Events** | `app.platform.events` | Authored Envelope, Transport, Registry, Idempotency, Policies, Outbox, Publisher, Subscriber | 9/9 Tests Green (Pytest) |
| **TypeScript Parity** | `src/kernel/events.ts` | Authored typed TypeScript interfaces matching backend contracts | `npm run build` Passing Clean (3,547 modules) |
| **Database Migration** | `v1454_retire_stores_table.py` | 5-Gate retirement of `stores` & `user_store_assignments` | Upgraded & Downgrade verified on `smriti001` & `smritisys` |
| **Model Hygiene** | `inventory.py`, `staff_placement.py`, `user_assignment.py`, `masters.py`, `system.py` | Severed FK constraints and retired dead store model calls | 17/17 Test suite regression green |

---

## 3. Files Created

| File | Purpose |
| :--- | :--- |
| `docs/_audit/CANONICAL_TABLE_DEPENDENCY_MATRIX_2026.md` | Master mapping of all 201 models → owner → consumers → FKs → canonical status → retirement gates |
| `docs/adr/ADR-005-One-Way-Canonical-Master-To-Compatibility-Projection-Architecture.md` | Formal ADR establishing One-Way Projections, Snapshot Immutability, and 5-Gate Deprecation |
| `backend/app/platform/events/__init__.py` | Stage 4 Platform Event Service public package exports |
| `backend/app/platform/events/envelope.py` | `EventEnvelope<T>` model with `schemaVersion`, `actorId`, `correlationId`, `causationId` |
| `backend/app/platform/events/transport.py` | `IEventTransport` abstraction interface and `MemoryTransport` reference implementation |
| `backend/app/platform/events/registry.py` | `EventRegistry` for schema version compatibility validation and event registration |
| `backend/app/platform/events/idempotency.py` | `IIdempotencyStore` contract and `MemoryIdempotencyStore` for duplicate detection |
| `backend/app/platform/events/policies.py` | `RetryPolicy` (exponential backoff) and `DeadLetterPolicy` / `DeadLetterEntry` |
| `backend/app/platform/events/serializer.py` | `EventSerializer` for bidirectional JSON envelope serialization |
| `backend/app/platform/events/publisher.py` | `EventPublisher` schema-guarded transport publishing engine |
| `backend/app/platform/events/subscriber.py` | `EventSubscriber` with tenant filtering, idempotency check, retries, and DLQ routing |
| `backend/app/platform/events/outbox.py` | `IEventOutbox` boundary interface declaration for atomic transactional staging |
| `backend/app/platform/events/service.py` | `PlatformEventService` unified kernel facade |
| `src/kernel/events.ts` | Frontend TypeScript interface contracts matching Stage 4 platform specs |
| `backend/alembic/versions/v1454_retire_stores_table.py` | Alembic migration for 5-gate retirement of `stores` with full rollback reconstruction |
| `backend/tests/test_platform_event_service.py` | Stage 4 platform verification test suite (9 tests) |
| `docs/walkthrough/architecture/Stage4_Platform_Event_Service_And_Canonical_Convergence_v6.26.0.md` | This WGP walkthrough |

---

## 4. Files Modified

| File | Changes Made |
| :--- | :--- |
| `backend/app/models/inventory.py` | Marked `Store` as Phase C RETIRED; commented out model table mapping |
| `backend/app/models/staff_placement.py` | Severed `ForeignKey("stores.id")` on `internal_store_id` and removed `internal_store` relationship |
| `backend/app/models/user_assignment.py` | Marked `UserStoreAssignment` as Phase C RETIRED; commented out table mapping |
| `backend/app/models/__init__.py` | Removed `UserStoreAssignment` from exports |
| `backend/alembic/env.py` | Removed `Store` and `UserStoreAssignment` from auto-registration imports |
| `backend/app/repositories/user_assignment.py` | Converted `UserStoreAssignmentRepository` to safe compatibility stub returning `[]` and `None` |
| `backend/app/services/user_assignment.py` | Updated `assign_store` and `remove_store_assignment` to return HTTP 410 Gone |
| `backend/app/api/v1/masters.py` | Removed `Store` model import; redirected store CRUD endpoints to HTTP 410 / empty array |
| `backend/app/api/v1/staff.py` | Removed unused `Store` import |
| `backend/app/api/v1/system.py` | Removed `Store` model import; updated `company_setup` to provision `Branch` without inserting to `stores` |
| `docs/walkthrough/README.md` | Registered this walkthrough in master index |
| `CHANGELOG.md` | Recorded Stage 4 Platform Event Service and table convergence milestone |

---

## 5. Architecture Decisions

### Decision 1: Platform Event Service vs. Raw Event Bus
The platform kernel strictly interacts with `PlatformEventService` and `IEventTransport`. Infrastructure message brokers (NATS, Kafka, RabbitMQ, Redis) are strictly external adapter implementations. Initial execution utilizes `MemoryTransport`, ensuring zero external infrastructure dependencies in local dev and CI/CD pipelines.

### Decision 2: One-Way Canonical Ownership
Bidirectional synchronization between legacy models and canonical models is prohibited. The canonical Item Master (`items`, `item_variants`, `item_barcodes`) and Universal Party Master (`parties`, `party_roles`, `customer_profiles`, `supplier_profiles`) are the single sources of truth. `products`, `customers`, and `suppliers` operate strictly as downstream read-compatible projections.

### Decision 3: Statutory Snapshot Rule
Historical invoices (`sales_invoices`, `sales_invoice_items`, `eway_bills`) must permanently preserve historical commercial and tax facts. Dynamic joins to live master tables to rewrite customer name, GSTIN, billing address, or tax rates on historical invoices are strictly prohibited under CGST Act Section 31.

---

## 6. Design Rationale

1. **Idempotency as a Contract:** Rather than treating idempotency as an ad-hoc test assertion, `IIdempotencyStore` is incorporated into the `EventSubscriber` pipeline. Every incoming event is checked for duplication before execution, and completed events are recorded atomically.
2. **Schema Versioning vs. Semantic Versioning:** The `EventEnvelope` distinguishes `version` (semantic event release version, e.g. `1.0.0`) from `schemaVersion` (payload structure contract, e.g. `1.0`), preventing payload structure changes from breaking event subscriptions.
3. **Actor Identity in Tracing:** Adding `actorId` directly to the envelope enables audit and compliance tracing from user UI action $\rightarrow$ API $\rightarrow$ Event $\rightarrow$ Consumer without requiring payload inspection.
4. **Controlled Outbox Staging Boundary:** Defining `IEventOutbox` conceptually in Stage 4 establishes the contract for database-event transactional staging without inflating Stage 4 into a multi-week distributed outbox worker implementation.

---

## 7. Implementation Summary

```text
                    SMRITI PLATFORM KERNEL
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   Identity              Capability           Workspace
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ▼
                  PLATFORM EVENT SERVICE
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
     Notification           Audit           Telemetry
                             │
                             ▼
                       Business Apps (POS, Billing, Inventory)
                             │
                             ▼
                      CANONICAL MASTERS
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
                 Items              Parties
                    │                 │
                    ▼                 ▼
             Compatibility       Compatibility
                Adapters             Adapters
                    │                 │
             products (Legacy)   customers / suppliers (Legacy)
```

---

## 8. Tests Executed

### 1. Platform Event Service Suite (`backend/tests/test_platform_event_service.py`)
- `test_envelope_immutability_and_schema_version`: PASSED
- `test_registry_contract_validation`: PASSED
- `test_serializer_roundtrip`: PASSED
- `test_publisher_rejects_unregistered_event`: PASSED
- `test_idempotency_duplicate_prevention`: PASSED
- `test_tenant_isolation_filtering`: PASSED
- `test_retry_policy_and_dead_letter_routing`: PASSED
- `test_platform_event_service_end_to_end_facade`: PASSED
- `test_outbox_interface_contract`: PASSED

### 2. Barcode Billing CSV Validation Suite (`backend/tests/test_billing_csv.py`)
- 8/8 tests: PASSED

### 3. Canonical Sales Writer Suite (`backend/tests/test_canonical_sales_writer.py`)
- 5/5 tests: PASSED

### 4. Vendor & Party Suite (`backend/tests/test_vendor_service.py`, `backend/tests/t_univ_party.py`)
- 9/9 tests: PASSED

### 5. Frontend Production Build
- `npm run build`: Exit Code 0 (3,547 modules transformed, 0 errors)

---

## 9. Verification Results

```text
Stage 4 Platform Event Service — 21-Point Completion Verification

✓ EventEnvelope frozen
✓ EventRegistry frozen
✓ EventPublisher
✓ EventSubscriber
✓ IEventTransport frozen
✓ MemoryTransport
✓ EventSerializer
✓ RetryPolicy
✓ DeadLetterPolicy
✓ Idempotency contract
✓ Duplicate detection
✓ Tenant isolation
✓ Correlation ID
✓ Causation ID
✓ Version compatibility (version vs schemaVersion)
✓ Actor ID tracing
✓ 100% Stage 4 tests green (9/9 passed)
✓ SDK compatibility (TypeScript interfaces src/kernel/events.ts)
✓ Platform TestKit
✓ No infrastructure dependency (pure standard library + pydantic + asyncio)
✓ No business-module dependency (pure platform kernel contract)
✓ No direct NATS/Kafka/RabbitMQ dependency

Stores Retirement Verification (v1454)
✓ Gate 1 (Zero Rows): smriti001 stores (0 rows), user_store_assignments (0 rows)
✓ Gate 2 (Zero Write Paths): Code decoupled in staff.py, system.py, masters.py
✓ Gate 3 (FK Severance): staff_placement_assignments_internal_store_id_fkey dropped
✓ Gate 4 (DDL Archive & Rollback): docs/archive/stores_phase_b_archive_v4.17.0.sql verified; downgrade() test passed
✓ Gate 5 (Full Regression Green): 17/17 test suite passed green

Evidence Level: Level A (Directly Observable PostgreSQL & Pytest Execution)
```

---

## 10. Known Limitations

1. **Transactional Outbox Background Poller:** `IEventOutbox` is declared as an interface contract in Stage 4. The distributed asynchronous polling daemon (`OutboxWorker`) remains scheduled for subsequent platform infrastructure phases.
2. **Compatibility Projection Latency:** Until consumers reading `products`, `customers`, and `suppliers` are migrated directly to `items` and `parties`, projection sync hooks must run synchronously during writes.

---

## 11. Future Work

1. **Stage 5 Notification Service Integration:** Wire `NotificationService` as a consumer of Stage 4 platform events (`billing.invoice.issued` $\rightarrow$ email/SMS delivery).
2. **Outbox Worker Engine:** Implement `PostgresEventOutbox` executing `SELECT ... FOR UPDATE SKIP LOCKED` on `integration_outbox_events` and publishing via `PlatformEventService`.
3. **Consumer Migration Phases:** Systematically repoint legacy foreign keys on `sales_invoice_items`, `stock_movements`, and `purchase_order_items` to canonical `items.id` and `parties.id`.

---

## 12. Related ADRs

- `docs/adr/ADR-005-One-Way-Canonical-Master-To-Compatibility-Projection-Architecture.md`
- `docs/adr/ADR-POS-002-ShiftC.md`
- `docs/implementation/purchase/Vendor_360_Universal_Party_Canonical_Architecture_v1.0.0.md` (ADR-001, ADR-004)

---

## 13. Related RFCs

- `RFC-PLAT-004: Stage 4 Platform Event Service Architecture`
- `RFC-DATA-002: Master Data Consolidation and Legacy Store Deprecation`
