<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 2.1.2
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Kernel & Studio Specification
-->

# SMRITI Asset Kernel (SAK v2.1) & Enterprise Asset Management Studio Specification (EAM v2.1 Baseline)

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ KERNEL QUICK FACTS HEADER                                              │
 ├───────────────────┬────────────────────────────────────────────────────┤
 │ Kernel Acronym    │ SAK (SMRITI Asset Kernel)                          │
 │ Kernel Version    │ v2.1 Baseline                                      │
 │ Platform Level    │ Level 3 (Shared Business Kernels)                  │
 │ Domain Owner      │ Enterprise Fixed Asset & Equipment Domain          │
 │ Level 2 Services  │ SEB, SES, SNP, SWA, SAS, STS, SAI                  │
 │ Level 3 Kernels   │ SDK, SLK, STK, SBPK, SIK, SNK                      │
 │ Events Published  │ 10 Asynchronous Events (SEB Event Bus)             │
 │ Events Consumed   │ 6 Domain Subscriptions                              │
 │ Public Service API│ 20 Service Methods (`SAK.AssetService`)            │
 │ KDS Compliance    │ ✅ PASSED (KDS v1.0 15-Section Compliant)          │
 └───────────────────┴────────────────────────────────────────────────────┘
```

**Status:** FROZEN — Enterprise Asset Management Baseline Specification v2.1 (2026-08-04)
**Scope:** KDS v1.0 Compliance, 15 Constitutional Principles, Categorized Contracts, & SAK v2.2 Roadmap

---

## 1. 15 SAK Architectural Principles (KDS v1.0 Compliant)

1. **SAK Domain Ownership:** SAK exclusively owns all fixed asset business logic. No Business Studio or UI component may modify asset tables directly.
2. **Mandatory Service Facade:** All asset operations MUST execute through `SAK.AssetService`.
3. **Immutable Asset Identity:** `asset_uuid` is 100% immutable once issued.
4. **Dual Lifecycle State/Status Separation:** Primary lifecycle state is an immutable state machine; operational sub-status is concurrent.
5. **Delegated Financial Ledger Postings:** Capitalization, depreciation, and disposal GL postings MUST delegate to `SLK Ledger Kernel`.
6. **Delegated Tax Calculations:** Input tax credit (ITC) and GST asset disposal write-offs MUST delegate to `STK Tax Kernel`.
7. **Delegated Document Lifecycle:** Asset acquisition, transfer, and disposal document approvals MUST delegate to `SDK Document Kernel`.
8. **Multi-Channel Notification Alerts:** Maintenance reminders and warranty expiry alerts MUST delegate to `SNP Notification Platform`.
9. **Event-Driven Communication:** All asset state changes MUST publish asynchronous events over `SEB Event Bus`.
10. **Strict Versioning Policy:** SAK v2.1 is locked as the production baseline. New capabilities (Relationships, IoT, GIS) are strictly reserved for SAK v2.2.
11. **Strict Backward Compatibility:** Existing public APIs shall NEVER break within SAK v2.x major release cycle.
12. **Idempotent Asset Operations:** All asset creation, custody transfer, and disposal API calls MUST be idempotent.
13. **Explicit Transaction Boundaries:** SAK owns its fixed asset transaction boundary; financial GL postings delegate cleanly to SLK.
14. **Full Operational Observability:** Exposes asset health endpoints, Prometheus counters, structured logs, and OpenTelemetry tracing.
15. **Closed Core, Open Extensibility:** Core asset lifecycle engine is closed; industry-specific rules extend via Industry Packs.

---

## 2. Categorized SAK v2.1 Platform Contracts

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
 │ SHARED BUSINESS KERNELS (LEVEL 3):                                    │
 │ • SDK (Document)   ── Enforces document state machine for PO, GRN, Move│
 │ • SLK (Ledger)     ── Posts capitalization, depreciation, disposal GLs │
 │ • STK (Tax)        ── Calculates GST ITC & tax write-off adjustments     │
 │ • SBPK (Printing)  ── Generates 1D/2D Barcode, QR code, & RFID label tags│
 │ • SIK (Integration)── Syncs vendor AMC contracts & IoT telemetry data  │
 │ • SNK (Node Sync)  ── Reconciles multi-site node transfers & vector clocks│
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. SAK v2.2 Reserved Capabilities Roadmap

Future asset platform extensions are formally reserved for **SAK v2.2**:
- **`SAK.RelationshipService`:** Hierarchy tree contracts (`CreateRelationship`, `RemoveRelationship`, `GetParent`, `GetChildren`, `FindDependencies`, `MoveHierarchy`).
- **IoT Telemetry Engine:** Equipment sensor streaming & predictive alerts.
- **GIS Location Tracking:** Spatial GPS coordinate mapping.
- **Digital Twin Engine:** Equipment wear-and-tear simulation models.
