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
  Classification: Living Engineering Dashboard
-->

# SMRITI Engineering Scoreboard

**Status:** ACTIVE — living execution dashboard  
**Effective:** 2026-08-01  
**Purpose:** Track executable delivery of business engines, studio workflows, and platform stewardship as M2 and M3 progress.

---

## 1. How to Use This Dashboard

- Update this file at the end of every sprint.
- Prefer evidence from automated tests, workflow execution, and telemetry.
- M1 documentation is frozen; only bug, ADR, version, and release-note updates are permitted.
- If a metric is not yet measured, mark it as "Baseline pending" and populate it in the next sprint.

---

## 2. Program Status Snapshot

| Area | Status | Notes |
| :--- | :--- | :--- |
| Platform Foundation | Frozen | Maintenance and backward-compatible evolution only |
| Product Foundation | Active | Primary engineering investment |
| Studios | Active | Customer value delivery begins here |
| Ecosystem | Planned | After core retail maturity |

---

## 3. Execution Scoreboard

### 3.1 Platform Health

| Metric | Target | Current | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Regression pass rate | 100% | 100% | Green | Verified through Vitest: 6/6 files and 32/32 tests passed |
| API compatibility | 100% | 100% | Green | Backward-compatible runtime contracts maintained |
| Platform Churn Index (PCI) | <10% | Baseline pending | Pending | Track churn per sprint |
| Security posture | No critical issues | Baseline pending | Pending | Track critical and high findings |

### 3.2 Product Foundation Health

| Metric | Target | Current | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Capability Reuse Index (CRI) | >70% | Baseline pending | Pending | Measure adoption across studios |
| Business Engine Coverage (BEC) | >80% | Baseline pending | Pending | Measure Studios using Product Foundation over total Studios |
| Capability Stability Score (CSS) | <5% breaking changes | Baseline pending | Pending | Measure breaking-change rate across capability releases |
| Shared engine coverage | Increasing | Baseline pending | Pending | Track engine adoption by Studio |
| Engine maturity | Stable | Baseline pending | Pending | Track engine readiness and versioning |

### 3.2.1 Adoption Dashboard

| Foundation Module | Adoption Target | Notes |
| :--- | :--- | :--- |
| Commerce Engine | ≥2 Studios | Pricing, discounts, promotions, loyalty, wallet |
| Inventory Engine | ≥2 Studios | Stock ledger, reservation, allocation, warehouse rules |
| Workflow Engine | ≥3 Studios | Approvals, tasks, rules, SLA, state machine |
| Finance Engine | ≥2 Studios | GST, posting, settlement, receivables, payables |
| Document Engine | All Studios | Numbering, print, barcode, QR, PDF |
| Intelligence Engine | ≥3 Studios | Search, reports, dashboards, AI, forecasting |

### 3.3 Studio Delivery

| Metric | Target | Current | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Studio delivery velocity | Increasing | Baseline pending | Pending | Track customer-facing feature throughput |
| Workflow completion rate | >95% | Baseline pending | Pending | Measure successful end-to-end retail workflows |
| Feature completion | Sprint target met | Baseline pending | Pending | Measure per sprint scope completion |

### 3.4 Customer Outcomes

| Metric | Target | Current | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| POS checkout time | <10 seconds | Baseline pending | Pending | Capture from end-to-end workflow runs |
| Sales invoice creation time | <30 seconds | Baseline pending | Pending | Measure from Studio workflow execution |
| Inventory accuracy | >99.9% | Baseline pending | Pending | Validate from ledger reconciliation |
| Purchase completion | PO → GRN → Invoice without manual intervention | Baseline pending | Pending | Measure end-to-end retail process |
| Dashboard response time | <2 seconds | Baseline pending | Pending | Track analytic and reporting responsiveness |
| Offline synchronization success | >99% | Baseline pending | Pending | Track sync success rate |
| Time to productive use | <30 minutes | Baseline pending | Pending | Measure in onboarding or pilot runs |

---

## 4. Sprint Update Template

At the end of each sprint, record:

- What shipped
- Which shared engine was exercised by at least one additional Studio
- Which customer workflow improved
- Which metric moved materially
- What remains blocked

---

## 5. Decision Rule

If a work item does not directly improve retailer workflows, enable reuse across multiple Studios, or materially improve customer outcomes, it should be deferred unless it is required for platform stewardship or compatibility safety.

---

## 6. Architecture Freeze Window (AFW)

**Purpose:** Protect engineering velocity during M2.

### Rules
- No new Platform Foundation components during M2.
- No new Kernel abstractions during M2.
- No new governance artifacts unless required by an approved ADR.
- Product Foundation may evolve freely.
- Studios may evolve rapidly.
- Only bug fixes, performance improvements, security fixes, compatibility updates, and adapter implementations are permitted in Platform Foundation.

---

## 7. Promotion Board

```text
Studio Feature
      │
      ▼
Used in Production
      │
      ▼
Adopted by Second Studio
      │
      ▼
Product Foundation
      │
      ▼
Platform Candidate (rare)
```

Production validation is required before a capability is promoted into Product Foundation.

---

## 8. Studio Structure Rule

Each Studio should remain a thin application that primarily orchestrates UI, workflow, navigation, and Product Foundation API consumption. Pricing, GST, inventory, and document logic should not be embedded directly in Studio code when shared engines are available.

---

## 9. Capability Catalog

The machine-readable capability inventory is maintained in [src/product-foundation/CAPABILITY_CATALOG.json](src/product-foundation/CAPABILITY_CATALOG.json). It should be updated whenever a capability changes maturity, owner, release ring, or version.
