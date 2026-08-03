<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.1.0
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Specification
-->

# SMRITI Master Data Platform Specification (MDP v3.1)

**Status:** FROZEN — Enterprise Master Data Platform Specification v3.1 (2026-08-04)
**Scope:** Master Data Platform (MDP), Reference Data Hub (RDH), Master Data Governance Center (MDGC), & SNK Node Kernel

---

## 1. Enterprise Master Data Platform (MDP v3.1) Architecture

`Master Data Platform (MDP v3.1)` is established as the enterprise-wide master data and governance platform, organizing master data into 7 distinct domain boundaries and serving as the single source of truth across SMRITI Digital Commerce Platform.

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SMRITI ENTERPRISE MASTER DATA PLATFORM (MDP V3.1 TOPOLOGY)              │
 ├────────────────────────────────────────────────────────────────────────┤
 │                                                                        │
 │                      MASTER DATA PLATFORM (MDP)                        │
 │                                  │                                     │
 │  ┌───────────────────────────────┼──────────────────────────────────┐  │
 │  │                               │                                  │  │
 │ Product Domain               Customer Domain                 Supplier  │
 │  │                               │                                  │  │
 │ Warehouse Domain             Financial Domain                Org Domain│
 │  │                               │                                  │  │
 │ Security Domain              Reference Data Hub (RDH)        MDGC Center│
 │  └───────────────────────────────┴──────────────────────────────────┘  │
 │                                  │                                     │
 │                          Catalog Publisher                             │
 │                                  │                                     │
 │                          SNK Node Kernel                               │
 │                                  │                                     │
 │      ┌──────────────┬────────────┼────────────┬──────────────┐         │
 │      │              │            │            │              │         │
 │     POS           Sales       Shopify       Amazon       Branches      │
 └──────────────┴────────────┴────────────┴────────────┴──────────────┘
```

---

## 2. Reference Data Hub (RDH) vs. Master Data Domains

MDP v3.1 strictly separates dynamic business master entities from shared system reference lookups:

| Domain Category | Domain / Hub Name | Entities & Managed Lookups | Target Platform Consumers |
|---|---|---|---|
| **Master Domain** | **Product Domain** | Product Concept, Master, Variants, SKUs | Product Studio, Sales, POS, Warehouse |
| **Master Domain** | **Customer Domain** | Customer Master, Loyalty Accounts, Wallets | CRM Studio, Sales, POS Checkout |
| **Master Domain** | **Supplier Domain** | Vendor Master, Rate Matrices, Contracts | Purchase Studio, Accounting AP |
| **Master Domain** | **Warehouse Domain**| Warehouses, Bin Locations, Zones, Racks | Warehouse Studio, Inventory Kernel |
| **Master Domain** | **Financial Domain**| Chart of Accounts, Cash/Bank Accounts | Accounting Studio, Ledger Engine |
| **Master Domain** | **Organization Domain**| Companies, Branches, Store Outlets, Registers | Platform OS, WNG Navigation |
| **Reference Hub** | **Reference Data Hub (RDH)**| GST Rates, HSN/SAC, Countries, States, Cities, UOM Ratios, Payment Terms, Reason Codes, Colors, Sizes | All Business Studios & Registries |

---

## 3. Master Data Governance Center (MDGC)

The **Master Data Governance Center (MDGC)** provides automated data quality, stewardship, deduplication, and survivorship rules:
- **Deduplication Engine:** Scans products (EAN/SKU/Name), customers (Mobile/Email/GSTIN), and suppliers (PAN/GSTIN/Mobile) to detect duplicates.
- **Survivorship & Record Merge:** Merge wizard resolves conflicting master attributes using configurable survivorship rules (e.g. Most Recent Update, Primary Node Owner).
- **Reference Integrity Guard:** Prevents master record deletion if active transaction documents exist in `SDK v1.0` or stock balances exist in `Inventory Kernel v1.0`.

---

## 4. SNK Node Kernel (Distributed Multi-Site Sync Protocol)

`SNK Node Kernel (SMRITI Node Kernel)` governs master data synchronization, version reconciliation, and conflict resolution across distributed SMRITI standalone installations, branch stores, and cloud nodes:
- **Node Metadata:** `master_uuid`, `organization_id`, `node_owner_id`, `created_node_id`, `version_id`, `published_version`, `revision_hash`, `effective_date`, `sync_status`.
- **Conflict Resolution:** Vector clock revision comparison; primary node owner authority overrides local node edits during sync collisions.
