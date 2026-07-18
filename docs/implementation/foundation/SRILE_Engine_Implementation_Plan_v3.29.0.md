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

# Statutory & Regulatory Inventory Ledger Engine (SRILE) Implementation Plan -- v3.29.0

## 1. Objective
Implement the Statutory & Regulatory Inventory Ledger Engine (SRILE) in SMRITI Retail OS. SRILE intercepts stock movements, executes tax boundary checks (intrastate vs. interstate distinct person rules), monitors the 180-day Sale on Approval compliance window, triggers deemed supply taxation, and generates immutable audit records.

## 2. Business Motivation
Under the CGST Act 2017:
- Goods dispatched to a distinct person across state boundaries trigger immediate GST liability (Sec 25(4)).
- Goods sent on approval must be taxed on the 181st day if not returned or approved (Sec 31(7)).
SRILE automates these time limits to shield the business from compliance penalties and automate ledger corrections.

## 3. Scope
- **Database Schema:** 4 tables (`corporate_gstin_registry`, `srile_rule_engine`, `srile_statutory_ledger`, `srile_audit_history`).
- **Alembic Migration:** Run script creating tables with correct foreign keys.
- **Hexagonal Core Service:** Async Python service under `backend/app/services/srile/`.
- **Nightly Compliance Scan:** Background job scanning for expired lots and triggering Deemed Supply events.
- **REST Endpoints:** Expose dispatches logs, rules, and settlements.

## 4. Current State
- Dispatches are recorded on a per-module basis without unified tax boundary checks or deferred compliance schedulers.

## 5. Gap Analysis
- No multi-GSTIN registry or corporate boundary checks.
- Lack of immutable audit records matching Indian MCA standards.
- Absence of 180-day deemed supply automated billing triggers.

## 6. Architecture Impact
```text
Inbound Dispatch Event
          │
          ▼
   SRILE Service (backend/app/services/srile/)
    ├── State Machine (Validates Transition)
    ├── Boundary Router (Checks GSTIN State Codes)
    └── Rule Engine (Deferred vs. Immediate Taxing)
          │
          ├───────────────┼───────────────┐
          ▼               ▼               ▼
   Immutable Ledger   Audit Logs   Outbound Events (GST / Acc)
```

## 7. Proposed Design
1. **Schema Definition:**
   - `corporate_gstin_registry` (id, company_id, gstin, state_code, warehouse_name, is_active).
   - `srile_rule_engine` (id, dispatch_type, tax_timing, max_deferral_days, warning_buffer_days, required_document_type).
   - `srile_statutory_ledger` (id, sku, batch_no, origin_gstin_id, destination_gstin, total_qty, approved_qty, returned_qty, unit_cost, gst_rate, tax_type_applied, statutory_state, dispatch_date, expiry_date).
   - `srile_audit_history` (id, ledger_id, event_type, quantity_changed, linked_document_no, executed_by_user_id, ip_address, timestamp).
2. **Core Ingestion Flow:**
   - Resolve origin and destination state codes.
   - If interstate, force immediate taxation.
   - If intrastate and deferred (Sale on Approval), log to statutory ledger and calculate `expiry_date = dispatch_date + max_deferral_days`.

## 8. Files Created
- `backend/app/models/srile.py`
- `backend/app/schemas/srile.py`
- `backend/app/services/srile/srile_service.py`
- `backend/app/api/v1/srile.py`
- `backend/alembic/versions/e6f7g8h9i0j1_add_srile_v3290.py`

## 9. Files Modified
- `backend/app/models/__init__.py`
- `backend/app/api/v1/__init__.py`
- `backend/app/main.py`

## 10. Dependencies
- Numbering Engine (`backend/app/services/numbering.py`)
- Accounting Service (`backend/app/services/accounting.py`)

## 11. Risks
- Mismatched GSTIN state codes during manual user entry may trigger incorrect interstate dispatches. String format regex checking must be enforced at API entry points.

## 12. Rollback Strategy
- Alembic database downgrades to drop SRILE tables.

## 13. Verification Plan
- Unit tests validating the tax boundary router matching algorithms.

## 14. Test Plan
- `test_intrastate_deferral`: Assert `statutory_state` is set to `TAX_DEFERRED`.
- `test_interstate_distinct_person`: Assert interstate transfers trigger immediate taxation.
- `test_nightly_compliance_scan_alerts`: Validate cron sweeper flags expired dispatches.

## 15. Documentation Impact
- Update Walkthroughs index and GSTR-1 compliance manuals.

## 16. Deployment Plan
- Run Alembic migrations on target staging environment.

## 17. Status
Draft (Awaiting User Review)

## 18. Related ADRs
- `ADR-009`: Strangler-Fig Migration Order

## 19. Related Walkthroughs
- —
