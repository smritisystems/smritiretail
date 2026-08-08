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
  Classification: Product Foundation Delivery Backlog
-->

# SMRITI Business Engine Program Backlog

**Status:** ACTIVE — M2 execution backlog  
**Effective:** 2026-08-01  
**Scope:** Shared business engines, studio enablement, and executable delivery

---

## 1. Purpose

This document is the living delivery artifact for M2. It tracks executable business engines and retail workflows rather than additional architectural speculation.

### Documentation Freeze for M1
M1 documentation is now locked. Only updates to M1 artifacts are permitted for:
- bug fixes
- ADR-approved changes
- version changes
- release notes

No new governance artifacts should be introduced during M2 unless required by ADR.

### Allowed Documents During M2
- Release Notes
- ADRs (only if unavoidable)
- Engine API specifications
- User documentation
- Migration guides

Everything else should be implemented as code and working software.

---

## 2. Program Objective

M2 is now defined as the Business Engine Program. Its purpose is to deliver tangible business engines and validate them through real retail workflows in POS, Sales, and Inventory.

### M2 Objective
- Deliver the first reusable business engines.
- Build POS, Sales, and Inventory Studios on top of those engines.
- Validate the architecture through real retail workflows rather than additional foundational abstractions.

---

## 3. Delivery Focus

### Wave 1 — Core Retail
1. POS Studio
2. Sales Studio
3. Inventory Studio

### Wave 2 — Business Operations
1. Purchase Studio
2. Accounting Studio
3. CRM Studio

### Wave 3 — Business Intelligence
1. Reporting Studio
2. License Studio
3. Customer Portal
4. Mobile Workspace

---

## 4. Product Foundation Engine Backlog

### 4.1 Shared Engine Domains
- Commerce Engine
- Inventory Engine
- Accounting Engine
- Workflow Engine
- Document Engine
- Intelligence Engine

### 4.2 Engine Components
- Pricing
- Discounts and Promotions
- Offers and Coupons
- Loyalty and Wallet
- Stock Ledger and Costing
- Reservations and Allocation
- Batch and Serial
- Warehouse Rules
- GST and Tax
- Voucher Posting and Settlement
- Receivables and Payables
- Approval and Task Management
- Numbering, Templates, Printing, and PDF
- Barcode, QR, and Labels
- Search, Dashboards, Reports, and AI Assistant

### 4.2 Engine Priorities

| Engine | Priority | Target Outcome |
| :--- | :--- | :--- |
| Workflow Engine | High | Shared approval and state transition flows |
| Pricing Engine | High | Consistent pricing, promotions, and discount logic |
| GST & Tax Engine | High | Shared tax calculation across studios |
| Discount & Promotion Engine | High | Customer and campaign pricing logic |
| Inventory Rules Engine | High | Stock, allocation, and replenishment policy enforcement |
| Approval Engine | High | Multi-step approvals for purchases and discounts |
| Reporting Engine | High | Shared reporting abstraction for studios |
| Print & Document Engine | Medium | Common document generation and print workflows |
| Search Engine | Medium | Reusable search and master-data lookup |
| AI Assistant Framework | Medium | Shared assistant experience patterns |
| Integration Engine | Medium | Reusable integration and connector abstraction |
| License & Subscription Engine | Medium | Shared entitlement and subscription logic |

---

## 5. Cross-Studio Reuse Opportunities

The following reuse opportunities should be tracked explicitly:

- Sales and POS share pricing, discounts, and workflow rules.
- Inventory and Purchase share approval and stock-rule logic.
- Accounting and Sales share document posting and reporting data.
- Reporting Studio consumes common reporting and document engines.
- Customer Portal and Mobile Workspace reuse search, workflow, and integration services.

---

## 6. Technical Debt and Delivery Risks

### Technical Debt
- Shared engine boundaries remain under-defined.
- Studio-specific logic may still need to be promoted into Product Foundation.
- Integration patterns should be standardized before broad reuse.

### Risks
- Premature abstraction of studio logic into Product Foundation.
- Over-implementation of generic services before real reuse signal exists.
- Inconsistent domain contracts across studios.

---

## 7. Promotion Criteria

A capability should be promoted from a Studio into Product Foundation only when it meets at least one of the following:

- It is reused by at least two studios.
- It is clearly business-neutral and reusable across multiple retail domains.
- It reduces duplicated logic in more than one workflow stream.
- It has reached at least CML-3 maturity and has been validated in production.

### Capability Maturity Levels
- CML-0 — Planned
- CML-1 — Prototype
- CML-2 — Validated in one Studio
- CML-3 — Shared by at least two Studios
- CML-4 — Standard Product Foundation default
- CML-5 — Strategic, eligible for Platform consideration

---

## 8. Engineering Definition of Done

Every engine should satisfy:
- Unit tests
- Integration tests
- Studio consumption
- Performance benchmark
- Public API documentation
- Version number
- Changelog
- Regression pass

The living execution dashboard for this program is maintained in [ENGINEERING_SCOREBOARD.md](ENGINEERING_SCOREBOARD.md). It should be updated at the end of every sprint with measured outcomes rather than aspirational targets.

---

## 9. Engineering KPIs

### Product KPIs
- POS checkout time
- Sales invoice creation time
- Inventory accuracy
- Purchase cycle completion
- Dashboard response time
- Offline synchronization success
- Customer adoption
- Retail workflow completion without manual repair
- PO → GRN → Invoice completion without manual intervention

### Platform KPIs
- API compatibility
- Regression pass rate
- Platform Churn Index (PCI)
- SDK stability
- Security issues
- Performance regressions

### Capability Reuse Index (CRI)
```text
CRI = (Shared Product Foundation usages) / (Total business capability implementations)
```

Targets:
- <40% → excessive duplication
- 40–70% → acceptable
- >70% → strong reuse

### Permanent Architectural Rule
Every new capability must first answer three questions before it enters the Platform Foundation:

1. Will it be reused by at least two Product Foundation engines?
2. Will it be reused by at least two Studios?
3. Does it reduce long-term maintenance across the product suite?

If the answer is no to all three, the capability should be implemented in the relevant Studio rather than in the platform.

### Platform KPIs
- API compatibility
- Regression pass rate
- Platform Churn Index (PCI)
- SDK stability
- Security issues
- Performance regressions

---

## 10. Execution Policy

The following principles should govern delivery:

- Prefer real retail workflows over synthetic platform expansion.
- Keep the platform stable and backward-compatible.
- Promote shared business capabilities into Product Foundation only when reuse is demonstrable.
- Use Studios as the primary source of customer-visible value.

---

## 11. Sprint Readiness Checklist

Each sprint should confirm:

- Product Foundation engines planned for the sprint are clearly scoped.
- Studio delivery work is connected to measurable customer value.
- Shared engine reuse is being validated across at least one additional studio.
- Platform changes remain backward-compatible and limited to stewardship needs.
- The work advances at least one capability from the retail capability map.
- The sprint remains within the Architecture Freeze Window rules.
- The work improves one of the adoption metrics in the engineering scoreboard.

---

## 12. M2 Delivery Focus

The first practical M2 delivery slice should be:

1. Workflow Foundation
2. Rules & State Machine
3. Pricing Engine
4. Discount & Promotion Engine
5. Stock Ledger Engine
6. Inventory Rules Engine
7. GST Engine
8. Accounting Posting Engine
9. Document Engine
10. Search & Reporting Framework

These should be consumed immediately by:

- POS Studio
- Sales Studio
- Inventory Studio

If these Studios are built largely by composing Product Foundation engines, the architecture will be validated more convincingly than through additional governance work.

---

## 13. M2 Exit Criteria

M2 is complete when:

- the first reusable Product Foundation engines are implemented;
- POS, Sales, and Inventory Studios are running on top of those shared engines;
- the core retail workflow is validated end to end;
- the platform remains stable and regression-safe.
