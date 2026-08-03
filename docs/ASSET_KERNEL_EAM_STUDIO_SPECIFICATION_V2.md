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
**Scope:** KDS v1.0 Compliance, 10 SAK Principles, Categorized Contracts, & SAK v2.2 Roadmap

---

## 1. 10 SAK Architectural Principles (KDS v1.0 Compliant)

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
