<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : SMP-001 v1.0
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Constitutional Architecture Standard
-->

# SMP-001: SMRITI Modular Platform Specification (v1.0 Baseline)

## 1. Architectural Mandate
`SMP-001` defines the **constitutional architectural contracts** of SMRITI Retail OS. It decouples the abstract platform specification (`SMP-001 v1.0`) from runtime engine implementations (`SPK v12.1.0`).

> **Long-Term Evolution Principle:** SMP-001 defines architectural contracts, not implementation details. Runtime implementations (SPK, SCM, Registry Manager, Event Manager, etc.) may evolve internally provided they preserve the public contracts defined by the SMP specification suite.

## 2. Versioning Hierarchy
- **SMP Specification Standard:** `v1.0` (Constitutional Architecture Standard).
- **SPK Runtime Kernel:** `v12.1.0` (Execution Engine).
- **SMRITI Retail OS:** `v12.1.0` (Commercial Product Release).

## 3. Structural Hierarchy & Categories
SMP enforces a 4-level hierarchy: `Platform → Module → Feature → Capability` across 12 Top-Level Domains:
1. Core Retail
2. Financial
3. CRM & Customer Experience
4. Procurement & Supply Chain
5. Warehouse & Logistics
6. Manufacturing
7. Human Resources
8. Enterprise Governance
9. AI & Automation
10. Integration Hub
11. Compliance & Tax
12. Platform & Administration

## 4. Module Types & States
- **Module Types:** `CORE`, `OPTIONAL`, `PLUGIN`, `SYSTEM`, `INTERNAL`, `EXPERIMENTAL`. Critical modules (`critical=True`, e.g. Sales) cannot be disabled.
- **Module States:** `NOT_INSTALLED`, `INSTALLED`, `LICENSED`, `ENABLED`, `DISABLED`, `LOCKED`, `DEPRECATED`, `BETA`, `PREVIEW`.

## 5. SPK Kernel Lifecycle
The SPK runtime kernel executes deterministic startup phases:
`BOOT → INITIALIZE → LOAD MODULES → START → READY → SHUTDOWN`.
