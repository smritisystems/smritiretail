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
  Classification: System Architecture Implementation Plan — Stage 5.2
-->

# Stage 5.2: First Domain Writer Integration (Sales Ledger to Platform Event Kernel)

**Plan ID:** IP-ARCH-009  
**Version:** v6.27.2  
**Date:** 2026-09-16  
**Area:** Foundation / Platform Events / Domain Integration  
**Status:** In Progress  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  

---

## 1. Objective
Wire the first canonical domain writer (`UnifiedSalesLedgerService.post_sales_invoice` / `CanonicalSalesWriter`) to the frozen Stage 5.1 `PlatformEventService` transactional outbox kernel. Ensure that invoice creation and cancellation stage contract-first `EventEnvelope` records within the caller's active database transaction.

## 2. Business Motivation
Prevent dual-write inconsistencies between domain sales financial records and asynchronous downstream subscribers (GST e-invoicing, analytics, notifications, customer alerts) by establishing an immutable, transactional event audit trail at the point of invoice confirmation.

## 3. Scope
- Instrument `UnifiedSalesLedgerService.post_sales_invoice` to call `PlatformEventService.stage_event` with `sales.invoice.confirmed` (v1.0).
- Instrument `UnifiedSalesLedgerService.cancel_sales_invoice` to call `PlatformEventService.stage_event` with `sales.invoice.cancelled` (v1.0).
- Establish `CanonicalSalesWriter = UnifiedSalesLedgerService` canonical alias.
- Implement 4-point verification suite (`test_stage5_2_domain_writer_integration.py`).

## 4. Current State
`UnifiedSalesLedgerService.post_sales_invoice` calls `OutboxService.record_event(...)`, which creates unversioned `IntegrationOutboxEvent` records directly without contract registry validation or typed `EventEnvelope` encapsulation.

## 5. Gap Analysis
| Aspect | Current State | Target State (Stage 5.2) |
| :--- | :--- | :--- |
| **Event Model** | Raw un-typed payload dict | Typed, validated `EventEnvelope[Dict[str, Any]]` |
| **Schema Validation**| None | Pre-validated against `EventRegistry` |
| **Session Control** | Implicit | Explicit caller `AsyncSession` ownership |
| **Worker Ingestion**| Legacy custom polling | `PlatformOutboxWorker` with `SKIP LOCKED` |

## 6. Architecture Impact
Transitions the sales domain from ad-hoc database queue insertion to the enterprise `PlatformEventService` facade. Maintains strict tenant isolation and ACID atomicity.

## 7. Proposed Design
```text
UnifiedSalesLedgerService.post_sales_invoice()
        │
        ├── 1. Validate & Create SalesInvoice
        ├── 2. Create StockMovement (OUTWARD_SALE)
        ├── 3. Deduct Batch & Master Inventory
        │
        └── 4. PlatformEventService.stage_event(envelope, session)
                 │
                 ├── Validate schema: sales.invoice.confirmed (v1.0)
                 └── PostgresEventOutbox.stage(envelope, session)
                           │
                           └── session.add(IntegrationOutboxEvent)
                                     │
                        Caller session.commit()
```

## 8. Files Created
- `backend/tests/test_stage5_2_domain_writer_integration.py`
- `docs/implementation/foundation/Stage5_2_First_Domain_Writer_Integration_v6.27.2.md`
- `docs/walkthrough/architecture/Stage5_2_First_Domain_Writer_Integration_v6.27.2.md`

## 9. Files Modified
- `backend/app/platform/events/service.py`
- `backend/app/platform/events/__init__.py`
- `backend/app/services/sales_ledger_svc.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- Frozen Stage 5.1 Platform Event Kernel (`IEventOutbox`, `PostgresEventOutbox`, `PlatformOutboxWorker`).
- PostgreSQL multi-tenant database (`smriti001`).

## 11. Risks
- *Risk:* Breaking legacy tests expecting raw payload dictionary structure.
- *Mitigation:* Ensure `EventSerializer` and outbox record payload maintains root key compatibility.

## 12. Rollback Strategy
Git revert to frozen Stage 5.1 commit (`v6.27.1`).

## 13. Verification Plan
- Verify atomic commit: `SalesInvoice` + outbox event both exist.
- Verify atomic rollback: Neither entity exists on transaction abort.
- Verify business logic: Totals, GST, batch stock movements 100% identical.
- Verify worker consumption: `PlatformOutboxWorker` transitions record to `DISPATCHED`.

## 14. Test Plan
Run `python -m pytest backend/tests/test_stage5_2_domain_writer_integration.py -v`.

## 15. Documentation Impact
Walkthrough creation, CHANGELOG entry for `v6.27.2`, master index table update.

## 16. Deployment Plan
Commit and push to `smritiNX` development branch.

## 17. Status
In Progress

## 18. Related ADRs
- `ADR-005-One-Way-Canonical-Master-To-Compatibility-Projection-Architecture.md`

## 19. Related Walkthroughs
- `docs/walkthrough/architecture/Stage5_Transactional_Postgres_Outbox_Engine_And_Worker_Daemon_v6.27.0.md`
