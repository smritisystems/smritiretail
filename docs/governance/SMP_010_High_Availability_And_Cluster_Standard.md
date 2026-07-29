<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0 (SMP-010 Specification)
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Constitutional Governance Specification
-->

# SMP-010: High Availability & Cluster Coordination Standard

**Status:** APPROVED — Frozen Governance Specification (v1.0)  
**Parent Standard:** SMP-001 Modular Platform Specification  
**Scope:** Layer 5 Multi-Node Clustering, Leader Election, Heartbeats, State Sync  

---

## 1. Overview & Purpose
SMP-010 defines the high availability and cluster coordination rules for multi-node deployments of **SMRITI Retail OS (Layer 5)**. Cluster management acts purely as an operational orchestration layer above SPK Kernel, communicating strictly through SPK public APIs.

---

## 2. Cluster Node Lifecycle & Leader Election

Nodes in a cluster must execute a 4-stage lifecycle:

```text
 [JOINING] ──> [FOLLOWER] ──(Heartbeat Timeout)──> [CANDIDATE] ──> [LEADER]
```

1. **`Leader`** — Coordinates module state mutations and orchestrates maintenance.
2. **`Follower`** — Synchronizes `module_states` from PostgreSQL database system of record.
3. **`Candidate`** — Initiates quorum election when leader heartbeat expires.

---

## 3. Kernel Purity Rule
The Cluster Manager orchestrates node operations by calling published SPK public APIs (`is_module_enabled()`, `apply_profile()`). Cluster logic must never access SPK private internal registry dictionaries directly.
