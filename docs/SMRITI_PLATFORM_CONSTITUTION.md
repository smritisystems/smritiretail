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
- **DDS (Deployment Development Standard):** Governs Docker container contracts, readiness/health levels, graceful shutdown, and distributed leader election.
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
 │ 4. smriti-worker ── Async Worker + Distributed Leader Scheduler        │
 │ 5. smriti-web    ── Next.js Single Page UI, PWA & Mobile Web Layout    │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Container Health Levels & Graceful Shutdown Contracts (DDS v1.0)

### A. Health State Levels
Containers expose detailed `/health` status reports adhering to 6 canonical **Health Levels**:
- **`STARTING`:** Container initializing; readiness check in progress.
- **`READY`:** Fully functional; accepting production traffic.
- **`DEGRADED`:** Partial capability degradation (e.g. Redis cache miss fallback to DB); traffic accepted with warning.
- **`READONLY`:** Storage or database restriction mode; read transactions permitted; write transactions blocked.
- **`STOPPING`:** Graceful shutdown sequence initiated; draining active jobs.
- **`FAILED`:** Unrecoverable error; triggers container restart / failover.

### B. Graceful Shutdown Order (Reverse Boot Order)
When a platform shutdown signal (`SIGTERM` / `SIGINT`) is received, containers execute **Graceful Shutdown** in reverse order to prevent data loss or corrupted transactions:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ DETERMINISTIC GRACEFUL SHUTDOWN ORDER (REVERSE BOOT ORDER)             │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. smriti-web    ── Stop accepting new HTTP/PWA traffic                │
 │ 2. smriti-worker ── Finish in-flight jobs, release scheduler lock, exit│
 │ 3. smriti-api    ── Complete active API requests, flush logs, exit    │
 │ 4. smriti-redis  ── Flush pending queues, save RDB snapshot, exit      │
 │ 5. smriti-db     ── Close connection pools, execute final WAL, exit    │
 └────────────────────────────────────────────────────────────────────────┘
```

### C. Distributed Leader Election Architecture
To enable horizontal worker scaling without duplicate cron execution:
- **Queue Worker Mode (Multi-Instance):** Any number of `smriti-worker` instances process queued jobs in parallel.
- **Scheduler Mode (Distributed Leader Lock):** Exactly **ONE** worker instance acquires an implementation-agnostic distributed leader lock (Redis Lock, Postgres Advisory Lock, or Kubernetes Lease) to execute scheduled tasks.

---

## 6. Deterministic Boot Failure Policy

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
- **Health Level Audit:** Asserts health states (`STARTING`, `READY`, `DEGRADED`, `READONLY`, `STOPPING`, `FAILED`).
- **Graceful Shutdown Audit:** Verifies reverse shutdown handling (`web` $\rightarrow$ `worker` $\rightarrow$ `api` $\rightarrow$ `redis` $\rightarrow$ `db`).
- **Distributed Leader Lock Audit:** Verifies single-leader lock ownership across worker nodes.
- **Platform Health Report:** Generates an enterprise-ready certification report (`100% READY FOR PRODUCTION`).

---

## 9. Baseline Structural Freeze & ADR Policy

1. **Constitutional Freeze Directive:** The 7-level Platform Topology, Platform OS v4.2, Professional Edition Deployment Topology (5 Containers), Graceful Shutdown Order, Health Levels, Distributed Leader Election, Shared Platform Services (Level 2), Shared Business Kernels (Level 3), Master Data Platform (Level 4), Universal Registries (Level 5), Business Studios (Level 6), and SMN Network Protocol (Level 7) are **PERMANENTLY FROZEN**.
2. **ADR Mandatory Conditions:** Architecture Decision Records (`ADR.md`) are strictly required ONLY for:
   - Introduction of a new Level 3 Shared Business Kernel or Level 2 Shared Service.
   - Breaking API changes to an existing public service facade (`KernelName.Service`).
   - Modification of cross-kernel transaction boundaries.
   - Alteration of USR security ABAC policies or data isolation models.
3. **Semantic Evolution Policy:** Routine bug fixes and non-breaking feature extensions use minor version increments (`v4.2.x`). Structural changes require a major version bump and an approved ADR.
