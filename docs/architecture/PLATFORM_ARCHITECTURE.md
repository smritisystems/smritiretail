<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.27.0
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Platform Architecture Reference
## v3.27.0 -- 2026-07-19

This document defines the architectural layers, governance boundaries, and platform services of SMRITI Retail OS.

---

## 1. Architectural Layers Model

SMRITI enforces a strict 4-layer dependency model. Dependencies must only flow downwards.

```
       ┌────────────────────────┐
       │   Presentation Layer   │ (React tabs, forms, print layouts)
       └───────────┬────────────┘
                   │
       ┌───────────▼────────────┐
       │    Business Modules    │ (CRM, Sales, Modern Trade, Inventory)
       └───────────┬────────────┘
                   │
       ┌───────────▼────────────┐
       │   Business Services    │ (CRMService, SalesService, etc.)
       └───────────┬────────────┘
                   │
       ┌───────────▼────────────┐
       │   Platform Services    │ (Numbering, Workflow, EventBus, Accounting)
       └────────────────────────┘
```

1. **Platform Services**: Reusable infrastructure components. Agnostic to specific business domains.
2. **Business Services**: Orchestrates business logic across one or more modules.
3. **Business Modules**: Defines schemas, database entities, and workflows for specific functional domains.
4. **Presentation Layer**: Exposes UI and triggers user-initiated transactions.

---

## 2. Module Ownership & Governance

To maintain maintainability and clean audits:
- **No module may directly update or write to another module's database tables.**
- Cross-module writes must go through defined Service layer calls or the synchronous Event Bus.
- Every entity inheriting `BaseEntity` has standard auditing (`created_by`, `modified_by`, `version`, `is_deleted`) and platform columns (`workflow_status`, `document_number`).

---

## 3. Platform Services Specification

### 3.1 Document Numbering Engine
- Centrally manages numbering schemes across all modules.
- Formats: `{PREFIX}-{FY}-{SEQ:06d}` or customized templates per branch.
- Thread-safe using `SELECT FOR UPDATE` row locks.

### 3.2 Workflow Engine
- Drives transitions for stateful documents: `Draft -> Submitted -> Approved -> Posted -> Cancelled | Closed`.
- Restricts status changes through configurable transition rules per document type.
- Records a complete, immutable transition history log in JSONB.

### 3.3 Domain Event Bus
- Publishes in-transaction synchronous events (e.g. `consignment.transfer.created`).
- Decouples secondary side-effects (auditing, notification dispatch) from core business logic.

### 3.4 Accounting Posting Engine (Stub)
- Enforces double-entry journal balance checking.
- Stub implementation in `v3.27.0` logs transaction details, to be replaced by full general ledger posting in `v3.30.x` with zero consumer-side changes.

### 3.5 Approval Engine (Stub)
- Evaluates document thresholds against user roles.
- Returns auto-approval status in `v3.27.0`. Full rule-evaluation engine slated for `v3.29.x`.

### 3.6 Notification Service
- Centrally routes messages to In-App alerts, Email, WhatsApp, or Webhooks based on user preferences.
- Decouples notification trigger points from SMTP/SMS gateways.
