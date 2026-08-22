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

# Walkthrough: Vertical Slice 7 — Outbox and Analytics Plane

## 1. Purpose
Implement the Transactional Outbox Event Ledger (`outbox_events`) in the tenant data plane (`smritiXXX`) to guarantee 100% reliable, zero dual-write event staging during transactional commits, accompanied by an asynchronous locked event dispatcher (`SKIP LOCKED`) and an authoritative operational analytics query engine computing KPIs directly from PostgreSQL ledgers.

---

## 2. Scope
- **Tenant Data Plane (`smritiXXX`) Outbox Ledger**: Canonical `OutboxEvent` capturing domain events (`INVOICE_CONFIRMED`, `STOCK_ADJUSTED`, `PAYMENT_SETTLED`, `APPROVAL_DECISION`) inside active database transactions.
- **Asynchronous Concurrent Dispatch Engine**: Worker queue polling with `SELECT ... FOR UPDATE SKIP LOCKED` preventing collision or double-processing.
- **Authoritative Operational Analytics Plane**: Real-time KPI summaries (confirmed revenue, invoice counts, stock movements, settled payment volumes, pending outbox queues) queried directly against PostgreSQL system-of-record ledgers.
- **Strict Physical Tenancy**: Outbox events and operational metrics strictly isolated per company database.

---

## 3. Files Created
1. `backend/app/models/outbox.py`: Canonical `OutboxEvent` and backward-compatible `IntegrationOutboxEvent` models.
2. `backend/app/services/unified_outbox_analytics_service.py`: Domain service handling atomic outbox event staging, locked batch dispatching, and operational KPI aggregations.
3. `backend/tests/test_unified_outbox_analytics.py`: Automated verification suite certifying event staging, locked batch processing, analytics metrics, and tenant isolation.
4. `docs/implementation/foundation/Platform_Refactor_Slice7_Outbox_Analytics_Plan_v1.0.md`: Master 19-section implementation plan for Slice 7.

---

## 4. Files Modified
1. `backend/app/models/__init__.py`: Exported Outbox models.
2. `docs/implementation/README.md`: Appended Slice 7 implementation plan to master index.
3. `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`: Updated platform tracker with verified Slice 7 status.
4. `docs/walkthrough/README.md`: Appended Slice 7 walkthrough to chronological master index.

---

## 5. Architecture Decisions
- **ADR-012: Transactional Outbox Pattern**: External streaming or audit dispatch must never participate in distributed 2PC transactions. Events must be written to `outbox_events` in the same local ACID transaction as the business entity and published asynchronously.
- **ADR-013: Authoritative Single-Source Analytics**: Real-time operational metrics derive exclusively from PostgreSQL ledgers (`sales_invoices`, `payment_transactions`, `stock_movements`) rather than unverified cache approximations.

---

## 6. Design Rationale
Decoupling domain event capture from downstream messaging ensures that API requests succeed with zero latency penalty and zero risk of orphaned database changes if an external messaging broker is unreachable.

---

## 7. Implementation Summary
- **Transactional Staging**:
  - `stage_outbox_event()` registers `OutboxEvent` instances in `PENDING` state within the caller's active database transaction.
- **Locked Batch Dispatching**:
  - `dispatch_pending_outbox_events()` grabs batches of events with `with_for_update(skip_locked=True)`, transitions status to `DISPATCHED`, and records `dispatched_at` timestamps.
- **Authoritative Operational Aggregation**:
  - `get_authoritative_operational_summary()` performs real-time SQL aggregations over confirmed invoices, payments, stock movements, and pending outbox queues.

---

## 8. Tests Executed
1. `backend/tests/test_unified_outbox_analytics.py`:
   - `test_transactional_outbox_event_staging_and_persistence` (Passed)
   - `test_locked_batch_outbox_event_dispatch` (Passed)
   - `test_authoritative_operational_analytics_summary` (Passed)
   - `test_outbox_and_analytics_tenant_isolation` (Passed)
2. Full Multi-Module Regression Suite:
   - 89/89 automated tests passed in 40.62s across Routing Boundary, Tenant DB Provisioning, Menu Governance, Security Access, WMS Phases 1–4, Slice 2 Universal Party/Item Masters, Slice 3 Sales/POS & Stock Ledger, Slice 4 Pricing/Payments, Slice 5 Approvals/Communicator, Slice 6 Capabilities/Workspaces, and Slice 7 Outbox/Analytics.

---

## 9. Verification Results

```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 89 items

backend\tests\test_unified_outbox_analytics.py ....                      [  4%]
backend\tests\test_unified_workspace_capability.py ....                  [  8%]
backend\tests\test_unified_approval_communicator.py ....                 [ 13%]
backend\tests\test_unified_pricing_payment_engine.py ....                [ 17%]
backend\tests\test_unified_sales_ledger.py ....                          [ 22%]
backend\tests\test_universal_party_master.py ...                         [ 25%]
backend\tests\test_universal_item_master.py ...                          [ 29%]
backend\tests\test_routing_boundary_canonical.py .............           [ 43%]
backend\tests\test_company_db_runtime_routing.py .......                 [ 51%]
backend\tests\test_company_db_naming_convention.py ......                [ 58%]
backend\tests\test_get_company_db_wiring.py .....                        [ 64%]
backend\tests\test_multi_company_database_architecture.py ......         [ 70%]
backend\tests\test_company_db_provisioning.py .....                      [ 76%]
backend\tests\test_menu_governance.py .                                  [ 77%]
backend\tests\test_security_menu_access.py ..                            [ 79%]
backend\tests\test_wms_phase1.py ....                                    [ 84%]
backend\tests\test_wms_phase2_grn_sales.py ...                           [ 87%]
backend\tests\test_wms_phase3_eway_bill.py .....                         [ 93%]
backend\tests\test_wms_phase4_audit_reconciliation.py ......             [100%]

======================= 89 passed, 1 warning in 40.62s ========================
```

---

## 10. Known Limitations
- High-throughput streaming forwarders (e.g. Debezium / Kafka Connect CDC) can be layered on top of `outbox_events` table in production clustering.

---

## 11. Future Work
- Continuous platform integration and external ecosystem bridges.

---

## 12. Related ADRs
- `ADR-001`: Multi-Company Database Architecture.
- `ADR-012`: Transactional Outbox Pattern & Authoritative Analytics Plane.

---

## 13. Related RFCs
- `RFC-014`: Transactional Outbox Event Ledger and Single-Source Operational Analytics.
