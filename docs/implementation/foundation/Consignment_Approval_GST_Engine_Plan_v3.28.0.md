<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.28.0
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Consignment & Sale on Approval GST Engine Refinement -- v3.28.0

## 1. Objective
Refactor and genericize the stock consignment and approval dispatch workflows in SMRITI Retail OS. Transition from independent, hardcoded voucher types (Consignment Transfer, Sale on Approval) to a unified **Stock Dispatch Engine** powered by a configurable **GST Rule Engine** and status monitoring lifecycle.

## 2. Business Motivation
Compliance with Indian GST rules (particularly Schedule I for Consignment Transfers and the 180-day monitoring timeline for Sale on Approval dispatches) demands structural traceability. Hardcoding individual voucher types leads to code duplication. A unified Dispatch Engine allows branching rules for Normal sales, consignment dispatches, branch transfers, job work, and samples with low technical debt.

## 3. Scope
- **Unified Dispatch Engine:** Support `StockDispatch` and `StockDispatchLine` models.
- **GST Rule Engine:** Configure tax triggers, invoice requirements, and limits (e.g. 180 days).
- **180-Day Lifecycle Scheduler:** Integrated cron/scheduler monitoring approval age and alerting at intervals (Day 150, 165, 175, 180).
- **Audit Trails:** Record user, quantity, timestamps, IP, and reason for all actions.
- **Notification Engine:** Unified routing stub delivering alerts to Dashboard, Email, WhatsApp, and SMS.
- **GSTR-1 Export Engine:** Decouple tax export generation from active transactional sales databases.

## 4. Current State
- `backend/app/models/consignment.py` implements dedicated `ConsignmentTransfer` and `ConsignmentReturn` models.
- Explicit status workflows are hardcoded in services.

## 5. Gap Analysis
- No unified `StockDispatch` abstraction; Normal, Consignment, and Approval flows are separated.
- 180-day monitoring time limit warnings are unimplemented.
- Hardcoded GST checks are present in code paths.

## 6. Architecture Impact
```text
Stock Dispatch Engine
         │
         ▼
    Dispatch Type (Normal | Consignment | Approval | Job Work | Branch)
         │
         ▼
   GST Rule Engine
         │
         ▼
  Workflow Engine (Draft -> Dispatched -> Pending -> Approved -> Returned -> Closed)
         │
         ▼
  Scheduler (180-day time monitoring)
         │
         ▼
  Notification / Accounting / GST Export Engines
```

## 7. Proposed Design
1. **Unified Schema:**
   - `stock_dispatches` (id, dispatch_no, dispatch_type, partner_id, status, totals).
   - `stock_dispatch_lines` (qty_sent, qty_invoiced, qty_returned, qty_on_hand).
   - `dispatch_approval_events` (audit logs recording timestamps, quantities, and IP).
2. **GST Rule Engine Config:**
   - Map Dispatch Type -> `invoice_required_at_dispatch` (True for Consignment, False for Approval).
   - Map Dispatch Type -> `tax_timing` (Immediate vs. Deferred 180-days).
   - Map Dispatch Type -> `max_days_allowed` (e.g. 180 days).

## 8. Files Created
- `backend/app/models/dispatch.py` -- [NEW] Unified Stock Dispatch models.
- `backend/app/services/dispatch_gst.py` -- [NEW] Configurable GST rule engine.

## 9. Files Modified
- `backend/app/main.py` -- Register new dispatch APIs.
- `src/App.tsx` -- Route to generic dispatch studio.

## 10. Dependencies
- Shared Numbering Engine
- Shared Workflow Engine
- Shared Event Bus

## 11. Risks
- Migration of existing `consignment_transfers` table data to the new unified `stock_dispatches` structure requires carefully mapped data conversion scripts.

## 12. Rollback Strategy
- Alembic database downgrades to restore dedicated consignment schemas.

## 13. Verification Plan
- Verification of GST rule resolution table matches via Python test assertions.

## 14. Test Plan
- `test_consignment_dispatch_immediate_tax`: Confirms immediate invoice generation.
- `test_approval_dispatch_deferred_tax`: Confirms challan dispatch with deferred tax timing.
- `test_180_day_scheduler_alert`: Confirms alerts triggered on Day 150, 165, 175, 180.

## 15. Documentation Impact
- Update Developer Guide and Walkthrough Index.

## 16. Deployment Plan
- Run migrations during offline system maintenance window.

## 17. Status
Draft (Awaiting User Review)

## 18. Related ADRs
- `ADR-009`: Strangler-Fig Migration Order

## 19. Related Walkthroughs
- `Consignment_And_CRM_Upgrades_Walkthrough_v3.27.0.md`
