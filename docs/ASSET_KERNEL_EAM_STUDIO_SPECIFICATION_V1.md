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
  Classification: Internal Kernel & Studio Specification
-->

# SMRITI Asset Kernel (SAK v1.1) & Enterprise Asset Management Studio Specification (EAM v1.1)

**Status:** FROZEN — Enterprise Asset Management Architecture Specification v1.1 (2026-08-04)
**Scope:** SAK Asset API Facade, Immutable Identity, 10-State Lifecycle, & Integration Matrix

---

## 1. SAK — SMRITI Asset Kernel v1.1 Architecture & Service API Facade

`SAK Asset Kernel v1.1` operates as an immutable Level 3 Shared Business Kernel providing pure service contracts (`SAK.AssetService`) consumed by all business studios without UI logic coupling.

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SAK — SMRITI ASSET KERNEL V1.1 SERVICE API FACADE                      │
 ├────────────────────────────────────────────────────────────────────────┤
 │ SAK.AssetService                                                       │
 │ ├── CreateAsset(payload: AssetPayload)                 ──► AssetRecord │
 │ ├── TransferAsset(assetId: UUID, targetBranch: String) ──► TransferResult│
 │ ├── AssignAsset(assetId: UUID, custodianId: String)    ──► CustodyLog   │
 │ ├── DisposeAsset(assetId: UUID, scrapValue: Money)     ──► DisposalDoc │
 │ ├── CalculateDepreciation(assetId: UUID, period: Date) ──► DeprSchedule│
 │ ├── ScheduleMaintenance(assetId: UUID, vendor: String) ──► WorkOrder   │
 │ ├── GenerateAssetQRCode(assetId: UUID)                 ──► BarcodeTag  │
 │ └── VerifyPhysicalAsset(scanPayload: ScanAudit)       ──► AuditReport │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Immutable Asset Identity Schema

Every fixed asset record managed by SAK v1.1 maintains immutable identity attributes:

| Field Name | Type | Description / Identifier Scope |
|---|---|---|
| `asset_uuid` | UUID v4 | Immutable universal asset identifier (never changes across transfers) |
| `asset_code` | String | Human-readable system asset code (e.g. `AST-2026-0042`) |
| `barcode_qr` | String | Encoded QR/Barcode GTIN string for handheld scanners |
| `rfid_epc` | String | RFID Electronic Product Code Class 1 Gen 2 tag |
| `serial_number` | String | Internal equipment serial number |
| `mfg_serial` | String | Manufacturer serial / IMEI / chassis number |
| `purchase_doc_id`| UUID v4 | Originating purchase order / GRN document reference (`SDK v1.0`) |
| `current_custodian`| String | Assigned employee user ID or branch manager |
| `current_location`| String | Warehouse bin / branch store ID |
| `current_status` | Enum | 10-State Asset Lifecycle Enum |

---

## 3. Governed 10-State Asset Lifecycle

Asset lifecycle transitions are enforced via `SDK v1.0` and `UWR Workflow Registry`:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ GOVERNED 10-STATE ASSET LIFECYCLE                                      │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Planned ──► Procured ──► Received ──► Capitalized ──► Assigned         │
 │    ▲                                                     │             │
 │    │                                                     ▼             │
 │ Disposed ◄── Transferred ◄── Maintenance ◄── In Service                │
 │    │                                                                   │
 │    ▼                                                                   │
 │ Archived                                                               │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Shared Kernel Integration Matrix

| Target Kernel | Integration Mechanism | Platform Business Outcome |
|---|---|---|
| **SDK Document Kernel** | Acquisition, Transfer, & Disposal Docs | Standardized document state machine & approval workflow |
| **SLK Ledger Kernel** | Financial & Capitalization Ledgers | Monthly depreciation & asset disposal gain/loss GL postings |
| **STK Tax Kernel** | Tax Treatment Calculation | Input tax credit (ITC) and GST asset disposal calculations |
| **SBPK Printing Kernel** | Barcode / QR Tag Generation | Asset label tags printed for physical audit scanning |
| **SNK Node Kernel** | Distributed Node Sync | Asset transfers synchronized across multi-site nodes |
| **SIK Integration Kernel** | Vendor & EDI Integration | External maintenance tickets & vendor AMC contract sync |
