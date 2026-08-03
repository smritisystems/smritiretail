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
  Classification: Internal Kernel & Studio Specification
-->

# SMRITI Asset Kernel (SAK v1.0) & Enterprise Asset Management Studio Specification (EAM v1.0)

**Status:** FROZEN — Enterprise Asset Management Architecture Specification v1.0 (2026-08-04)
**Scope:** SAK Asset Kernel, 10-Workspace EAM Studio, Depreciation Engine, & Physical Verification

---

## 1. SAK — SMRITI Asset Kernel v1.0 Architecture

`SAK Asset Kernel v1.0` serves as the Level 3 Shared Business Kernel for fixed asset lifecycle management, depreciation calculation, warranty tracking, and physical asset verification across all SMRITI business studios.

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SAK — SMRITI ASSET KERNEL V1.0 ARCHITECTURE                            │
 ├────────────────────────────────────────────────────────────────────────┤
 │                                                                        │
 │                          SAK ASSET KERNEL                              │
 │                                  │                                     │
 │ ┌────────────────────────────────┼──────────────────────────────────┐  │
 │ │                                │                                  │  │
 │ Asset Lifecycle Engine      Depreciation Engine             Warranty Hub│
 │ │                                │                                  │  │
 │ Physical Verification        Asset Transfer Router           SLK Posting│
 │ └────────────────────────────────┴──────────────────────────────────┘  │
 │                                  │                                     │
 │       ┌──────────────────────────┼──────────────────────────┐          │
 │       │                          │                          │          │
 │ Purchase Studio             Warehouse Studio           Accounting Studio│
 │ (Auto GRN Capitalize)       (Branch & Bin Routing)     (Depreciation JV)│
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. EAM Studio v1.0 Workspace Architecture (10 Workspaces)

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ ENTERPRISE ASSET MANAGEMENT STUDIO V1.0 WORKSPACE ARCHITECTURE         │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. Asset Dashboard             ── (Asset Valuation, Depreciation, SLA) │
 │ 2. Asset Registry              ── (Master List Report & Multi-Filters) │
 │ 3. Asset 360 Object Page       ── (Lifecycle, Maintenance, Warranty)  │
 │ 4. Asset Assignment & Transfer ── (Employee Custody & Branch Routing)  │
 │ 5. Asset Maintenance           ── (Preventive Maintenance & Repair)    │
 │ 6. Warranty & AMC Hub          ── (Vendor AMC Contracts & Claim Log)   │
 │ 7. Depreciation Engine         ── (Straight Line & Reducing Balance)   │
 │ 8. Physical Verification Audit ── (Bar/QR/RFID Stock Audit & Scans)    │
 │ 9. Asset Disposal & Retirement ── (Scrap, Sale, & Write-off Journal)   │
 │ 10. Asset Analytics & Reports  ── (Universal Report Registry Engine)   │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Platform Integration Matrix

| Target Platform Layer / Studio | Integration Mechanism | Business Outcome |
|---|---|---|
| **Product / PIM Studio** | Asset Models & Templates | Capitalized asset template linked to master catalog |
| **Purchase Studio** | GRN Auto-Capitalization | Asset record automatically generated upon GRN receipt |
| **Warehouse Studio** | Branch & Custody Routing | Asset transferred between branch stores & bin locations |
| **Accounting Studio** | Depreciation Journal Vouchers | Monthly depreciation posted to SLK Ledger Kernel |
| **CRM Studio** | Customer Warranty & AMC | Customer-owned equipment serviced via CRM ticket |
| **SBPK Printing Kernel** | Barcode / QR Tag Generation | Asset label tags printed for physical audit scanning |
| **SDK Document Kernel** | Document State Machine | Asset acquisition & disposal document approvals |
| **SLK Ledger Kernel** | Immutable Ledger Posting | Asset capitalization, depreciation, & disposal ledgers |
| **STK Tax Kernel** | Tax Treatment Calculation | Input tax credit (ITC) & GST disposal calculations |
| **SNK / SMN Network** | Distributed Node Sync | Asset movement tracked across multi-site nodes |
