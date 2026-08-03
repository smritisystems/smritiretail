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
  Classification: Internal Architecture Specification
-->

# SMRITI Product Studio & PIM Engine Specification (PROD v1.0)

**Status:** FROZEN — Enterprise Product Information Management Specification v1.0 (2026-08-04)
**Scope:** Product 360 Object Page, Product Creation Wizard, Industry Pack Extensions, & PIM Integration

---

## 1. Product Studio v1.0 Architecture & Workspaces

`Product Studio v1.0` serves as the centralized Product Information Management (PIM) and Master Catalog Studio for SMRITI Retail OS, providing a unified product experience across physical stores, warehouses, e-commerce, and mobile channels.

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ PRODUCT STUDIO V1.0 WORKSPACE ARCHITECTURE (PIM ENGINE)                 │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. Product Dashboard             ── (Catalog Health, Stock Value, Margin)│
 │ 2. Product Registry              ── (List Report & Multi-Facet Filters)│
 │ 3. 5-Step Product Wizard         ── (Identity -> Type -> Inv -> Price) │
 │ 4. Product 360 Object Page       ── (16-Tab Enterprise Object Page)    │
 │ 5. Variant & Matrix Manager      ── (Color/Size Grid & SKU Auto-Gen)   │
 │ 6. Barcode & Label Center        ── (SBPK Thermal/ZPL Printing Engine) │
 │ 7. Multi-Price Matrix             ── (MRP, Cost, Retail, Wholesale, Web)│
 │ 8. Multi-Supplier Matrix         ── (MOQ, Lead Times, Supplier Rates)   │
 │ 9. Media & Digital Asset Library ── (Images, 360 View, Manuals, Video)  │
 │ 10. Industry Pack Extension      ── (Apparel, Medical, Gems, Electronics)│
 │ 11. Product Analytics & Reports  ── (Universal Report Registry Engine) │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Supported Product Types Matrix

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ SMRITI PRODUCT TYPES (DYNAMIC BEHAVIOR MATRIX)                         │
 ├────────────────────────────────────────────────────────────────────────┤
 │ 1. Inventory SKU (Tracked stock, batch/expiry, serial)                │
 │ 2. Service Item (Non-inventory, labour, installation, consultancy)     │
 │ 3. Product Bundle / Kit (Bill of Materials assembly, composite SKU)    │
 │ 4. Assembly / Manufactured SKU (BOM raw material deduction)            │
 │ 5. Digital Product (Software license, e-book, online download)         │
 │ 6. Voucher / Gift Card (Store credit voucher, promo card)              │
 │ 7. Packaging Material (Boxes, bags, shipping cartons)                  │
 │ 8. Consumable (Office supplies, store cleaning, internal usage)        │
 │ 9. Fixed Asset (Store equipment, barcode scanner, POS terminal)        │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 16-Tab Product 360 Object Page Schema

| Tab # | Tab Name | Primary Content & Business Purpose |
|---|---|---|
| **Tab 1** | **Identity & Classification** | Name, HSN/SAC, GST Rate, Brand, Category, Industry Pack |
| **Tab 2** | **Pricing & Margin Matrix** | Buying Cost, Landed Cost, MRP, Retail, Wholesale, E-Com, Margin % |
| **Tab 3** | **Barcode & Identification** | Primary Barcode, Alternate Barcodes, Vendor Barcode, Carton Barcode |
| **Tab 4** | **UOM & Packaging Hierarchy** | Base UOM, Pack, Box, Inner, Master Carton, Pallet Conversion Ratios |
| **Tab 5** | **Variants & Matrix** | Color, Size, Fit Grid & SKU Auto-Generation Engine |
| **Tab 6** | **Inventory & Warehouses** | Available, Reserved, In-Transit, Quality Hold, ATP per Branch |
| **Tab 7** | **Batch / Serial / Expiry** | Batch tracking, FEFO rules, Expiry alert days, Serial number log |
| **Tab 8** | **Planning & Replenishment**| Min/Max stock levels, Safety stock, ROP, Reorder MOQ |
| **Tab 9** | **Supplier Matrix** | Primary/Secondary vendors, MOQ, Lead times, Contract rates |
| **Tab 10** | **Sales Velocity & Analytics** | 7/30/90 Day sales velocity, ABC/XYZ classification, Margin analysis |
| **Tab 11** | **Barcode & Label History** | SBPK Printing Kernel audit trail & label generation log |
| **Tab 12** | **Media & Digital Assets** | Product images, 360-degree spin views, videos, user manuals |
| **Tab 13** | **Product Attributes** | Material, Fabric, Pattern, Gender, Age Group, Season, Country of Origin |
| **Tab 14** | **Compliance & Statutory** | FSSAI, Drug License, BIS, Hallmark, CE, RoHS, Regulatory badges |
| **Tab 15** | **Related Documents & Txns** | SDK Document Kernel transaction history (POs, Invoices, GRNs) |
| **Tab 16** | **Audit & AI Insights** | Duplicate SKU risk score, HSN/GST suggestions, Audit log |

---

## 4. Industry Pack Extension Framework

`Product Studio v1.0` dynamically injects industry-specific attribute fields based on active industry packs:
- **Apparel & Footwear Pack:** Fabric, Pattern, Gender, Fit, Sole, Heel, Season.
- **Medical & Pharma Pack:** Drug Schedule, FSSAI Code, Manufacturer License, Active Ingredient.
- **Electronics & Mobile Pack:** IMEI/Serial tracking, Warranty period, Voltage, Power consumption.
- **Gems & Jewellery Pack:** Purity (Karat), Stone weight, Gross weight, Net weight, Making charges.
- **FMCG & Grocery Pack:** FSSAI License, Veg/Non-Veg badge, Nutritional facts, Shelf life.
