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
  Classification: Internal Architecture Specification
-->

# SMRITI Platform Reference Implementation Guide (PRIG v1.0)

**Status:** PERMANENT DEVELOPER COOKBOOK — FROZEN v1.0 (2026-08-04)
**Baseline:** SMRITI Digital Commerce Platform OS v4.2 & SPC v1.0
**Scope:** Developer Implementation Guide for Repository Layout, Manifest Placement, Mandatory Interfaces, Kernel/Studio Creation, SPD Certification Gates, Packaging & Deployment

---

## 1. Developer Directory & Manifest Placement Topology

Every component in the repository MUST follow canonical directory conventions and expose a valid manifest:

```text
F:\SMRITRretailNXmgrt\
├── platform.manifest.yaml                   <-- Root Platform Baseline Manifest (smriti.manifest.v1)
├── platform.lock.yaml                       <-- Resolved Immutable Dependency Lock File
│
├── docs/                                    <-- Constitutional Architecture & Standards
│   ├── SMRITI_PLATFORM_CONSTITUTION.md     <-- SPC v1.0 Supreme Constitution
│   ├── PLATFORM_REFERENCE_IMPLEMENTATION_GUIDE_V1.md <-- PRIG v1.0 Developer Cookbook
│   ├── KERNEL_DEVELOPMENT_STANDARD_V1.md     <-- KDS v1.1 Standard
│   └── ...
│
├── packages/                                <-- Level 2 Shared Platform Services & Level 3 Business Kernels
│   ├── services/
│   │   ├── spd-platform-doctor/             <-- SPD Platform Doctor Service
│   │   │   ├── service.manifest.yaml       <-- Service Manifest
│   │   │   ├── src/
│   │   │   └── package.json
│   │   └── seb-event-bus/
│   │
│   └── kernels/
│       ├── sak-asset-kernel/                <-- SAK Asset Kernel v2.1
│       │   ├── kernel.manifest.yaml        <-- Kernel Manifest
│       │   ├── src/
│       │   │   ├── interfaces/             <-- Mandatory TypeScript Interfaces
│       │   │   ├── services/               <-- Facade Service Implementation
│       │   │   └── repositories/           <-- Database Data Access
│       │   └── package.json
│       ├── stk-tax-kernel/
│       └── slk-ledger-kernel/
│
├── apps/                                    <-- Level 6 Enterprise Business Studios & Level 1 Platform UI
│   ├── smriti-web/                          <-- Next.js Single Page UI (Container 1)
│   │   └── app.manifest.yaml
│   └── studios/
│       ├── pim-product-studio/             <-- Product Studio (PIM)
│       │   ├── studio.manifest.yaml        <-- Studio Manifest
│       │   └── src/
│       ├── eam-asset-studio/               <-- Asset Management Studio (EAM)
│       │   └── studio.manifest.yaml
│       └── ...
│
└── deploy/                                  <-- Level 7 Deployment Configurations (DDS v1.0)
    ├── docker-compose.yml                   <-- Professional Edition (5 Containers)
    └── docker-compose.community.yml         <-- Community Edition (3 Containers)
```

---

## 2. Mandatory Component Structure & Interface Contracts

### A. Mandatory Files for Every Kernel, Service, & Studio
Every deployable module directory MUST contain:
1. `kernel.manifest.yaml` (or `service.manifest.yaml` / `studio.manifest.yaml`): Valid `smriti.manifest.v1` document.
2. `src/interfaces/index.ts`: Exported TypeScript interfaces defining generic facade contracts.
3. `src/index.ts`: Main entry point exposing the module initialization factory function (`createInstance()`).
4. `package.json`: NPM module configuration.

### B. Standard Kernel Facade Pattern Interface Example (`IKernelFacade`)
```typescript
// Canonical Interface Contract for Level 3 Kernels
export interface IKernelFacade {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  
  initialize(context: IPlatformContext): Promise<void>;
  validateHealth(): Promise<IComponentHealthReport>;
  shutdown(): Promise<void>;
}
```

---

## 3. Developer Workflow: How to Create a New Shared Business Kernel

1. **Create Kernel Directory:** Create `packages/kernels/my-domain-kernel/`.
2. **Create Kernel Manifest:** Create `kernel.manifest.yaml`:
   ```yaml
   manifest:
     id: "urn:uuid:12345678-1234-5678-1234-567812345678"
     schema: "smriti.manifest.v1"
     type: "kernel"
     extends: "smriti.enterprise.kernel.v1"
     lifecycle: { state: "active" }
   identity:
     name: "My Domain Kernel"
     vendor: "SmritiSys"
     namespace: "smritibooks.kernel.mydomain"
   metadata:
     version: "1.0.0"
     issued: "2026-08-04T12:00:00Z"
   startup:
     phase: "30-kernel"
     priority: 300
   capabilities:
     provides: ["my-domain-service"]
     requires: ["relational-database"]
   ```
3. **Implement Facade Class:** Extend base kernel class adhering to KDS v1.1 15-Section layout.
4. **Register with UPR:** Add facade export to `SPK.kernels.register("MyDomainKernel", myDomainFacade)`.

---

## 4. Developer Workflow: How to Create a New Business Capability Studio

1. **Create Studio Directory:** Create `apps/studios/my-business-studio/`.
2. **Create Studio Manifest:** Create `studio.manifest.yaml` with `phase: "40-studio"` and `priority: 400`.
3. **Implement Object Page & List Report UI Patterns:** Enforce WNG-002 List Report or Object Page layout using Vanilla CSS & UPR facade metadata.
4. **Bind to Level 3 Kernels:** Consume facade APIs via `SPK.kernels.get("SDK")` or `SPK.kernels.get("SLK")`.

---

## 5. SPD Certification Gates & Architecture Compliance Score

SPD Platform Doctor enforces **Strict Mandatory Binary Gates** in addition to the **Weighted Compliance Score (100%)**. If ANY mandatory gate fails, certification status is `REJECTED (UNCERTIFIED)` regardless of score.

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SPD CERTIFICATION GATES & ARCHITECTURE COMPLIANCE REPORT              │
 ├────────────────────────────────────────────────────────────────────────┤
 │ MANDATORY BINARY GATES:                                                │
 │ • Gate 1: Constitution & 7-Layer Topology ──► PASS                     │
 │ • Gate 2: Manifest & SHA256 Checksum     ──► PASS                     │
 │ • Gate 3: Ed25519 & Revocation (CRL/OCSP)──► PASS                     │
 │ • Gate 4: Standards Adherence (KDS/DDS)  ──► PASS                     │
 │ • Gate 5: Container Readiness Contracts  ──► PASS                     │
 ├────────────────────────────────────────────────────────────────────────┤
 │ OVERALL SCORE: 100.0%                                                  │
 │ CERTIFICATION STATUS: ENTERPRISE CERTIFIED (PRODUCTION READY)          │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Packaging & Deployment Workflow (DDS v1.0)

1. **Build Artifacts:** `npm run build` (Compiles TypeScript & verifies zero undefined CSS variables).
2. **Generate Lock File:** `npx smriti-cli manifest lock` (Computes `platform.lock.yaml` and dependency graph hashes).
3. **Sign Manifests:** `npx smriti-cli manifest sign --key-id smriti-root-2026` (Embeds Ed25519 signature bytes).
4. **Package Docker Images:** Build Professional Edition containers (`web`, `api`, `db`, `redis`, `worker`).
5. **Launch Sequential Boot:** Execute `docker compose up -d` following `db` $\rightarrow$ `redis` $\rightarrow$ `api` $\rightarrow$ `worker` $\rightarrow$ `web` readiness order.
