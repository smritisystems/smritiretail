<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.0.0
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Specification
-->

# SMRITI Master Data Hub Architecture & Product Studio Specification (MDH v3.0)

**Status:** FROZEN — Enterprise Master Data Hub Architecture Specification v3.0 (2026-08-04)
**Scope:** Master Data Hub (MDH), 4-Level Identity Hierarchy, Node-Aware Metadata, & Catalog Publisher

---

## 1. Enterprise Master Data Hub (MDH v3.0) Architecture

`Master Data Hub (MDH v3.0)` is established as the platform-level master data engine, owning all master entities across SMRITI Retail OS. **Product Studio** operates as the primary user-facing PIM application consuming MDH.

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SMRITI ENTERPRISE MASTER DATA HUB (MDH V3.0 TOPOLOGY)                   │
 ├────────────────────────────────────────────────────────────────────────┤
 │                                                                        │
 │                      ENTERPRISE MASTER DATA HUB                        │
 │                                  │                                     │
 │  ┌───────────────────────────────┼──────────────────────────────────┐  │
 │  │                               │                                  │  │
 │ Product Master               Brand Master                    Category  │
 │  │                               │                                  │  │
 │ Supplier Master              Customer Master                 Warehouse │
 │  │                               │                                  │  │
 │ Tax Profile                  Currency Master                 UOM Ratios│
 │  │                               │                                  │  │
 │ Price Lists                  Payment Terms                   Reason Code│
 │  └───────────────────────────────┴──────────────────────────────────┘  │
 │                                  │                                     │
 │                          Catalog Publisher                             │
 │                                  │                                     │
 │      ┌──────────────┬────────────┼────────────┬──────────────┐         │
 │      │              │            │            │              │         │
 │     POS           Sales      Shopify      Amazon      Dealer App       │
 └──────────────────────────────┴────────────┴──────────────┴─────────────┘
```

---

## 2. 4-Level Product Identity Hierarchy

MDH v3.0 enforces a clean 4-level separation between invariant product concept and transactional barcode instances:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 4-LEVEL PRODUCT IDENTITY HIERARCHY                                     │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Level 1: Product Concept / Identity ── (Invariant Master UUID & Brand)  │
 │    └─► Level 2: Product Master    ── (HSN, GST Rate, Style Description)│
 │         └─► Level 3: Variants     ── (Color, Size, Fit Combination)    │
 │              └─► Level 4: SKU Code ── (EAN-13, Barcode, RFID Tag)      │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Node-Aware Distributed Master Record Metadata

Every master record in MDH v3.0 contains immutable node-awareness metadata for multi-site synchronization:

| Metadata Field | Type | Description / Sync Purpose |
|---|---|---|
| `master_uuid` | UUID v4 | Universal immutable master record identifier |
| `node_owner_id` | String | Originating SMRITI node installation ID |
| `version_id` | Integer | Incrementing version log ID (`v1`, `v2`, `v3`) |
| `published_version`| Integer | Version currently active in Catalog Publisher |
| `revision_hash` | SHA-256 | Immutable hash of master record attributes |
| `effective_date` | Timestamp | Scheduled activation timestamp |
| `sync_status` | Enum | `LOCAL_DRAFT` \| `PUBLISHED` \| `SYNCED` \| `CONFLICT` |

---

## 4. Governed Product Lifecycle & Multi-Dimensional Health Score

### A. Governed Product Lifecycle (10 States)
`Concept` $\rightarrow$ `Draft` $\rightarrow$ `Review` $\rightarrow$ `Approved` $\rightarrow$ `Published` $\rightarrow$ `Active` $\rightarrow$ `Seasonal` $\rightarrow$ `Suspended` $\rightarrow$ `Discontinued` $\rightarrow$ `Archived`.

### B. Multi-Dimensional Product Health Score (6 Categories)
- **Identity Health Score (20%):** Name, Brand, Category, HSN Code.
- **Pricing Health Score (20%):** Cost, Landed Cost, MRP, SPPK Price Lists.
- **Media Asset Health Score (15%):** High-res images, 360 spin, manual PDFs.
- **Supplier Health Score (15%):** Primary/Secondary vendor, MOQ, Lead time.
- **Inventory Health Score (15%):** Base UOM, Packaging hierarchy ratios.
- **Compliance Health Score (15%):** FSSAI, BIS, Drug License, Statutory Badging.

---

## 5. Multi-Channel Catalog Publisher Matrix

Catalog Publisher dispatches master updates through **SIK Integration Kernel v1.0** across 12 distribution channels:
1. Physical Store POS Registers
2. Branch Outlets & Franchises
3. Direct Web Storefronts (Shopify / WooCommerce)
4. Amazon Marketplace
5. Flipkart Marketplace
6. WhatsApp Conversational Bot
7. B2B Customer Portal
8. Dealer & Distributor Mobile Apps
9. Field Sales Representative App
10. Customer Facing Display (CFD)
11. Electronic Shelf Labels (ESL)
12. Third-Party Logistics (3PL) Warehouses
