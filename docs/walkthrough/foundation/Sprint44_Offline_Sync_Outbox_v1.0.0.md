<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.60.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — Sprint 44: P2 Offline-First Foundation & Transactional Outbox Event Architecture

**Version:** `v1.0.0`  
**Area:** `foundation`  
**Module:** `Offline Sync / Conflict Engine / Transactional Outbox`  
**Certification Status:** `Done / Verified`  

---

## 1. Purpose
To certify Blueprint Section 10 across both architectural domains:
1. **Offline-First Synchronization & Conflict Resolution:** High-throughput edge POS transaction queueing, 5-tier domain-driven conflict resolution, price-at-sale preservation, retry storm idempotency, and Store Manager Reconciliation Queue triage.
2. **Transactional Outbox & Event Processing Architecture:** Atomic outbox event recording within business database transactions, non-blocking two-phase batch claims, exponential backoff, Dead-Letter Queue (`DLQ`) transitions, and multi-tenant worker cycle execution.

---

## 2. Scope
- Verification and hardening of `POSOfflineSyncQueue` model and schema fixtures across PostgreSQL tenant databases (`smriti001`, `smriti002`).
- Validation of `OfflineConflictResolutionEngine` 5-tier conflict resolution across sequential and concurrent soak loads.
- Validation of `OutboxService`, `UnifiedOutboxAnalyticsService`, and `OutboxQueueWorker` asynchronous event dispatch cycles.
- Execution of 19 automated integration and concurrent soak tests covering oversell, price drift, credit limits, retry storms, governance snapshot binding, transactional atomicity, rollback guarantees, and DLQ handling.

---

## 3. Files Created
1. `docs/walkthrough/foundation/Sprint44_Offline_Sync_Outbox_v1.0.0.md` — WGP Walkthrough for Sprint 44.

---

## 4. Files Modified
1. `backend/tests/t_conflict_res.py` — Updated Product fixture instantiations with mandatory `mrp`, `buying_price`, `cost_price`, and `hsn_code` attributes.
2. `backend/tests/t_soak_conflict.py` — Updated `seed_product` helper with mandatory Item Master pricing and HSN fields for concurrent soak runs.
3. `docs/architecture/BLUEPRINT_PENDING.md` — Certified Section 10 (Offline-First and Event Architecture) per Rule 11 with quantitative metrics and named mechanisms.
4. `docs/walkthrough/README.md` — Appended Sprint 44 walkthrough entry to the master index.
5. `CHANGELOG.md` — Documented Sprint 44 release notes for `v3.60.0`.

---

## 5. Architecture Decisions
1. **5-Tier Domain-Driven Conflict Resolution:** Offline mutations do not blindly overwrite server state. Invariants are evaluated across inventory stock thresholds (`allow_negative_stock`), customer credit limits, price book drift (preserving client price at point of sale), and immutable governance snapshot bindings.
2. **Reconciliation Queue Quarantine:** Transactions with unresolvable invariant breaches are quarantined into the Store Manager Reconciliation Queue (`NEEDS_REVIEW`) rather than silently dropped or crashing background sync workers.
3. **Atomic Outbox Recording:** `IntegrationOutboxEvent` records are written in the exact same database transaction as domain business mutations, completely eliminating dual-write failure hazards across intermittent networks.

---

## 6. Design Rationale
- Retail POS cashiers cannot halt checkouts when internet connectivity fluctuates. Offline transactions must be durably stored and replayed in FIFO sequence once network is restored.
- In multi-lane supermarket environments, concurrent sales of identical SKUs must be resolved deterministically without database deadlocks or negative stock errors crashing the sync daemon.
- By binding `governance_snapshot_id` to offline sales invoices, statutory GST calculations and historical discount rules remain 100% reproducible even if central rules change while terminals were offline.

---

## 7. Implementation Summary
- **Offline Sync & Reconciliation:** Implemented in `OfflineConflictResolutionEngine` and `OfflineSyncService`, exposed via `/api/v1/sync/push` and `/api/v1/sync/reconciliation-queue`.
- **Concurrency & Soak Testing:** Hardened `t_soak_conflict.py` verifying multi-terminal `asyncio.gather` concurrent resolution across 5 parallel async sessions and 20-cycle rolling loads.
- **Outbox Worker & Analytics:** Implemented two-phase claim dispatch in `UnifiedOutboxAnalyticsService` and multi-tenant cycle processing in `OutboxQueueWorker`.

---

## 8. Tests Executed
1. `backend/tests/t_conflict_res.py`:
   - `test_simultaneous_last_unit_sale_oversell_conflict` (PASSED)
   - `test_price_book_drift_preservation` (PASSED)
   - `test_customer_credit_limit_race` (PASSED)
   - `test_idempotent_retry_storm_deduplication` (PASSED)
   - `test_governance_rule_version_drift_binding` (PASSED)
   - `test_sync_reconciliation_queue_api_endpoint` (PASSED)
2. `backend/tests/t_outbox_stats.py`:
   - `test_real_domain_service_sales_invoice_outbox_atomicity` (PASSED)
   - `test_real_domain_service_sales_invoice_cancellation_outbox_atomicity` (PASSED)
   - `test_outbox_transaction_rollback_guarantee` (PASSED)
   - `test_outbox_dispatcher_two_phase_claim_and_retry_backoff` (PASSED)
   - `test_outbox_dead_letter_queue_transition` (PASSED)
   - `test_outbox_dispatcher_rejects_missing_callback` (PASSED)
   - `test_authoritative_operational_analytics_summary` (PASSED)
   - `test_outbox_and_analytics_tenant_isolation` (PASSED)
   - `test_outbox_queue_worker_multi_tenant_cycle` (PASSED)
3. `backend/tests/t_soak_conflict.py`:
   - `test_concurrent_oversell_asyncio_gather_5_terminals` (PASSED)
   - `test_concurrent_retry_storm_same_invoice_no_idempotency` (PASSED)
   - `test_concurrent_http_push_5_terminals_via_httpx_gather` (PASSED)
   - `test_sustained_rolling_load_20_cycles_two_terminals` (PASSED)

---

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
collected 19 items

tests/t_conflict_res.py::test_simultaneous_last_unit_sale_oversell_conflict PASSED [  5%]
tests/t_conflict_res.py::test_price_book_drift_preservation PASSED       [ 10%]
tests/t_conflict_res.py::test_customer_credit_limit_race PASSED          [ 15%]
tests/t_conflict_res.py::test_idempotent_retry_storm_deduplication PASSED [ 21%]
tests/t_conflict_res.py::test_governance_rule_version_drift_binding PASSED [ 26%]
tests/t_conflict_res.py::test_sync_reconciliation_queue_api_endpoint PASSED [ 31%]
tests/t_outbox_stats.py::test_real_domain_service_sales_invoice_outbox_atomicity PASSED [ 36%]
tests/t_outbox_stats.py::test_real_domain_service_sales_invoice_cancellation_outbox_atomicity PASSED [ 42%]
tests/t_outbox_stats.py::test_outbox_transaction_rollback_guarantee PASSED [ 47%]
tests/t_outbox_stats.py::test_outbox_dispatcher_two_phase_claim_and_retry_backoff PASSED [ 52%]
tests/t_outbox_stats.py::test_outbox_dead_letter_queue_transition PASSED [ 57%]
tests/t_outbox_stats.py::test_outbox_dispatcher_rejects_missing_callback PASSED [ 63%]
tests/t_outbox_stats.py::test_authoritative_operational_analytics_summary PASSED [ 68%]
tests/t_outbox_stats.py::test_outbox_and_analytics_tenant_isolation PASSED [ 73%]
tests/t_outbox_stats.py::test_outbox_queue_worker_multi_tenant_cycle PASSED [ 78%]
tests/t_soak_conflict.py::test_concurrent_oversell_asyncio_gather_5_terminals PASSED [ 84%]
tests/t_soak_conflict.py::test_concurrent_retry_storm_same_invoice_no_idempotency PASSED [ 89%]
tests/t_soak_conflict.py::test_concurrent_http_push_5_terminals_via_httpx_gather PASSED [ 94%]
tests/t_soak_conflict.py::test_sustained_rolling_load_20_cycles_two_terminals PASSED [100%]

======================= 19 passed, 9 warnings in 31.43s =======================
```
- SMRITI Naming Guard: `0 naming violations`.

---

## 10. Known Limitations
- Physical thermal receipt printing over LAN ESC/POS is simulated in tests via byte-stream validation; hardware verification requires connected hardware in physical environment.
- Outbox workers currently poll on fixed intervals; real-time push can be supplemented with PostgreSQL `LISTEN / NOTIFY` if sub-second latency is required.

---

## 11. Future Work
- Connect downstream consumers for Section 11 (Analytics & Intelligence Plane CDC) and Section 12 (Integration Hub / Compliance Gateways).
- Add browser IndexedDB local persistent store driver for the React frontend client layer.

---

## 12. Related ADRs
- `ADR-POS-002-ShiftC` — Shift Cash Reconciliation and Offline Deferral
- `ADR-004-Universal-Party-Master` — Universal Party Architecture

---

## 13. Related RFCs
- `RFC-010-Offline-Sync-Protocol` — Durable Edge Terminal Synchronization
- `RFC-011-Transactional-Outbox` — At-least-once Asynchronous Event Processing
