<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# SMRITI Retail OS RC2 Execution Contract v1.0

**Version:** 1.0  
**Status:** Frozen for RC2 execution  
**Effective Date:** 2026-08-01  
**Owner:** Product & Platform Governance  
**Purpose:** Define the governance, sequencing, delivery rules, and exit criteria for RC2 business capability execution.

---

## 1. Primary Objective

RC2 exists to transform the RC1 platform foundation into a complete, production-ready Retail ERP through end-to-end business capability delivery.

Platform engineering is now in maintenance mode.  
Business capability delivery is now the primary engineering activity.

---

## 2. Core Execution Principle

Every sprint must answer one question:

> Which complete business capability became production-ready this sprint?

---

## 3. Capability Delivery Rule

A capability is complete only when every business document inside that capability is complete.

For example, the Sales capability is not complete just because Sales Invoice exists. It is complete only when the full workflow is operational:

- Sales Quotation
- Sales Order
- Delivery Challan
- Sales Invoice
- Sales Return

---

## 4. Capability Ownership

Each capability pack must have one accountable owner.

Examples:

- Sales — Sales Lead
- Purchase — Purchase Lead
- Inventory — Inventory Lead
- Finance — Finance Lead
- CRM — CRM Lead
- Unified Commerce — Commerce Lead

This makes accountability explicit and creates a sustainable operating model for delivery.

---

## 5. Capability Dependency Rule (Mandatory)

A capability pack may begin only when all prerequisite capability packs have reached Done according to their Exit Criteria.

Approved dependency sequence:

```text
Platform Foundation (RC1)
        ↓
Sales
        ↓
Purchase
        ↓
Inventory
        ↓
Finance
        ↓
CRM
        ↓
Unified Commerce
```

This prevents duplicate implementations, minimizes rework, and ensures every capability builds on validated business foundations.

---

## 6. Capability Exit Criteria

Every capability pack must satisfy the following before it is marked Done.

### Business
- All business documents implemented
- Business rules complete
- Workflow complete

### Platform Integration
- Document lifecycle
- Numbering
- Finance integration where applicable
- Inventory integration where applicable
- Notifications
- Printing
- Audit trail

### User Experience
- Complete UI
- Mobile compatibility
- Accessibility where applicable

### Reporting
- Reports
- Dashboard KPIs
- Analytics

### Integration
- APIs
- Import/export
- External integration points

### Quality
- Automated tests at or above target
- No critical defects
- Performance targets achieved

### Release Readiness
- Documentation complete
- UAT complete
- Pilot validation complete

---

## 7. Business Document Lifecycle

Every business document shall progress through the standard lifecycle:

```text
Draft
   ↓
Validated
   ↓
Submitted
   ↓
Approved (if required)
   ↓
Posted
   ↓
Completed
   ↓
Archived / Closed
```

Where applicable:

```text
Completed
     ↓
Returned
     ↓
Cancelled
```

This lifecycle shall be governed by the Document Lifecycle Framework and corresponding workflow policies, not by individual business services.

---

## 8. Business Document Integrity Rule

Every business document must:

- Have a Document Definition
- Execute through the Business Transaction Pipeline (where transactional)
- Be governed by Workflow Policies
- Use an approved Numbering Policy
- Support the Document Lifecycle
- Participate in Audit Logging
- Integrate with Finance and Inventory where applicable

No transactional business document may bypass these platform mechanisms.

---

## 9. Architecture Freeze Policy

During RC2:

### Allowed
- Bug fixes
- Security fixes
- Performance improvements
- Compatibility updates
- ADR-approved enhancements

### Not Allowed
- New frameworks
- New kernels
- New registries
- New architectural layers
- Breaking APIs
- Database redesign unless required for integrity
- Major UI redesign unless validated by usability testing

### UX Freeze for RC2
During RC2 the user interface must remain stable for business workflow delivery.

#### Allowed UX changes
- Bug fixes and small usability improvements only
- Accessibility improvements
- Performance optimizations for existing screens
- Light Mode as default with Dark Mode user-selectable
- Introduction of shared design tokens or shell foundations only when they do not alter existing layouts or workflows
- Removal of obvious excessive padding, shadows, and nested card styling when screens are already touched for business work

#### Not Allowed UX changes
- Global UI redesigns
- New desktop or mobile shells that change current workflows
- Major layout refactors
- Component refactoring that impacts screen behavior or structure
- Parallel UX modernization work during RC2

This preserves the RC2 delivery focus on complete business capabilities while reserving full UX modernization for RC3.

---

## 10. Architecture Freeze Exception

Any proposed platform change that introduces a new framework, engine, registry, kernel service, or foundational abstraction must include:

1. A documented limitation in the current architecture
2. Analysis of why existing mechanisms cannot satisfy the requirement
3. An Architecture Decision Record (ADR)
4. Approval before implementation

This preserves the RC1 foundation while still allowing controlled evolution when genuinely necessary.

---

## 11. Milestone Plan

### Milestone 1 — Sales Foundation
- Sales Quotation
- Sales Order
- Delivery Challan
- Sales Invoice
- Sales Return

### Milestone 2 — Purchase Foundation
- Purchase Requisition
- RFQ
- Purchase Order
- GRN
- Purchase Invoice
- Purchase Return

### Milestone 3 — Inventory Foundation
- Stock Transfer
- Physical Verification
- Stock Adjustment
- Batch Management
- Serial Number
- Warehouse Operations

### Milestone 4 — Finance Foundation
- Receipt Voucher
- Payment Voucher
- Journal Voucher
- Cash Book
- Bank Book
- Trial Balance
- Profit & Loss
- Balance Sheet

### Milestone 5 — CRM Foundation
- Lead
- Opportunity
- Follow-up
- Customer 360
- Campaign
- Sales Analytics

### Milestone 6 — Unified Commerce
- Retail POS
- B2C Store
- B2B Portal
- Marketplace
- Social Commerce
- Wholesale

---

## 12. Business Document Registry

Maintain a single authoritative registry for all business documents.

This becomes the operational master register for RC2 execution.

A practical delivery board should track each document across design, backend, UI, workflow, inventory, finance, print, reports, API, tests, and UAT.

| Capability | Document | Owner | Milestone | Status | Completion | UAT |
|---|---|---|---|---|---:|---|
| Sales | Sales Quotation | Sales Lead | M1 | Planned | 0% | ☐ |
| Sales | Sales Order | Sales Lead | M1 | Planned | 0% | ☐ |
| Sales | Delivery Challan | Sales Lead | M1 | Planned | 0% | ☐ |
| Sales | Sales Invoice | Sales Lead | M1 | Planned | 0% | ☐ |
| Sales | Sales Return | Sales Lead | M1 | Planned | 0% | ☐ |
| Purchase | Purchase Order | Purchase Lead | M2 | Planned | 0% | ☐ |
| Purchase | GRN | Purchase Lead | M2 | Planned | 0% | ☐ |
| Inventory | Stock Transfer | Inventory Lead | M3 | Planned | 0% | ☐ |
| Finance | Sales Invoice Posting | Finance Lead | M4 | Planned | 0% | ☐ |
| CRM | Lead | CRM Lead | M5 | Planned | 0% | ☐ |
| Unified Commerce | Retail POS | Commerce Lead | M6 | Planned | 0% | ☐ |

---

## 13. KPI Dashboard

Project health should be measured by business completion.

| KPI | Target |
|---|---:|
| Capability Packs Completed | 6 / 6 |
| Business Documents Delivered | 100% |
| End-to-End Workflows | 100% |
| Automated Test Pass Rate | ≥ 95% during RC2, 100% before RC2 sign-off and GA |
| Critical Bugs | 0 |
| Performance SLA Met | 100% |
| Documentation Coverage | 100% |
| Pilot Readiness | Achieved |

---

## 14. Document Done Definition

A business document is Done only when all of the following are complete:

- Master Data
- Business Rules
- Workflow
- Inventory Integration (if applicable)
- Finance Integration (if applicable)
- Tax Calculation
- Numbering
- Printing
- Notifications
- Audit Trail
- Reports
- Dashboard KPIs
- REST APIs
- Permissions
- Mobile Compatibility
- Offline Support (where applicable)
- Automated Tests
- Documentation
- UAT Approval

---

## 15. Daily Execution Rule

Every development day should follow this loop:

```text
Select One Business Document
        ↓
Implement
        ↓
Integrate
        ↓
Test
        ↓
Document
        ↓
Mark Complete
        ↓
Move to Next Document
```

Avoid splitting effort across multiple unfinished capabilities.

---

## 16. RC2 Exit Criteria

RC2 is complete only when:

- All 6 capability packs are complete
- All planned business documents are delivered
- Every end-to-end workflow executes successfully
- No critical defects remain
- Platform architecture remains within RC1 freeze boundaries
- Pilot deployment is successful
- Documentation and UAT are complete

---

## 17. Final Strategic Statement

> SMRITI Retail OS evolves through business documents, policies, and composition. The platform remains stable while business capabilities continuously expand. Every release should increase customer value without increasing architectural complexity.

---

## 18. Overall Assessment

With this contract in place, the governance package is complete for RC2 execution:

- Platform Constitution
- Architecture Freeze
- Governance Framework
- Extension Guide
- ADR Structure
- Change Process
- Compatibility Policy
- Deprecation Policy
- Architecture Map
- RC2 Execution Contract
- Capability Roadmap
- Capability Exit Criteria
- Business Document Lifecycle
- Business Document Integrity Rules
- Business Document Registry
- Delivery KPIs

The highest return on effort is now to execute Milestone 1 — Sales Foundation — to completion, validate it in a pilot environment, and then progress sequentially through the remaining capability packs under this contract.
