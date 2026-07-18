<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.29.0
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Regulatory Engine (SRE) Implementation Plan -- v3.29.0

## 1. Objective
Implement the SMRITI Regulatory Engine (SRE) to decouple regulatory compliance from core inventory and sales transactions. SRE evaluates tax boundaries, logs compliance decisions in an audit ledger, monitors timelines for Sale on Approval, raises deemed supply tax events, and posts automatic journal entries to simplified accounting ledgers.

## 2. Business Motivation
Under the CGST Act 2017, dispatches to distinct persons across state boundaries trigger immediate tax liability, while intrastate Sale on Approval transfers have up to 180 days to invoice. SRE automates these regulatory boundaries dynamically.

## 3. Scope
- **SRE Core Service:** Exposes compliance decision routers (`sre_compliance_decisions` logging table) and handles state transitions.
- **Simplified Dispatch Workflow:**
  - Standard dispatches: `Draft -> Dispatched -> Pending -> Completed`.
  - Deferred/Approval dispatches: Rich compliance sub-states (`Deferred -> Warning -> Deemed Supply -> Returned -> Closed`).
- **Database Schema:** 4 tables (`corporate_gstin_registry`, `sre_rule_engine`, `sre_statutory_ledger`, `sre_compliance_decisions`).
- **Alembic Migration:** Add tables with `VARCHAR(50)` primary/foreign keys.
- **v1.0 Basic Accounting:** Support automatic silent journal entries for Sales, Purchases, Returns, Receipts, and Payments. Explicitly excludes enterprise accounting (cost centers, budgeting, posting previews, multi-level financial approvals).

## 4. Current State
- Compliance logic and tax timing computations are decentralized in separate modules.

## 5. Gap Analysis
- No centralized rule evaluator.
- No automated cron scheduler alerting for aging dispatches (Day 150, 165, 175, 180).
- Accounting schemas are in feature freeze in Express, requiring FastAPI integration.

## 6. Architecture Impact
```text
Inbound Stock Movement
          │
          ▼
   SRE Router (sre_service.py)
    ├── Rule Engine Evaluator (sre_compliance_decisions)
    └── State Machine (Standard vs. Compliance Workflows)
          │
          ├─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
   Immutable Ledger    Audit Trail    Auto Accounting Posts
```

## 7. Proposed Design
1. **Compliance Decision Table:**
   `sre_compliance_decisions` (id, dispatch_id, evaluated_rule, decision, reason, evaluated_at, engine_version).
2. **GST Registry:**
   `corporate_gstin_registry` (id, company_id, gstin, state_code, warehouse_name, is_active).
3. **State Machine:**
   If normal transfer, status progresses linearly. If Sale on Approval, status defaults to `Deferred` with warning thresholds computed via background sweeper.

## 8. Files Created
- `backend/app/models/sre.py`
- `backend/app/schemas/sre.py`
- `backend/app/services/sre/sre_service.py`
- `backend/app/api/v1/sre.py`
- `backend/alembic/versions/e6f7g8h9i0j1_add_sre_v3290.py`

## 9. Files Modified
- `backend/app/models/__init__.py`
- `backend/app/api/v1/__init__.py`
- `backend/app/main.py`

## 10. Dependencies
- Numbering Engine
- Accounting Service (Basic Journal Posts)

## 11. Risks
- Mapped locations failing to reference the correct GSTIN registry records. UI forms must enforce selection constraints.

## 12. Rollback Strategy
- Alembic downgrade to drop SRE tables.

## 13. Verification Plan
- Unit tests asserting tax timing decisions.

## 14. Test Plan
- `test_interstate_distinct_person_immediate_tax`
- `test_approval_intrastate_180_days_deferral`
- `test_deemed_supply_expiration_journal`

## 15. Documentation Impact
- Update Wiki and developer reference manuals.

## 16. Deployment Plan
- Upgrade DB schemas using `alembic upgrade head`.

## 17. Status
Draft (Awaiting User Review)

## 18. Related ADRs
- `ADR-009`: Strangler-Fig Migration Order

## 19. Related Walkthroughs
- —
