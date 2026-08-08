<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 2.1.0
  Created      : 2026-08-04
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Specification
-->

# SMRITI Product Studio & Master Data Hub Specification (PROD v2.1)

**Status:** FROZEN — Enterprise Master Data Hub & Catalog Publisher Specification v2.1 (2026-08-04)
**Scope:** Master Data Hub, Product Identity Service, Catalog Publisher, Completeness Rules, & Versioning

---

## 1. Product Studio v2.1 Master Data Hub Architecture

`Product Studio v2.1` expands from a standalone PIM engine into the centralized **Master Data Hub** for all product, category, brand, attribute, and identity entities across SMRITI Retail OS.

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ MASTER DATA HUB ARCHITECTURE (ENTERPRISE PRODUCT PLATFORM)              │
 ├────────────────────────────────────────────────────────────────────────┤
 │                                                                        │
 │                            PRODUCT STUDIO                              │
 │                                  │                                     │
 │ ┌────────────────────────────────┼──────────────────────────────────┐  │
 │ │                                │                                  │  │
 │ Product Master               Brand Master                    Category  │
 │ │                                │                                  │  │
 │ Supplier Master              Attribute Templates             Price Lists│
 │ │                                │                                  │  │
 │ Identity Service             Media Assets                    Tax Profile│
 │ └────────────────────────────────┴──────────────────────────────────┘  │
 │                                  │                                     │
 │                           Catalog Publisher                            │
 │                                  │                                     │
 │        ┌─────────────────────────┼─────────────────────────┐           │
 │        │                         │                         │           │
 │       POS                      Sales                   Omnichannel     │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Product Identity Service & Multi-Barcode Registry

`Product Identity Service` centralizes all product SKU codes, barcodes, RFID tags, and external marketplace identifiers:

| Identifier Type | Standard / Format | Target System Usage |
|---|---|---|
| **Primary SKU Code** | System Generated / Custom | Core Inventory Kernel & Transactions |
| **EAN-13 / UPC Barcode** | International GTIN | Retail Counter POS & Scanner |
| **Vendor Barcode** | Supplier Package Barcode | Purchase Inbound Receiving & GRN |
| **Internal Barcode** | Custom Store Label | Internal Bin & Shelf Tagging |
| **Carton / Pallet Code** | ITF-14 / GS1-128 | Warehouse Receiving & Pallet Moving |
| **Marketplace SKU** | ASIN / FSN / Shopify ID | SIK Omnichannel Channel Sync |
| **RFID Electronic Tag** | EPC Class 1 Gen 2 | High-Speed RFID Checkout & Audit |

---

## 3. Product Completeness Rules Engine

Product activation from `Under Review` to `Active` state requires satisfying mandatory **Completeness Rules**:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ MANDATORY PRODUCT COMPLETENESS RULES (ACTIVATION BLOCKERS)             │
 ├────────────────────────────────────────────────────────────────────────┤
 │ [ ] Rule 1: Primary EAN-13 or SKU Code must be assigned & unique       │
 │ [ ] Rule 2: Valid HSN/SAC code and GST tax rate profile assigned       │
 │ [ ] Rule 3: Base UOM and packaging hierarchy conversion defined       │
 │ [ ] Rule 4: Primary Buying Cost and Landed Cost defined                │
 │ [ ] Rule 5: Standard MRP and Retail Selling Price defined in SPPK      │
 │ [ ] Rule 6: Primary Supplier linked with MOQ and Lead Time             │
 │ [ ] Rule 7: Primary High-Res product image uploaded to Media Library   │
 │ [ ] Rule 8: Mandatory Industry Pack attributes completed               │
 ├────────────────────────────────────────────────────────────────────────┤
 │ Enforcement: Activation blocked if Product Health Score < 85%          │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Product Catalog Publisher Workflow

The **Catalog Publisher Engine** controls publication releases to distribution channels:

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ CATALOG PUBLISHER WORKFLOW                                             │
 ├────────────────────────────────────────────────────────────────────────┤
 │                                                                        │
 │  ┌────────────────┐     Publish     ┌──────────────────┐               │
 │  │ PRODUCT STUDIO ├────────────────►│ CATALOG PUBLISHER│               │
 │  └────────────────┘                 └────────┬─────────┘               │
 │                                              │                         │
 │        ┌─────────────────┬───────────────────┼──────────────────┐      │
 │        │                 │                   │                  │      │
 │        ▼                 ▼                   ▼                  ▼      │
 │  ┌───────────┐    ┌─────────────┐    ┌──────────────┐    ┌───────────┐ │
 │  │ POS STORE │    │ SALES BILL  │    │ SHOPIFY WEB  │    │ AMAZON    │ │
 │  │ REGISTERS │    │ INVOICES    │    │ STORE FRONT  │    │MARKETPLACE│ │
 │  └───────────┘    └─────────────┘    └──────────────┘    └───────────┘ │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Product Studio v2.1 Workspace Architecture (13 Workspaces)

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ PRODUCT STUDIO V2.1 WORKSPACE ARCHITECTURE                             │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. Product Dashboard             ── (Catalog Health KPIs, Stock Value)  │
 │ 2. Product Registry              ── (List Report & Multi-Facet Filters)│
 │ 3. 5-Step Product Wizard         ── (Guided Creation Workflow)         │
 │ 4. Product 360 Object Page       ── (16-Tab Enterprise Object Page)    │
 │ 5. Variant & Matrix Manager      ── (Color/Size Grid & SKU Auto-Gen)   │
 │ 6. Barcode & Label Center        ── (SBPK Thermal/ZPL Printing Engine) │
 │ 7. Multi-Price Matrix             ── (MRP, Cost, Retail, Wholesale, Web)│
 │ 8. Multi-Supplier Matrix         ── (MOQ, Lead Times, Supplier Rates)   │
 │ 9. Media & Digital Asset Library ── (Images, 360 Spin, Video, Manuals)  │
 │ 10. Industry Pack Extension      ── (Apparel, Medical, Gems, Electronics)│
 │ 11. Product Governance Center    ── (Health Score & Completeness Rules) │
 │ 12. Catalog Publisher            ── (Channel Releases & Sync Monitor)   │
 │ 13. Product Reports & Analytics  ── (Universal Report Registry Engine) │
 └────────────────────────────────────────────────────────────────────────┘
```
