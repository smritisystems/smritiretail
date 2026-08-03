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
  Classification: Internal Architecture Capability Map
-->

# SMRITI Retail OS v2.0 Platform Capability Map & Architectural Index

**Status:** FROZEN — Enterprise Digital Commerce Platform Capability Map v2.0 (2026-08-04)
**Classification:** Complete Architectural Index & Platform Topology

---

## 1. Architectural Layer Hierarchy

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SMRITI DIGITAL COMMERCE PLATFORM OS V2.0 ARCHITECTURE                  │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 1: Platform OS & UX (SXP v1.0, SEEF v1.0, SEDS v1.0, WNG)       │
 │ Level 2: Platform Kernels (Inventory, SDK, SBPK, SIK, SPPK, Workflow)   │
 │ Level 3: Universal Registries (UFR, UWR, URR, USR, UPRT)               │
 │ Level 4: Enterprise Business Studios (10 Certified Studios)            │
 │ Level 5: External Integration Connectors (Statutory, Tally, Devices)   │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Shared Platform Kernels & Registries Index

| Kernel / Registry | Architectural Role | Status |
|---|---|---|
| **Inventory Kernel v1.0** | Immutable ledger, stock locks, bin allocation, journal audit | ✅ Certified |
| **SDK Document Kernel v1.0** | Universal document state machine (`Draft` $\rightarrow$ `Posted`) | ✅ Certified |
| **SBPK Printing Kernel v1.0** | 1D/2D Barcode generation, ESC/POS Thermal, ZPL, PDF/A | ✅ Certified |
| **SIK Integration Kernel v1.0**| Statutory GSTN sync, Tally XML, WhatsApp, Scales, Shopify | ✅ Certified |
| **SPPK Pricing Kernel v1.0** | Price lists, BOGO, Mix & Match, Happy Hours, Coupons | ✅ Certified |
| **Universal Form Registry (UFR)**| Metadata-driven dynamic form layouts & field controls | ✅ Certified |
| **Universal Workflow Registry (UWR)**| Entity state machines & role-based transition locks | ✅ Certified |
| **Universal Report Registry (URR)**| Analytical query execution, PDF/Excel/CSV exports | ✅ Certified |
| **Universal Security Registry (USR)**| ABAC security, role hierarchy, multi-tenant isolation | ✅ Certified |
| **Universal Print Registry (UPRT)**| Print layout schemas & template parameter substitution | ✅ Certified |

---

## 3. Certified Enterprise Business Studios Index

| Business Studio Domain | Workspaces | Key Business Scenarios | Status |
|---|---|---|---|
| **Inventory Studio** | 10 Workspaces | Stock ledgers, bin management, cycle counts | ✅ Certified |
| **Purchase Studio** | 6 Workspaces | Procurement, PO approvals, 3-way match | ✅ Certified |
| **Sales Studio** | 8 Workspaces | Order-to-Cash, tax invoices, customer credit | ✅ Certified |
| **POS Studio** | 6 Workspaces | Touch checkout, hardware, multi-tenders | ✅ Certified |
| **CRM Studio** | 10 Workspaces | Customer 360, loyalty tiers, wallet, campaigns | ✅ Certified |
| **Accounting Studio** | 10 Workspaces | COA, GST center, P&L, Balance Sheet, GSTR-1/2B | ✅ Certified |
| **Warehouse Studio** | 10 Workspaces | Dock receiving, directed put-away, wave pick | ✅ Certified |
| **Merchandising Studio**| 8 Workspaces | Assortments, buying calendar, markdowns | ✅ Certified |
| **Pricing & Promo Studio**| 8 Workspaces | Store price lists, BOGO, happy hour rules | ✅ Certified |
| **Replenishment Studio**| 8 Workspaces | Demand forecast, min/max reorder, ABC analysis| 🎯 Next Milestone |

---

## 4. Platform Freeze & Evolution Directives

> **Directive:** Platform OS v1.x, SXP, SEEF, SEDS, and shared kernels (Inventory, SDK, SBPK, SIK, SPPK) remain strictly frozen. Business capability development MUST consume these capabilities as generic facade clients.
