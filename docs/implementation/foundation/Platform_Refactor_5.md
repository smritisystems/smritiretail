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

# Implementation Plan: Vertical Slice 7 — Outbox and Analytics Plane

## 1. Objective
Implement the Transactional Outbox Event Ledger (`outbox_events`) in the tenant data plane (`smritiXXX`) to guarantee zero dual-write event publishing failures, coupled with an asynchronous outbox dispatcher and authoritative operational analytics reporting derived directly from system-of-record ledgers.

---

## 2. Business Motivation
When transactional operations occur (such as confirming a sales invoice or receiving inventory), external downstream consumers (analytics dashboards, ERP integrations, audit feeds) must receive events reliably without risking data loss if external messaging brokers are temporarily unreachable. Writing domain events atomically into the database within the business transaction unit of work guarantees 100% reliable asynchronous dispatch.

---

## 3. Scope

### In-Scope
1. **Transactional Outbox Event Ledger (`outbox_events`)**:
   - Atomic domain event capture within transactional boundaries (`INVOICE_CONFIRMED`, `STOCK_ADJUSTED`, `PAYMENT_SETTLED`, `APPROVAL_DECISION`).
   - Fields: `event_type`, `aggregate_type`, `aggregate_id`, `payload` (JSONB), `status` (`PENDING`, `DISPATCHED`, `FAILED`), `retry_count`.
2. **Asynchronous Outbox Dispatch Engine**:
   - Worker polling with `SELECT ... FOR UPDATE SKIP LOCKED` for concurrent safe dispatch.
   - Idempotent delivery tracking and status updating.
3. **Authoritative Operational Analytics Engine**:
   - Real-time revenue aggregation, tender volume breakdown, and stock movement velocity computed directly from `sales_invoices`, `payment_transactions`, and `stock_movements`.
4. **Tenant Isolation**:
   - All outbox events and analytical aggregations remain strictly scoped to individual tenant databases (`smritiXXX`).

### Out-of-Scope (Deferred)
- External Kafka / RabbitMQ cluster brokers (dispatched via abstract stream adapter).
- Predictive data modeling (PDT) and machine learning forecasting against unpopulated production data.

---

## 4. Current State
- Domain events were previously emitted in-memory or logged without guaranteed transactional persistence.
- Analytics calculations lacked a standardized transactional outbox backbone.

---

## 5. Gap Analysis
| Dimension | Current State | Target Architecture (Slice 7) |
| :--- | :--- | :--- |
| **Event Reliability** | In-memory/Ad-hoc | Transactional Outbox table (`outbox_events`) within DB commit |
| **Concurrency Safety** | Risk of double-processing | Row-locked dispatch (`SKIP LOCKED`) |
| **Analytics Truth** | UI ad-hoc counts | Aggregations computed directly against authoritative Postgres ledgers |
| **Data Plane Boundary** | Tenant DB | Strictly tenant data plane (`smritiXXX`) |

---

## 6. Architecture Impact
- **Guaranteed Event Delivery**: If a database transaction commits, its corresponding domain event is guaranteed to be recorded and eventually dispatched.
- **Authoritative Metrics**: Dashboard metrics derive strictly from `stock_movements` and `sales_invoices`, preventing competing truth drift.

---

## 7. Proposed Design

### A. Outbox Model (`backend/app/models/outbox.py`)
```sql
CREATE TABLE IF NOT EXISTS outbox_events (
    id VARCHAR(50) PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL DEFAULT gen_random_uuid()::text,
    company_id VARCHAR(50),
    branch_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(100),
    version INTEGER DEFAULT 1,

    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    dispatched_at TIMESTAMP WITH TIME ZONE
);
```

---

## 8. Files Created
- `backend/app/models/outbox.py`: Canonical `OutboxEvent` model.
- `backend/app/services/outbox_analytics.py`: Domain service handling atomic outbox event staging, locked batch dispatching, and authoritative operational analytics summaries.
- `backend/tests/t_outbox_stats.py`: Automated verification suite certifying transactional outbox staging, locked batch processing, analytics metrics, and tenant isolation.
- `docs/implementation/foundation/Platform_Refactor_5.md`: This implementation plan.

---

## 9. Files Modified
- `backend/app/models/__init__.py`: Export Outbox models.
- `docs/implementation/README.md`: Append Slice 7 plan to master index.
- `docs/architecture/PLATFORM.md`: Track Slice 7 verification.

---

## 10. Dependencies
- Vertical Slice 3: Sales, POS, and Operational Stock Ledger.
- Vertical Slice 4: Pricing, Payments, and Document Sequences.

---

## 11. Risks
| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| Outbox table bloat under high transaction volume | Medium | Introduce housekeeping archive purge for dispatched events older than 30 days |
| Concurrent worker dispatch collisions | High | Use `SELECT ... FOR UPDATE SKIP LOCKED` |

---

## 12. Rollback Strategy
Additive DDL tables. If rollback is required, business operations proceed normally while outbox events remain unpolled.

---

## 13. Verification Plan
1. Test transactional outbox event insertion during sales invoice confirmation.
2. Test locked batch dispatching transitioning events to `DISPATCHED`.
3. Test operational analytics queries for daily sales, tender breakdowns, and stock velocity.
4. Verify tenant isolation between `smriti001` and `smriti002`.

---

## 14. Test Plan
- Run `backend/tests/t_outbox_stats.py` (Atomicity, Rollback, Callback Dispatcher, DLQ, Operational KPIs, Tenant Isolation).
- Run full platform test suite (`t_route_boundary.py` through `t_outbox_stats.py`).

---

## 15. Documentation Impact
- Update `docs/architecture/PLATFORM.md`.
- Update Walkthrough `docs/walkthrough/foundation/Platform_Outbox.md`.
- Update `docs/walkthrough/README.md`.

---

## 16. Deployment Plan
1. Apply Alembic migration `v1342_canonical_outbox` to all tenant databases (`alembic -x db=smritiXXX upgrade head`).
2. Deploy consolidated outbox models and domain services (`OutboxService`, `UnifiedOutboxAnalyticsService`).
3. Validate automated test suite execution.

---

## 17. Status
**Partially Verified — Canonical Outbox Consolidated, Alembic Migration Verified, Operational KPI Service Active**

---

## 18. Related ADRs
- `ADR-001`: Multi-Company Database Architecture.
- `ADR-012`: Transactional Outbox Pattern & Authoritative Operational Analytics.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Platform_Outbox.md`.

