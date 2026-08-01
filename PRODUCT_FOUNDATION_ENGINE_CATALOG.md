<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0
  Created      : 2026-08-01
  Modified     : 2026-08-01
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Product Foundation Implementation Catalog
-->

# SMRITI Product Foundation Engine Catalog

**Status:** ACTIVE — implementation contract for M2  
**Effective:** 2026-08-01  
**Purpose:** Define the reusable Product Foundation engines that should be implemented and consumed by retail Studios.

---

## 1. Catalog Purpose

This catalog is the operational reference for Product Foundation delivery. It replaces the need for additional platform-centric governance artifacts by defining, for each engine:

- purpose
- public API
- owned business rules
- consuming Studios
- dependencies
- version
- reuse status
- promotion status
- test coverage
- performance targets

---

## 2. Engine Catalog

### 2.1 Workflow Engine
- Purpose: Shared state transitions, approvals, tasks, notifications, and SLA handling.
- Public API: workflow.create, workflow.approve, workflow.reject, workflow.route, workflow.status
- Owned business rules: approval routing, escalation, SLA enforcement, task ownership
- Consuming Studios: POS, Sales, Purchase, Accounting, CRM
- Dependencies: Notification Engine, Audit Engine, User Context
- Version: v0.1
- Reuse status: Planned
- Promotion status: Candidate
- Test coverage: Pending
- Performance targets: <200ms for local workflow resolution

### 2.2 Pricing Engine
- Purpose: Consistent pricing, discount, and promotion calculation across retail channels.
- Public API: pricing.calculate, pricing.applyPromotion, pricing.evaluateRules
- Owned business rules: base price, quantity rules, basket rules, customer-specific pricing
- Consuming Studios: POS, Sales, CRM
- Dependencies: Promotion Engine, Loyalty Engine, Currency Engine
- Version: v0.1
- Reuse status: Planned
- Promotion status: Candidate
- Test coverage: Pending
- Performance targets: <100ms per quote calculation

### 2.3 Discount & Promotion Engine
- Purpose: Reusable discount and campaign management.
- Public API: promotion.evaluate, promotion.activate, promotion.expire
- Owned business rules: discount priority, coupon validation, campaign conditions
- Consuming Studios: POS, Sales, CRM
- Dependencies: Pricing Engine, Loyalty Engine
- Version: v0.1
- Reuse status: Planned
- Promotion status: Candidate
- Test coverage: Pending
- Performance targets: <150ms per promotion evaluation

### 2.4 Inventory Rules Engine
- Purpose: Shared stock policy enforcement, reservations, allocation, and replenishment logic.
- Public API: inventory.evaluateRule, inventory.reserve, inventory.allocate, inventory.replenish
- Owned business rules: stock thresholds, reservation policy, allocation precedence, replenishment triggers
- Consuming Studios: Inventory, Purchase, POS
- Dependencies: Stock Ledger Engine, Warehouse Rules
- Version: v0.1
- Reuse status: Planned
- Promotion status: Candidate
- Test coverage: Pending
- Performance targets: <250ms per evaluation

### 2.5 Stock Ledger Engine
- Purpose: Shared stock movement, costing, and ledger tracking.
- Public API: stock.movement, stock.balance, stock.reconcile, stock.cost
- Owned business rules: stock in/out, adjustment handling, valuation rules
- Consuming Studios: Inventory, Purchase, Accounting
- Dependencies: Accounting Posting Engine, Inventory Rules Engine
- Version: v0.1
- Reuse status: Planned
- Promotion status: Candidate
- Test coverage: Pending
- Performance targets: <300ms per ledger operation

### 2.6 GST & Tax Engine
- Purpose: Shared tax computation and posting behavior.
- Public API: tax.calculate, tax.post, tax.validate
- Owned business rules: GST logic, tax jurisdiction, invoice-level rules
- Consuming Studios: Sales, Purchase, Accounting
- Dependencies: Accounting Posting Engine
- Version: v0.1
- Reuse status: Planned
- Promotion status: Candidate
- Test coverage: Pending
- Performance targets: <150ms per calculation

### 2.7 Accounting Posting Engine
- Purpose: Shared posting, settlement, and financial entry generation.
- Public API: posting.create, posting.reverse, posting.settle
- Owned business rules: voucher creation, ledger posting, settlement matching
- Consuming Studios: Sales, Purchase, Accounting
- Dependencies: GST & Tax Engine, Workflow Engine
- Version: v0.1
- Reuse status: Planned
- Promotion status: Candidate
- Test coverage: Pending
- Performance targets: <250ms per posting batch

### 2.8 Reporting Engine
- Purpose: Shared reporting, dashboard, and analytics data access.
- Public API: reporting.query, reporting.dashboard, reporting.export
- Owned business rules: aggregation, access policy, data slicing
- Consuming Studios: Reporting, Sales, Inventory, Accounting
- Dependencies: Search Engine, Document Engine
- Version: v0.1
- Reuse status: Planned
- Promotion status: Candidate
- Test coverage: Pending
- Performance targets: <2s for standard dashboard payloads

### 2.9 Search Engine
- Purpose: Reusable lookup and search across masters, documents, and transactions.
- Public API: search.find, search.suggest, search.filter
- Owned business rules: relevance ordering, permission-aware results
- Consuming Studios: POS, Sales, Inventory, Customer Portal
- Dependencies: Document Engine
- Version: v0.1
- Reuse status: Planned
- Promotion status: Candidate
- Test coverage: Pending
- Performance targets: <500ms for standard search queries

### 2.10 Print & Document Engine
- Purpose: Shared document generation, number series, barcode, labels, and PDF output.
- Public API: document.generate, document.print, document.barcode, document.label
- Owned business rules: numbering, layout rules, print template selection
- Consuming Studios: Sales, Purchase, Inventory, Accounting
- Dependencies: Workflow Engine, Reporting Engine
- Version: v0.1
- Reuse status: Planned
- Promotion status: Candidate
- Test coverage: Pending
- Performance targets: <1s for standard document generation

### 2.11 AI Assistant Framework
- Purpose: Shared assistant experience patterns and command orchestration.
- Public API: assistant.run, assistant.context, assistant.followUp
- Owned business rules: prompt routing, action grounding, consent handling
- Consuming Studios: POS, CRM, Reporting
- Dependencies: Search Engine, Workflow Engine
- Version: v0.1
- Reuse status: Planned
- Promotion status: Candidate
- Test coverage: Pending
- Performance targets: <2s for standard assistance flows

### 2.12 Integration Engine
- Purpose: Shared connector patterns for third-party services and data exchange.
- Public API: integration.connect, integration.sync, integration.publish
- Owned business rules: connector lifecycle, retries, mapping policy
- Consuming Studios: All Studios
- Dependencies: Workflow Engine, Document Engine
- Version: v0.1
- Reuse status: Planned
- Promotion status: Candidate
- Test coverage: Pending
- Performance targets: <5s for standard sync operations

### 2.13 License & Subscription Engine
- Purpose: Shared entitlement, licensing, and subscription lifecycle handling.
- Public API: license.validate, license.activate, license.revoke
- Owned business rules: plan validation, expiration checks, entitlement mapping
- Consuming Studios: License Studio, Customer Portal, Mobile Workspace
- Dependencies: Workflow Engine
- Version: v0.1
- Reuse status: Planned
- Promotion status: Candidate
- Test coverage: Pending
- Performance targets: <200ms per validation

---

## 3. Promotion Lifecycle

A capability moves through the following lifecycle:

1. Studio
2. Validated in multiple Studios
3. Product Foundation
4. Adopted across multiple products
5. Platform Foundation only in exceptional cases

---

## 4. Delivery Guidance

- Implement engines only when they are directly reusable across at least two Studios or workflows.
- Keep Studio ownership focused on orchestration, UX, and studio-specific behavior.
- Promote a capability into Product Foundation only after it has been exercised in real business scenarios.
- Avoid adding new platform abstractions when a shared engine can solve the need directly.
