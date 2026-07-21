<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0 (PAR-001 Reference)
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Master Platform Architecture Reference Guide
-->

# PAR-001: SMRITI Platform Architecture Reference Guide

**Status:** FROZEN — Platform Foundation Reference (v1.0)  
**Effective:** 2026-07-21  
**Scope:** Master Engineering Reference across all 7 Platform Layers  

---

## 1. Executive Summary
PAR-001 serves as the unified entry point and master reference guide for the **SMRITI Modular Platform (SMP) & SMRITI Retail OS Foundation Series**.

---

## 2. The 7-Layer Platform Architecture Model

```text
 ┌─────────────────────────────────────────────────────────────────────────┐
 │ Layer 1: Constitutional Governance & Standards                          │
 │ ├── SMP-001 ... SMP-014 Specifications                                 │
 │ ├── GCR-001 SMRITI Golden Code Rule (20 Mandatory Rules)                │
 │ └── AOP-001 SMRITI AI Optionality Principle ("AI advises. Platform decides.")
 ├─────────────────────────────────────────────────────────────────────────┤
 │ Layer 2: SPK Kernel Runtime Engine (v12.1.0)                            │
 │ ├── Microkernel Lifecycle Orchestrator & 12 Core Platform Registries    │
 │ └── Deterministic Module State Engine & Capability Guards               │
 ├─────────────────────────────────────────────────────────────────────────┤
 │ Layer 3: Business Subsystems (v13.0.0)                                  │
 │ └── Sales, Inventory, POS, Purchase, CRM, General Ledger Accounting     │
 ├─────────────────────────────────────────────────────────────────────────┤
 │ Layer 4: SMRITI Marketplace Ecosystem (v14.0.0)                         │
 │ ├── Repository Providers (Official, Enterprise, Filesystem, USB)        │
 │ ├── Compatibility Evaluator, Triad Security Engine, Package Manager     │
 ├─────────────────────────────────────────────────────────────────────────┤
 │ Layer 5: Enterprise Operations, HA & Observability (v15.0.0)            │
 │ ├── Multi-Node Cluster Manager (SMP-010), Telemetry & Probes (SMP-011)  │
 │ └── Disaster Recovery Engine (SMP-012), Policy Performance SLA Budgets  │
 ├─────────────────────────────────────────────────────────────────────────┤
 │ Layer 6: AI & Intelligent Automation (v16.0.0)                          │
 │ ├── Statistical Forecasting, Pricing, Replenishment Advisors (SMP-013)  │
 │ └── OCR Document Parser & BaseAIProvider Abstraction                    │
 ├─────────────────────────────────────────────────────────────────────────┤
 │ Layer 7: SMRITI Content & Document Platform (SCDP / UDMS v17.0.0)       │
 │ ├── Document / Attachment Separation & SHA256 Checksums (SMP-014)       │
 │ └── Immutable Version Control & Multi-Format Inline Preview Engine      │
 └─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Governance Master Index

| Spec ID | Standard Title | Scope |
| :--- | :--- | :--- |
| **`SMP-001`** | SMRITI Modular Platform Specification | Constitutional Architecture Baseline |
| **`SMP-002..008`** | Core Domain & Extension Standards | Capability profiles, event manifests, DTOs |
| **`SMP-009`** | Marketplace Package & Distribution Standard | `.smx` package format & channels |
| **`SMP-010`** | High Availability & Cluster Standard | Multi-node clustering & leader election |
| **`SMP-011`** | Observability & Telemetry Standard | Prometheus metrics (`/metrics`) & probes |
| **`SMP-012`** | Disaster Recovery & Backup Standard | Snapshot backup FSM & maintenance mode |
| **`SMP-013`** | AI Advisory & Automation Standard | `AdvisoryRecommendation` DTO & AOP-001 |
| **`SMP-014`** | Universal Document Management Standard | Document/Attachment separation & storage |
| **`GCR-001`** | SMRITI Golden Code Rule | 20 Mandatory Engineering Rules & CI Gates |
| **`AOP-001`** | SMRITI AI Optionality Principle | Advisory AI non-blocking principle |

---

## 4. Key Architectural Precepts
1. **Kernel Purity:** SPK Kernel executes modules; higher layers manage/orchestrate modules.
2. **Inward Dependencies:** Higher layers depend on public APIs of lower layers; lower layers never import higher layers.
3. **Deterministic Core:** Business transactions execute flawlessly regardless of AI or marketplace availability.
4. **First-Class Content:** Documents exist independently of transaction attachment relationships.
