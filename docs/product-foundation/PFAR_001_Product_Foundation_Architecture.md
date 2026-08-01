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
  Classification: Product Foundation Architecture Reference
-->

# Product Foundation Architecture Reference (PFAR) v1.0

**Status:** ACTIVE — Supporting the M2 Product Foundation milestone
**Effective:** 2026-08-01
**Scope:** Product Foundation, Studio placement guidance, and promotion criteria

---

## 1. Purpose

This document defines the architectural boundary between:
- Platform Foundation
- Product Foundation
- Retail Studios

Its purpose is to guide implementation decisions so that reusable business capability is captured in Product Foundation, while Platform Foundation remains intentionally lean and stable.

---

## 2. Architectural Layers

### Layer 1 — Platform Foundation

The Platform Foundation remains the stable infrastructure and contract layer.

It includes:
- Platform Core
- Platform Kernel
- Registration
- Workspace
- Events
- Notifications
- Audit
- Public platform contracts
- Governance and compatibility model

The Platform Foundation should evolve only through compatibility-preserving changes or approved ADRs for public contracts.

### Layer 2 — Product Foundation

The Product Foundation contains reusable retail business capabilities that are shared across multiple Studios.

Examples:
- Workflow Engine
- Document Engine
- Pricing Engine
- GST and Tax Engine
- Discount and Promotion Engine
- Barcode and Label Engine
- Printing Engine
- Approval Engine
- Search Engine
- Offline Sync Engine
- Reporting Engine

These capabilities are shared across multiple product experiences and should not be owned by a single Studio.

### Layer 3 — Studios

Studios implement customer-facing workflows and product experiences.

Examples:
- POS Studio
- Sales Studio
- Inventory Studio
- Purchase Studio
- Accounting Studio
- CRM Studio
- Reporting Studio
- Customer Portal
- License Studio
- Mobile Workspace

Studios should consume Product Foundation and Platform Foundation capabilities rather than redefining them.

---

## 3. Placement Decision Guide

Every new capability should be assigned to one layer using the following decision flow:

```text
Customer Problem?
        │
        ▼
Can Studio solve it?
        │
      Yes ─────► Studio
        │
       No
        │
        ▼
Can Product Foundation solve it?
        │
      Yes ─────► Product Foundation
        │
       No
        │
        ▼
Is it reusable across multiple products?
        │
      Yes ─────► Platform Foundation (ADR Required)
        │
       No
        │
        ▼
Do Not Add It
```

---

## 4. Placement Rules

### Put it in a Studio when:
- the capability is specific to one customer-facing workflow
- the functionality is highly UI or experience oriented
- the capability is not likely to be reused outside that Studio

### Put it in Product Foundation when:
- the capability is reusable across multiple Studios
- the logic is business-oriented rather than infrastructure-oriented
- the capability improves consistency across Retail OS products

### Put it in Platform Foundation when:
- the capability is infrastructure-oriented
- the capability is reused across multiple products at a platform level
- it affects public contracts or runtime behavior in a cross-cutting way

---

## 5. Promotion Criteria

### Studio → Product Foundation

A Studio capability should move to Product Foundation when:
- it is used by at least two Studios
- it is not tied to a single Studio workflow
- it has regression tests and documentation
- it has a stable and reusable business contract

### Product Foundation → Platform Foundation

A Product Foundation capability should move to Platform Foundation only when:
- it is truly product-neutral and infrastructure-like
- it is reusable across multiple products beyond retail business capabilities
- it affects the platform runtime, public contracts, or shared infrastructure services
- it has an ADR and compatibility review

---

## 6. M2 Product Foundation Milestone

The next program milestone is Product Foundation v1.0.

### Initial workstreams
- Workflow Engine
- Document Engine
- Pricing Engine
- GST and Tax Engine
- Discount and Promotion Engine
- Barcode and Label Engine
- Printing Engine
- Search Engine
- Offline Sync Engine
- Reporting Engine

### Studio delivery priority
1. POS Studio
2. Sales Studio
3. Inventory Studio
4. Purchase Studio
5. Accounting Studio
6. CRM Studio
7. Reporting Studio

These Studios should consume Product Foundation and Platform Foundation capabilities rather than extending the platform itself.

---

## 7. Success Metrics

### Platform Foundation KPIs
- API stability
- Compatibility
- Regression health
- Performance
- Security

### Product Foundation KPIs
- Reuse across Studios
- Reduction in duplicated logic
- Shared engine adoption
- Consistent business rules

### Studio KPIs
- POS checkout time
- Invoice creation time
- Inventory accuracy
- Purchase workflow completion
- Dashboard performance
- Offline synchronization reliability
- Customer adoption

---

## 8. Governance Note

This document complements the Platform Constitution and does not expand Platform Foundation scope. It exists to clarify placement decisions and keep the platform lean while enabling Product Foundation and Studio growth.
