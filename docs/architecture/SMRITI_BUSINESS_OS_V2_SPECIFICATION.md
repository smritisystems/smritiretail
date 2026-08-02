<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# SMRITI Business OS v2.0 — Enterprise Architecture Specification

**Specification Version:** 2.0.0 (Frozen Enterprise Baseline)  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect) & Antigravity AI  
**Organization:** AITDL NETWORKS & SMRITIBooks.com  
**Effective Date:** 2026-07-26  
**Status:** **RATIFIED & FROZEN BASELINE**  
**Governance Standard:** Level 1 SMRITI Architecture Constitution (AOP-001 — AOP-007)

---

## 1. Vision & Core Paradigm

> **"ERP is only one module. The Platform is the product."**

SMRITI Business OS v2.0 evolves the system from a retail billing application into a **Metadata-Driven, Multi-Tenant, Modular Business Operating System**. It unifies ERP, Distribution, Commerce, CMS, Customer Experience, AI, and Integrations into a single, unified codebase capable of supporting retail stores, multi-tier distributors, franchise networks, and enterprise conglomerates.

---

## 2. 10-Layer Enterprise Platform Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                  SMRITI Business OS v2.0                    │
├─────────────────────────────────────────────────────────────┤
│ Layer 1  : Platform Kernel (SKP)                            │
│ Layer 2  : Metadata Engine                                  │
│ Layer 3  : Identity Platform (SSO, RBAC, OAuth)             │
│ Layer 4  : Business Core (ERP: Sales, POS, Inventory, GL)   │
│ Layer 5  : Supply Chain & Distribution (6 Inventory Domains)│
│ Layer 6  : Commerce Platform (B2B, B2C, Marketplace)       │
│ Layer 7  : Experience Platform (CMS & Portals)              │
│ Layer 8  : AI Intelligence Platform (Advisory & OCR)        │
│ Layer 9  : Analytics & Decision Platform (BI & KPIs)        │
│ Layer 10 : Integration Platform (GST, Banking, Webhooks)    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Universal Object Identification Standard (UOI)

Every primary business entity table in SMRITI v2.0 implements the **Quad-Identity Standard**:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    UNIVERSAL OBJECT IDENTIFICATION (UOI)                    │
├───────────────────┬──────────────────────────┬──────────────────────────────┤
│ Identity Layer    │ Format Example           │ Target Consumer / Purpose    │
├───────────────────┼──────────────────────────┼──────────────────────────────┤
│ 1. Global UUID    │ 3dca2b1f-8c2d-4d10...    │ APIs, Sync, Offline Mobile   │
│ 2. Business Code  │ PRD-00001235             │ UI Display, Search, Reports  │
│ 3. Legal Doc No   │ INV/MUM/2026/000123      │ Statutory Tax, GST & Audits  │
│ 4. Sequence No    │ 1235 (BIGINT)            │ B-Tree Indexing, Fast Sorts  │
└───────────────────┴──────────────────────────┴──────────────────────────────┘
```

### Universal Table Schema Block
Every business entity table contains the standard primary key and audit block:
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
code        VARCHAR(50) NOT NULL,
sequence_no BIGINT NOT NULL,
company_id  VARCHAR(50) NOT NULL,
branch_id   VARCHAR(50) NOT NULL,
created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
created_by  VARCHAR(100) NOT NULL,
updated_by  VARCHAR(100) NOT NULL,
version_no  INT NOT NULL DEFAULT 1,
is_active   BOOLEAN NOT NULL DEFAULT TRUE,
is_deleted  BOOLEAN NOT NULL DEFAULT FALSE
```

---

## 4. 6-Domain Inventory Model (Layer 5)

SMRITI v2.0 explicitly partitions stock into **six supply chain domains**:
1. **Company Inventory**: Physical stock in owned warehouses.
2. **Channel Inventory**: Stock held by distributors, dealers, and franchise partners with sell-through tracking.
3. **Consignment Inventory**: Physical stock delivered to partner stores where ownership transfers upon checkout.
4. **Transit Inventory**: Goods in movement across Inter-Store Transfer Orders (STOs).
5. **Reserved Inventory**: Allocated stock committed to active B2B or ecommerce orders.
6. **Vendor Inventory**: Vendor-Managed Inventory (VMI) on-site.

---

## 5. Decoupled Platform Services

No business module shall build redundant file attachment, commenting, tagging, or search tables. Cross-cutting services are provided by centralized platform tables:
* **Universal Attachments**: `platform.attachment`, `platform.attachment_reference`, `platform.attachment_version`
* **Universal Notes & Activity**: `platform.note`, `platform.comment`, `platform.activity`
* **Universal Tagging**: `platform.tag`, `platform.object_tag`
* **Enterprise Search Index**: `platform.search_index` (indexed by `object_type`, `object_id`, `title`, `keywords`, `company_id`, `branch_id`)

---

## 6. Schema Domain Architecture Map

Database tables are organized into dedicated PostgreSQL schemas:

| Schema | Domain Purpose | Core Tables |
| :--- | :--- | :--- |
| **`platform`** | Kernel, Licensing, Packages, System Config | `platform.companies`, `platform.branches`, `platform.attachment` |
| **`metadata`** | Screen, Grid, Field, Rule Definitions | `metadata.screens`, `metadata.fields`, `metadata.rules` |
| **`master`** | Core Master Entities | `master.product`, `master.customer`, `master.supplier` |
| **`sales`** | Sales Transactions & Billing | `sales.sales_invoice`, `sales.sales_invoice_item`, `sales.pos_shift` |
| **`purchase`** | Procurement & VMI | `purchase.purchase_order`, `purchase.purchase_invoice` |
| **`inventory`**| Ledgers & Stock Movements | `inventory.stock_ledger`, `inventory.stock_movement` |
| **`accounting`**| General Ledger & Financials | `accounting.gl_entry`, `accounting.journal_entry` |
| **`gst`** | Tax Rules & E-Invoicing | `gst.tax_rates`, `gst.einvoice_logs`, `gst.hsn_codes` |
| **`distribution`**| Channel & Secondary Sales | `channel.secondary_sales`, `channel.consignment_stock` |
| **`commerce`** | B2B/B2C Ordering & Cart | `commerce.orders`, `commerce.cart`, `commerce.schemes` |
| **`experience`**| CMS & External Portals | `experience.cms_pages`, `experience.portal_users` |
| **`ai`** | Advisory Models & Predictions | `ai.predictions`, `ai.demand_forecasts`, `ai.ocr_logs` |
| **`integration`**| Connectors, Webhooks, APIs | `connector.jobs`, `connector.logs`, `connector.webhooks` |
| **`audit`** | System Events & Audit Trails | `audit.event_log`, `audit.security_log` |

---

## 7. Architecture Freeze Governance

1. **Alembic Sole Migration Authority**: No raw DDL executions. All database changes must be versioned via Alembic Python scripts (`alembic/versions/`).
2. **Modular SPK Delivery**: Vertical industry features (Footwear size matrices, Jewellery karats, Pharma expiry tracking, FMCG schemes) shall be delivered as **SMRITI Package Kits (SPKs)** or metadata extensions, preserving core table purity.
3. **Synchronous Ledger Integrity**: Inventory and financial ledgers remain synchronous, atomic, and authoritative inside DB transactions.
