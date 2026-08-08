<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.1.0
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Governance Specification
-->

# SMRITI Kernel Development Standard & Governance Framework (KDS v1.1 Baseline)

**Status:** FROZEN — Enterprise Kernel Specification & Governance Standard v1.1 (2026-08-04)
**Scope:** Machine-Readable Manifest Schema, Centralized Kernel Registry, ADR Trigger Policy, & Freeze Policy

---

## 1. Machine-Readable Kernel Manifest Schema (`kernel.manifest.yaml`)

Every Level 3 Shared Business Kernel MUST contain a `kernel.manifest.yaml` file in its root directory:

```yaml
# SMRITI Kernel Manifest Schema v1.0
kernel: SAK
version: 2.1.0
layer: 3
owner: "Enterprise Fixed Asset & Equipment Domain"
maturity: Gold

dependencies:
  services: [SEB, SES, SNP, SWA, SAS, STS, SAI]
  kernels: [SDK, SLK, STK, SBPK, SIK, SNK]

events:
  published: 10
  consumed: 6

api:
  facade: "SAK.AssetService"
  methods: 20

compliance:
  kds_version: 1.1.0
  quick_facts: true
  adr_logged: true
  observability: true
```

---

## 2. Centralized Platform Kernel Registry Index

| Kernel Acronym | Domain Owner | Version | Layer | Public API Facade | Maturity Level | Status |
|---|---|---|---|---|---|---|
| **SDK** (Document) | Universal Document Machine | v1.0 | Level 3 | `SDK.DocumentService` | Platinum | ✅ Active |
| **SLK** (Ledger) | Financial & Stock Ledgers | v1.0 | Level 3 | `SLK.LedgerService` | Platinum | ✅ Active |
| **STK** (Tax) | Tax Rules & GST Engine | v1.0 | Level 3 | `STK.TaxService` | Platinum | ✅ Active |
| **SBPK** (Printing) | Barcodes & ESC/POS Print | v1.0 | Level 3 | `SBPK.PrintService` | Platinum | ✅ Active |
| **SPPK** (Pricing) | Price Lists & Promotions | v1.0 | Level 3 | `SPPK.PricingService`| Platinum | ✅ Active |
| **SIK** (Integration)| External Systems & EDI | v1.0 | Level 3 | `SIK.IntegrationService`| Platinum | ✅ Active |
| **SNK** (Node Sync) | Multi-Site Synchronization | v1.0 | Level 3 | `SNK.NodeService` | Platinum | ✅ Active |
| **SAK** (Asset) | Fixed Asset Lifecycle | v2.1 | Level 3 | `SAK.AssetService` | Gold | ✅ Active |

---

## 3. Mandatory ADR Trigger Policy & Baseline Freeze Policy

### A. Mandatory ADR Trigger Triggers
Architecture Decision Records (`ADR.md`) are strictly mandatory ONLY under 5 conditions:
1. Introduction of a new Level 3 Shared Business Kernel or Level 2 Service.
2. Breaking change to an existing public service API facade (`KernelName.Service`).
3. Introduction or modification of cross-kernel transaction boundaries.
4. Structural change to the 7-level Platform Topology.
5. Alteration of USR security ABAC policies or data isolation models.
*Routine feature additions within existing API contracts DO NOT require an ADR.*

### B. Baseline Structural Freeze Policy
> **Governance Directive:** A frozen baseline (e.g. KDS v1.1, SAK v2.1) may receive ONLY non-breaking corrections, clarifications, or doc updates. Any structural change or breaking API modification REQUIRES a major version bump (e.g. KDS v2.0) and an approved ADR.

---

## 4. Redefined Operational Kernel Maturity Matrix

| Maturity Level | Governance Definition | Audit & Verification Requirement | Current Platform Status |
|---|---|---|---|
| **Bronze** | Specification Complete | 15-Section KDS document locked & ADR created | All Kernels |
| **Silver** | Test Suite Complete | 100% TypeScript compile & Jest/Vite unit tests pass | All Kernels |
| **Gold** | Production Ready | 20 Business Scenarios certified & SEB Events verified | SDK, SBPK, SIK, SPPK, STK, SLK, SNK, SAK |
| **Platinum** | Enterprise Certified | 6-Dimension Governance audit & OpenTelemetry live | Platinum Baseline (`cbae5948`) |
| **Diamond** | Proven at Production Scale | Sustained operation with zero-downtime & auto-recovery | Production Nodes |
