<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.18.0
  Created      : 2026-07-14
  Modified     : 2026-07-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Architectural Debt Registry

This log tracks architectural debt, compromises, and design gaps discovered during major directives or refactoring. Every entry details the debt description, tracking ID, associated impact, and planned resolution.

| ID | Module / Component | Debt Description | Architecture Impact | Planned Resolution Version | Status |
|---|---|---|---|---|---|
| **DEBT-001** | Tenant / Auth | Seeded default users (`super`, `manager`, `cashier`) lack company and branch associations in database. | Triggers HTTP 403 authorization failures on all FastAPI tenant-scoped endpoints unless bootstrapped. | v3.18.0 (Pre-flight 0) | Resolved |
| **DEBT-002** | Frontend / App | Callers request three non-existent endpoints: `/api/ufe/fields`, `/api/formulas`, `/api/psv/parties`. | Logs console 404 network warnings on every screen initialization. | v3.18.0 (Pre-flight 1) | Resolved |
| **DEBT-003** | Sales Model | `SalesInvoiceItem` extends SQLAlchemy `Base` model directly instead of `BaseEntity`. | Inconsistent column properties (missing auditing audit trails like `created_by`, `updated_by`). | v3.18.0 (Phase 1 Audit) | Tracked |
| **DEBT-004** | Tenant Models | `Company` and `Branch` models do not extend `BaseEntity` (missing standard soft-delete fields and version tracking). | Hand-rolled columns, inconsistent soft-delete schema. | Deferred (Future Tenant Upgrade) | Open |
| **DEBT-005** | General Ledger | Accounts Ledger vouchers API routes `/api/ledger` are stubbed inside Express memory stores. | Financial audits cannot be integrated against postgres transactional history. | Master Command 3 (Accounting) | Open |
