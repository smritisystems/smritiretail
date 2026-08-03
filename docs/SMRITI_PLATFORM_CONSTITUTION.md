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

> **SMRITI Digital Commerce Platform OS** is a modular, multi-tenant, enterprise digital commerce operating system built on a strictly frozen 7-layer architecture, governed by constitutional engineering standards (KDS, SDS, RDS, BDS, NDS, IDS, DDS), powered by shared platform services and business kernels, and extended through certified business capability studios and distributed network nodes.

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

## 3. Governance Standards Hierarchy (Including DDS v1.0)

Every layer and operational aspect derives its engineering authority from a dedicated governance standard:
- **SPC (Platform Constitution):** Supreme architectural governance framework (`8732cb77`).
- **PRIG (Reference Implementation Guide):** Canonical repo layout, coding rules, & OpenTelemetry standards.
- **PCMM (Platform Capability Maturity Model):** L1 Foundation $\rightarrow$ L2 Operational $\rightarrow$ L3 Integrated $\rightarrow$ L4 Enterprise $\rightarrow$ L5 Ecosystem.
- **DDS (Deployment Development Standard):** Governs Docker container contracts, readiness checks, volume mappings, and scaling rules.
- **KDS (Kernel Development Standard):** Governs Level 3 Shared Business Kernels.
- **SDS (Service Development Standard):** Governs Level 2 Shared Platform Services.
- **RDS (Registry Development Standard):** Governs Level 5 Universal Registries.
- **BDS (Business Studio Standard):** Governs Level 6 Business Capability Studios.
- **NDS (Network Development Standard):** Governs Level 7 SMN Network Protocols.
- **IDS (Integration Development Standard):** Governs REST APIs, GraphQL, Webhooks, OAuth, & external connectors.

---

## 4. Platform Deployment Topology: Professional Edition (DEFAULT BASELINE)

The **Professional Edition (5 Containers)** is the **DEFAULT PRODUCTION DEPLOYMENT** for SMRITI Retail OS across 95% of customer environments:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SMRITI PROFESSIONAL EDITION (DEFAULT 5-CONTAINER DOCKER TOPOLOGY)      │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. smriti-db     ── PostgreSQL Master Database & Migrations            │
 │ 2. smriti-redis  ── Cache, Queue, Pub/Sub, Sessions, & Distributed Lock│
 │ 3. smriti-api    ── Stateless API: OS, Boot Manager, SPD Doctor, Kernels│
 │ 4. smriti-worker ── Async Worker (Consumers) + Redis Leader Scheduler  │
 │ 5. smriti-web    ── Next.js Single Page UI, PWA & Mobile Web Layout    │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Container Readiness Contracts & Health Check Standards (DDS v1.0)

During container boot, every container MUST pass its mandatory **Readiness Check** before subsequent containers are started:

| Boot Order | Container Name | Container Readiness Contract | Scaling Strategy |
|---|---|---|---|
| **1** | **`smriti-db`** | PostgreSQL accepts connections & schema migrations complete | Primary / Replica Failover |
| **2** | **`smriti-redis`** | Redis PING succeeds & queue namespace initialized | Sentinel / Redis Cluster |
| **3** | **`smriti-api`** | SPC loaded, manifests verified, SPD passed, `/health` = READY | Horizontal Stateless Auto-Scale |
| **4** | **`smriti-worker`**| Redis Queue connected & Scheduler Leader elected via lock | Horizontal Worker Auto-Scale |
| **5** | **`smriti-web`** | API reachability verified & Next.js assets loaded | Horizontal UI Auto-Scale |

### Worker Scheduler Leader Election Architecture

To enable horizontal worker scaling without duplicate cron execution:
- **Queue Worker Mode (Multi-Instance):** Any number of `smriti-worker` instances process queued jobs in parallel (WhatsApp, SMS, Email, AI, PDF, Stock Sync).
- **Scheduler Mode (Leader-Elected):** Exactly **ONE** worker instance acquires a Redis distributed lock (`smriti:scheduler:leader_lock`) to execute cron maintenance, retention, and backup tasks.

---

## 6. Deterministic Platform Boot Failure Policy

| Boot Failure Severity | Governance Definition | Runtime System Behavior | Failure Examples |
|---|---|---|---|
| **Critical** | Core constitutional, key revocation, or kernel failure | **Abort Startup Immediately** | SPC missing, key revoked, signature invalid, container check failed |
| **Major** | Non-core studio or connector failure | **Start in Restricted / Read-Only Mode** | Optional studio missing, secondary connector offline |
| **Minor** | Operational service degradation | **Continue Startup with Logged Warnings**| Telemetry collector unreached, non-critical cache miss |
| **Info** | Non-blocking metric or doc gap | **Log Diagnostic Note Only** | Documentation link mismatch, non-semantic version note |

---

## 7. Governance Authority Precedence Hierarchy

1. **SPC (Platform Constitution):** Supreme architectural authority.
2. **PRIG (Reference Implementation Guide):** Canonical implementation & coding standard.
3. **Layer Governance Standards:** KDS, SDS, IDS, RDS, BDS, NDS, DDS.
4. **Kernel Specifications:** Domain kernel design specifications.
5. **Service Specifications:** Level 2 shared platform service specifications.
6. **Studio Specifications:** Level 6 business capability studio specifications.
7. **Industry Packs:** Industry extension packs.
8. **Implementation Code:** Executable codebase.

---

## 8. Shared Platform Service: SPD Platform Doctor Service

Operating within Level 2 Shared Platform Services, **SPD (SMRITI Platform Diagnostics)** acts as the platform's self-healing diagnostic engine:
- **Manifest & Lock File Audit:** Validates `platform.manifest.yaml` and `platform.lock.yaml`.
- **SHA256 & Dependency Graph Hash Verification:** Asserts payload and resolved graph hashes.
- **Ed25519 Signature & Revocation Audit:** Verifies signatures, checks `key_id` against CRL/OCSP revocation sources.
- **Container Readiness & DDS Audit:** Asserts container readiness contracts (`db` $\rightarrow$ `redis` $\rightarrow$ `api` $\rightarrow$ `worker` $\rightarrow$ `web`).
- **Scheduler Leader Election Audit:** Verifies single-leader lock ownership (`smriti:scheduler:leader_lock`).
- **Platform Health Report:** Generates an enterprise-ready certification report (`100% READY FOR PRODUCTION`).

---

## 9. Baseline Structural Freeze & ADR Policy

1. **Constitutional Freeze Directive:** The 7-level Platform Topology, Platform OS v4.2, Professional Edition Deployment Topology (5 Containers), Container Readiness Contracts (DDS v1.0), Leader-Elected Worker Scheduler, Shared Platform Services (Level 2), Shared Business Kernels (Level 3), Master Data Platform (Level 4), Universal Registries (Level 5), Business Studios (Level 6), and SMN Network Protocol (Level 7) are **PERMANENTLY FROZEN**.
2. **ADR Mandatory Conditions:** Architecture Decision Records (`ADR.md`) are strictly required ONLY for:
   - Introduction of a new Level 3 Shared Business Kernel or Level 2 Shared Service.
   - Breaking API changes to an existing public service facade (`KernelName.Service`).
   - Modification of cross-kernel transaction boundaries.
   - Alteration of USR security ABAC policies or data isolation models.
3. **Semantic Evolution Policy:** Routine bug fixes and non-breaking feature extensions use minor version increments (`v4.2.x`). Structural changes require a major version bump and an approved ADR.
