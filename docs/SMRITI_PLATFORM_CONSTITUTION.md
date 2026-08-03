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
  Classification: Internal Architecture Constitution
-->

# SMRITI Digital Commerce Platform Constitution (FROZEN v1.0)

**Status:** PERMANENT ARCHITECTURAL CONSTITUTION — FROZEN v1.0 (2026-08-04)
**Baseline:** SMRITI Digital Commerce Platform OS v4.2 & KDS v1.1 Baseline
**Scope:** Supreme Governance Document for Platform OS, Shared Services, Shared Business Kernels, Master Data, Registries, Business Studios, Deployment Editions, & Network Topology

---

## 1. Platform Vision & Identity Statement

> **SMRITI Digital Commerce Platform OS** is a modular, multi-tenant, enterprise digital commerce operating system built on a strictly frozen 7-layer architecture, governed by constitutional engineering standards (KDS, SDS, RDS, BDS, NDS, IDS), powered by shared platform services and business kernels, and extended through certified business capability studios and distributed network nodes.

---

## 2. Supreme 7-Level Architectural Topology

All platform capabilities MUST be categorized into exactly one of the following 7 frozen architectural layers. **No new architectural layers may ever be introduced.**

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SMRITI DIGITAL COMMERCE PLATFORM OS ARCHITECTURAL TOPOLOGY             │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 1: Platform Operating System (SXP, SEEF, SEDS, WNG, USR)         │
 │ Level 2: Shared Platform Services (SEB, SES, SNP, SWA, SAS, STS, SAI,  │
 │          SPD Platform Doctor Service)                                  │
 │ Level 3: Shared Business Kernels (SDK, SBPK, SPPK, SIK, SNK, STK, SLK, │
 │          SAK Asset Kernel)                                             │
 │ Level 4: Master Data Platform (MDP v3.1, Reference Master Hub, MDGC)   │
 │ Level 5: Universal Registries (UFR, UWR, URR, USR, UPRT, ULR, UEDF)     │
 │ Level 6: Enterprise Business Studios (13 Certified Business Studios)   │
 │ Level 7: Network & Connectors (SMN Network Protocol, SIK Connectors)   │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Platform Deployment Topology: Professional Edition (DEFAULT BASELINE)

The **Professional Edition (5 Containers)** is the **DEFAULT PRODUCTION DEPLOYMENT** for SMRITI Retail OS across all standard customer environments:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SMRITI PROFESSIONAL EDITION (DEFAULT 5-CONTAINER DOCKER TOPOLOGY)      │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. smriti-web    ── Next.js Single Page UI, PWA & Mobile Web Layout    │
 │ 2. smriti-api    ── Platform OS, Boot Manager, SPD Doctor, SEB/SES/SAS,│
 │                     SDK/SLK/STK/SAK Kernels, Registries, All 13 Studios │
 │ 3. smriti-db     ── PostgreSQL Master Database                         │
 │ 4. smriti-redis  ── Cache, Message Queue, Session, & Distributed Locks │
 │ 5. smriti-worker  ── Background Worker (WhatsApp, SMS, AI, PDF, Sync)  │
 └────────────────────────────────────────────────────────────────────────┘
```

### Platform Deployment Editions Summary

| Edition Name | Default Status | Container Count | Deployment Topology & Target |
|---|---|---|---|
| **Community Edition** | Optional | 3 Containers | `smriti-web`, `smriti-api`, `smriti-db` (Demos / Small Shops) |
| **Professional Edition**| **DEFAULT (✅)** | **5 Containers** | **`smriti-web`, `smriti-api`, `smriti-db`, `smriti-redis`, `smriti-worker`** |
| **Enterprise Edition** | Optional | 12+ Containers | Professional + `gateway`, `search`, `otel`, `prometheus`, `grafana`, `smn`, `ai` |

---

## 4. Standardized Manifest Schema v1.0 (`smriti.manifest.v1`)

Every deployable layer artifact MUST expose a standardized, checksum-verified, digitally signed, and auditable manifest following the `smriti.manifest.v1` schema with support for inheritance (`extends`), Scoped Dependencies, Capabilities, Startup Phase Enums (`00-core` to `50-connector`), Compatibility Profiles, Lock Files (`platform.lock.yaml`), and CI/CD Build Provenance:

```yaml
# SMRITI Platform Baseline Manifest v1.0
manifest:
  id: "urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6"
  schema: "smriti.manifest.v1"
  type: "platform"
  extends: "smriti.enterprise.base.v1"
  lifecycle:
    state: "active" # Lifecycle State Machine: experimental -> active -> deprecated -> archived -> revoked

identity:
  name: "SMRITI Digital Commerce Platform OS"
  vendor: "SmritiSys"
  namespace: "smritibooks.platform.os"

metadata:
  version: "4.2.0"
  issued: "2026-08-04T12:30:00Z"
  deployment_edition: "Professional" # Default Edition

build:
  generated_by: "SmritiSys CI/CD Governance Pipeline v1.0"
  pipeline: "release-main-v4.2"
  commit: "a4fce7d3b2"
  build_number: "4201"
  validator: "SPD Validator v1.0"

integrity:
  algorithm: "SHA256"
  checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  dependency_graph_hash: "7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a"

signature:
  algorithm: "Ed25519"
  key_id: "smriti-root-2026"
  timestamp: "2026-08-04T12:30:05Z"
  signature_bytes: "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e"
  certificate:
    issuer: "SmritiSys Enterprise Certificate Authority"
    serial: "2026-ROOT-001"

trust:
  level: "Root" # Trust Levels: Root | Enterprise | Partner | Community
  policy: "strict"
  revocation:
    method: "CRL" # Methods: CRL | OCSP | Local | Bundle
  trust_cache:
    ttl: "300s"

startup:
  phase: "00-core" # Enums: 00-core | 10-registry | 20-service | 30-kernel | 40-studio | 50-connector
  priority: 100 # Priority Range: 100 (Highest - Core) to 900 (Connectors)

compatibility:
  profile: "enterprise" # Profiles: community | enterprise | cloud | edge

features:
  ai: true
  marketplace: true
  telemetry: true

capabilities:
  provides:
    - "platform-os"
    - "digital-commerce-kernel-host"
  requires:
    - "relational-database"
    - "redis-cache-queue"
    - "opentelemetry-collector"

dependencies:
  required:
    standards:
      KDS: { version: "1.1.0", checksum: "a1b2c3...", policy: "same-major" }
      SDS: { version: "1.0.0", checksum: "d4e5f6...", policy: "same-major" }
      IDS: { version: "1.0.0", checksum: "7a8b9c...", policy: "same-major" }
      BDS: { version: "1.0.0", checksum: "0e1f2a...", policy: "same-major" }
      RDS: { version: "1.0.0", checksum: "3b4c5d...", policy: "same-major" }
      NDS: { version: "1.0.0", checksum: "6e7f8a...", policy: "same-major" }
    kernels:
      SDK: { version: "1.0.0", checksum: "9b8a7c...", policy: "compatible-minor", trust_level: "Enterprise" }
      SLK: { version: "1.0.0", checksum: "5d4c3b...", policy: "compatible-minor", trust_level: "Enterprise" }
      STK: { version: "1.0.0", checksum: "2a1f0e...", policy: "compatible-minor", trust_level: "Enterprise" }
      SAK: { version: "2.1.0", checksum: "fa7dff...", policy: "compatible-minor", trust_level: "Enterprise" }
  optional:
    services:
      - "SAI-AI-Engine"
```

---

## 5. Governed Lifecycle State Machine

Components transition through an explicit, governed **Lifecycle State Machine**:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ GOVERNED LIFECYCLE STATE MACHINE                                       │
 ├────────────────────────────────────────────────────────────────────────┤
 │ experimental ──► active ──► deprecated ──► archived ──► revoked       │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Deterministic Boot Manager Runtime Architecture

The platform startup orchestrator cleanly decomposes into 11 specialized runtime components:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ DETERMINISTIC BOOT MANAGER RUNTIME ARCHITECTURE                        │
 ├────────────────────────────────────────────────────────────────────────┤
 │ BOOT MANAGER -> Manifest Loader -> Manifest Inheritance Resolver      │
 │              -> Integrity Verifier (SHA256 & Dependency Graph Hash)    │
 │              -> Trust Manager (Ed25519 & Revocation)                   │
 │              -> Capability Resolver -> Dependency Resolver             │
 │              -> Compatibility Engine -> Startup Scheduler (Phase/Prior)│
 │              -> Component Loader -> SPD Platform Doctor Check          │
 │              -> Health & Telemetry Verification -> READY               │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Deterministic Boot Failure Policy

| Boot Failure Severity | Governance Definition | Runtime System Behavior | Failure Examples |
|---|---|---|---|
| **Critical** | Core constitutional, key revocation, or kernel failure | **Abort Startup Immediately** | SPC missing, key revoked, signature invalid, graph hash mismatch |
| **Major** | Non-core studio or connector failure | **Start in Restricted / Read-Only Mode** | Optional studio missing, secondary connector offline |
| **Minor** | Operational service degradation | **Continue Startup with Logged Warnings**| Telemetry collector unreached, non-critical cache miss |
| **Info** | Non-blocking metric or doc gap | **Log Diagnostic Note Only** | Documentation link mismatch, non-semantic version note |

---

## 8. Governance Authority Precedence Hierarchy

1. **SPC (Platform Constitution):** Supreme architectural authority.
2. **PRIG (Reference Implementation Guide):** Canonical implementation & coding standard.
3. **Layer Governance Standards:** KDS, SDS, IDS, RDS, BDS, NDS.
4. **Kernel Specifications:** Domain kernel design specifications.
5. **Service Specifications:** Level 2 shared platform service specifications.
6. **Studio Specifications:** Level 6 business capability studio specifications.
7. **Industry Packs:** Industry extension packs.
8. **Implementation Code:** Executable codebase.

---

## 9. Shared Platform Service: SPD Platform Doctor Service

Operating within Level 2 Shared Platform Services, **SPD (SMRITI Platform Diagnostics)** acts as the platform's self-healing diagnostic engine:
- **Manifest & Lock File Audit:** Validates `platform.manifest.yaml` and `platform.lock.yaml`.
- **SHA256 & Dependency Graph Hash Verification:** Asserts payload and resolved graph hashes.
- **Ed25519 Signature & Revocation Audit:** Verifies signatures, checks `key_id` against CRL/OCSP revocation sources.
- **Container & Deployment Edition Audit:** Validates Professional Edition 5-container topology (`web`, `api`, `db`, `redis`, `worker`).
- **Startup Phase & Priority Orchestration:** Schedules initialization from `00-core` to `50-connector`.
- **Compatibility Profile Verification:** Asserts environment profile (`enterprise`, `community`, `cloud`, `edge`).
- **Platform Health Report:** Generates an enterprise-ready certification report (`100% READY FOR PRODUCTION`).

---

## 10. Baseline Structural Freeze & ADR Policy

1. **Constitutional Freeze Directive:** The 7-level Platform Topology, Platform OS v4.2, Professional Edition Deployment Topology (5 Containers), Shared Platform Services (Level 2), Shared Business Kernels (Level 3), Master Data Platform (Level 4), Universal Registries (Level 5), Business Studios (Level 6), and SMN Network Protocol (Level 7) are **PERMANENTLY FROZEN**.
2. **ADR Mandatory Conditions:** Architecture Decision Records (`ADR.md`) are strictly required ONLY for:
   - Introduction of a new Level 3 Shared Business Kernel or Level 2 Shared Service.
   - Breaking API changes to an existing public service facade (`KernelName.Service`).
   - Modification of cross-kernel transaction boundaries.
   - Alteration of USR security ABAC policies or data isolation models.
3. **Semantic Evolution Policy:** Routine bug fixes and non-breaking feature extensions use minor version increments (`v4.2.x`). Structural changes require a major version bump and an approved ADR.
