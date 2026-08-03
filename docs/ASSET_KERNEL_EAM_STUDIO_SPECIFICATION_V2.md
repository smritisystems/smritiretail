<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 2.1.1
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Kernel & Studio Specification
-->

# SMRITI Asset Kernel (SAK v2.1) & Enterprise Asset Management Studio Specification (EAM v2.1 Baseline)

**Status:** FROZEN — Enterprise Asset Management Baseline Specification v2.1 (2026-08-04)
**Scope:** Categorized 13 Platform Contracts, Dual Lifecycle Baseline, & SAK v2.2 Future Roadmap

---

## 1. Categorized SAK v2.1 Platform Contracts

SAK v2.1 formally categorizes its 13 explicit platform contracts into **Shared Platform Services (Level 2)** and **Shared Business Kernels (Level 3)**:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SAK V2.1 CATEGORIZED PLATFORM CONTRACTS                                │
 ├────────────────────────────────────────────────────────────────────────┤
 │ SHARED PLATFORM SERVICES (LEVEL 2):                                    │
 │ • SEB (Event Bus)  ── Publishes 10 asset lifecycle & status events    │
 │ • SES (Search)     ── Indexes asset UUID, codes, serials, QR/RFID, tags  │
 │ • SNP (Notify)     ── Dispatches WhatsApp/SMS maintenance alerts      │
 │ • SWA (Automation) ── Triggers approval workflows for disposal        │
 │ • SAS (Audit)      ── Logs immutable audit trail of field edits        │
 │ • STS (Scheduler)  ── Runs recurring monthly depreciation & maintenance│
 │ • SAI (AI Engine)  ── Executes predictive maintenance & useful-life ML │
 ├────────────────────────────────────────────────────────────────────────┤
 │ SHARED BUSINESS KERNELS (LEVEL 3):                                     │
 │ • SDK (Document)   ── Enforces document state machine for PO, GRN, Move│
 │ • SLK (Ledger)     ── Posts capitalization, depreciation, disposal GLs │
 │ • STK (Tax)        ── Calculates GST ITC & tax write-off adjustments     │
 │ • SBPK (Printing)  ── Generates 1D/2D Barcode, QR code, & RFID label tags│
 │ • SIK (Integration)── Syncs vendor AMC contracts & IoT telemetry data  │
 │ • SNK (Node Sync)  ── Reconciles multi-site node transfers & vector clocks│
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. SAK v2.2 Future Evolution Roadmap (Reserved Features)

The baseline for **SAK v2.1** is officially locked and frozen (`aba00260`). Future asset extensions are reserved for **SAK v2.2**:
- **SAK.RelationshipService:** Hierarchy tree contracts (`Parent`, `Child`, `Accessory`, `Replacement`, `Component`, `Spare`, `Bundle`).
- **IoT Telemetry & Condition Monitoring:** Real-time sensor alerts (vibration, temperature, runtime hours).
- **GIS Location Services:** Spatial GPS asset tracking for fleet vehicles and field equipment.
- **Digital Twin Simulation:** Equipment wear-and-tear simulation models.
