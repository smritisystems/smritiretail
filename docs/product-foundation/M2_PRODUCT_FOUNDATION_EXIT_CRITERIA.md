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
  Classification: M2 Product Foundation Exit Criteria
-->

# M2 Business Engine Program Exit Criteria

**Status:** ACTIVE — M2 success definition  
**Effective:** 2026-08-01  
**Scope:** Product Foundation delivery and Studio enablement criteria

---

## 1. Purpose

This document defines the measurable completion criteria for M2, now reframed as the Business Engine Program. It shifts the success definition from framework maturity and documentation to shared business capability delivery and real retail workflow enablement.

---

## 2. ARB Disposition

**Decision:** APPROVED — Platform Foundation v1.0 Frozen

**Frozen scope:**
- Platform Core
- Platform Kernel
- Runtime Contracts
- Service Registry
- Event Framework
- Notification Framework
- Audit Framework
- Governance Framework
- Architecture Constitution
- Engineering Charter

**Implementation status:**
- Stable baseline
- Evolvable implementation
- Backward-compatible contract evolution only

---

## 3. Business Engine Exit Criteria

### 3.1 Commerce Foundation
- Pricing Engine production-ready
- Discount Engine production-ready
- Promotion Engine production-ready
- Loyalty Engine production-ready

### 3.2 Inventory Foundation
- Stock Ledger Engine complete
- Reservation Engine complete
- Warehouse Rule Engine complete
- Batch & Serial Engine complete

### 3.3 Finance Foundation
- GST Engine validated
- Accounting Posting Engine validated
- Settlement Engine validated

### 3.4 Workflow Foundation
- Approval Engine reusable
- Rule Engine reusable
- Notification integration complete

### 3.5 Document Foundation
- Number Series Engine
- Print Engine
- Barcode & Label Engine
- PDF Engine

Only after these capabilities are stable should equivalent logic be duplicated inside Studios.

---

## 4. Studio Definition of Done

Every Studio should satisfy the following criteria:

- Uses Product Foundation engines instead of reimplementing business logic.
- Contains only workflow orchestration, UI, navigation, and presentation logic.
- Passes end-to-end business workflow tests.
- Meets performance targets.
- Integrates with shared reporting, search, notifications, and licensing.
- Demonstrates reuse of at least one shared engine from Product Foundation.

This keeps Studios thin and reusable.

---

## 5. Capability Reuse Index (CRI) and Stability

The Capability Reuse Index measures whether Product Foundation is delivering on its purpose.

```text
CRI = (Shared Product Foundation usages) / (Total business capability implementations)
```

### Targets
- <40% → excessive duplication
- 40–70% → acceptable
- >70% → strong reuse

### Capability Stability Score (CSS)
```text
CSS = Breaking Changes / Capability Releases
```

Target:
- <5% breaking changes

---

## 6. Engineering Investment Guideline

Execution should be tracked in [ENGINEERING_SCOREBOARD.md](ENGINEERING_SCOREBOARD.md) rather than in additional governance artifacts. The scoreboard is the living measure of progress for M2 and M3.

The recommended sustained allocation is:

- Studios: 60%
- Product Foundation: 30%
- Platform Foundation: 10%

Platform work should be limited to maintenance, performance, security, SDK improvements, adapters, and ADR-approved compatibility changes.

---

## 7. Build Priority Sequence

The next priority sequence is:

1. Workflow Engine
2. Pricing & Discount Engine
3. Inventory Rules & Stock Ledger Engine
4. GST & Accounting Posting Engine
5. POS Studio
6. Sales Studio
7. Inventory Studio

These provide the highest customer value while exercising the shared Product Foundation.

---

## 8. Product-Oriented Success Metrics

| Area | Target |
| :--- | :--- |
| POS checkout | <10 seconds |
| Sales invoice | <30 seconds |
| Inventory accuracy | >99.9% |
| Purchase completion | PO → GRN → Invoice without manual intervention |
| Dashboard load | <2 seconds |
| Offline sync | >99% success |
| First-time user onboarding | <30 minutes |

---

## 9. Capability Catalog and Ownership Rule

The machine-readable capability inventory is maintained in [src/product-foundation/CAPABILITY_CATALOG.json](src/product-foundation/CAPABILITY_CATALOG.json). Every Product Foundation module should have exactly one owner, and capabilities should be tracked through CML and release ring states.

## 10. Documentation Freeze and Delivery Rule

M1 documentation is frozen. During M2, only release notes, ADRs when unavoidable, engine API specifications, user documentation, and migration guides should be updated. All other work should be implemented as executable engines, tests, and retail workflows.

## 11. Final M2 Evaluation Rule

M2 should be judged by working retail workflows and reusable business engines, not by additional platform or governance artifacts.
