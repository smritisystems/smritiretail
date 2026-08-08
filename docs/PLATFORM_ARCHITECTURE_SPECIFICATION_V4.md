<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.2.0
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Specification
-->

# SMRITI Platform OS Architecture & Kernels Specification (SPO v4.2)

**Status:** FROZEN — Enterprise Digital Commerce Platform Architecture Specification v4.2 (2026-08-04)
**Scope:** 7-Level Platform Topology, Shared Business Kernels (STK Tax Kernel, SLK Ledger Kernel), & SMN Network Protocols

---

## 1. SMRITI Digital Commerce Platform v4.2 7-Level Topology

`SMRITI Digital Commerce Platform v4.2` formalizes the 7-level architecture with clear architectural terminology across shared services, business kernels, master data, registries, studios, and network connectors:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SMRITI DIGITAL COMMERCE PLATFORM OS V4.2 ARCHITECTURE                  │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 1: Platform Operating System (SXP, SEEF, SEDS, WNG, USR)         │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 2: Shared Platform Services (SEB, SES, SNP, SWA, SAS, STS, SAI)  │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 3: Shared Business Kernels (SDK, SBPK, SPPK, SIK, SNK, STK, SLK) │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 4: Master Data Platform (MDP v3.1, Reference Master Hub, MDGC)   │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 5: Universal Registries (UFR, UWR, URR, USR, UPRT, ULR, UEDF)     │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 6: Enterprise Business Studios (12 Certified Business Studios)   │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 7: Network & Connectors (SMN Network Protocol, SIK Connectors)   │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Level 3 Shared Business Kernels (STK & SLK Additions)

| Shared Business Kernel | Kernel Acronym | Architectural Role & Scope |
|---|---|---|
| **SMRITI Tax Kernel** | **STK v1.0** | Universal tax engine for GST, CGST, SGST, IGST, CESS, HSN validation, and international tax rules across Sales, Purchase, and POS |
| **SMRITI Ledger Kernel**| **SLK v1.0** | Immutable ledger engine managing Stock Ledger, Customer Ledger, Supplier Ledger, Financial Ledger, Wallet Ledger, and Loyalty Ledger |
| **SMRITI Node Kernel** | **SNK v1.0** | Node identity, version reconciliation, vector clock conflict resolution, and offline replay |
| **SDK Document Kernel** | **SDK v1.0** | Universal document state machine (`Draft` $\rightarrow$ `Submitted` $\rightarrow$ `Posted`) |
| **SBPK Printing Kernel**| **SBPK v1.0**| 1D/2D Barcode generation, ESC/POS Thermal, ZPL, PDF/A |
| **SIK Integration Kernel**| **SIK v1.0** | Statutory GSTN sync, Tally XML, WhatsApp, Scales, Shopify |
| **SPPK Pricing Kernel** | **SPPK v1.0**| Store price lists, BOGO, Mix & Match, Happy Hours, Coupons |
| **Inventory Kernel** | **Inventory v1.0**| Stock allocations, bin routing, physical stock locks |

---

## 3. Level 7 Network & Connectors (SMN Network Protocol)

`SMN Network (SMRITI Network Protocol)` governs distributed multi-site network operations across standalone nodes, branch stores, and head office hubs:
- **Node Discovery Protocol:** Automatic zero-configuration discovery and registration of new branch nodes on local network.
- **Node & License Registry:** Centralized node health, heartbeat monitoring, and license scope enforcement.
- **Remote Encrypted Backup:** Head-office initiated compressed, encrypted backups across branch nodes with cloud upload.
- **Deployment & Update Manager:** Centralized push updates, schema migrations, and automated rollback guard.
