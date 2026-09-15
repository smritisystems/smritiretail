<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.27.2
  Created      : 2026-09-16
  Modified     : 2026-09-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: System Architecture Walkthrough — Stage 5.2
-->

# Stage 5.2: First Domain Writer Integration (Sales Ledger to Platform Event Kernel)

**Walkthrough ID:** WLK-ARCH-009  
**Version:** v6.27.2  
**Date:** 2026-09-16  
**Sprint:** Platform Kernel Stage 5.2 & Phase A Domain Writer Convergence  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  

---

## 1. Purpose
Verify the integration of the first canonical domain writer (`UnifiedSalesLedgerService.post_sales_invoice` / `CanonicalSalesWriter`) with the frozen Stage 5.1 `PlatformEventService` transactional outbox kernel. This implements Phase A of the controlled domain writer rollout policy, establishing atomic transaction coupling between business invoicing and outbox event staging.

---

## 2. Scope
| Area | Component | Action | Verification |
| :--- | :--- | :--- | :--- |
| **Domain Writer** | `app.services.sales_ledger_svc` | Modified | `UnifiedSalesLedgerService.post_sales_invoice` stages `sales.invoice.confirmed` via `PlatformEventService` |
| **Cancellation Writer** | `app.services.sales_ledger_svc` | Modified | `UnifiedSalesLedgerService.cancel_sales_invoice` stages `sales.invoice.cancelled` via `PlatformEventService` |
| **Service Accessor** | `app.platform.events.service` | Modified | Added `get_platform_event_service()` singleton factory with pre-registered schemas |
| **Registry Normalization** | `app.platform.events.registry` | Modified | Case & dot-normalized lookup supporting legacy and canonical schemas |
| **Test Suite** | `backend/tests/test_stage5_2_domain_writer_integration.py` | Created | 5/5 Pytest tests passing green (26/26 combined platform suite) |

---

## 3. Files Created
| File | Purpose |
| :--- | :--- |
| `backend/tests/test_stage5_2_domain_writer_integration.py` | 5-point verification suite proving commit, rollback, logic preservation, worker dispatch, and cancellation |
| `docs/implementation/foundation/Stage5_2_First_Domain_Writer_Integration_v6.27.2.md` | IPGP implementation plan |
| `docs/walkthrough/architecture/Stage5_2_First_Domain_Writer_Integration_v6.27.2.md` | This WGP walkthrough |

---

## 4. Files Modified
| File | Changes Made |
| :--- | :--- |
| `backend/app/services/sales_ledger_svc.py` | Replaced legacy `OutboxService.record_event` with `PlatformEventService.stage_event(envelope, session)`; exported `CanonicalSalesWriter` alias |
| `backend/app/platform/events/service.py` | Added `get_platform_event_service()` factory with default registrations |
| `backend/app/platform/events/__init__.py` | Exported `get_platform_event_service` |
| `backend/app/platform/events/registry.py` | Enhanced `is_registered` and `is_compatible` with normalized schema lookup |
| `backend/app/platform/events/postgres_outbox.py` | Added root payload backward compatibility and metadata `event_type` override |
| `backend/app/platform/events/serializer.py` | Filtered known fields in `from_dict` for resilient `EventEnvelope` reconstruction |
| `backend/app/platform/events/outbox_worker.py` | Added `process_batch` alias for `run_cycle` |
| `CHANGELOG.md` | Recorded Stage 5.2 milestone |
| `docs/implementation/README.md` | Registered Stage 5.2 implementation plan |
| `docs/walkthrough/README.md` | Registered this walkthrough |

---

## 5. Architecture Decisions
1. **Contract-First Staging in Domain Transaction:** `post_sales_invoice` and `cancel_sales_invoice` construct strongly-typed `EventEnvelope` instances validated against `EventRegistry` and stage them inside the caller's active `AsyncSession` prior to `session.commit()`.
2. **Backward-Compatible Stored Payload:** `PostgresEventOutbox.stage()` merges envelope payload attributes at the root of `payload_json`, ensuring legacy reports and queries expecting `payload_json["invoice_no"]` continue working without modification.
3. **Canonical Alias Parity:** Formally declared `CanonicalSalesWriter = UnifiedSalesLedgerService` to align domain implementation with platform architectural naming standards.

---

## 6. Design Rationale
- **Controlled Blast Radius:** Starting domain event staging exclusively with `post_sales_invoice` (Phase A) allows deep observation of PostgreSQL outbox behavior under invoice traffic before expanding to WMS and POS Cashier modules (Phase B & C).
- **Single Source of Truth:** `EventRegistry` validates that schema version `1.0` matches the registered specification before any outbox row is staged, preventing schema drift at runtime.

---

## 7. Implementation Summary
```text
post_sales_invoice(session, company_id, invoice_no, customer_id, items_data, ...)
       │
       ├── Insert SalesInvoice + Items
       ├── Post StockMovement (OUTWARD_SALE)
       ├── Decrement Inventory & Batch Stock
       │
       └── PlatformEventService.stage_event(envelope, session)
                 │
                 ├── Validate schema: sales.invoice.confirmed (v1.0)
                 └── PostgresEventOutbox.stage(envelope, session)
                           │
                           └── session.add(IntegrationOutboxEvent)
                                     │
                        await session.commit()
```

---

## 8. Tests Executed

### Test Suite 1: Stage 5.2 Domain Writer Integration (`test_stage5_2_domain_writer_integration.py`)
```powershell
python -m pytest backend/tests/test_stage5_2_domain_writer_integration.py -v
```
Literal output:
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 5 items

backend\tests\test_stage5_2_domain_writer_integration.py::test_criterion_1_successful_invoice_atomically_commits_invoice_and_outbox PASSED [ 20%]
backend\tests\test_stage5_2_domain_writer_integration.py::test_criterion_2_invoice_rollback_discards_both_invoice_and_outbox PASSED [ 40%]
backend\tests\test_stage5_2_domain_writer_integration.py::test_criterion_3_existing_invoice_calculations_and_inventory_movements_preserved PASSED [ 60%]
backend\tests\test_stage5_2_domain_writer_integration.py::test_criterion_4_event_worker_consumes_and_dispatches_staged_sales_event PASSED [ 80%]
backend\tests\test_stage5_2_domain_writer_integration.py::test_criterion_5_cancel_sales_invoice_atomically_stages_cancellation_event PASSED [100%]

============================== 5 passed in 7.85s ==============================
```

### Test Suite 2: Combined 26-Test Platform Event & Domain Suite
```powershell
python -m pytest backend/tests/test_stage5_2_domain_writer_integration.py backend/tests/test_platform_event_service.py backend/tests/test_postgres_outbox_worker.py -v
```
Literal output:
```text
============================= 26 passed in 17.65s =============================
```

### Test Suite 3: Domain Sales Ledger Regression Suite
```powershell
python -m pytest backend/tests/t_sales_ledger.py backend/tests/t_outbox_stats.py -v
```
Literal output:
```text
======================= 13 passed, 4 warnings in 35.60s =======================
```

---

## 9. Verification Results

```text
Stage 5.2 Domain Writer Integration — 5-Point Acceptance Verification

✓ Criterion 1 (Successful Invoice Atomicity): Both SalesInvoice & Outbox Event committed
✓ Criterion 2 (Invoice Rollback Atomicity): Both entities discarded on transaction rollback
✓ Criterion 3 (Logic Preservation): Grand total, tax lines, & StockMovement entries unchanged
✓ Criterion 4 (Worker Ingestion): PlatformOutboxWorker claims and settles event to DISPATCHED
✓ Criterion 5 (Cancellation Atomicity): Cancelled status & cancellation event staged atomically

Evidence Level: Level A (Directly Observable PostgreSQL Catalog, Sales Tables & Pytest)
```

---

## 10. Known Limitations
1. **Single Domain Writer:** Only `sales_ledger_svc.py` is wired in Phase A. Other services (WmsService, PosCashier) remain on legacy queues until Phase B.

---

## 11. Future Work
1. **Stage 5.2 Phase B:** Expand domain writer staging to `WmsService.dispatch_stock` and `PosPaymentService.settle_payment`.
2. **Stage 6 (v6.28.0):** SMRITI Notification Service consuming outbox-dispatched events.

---

## 12. Related ADRs
- `ADR-005-One-Way-Canonical-Master-To-Compatibility-Projection-Architecture.md`

---

## 13. Related RFCs
- `RFC-PLAT-005: Transactional Outbox Worker Daemon Architecture`
- `RFC-PLAT-006: Domain Writer Outbox Convergence Policy`
