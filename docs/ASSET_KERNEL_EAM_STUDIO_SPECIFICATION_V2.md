<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 2.0.0
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Kernel & Studio Specification
-->

# SMRITI Asset Kernel (SAK v2.0) & Enterprise Asset Management Studio Specification (EAM v2.0)

**Status:** FROZEN — Enterprise Asset Management Architecture Specification v2.0 (2026-08-04)
**Scope:** Complete SAK API Facade (20 Methods), 5-Level Asset Hierarchy, 12-Tab Asset 360, & SEB Bus Events

---

## 1. SAK — SMRITI Asset Kernel v2.0 Complete Service API Facade

`SAK Asset Kernel v2.0` exposes a complete enterprise service API facade (`SAK.AssetService`) managing asset lifecycles, maintenance work orders, multi-method depreciation, physical audits, and SEB event dispatches:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SAK — SMRITI ASSET KERNEL V2.0 SERVICE API FACADE (20 METHODS)         │
 ├────────────────────────────────────────────────────────────────────────┤
 │ SAK.AssetService                                                       │
 │ ├── CreateAsset(payload: AssetPayload)                 ──► AssetRecord │
 │ ├── UpdateAsset(assetId: UUID, patch: AssetPatch)      ──► AssetRecord │
 │ ├── GetAsset(assetId: UUID)                            ──► AssetRecord │
 │ ├── SearchAssets(query: AssetSearchQuery)              ──► AssetList   │
 │ ├── AssignAsset(assetId: UUID, custodianId: String)    ──► CustodyLog   │
 │ ├── TransferAsset(assetId: UUID, targetBranch: String) ──► TransferResult│
 │ ├── ReserveAsset(assetId: UUID, forPurpose: String)    ──► Reservation │
 │ ├── ReleaseAsset(assetId: UUID, reservationId: UUID)   ──► ReleaseResult│
 │ ├── DisposeAsset(assetId: UUID, scrapValue: Money)     ──► DisposalDoc │
 │ ├── RestoreAsset(assetId: UUID, reason: String)        ──► RestoreResult│
 │ ├── CalculateDepreciation(assetId: UUID, method: Enum) ──► DeprSchedule│
 │ ├── GenerateDepreciationJournal(period: Date)          ──► JournalEntry│
 │ ├── CreateMaintenancePlan(assetId: UUID, schedule)     ──► MaintPlan   │
 │ ├── GenerateWorkOrder(planId: UUID)                    ──► WorkOrder   │
 │ ├── CompleteWorkOrder(workOrderId: UUID, cost: Money)  ──► MaintLog    │
 │ ├── VerifyPhysicalAsset(scanPayload: ScanAudit)       ──► AuditReport │
 │ ├── GenerateQRCode(assetId: UUID)                      ──► QRTag       │
 │ ├── GenerateRFID(assetId: UUID)                        ──► RFIDTag     │
 │ ├── ImportAssets(csvStream: Stream)                    ──► ImportReport│
 │ └── ExportAssets(filter: AssetFilter)                  ──► ExportFile  │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 5-Level Enterprise Asset Classification Hierarchy

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 5-LEVEL ASSET CLASSIFICATION HIERARCHY                                 │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 1: Asset Class     ── (e.g. IT Equipment, Plant & Machinery)     │
 │    └─► Level 2: Category ── (e.g. Laptops, POS Hardware, Vehicles)    │
 │         └─► Level 3: Group ── (e.g. Dell Latitude Series)             │
 │              └─► Level 4: Asset ── (e.g. AST-2026-0042)                │
 │                   └─► Level 5: Component ── (e.g. Laptop Battery/RAM)  │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Governed 12-State Asset Lifecycle

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ GOVERNED 12-STATE ASSET LIFECYCLE                                      │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Draft ──► Planned ──► Procured ──► Received ──► Capitalized ──► Available│
 │                                                                   │    │
 │                                                                   ▼    │
 │ Archived ◄── Disposed ◄── Transferred ◄── Maintenance ◄── Assigned ◄──┘│
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 4. SEB Event Bus Asset Events

SAK v2.0 publishes asynchronous domain events over **SEB Event Bus (`SEB v1.0`)**:
- `asset.created` / `asset.updated` / `asset.capitalized`
- `asset.assigned` / `asset.transferred` / `asset.reserved`
- `asset.maintenance_due` / `asset.work_order_completed`
- `asset.depreciation_posted` / `asset.disposed` / `asset.archived`

---

## 5. 12-Tab Asset 360 Object Page Schema

| Tab # | Tab Name | Primary Content & Business Purpose |
|---|---|---|
| **Tab 1** | **General Information** | Asset Name, Code, Asset Class/Category/Group, Industry Type |
| **Tab 2** | **Identity & Serial Numbers** | Barcode, QR, RFID EPC, Serial #, Manufacturer Serial, UUID |
| **Tab 3** | **Financial & Capitalization** | Purchase Cost, Landed Cost, Capitalization Date, Salvage Value |
| **Tab 4** | **Custody & Assignment** | Current Custodian, Employee ID, Custody History, Reservation Log |
| **Tab 5** | **Location & Bin Routing** | Branch Store ID, Warehouse ID, Bin Location, Movement History |
| **Tab 6** | **Maintenance & Work Orders** | Preventive Maintenance Plans, Work Orders, Repair Log, Technician |
| **Tab 7** | **Warranty & Vendor AMC** | AMC Contract #, Vendor Details, Expiry Date, Claim Journal |
| **Tab 8** | **Depreciation Schedule** | Method (Straight Line / DB / Units), Accum Depr, Net Book Value |
| **Tab 9** | **Related Documents** | PO, GRN, Maintenance Invoices, Disposal Docs (`SDK v1.0`) |
| **Tab 10** | **Activity History & Events** | SEB Event Bus audit log & timestamped status changes |
| **Tab 11** | **Physical Verification Audit** | Handheld scanner audit logs, physical vs book reconciliations |
| **Tab 12** | **Audit & Governance** | SAS Audit Trail, field modification journal, user approvals |
