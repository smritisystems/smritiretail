<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Kernel Standard Specification
-->

# SMRITI Kernel Development Standard (KDS v1.0) & 10 Architectural Principles

**Status:** FROZEN — Enterprise Kernel Specification Standard v1.0 (2026-08-04)
**Scope:** Standardized 14-Section Kernel Structure & 10 Core Architectural Principles

---

## 1. Standardized 14-Section Kernel Specification Structure

Every Shared Business Kernel in SMRITI Retail OS (Level 3) MUST adhere strictly to this 14-section architectural document structure:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SMRITI KERNEL DEVELOPMENT STANDARD (KDS V1.0) STRUCTURE                │
 ├────────────────────────────────────────────────────────────────────────┤
 │  1. Purpose & Scope                                                    │
 │  2. Architectural Responsibilities                                     │
 │  3. Public Service API Facade                                          │
 │  4. Internal Components & Engine Logic                                 │
 │  5. Domain Model & Data Schemas                                        │
 │  6. Governed Lifecycle & State Machines                                │
 │  7. Categorized Platform Contracts (Level 2 Services & Level 3 Kernels)│
 │  8. Asynchronous Events Published (SEB Event Bus)                      │
 │  9. Events Consumed & Handlers                                         │
 │ 10. Security & USR ABAC Rules                                          │
 │ 11. Performance Benchmarks & SLA Targets                               │
 │ 12. 6-Dimensional Certification Matrix                                 │
 │ 13. Semantic Versioning Policy                                         │
 │ 14. 10 Architectural Principles                                        │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 10 Constitutional Architectural Principles (KDS v1.0)

All Shared Business Kernels (SDK, SLK, STK, SBPK, SPPK, SIK, SNK, SAK) MUST enforce these 10 constitutional principles:

1. **Kernel Domain Ownership:** Shared Business Kernels exclusively own their respective business domain logic. No UI component or Business Studio may bypass the kernel or manipulate underlying tables directly.
2. **Mandatory Service API Facade:** All domain operations MUST execute exclusively through the kernel's public service facade (`KernelName.Service`).
3. **Immutable Master Identity:** Entity primary keys and universal identifiers (`master_uuid`, `asset_uuid`, `doc_uuid`) are 100% immutable once issued.
4. **Dual Lifecycle State/Status Separation:** Primary lifecycle states (e.g. `Active`, `Capitalized`) are immutable state machines; operational sub-statuses (e.g. `Under Maintenance`, `In-Transit`) are concurrent.
5. **Delegated Financial Ledger Postings:** All financial, stock, customer, and supplier ledger postings MUST delegate exclusively to **SLK Ledger Kernel v1.0**.
6. **Delegated Tax Calculations:** All GST, CGST, SGST, IGST, CESS, and HSN tax rule calculations MUST delegate exclusively to **STK Tax Kernel v1.0**.
7. **Delegated Document State Machines:** All transaction document creation, approval transitions, and archiving MUST delegate to **SDK Document Kernel v1.0**.
8. **Multi-Channel Notification Dispatch:** All communication alerts (WhatsApp, SMS, Email, Push) MUST delegate to **SNP Notification Platform (Level 2)**.
9. **Event-Driven Communication (SEB):** All state changes, updates, and domain triggers MUST publish asynchronous events over **SEB Event Bus (Level 2)**.
10. **Strict Semantic Versioning:** Breaking API facade changes require a major version increment and an approved Architecture Decision Record (ADR).
