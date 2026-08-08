# SMRITI ITEM MASTER ATTRIBUTE AUTHORITY MAP V1
## Canonical Item Attribute Registry, Adaptive Labeling, & Storage Matrix

> **Status:** READ-ONLY ARCHITECTURAL & UI METADATA AUDIT | FROZEN BASELINE | ZERO DB ALTERATION
> **Governance Principle:** ONE BUSINESS CONCEPT = ONE CANONICAL ATTRIBUTE | ADAPTIVE BUSINESS-MODEL DISPLAY LABEL

---

## Executive Summary

An exhaustive read-only architectural audit of Item Master attribute definitions, UI forms (`ItemMasterTab.tsx`, `ExcelGridEntrySection.tsx`), backend models (`Product`, `VariantTemplate`), API schemas (`ProductRead`), import mappers, and `UniversalAttributeEngine.ts` was performed.

### Key Findings:
1. **Zero Database Column Duplication:** The PostgreSQL `products` table contains exactly **ONE** column for Brand (`products.brand`) and **ONE** column for Style (`products.style_code`). There are no duplicate physical columns such as `brand_name`, `article`, `model`, or `article_code` in the database.
2. **UI & Import Header Synonym Aliasing:** Apparent duplicates (`Brand` vs `Brand Name`; `Style` vs `Article Code` vs `Model Number`) are **header aliases and display labels** of the same underlying canonical concept.
3. **Universal Attribute Engine (UAME) Authority:** `UniversalAttributeEngine.ts` resolves raw headers/synonyms to a single canonical key (e.g. `BRAND`, `STYLE_CODE`) and dynamically renders the active industry's display label.

---

## A. Canonical Attribute Registry

| Canonical Key | Canonical Purpose | DB Column (`products`) | Data Type | Is Variant Dimension? | Master Lookup Type | Default UI Label |
|---|---|---|---|---|---|---|
| `BRAND` | Product Manufacturer / Retail Brand | `brand` | String(100) | ❌ NO | `product_brand` | Brand Name |
| `STYLE_CODE` | Parent Item / Design / Style Identity | `style_code` | String(100) | ❌ NO | *None* | Product Style Code |
| `COLOR` | Physical Product Color / Finish | `color` | String(50) | ✅ YES | `product_color` | Color |
| `SIZE` | Size / Regional Scale Dimension | `size` | String(50) | ✅ YES | `size_scales` | Size |
| `ITEM_NAME` | Full Item Display Description | `name` | String(255) | ❌ NO | *None* | Item Name |
| `BARCODE` | Primary EAN/UPC/SKU Barcode | `barcode` | String(100) | ❌ NO | *None* | Barcode |
| `COST_PRICE` | Purchase Unit Buy Cost | `cost_price` | Numeric(15,2) | ❌ NO | *None* | Buy Cost |
| `SELLING_PRICE` | Retail Unit Selling Price | `price` | Numeric(15,2) | ❌ NO | *None* | Selling Price |
| `MRP` | Maximum Retail Price | `mrp` | Numeric(15,2) | ❌ NO | *None* | MRP |
| `GST_RATE` | Statutory Tax Percentage | `gst_percentage` | Numeric(5,2) | ❌ NO | `tax_profiles` | GST % |
| `STOCK` | Available On-Hand Stock Qty | `stock` | Integer | ❌ NO | *None* | Stock |
| `HSN_CODE` | Statutory HSN / SAC Code | `hsn_code` | String(15) | ❌ NO | `hsn_master` | HSN Code |

---

## B. Duplicate & Synonym Mapping

### 1. Brand Concept
- **Canonical Key:** `BRAND`
- **Synonyms / Aliases:** `Brand`, `Brand Name`, `Brand Names`, `BRAND NAME`, `Manufacturer`, `Label`, `Designer`
- **Storage Field:** `products.brand` (PostgreSQL VARCHAR 100)
- **Authority Verdict:** `Brand` and `Brand Name` are 100% identical in business semantics. Both normalize to canonical key `BRAND` and write to `products.brand`.

### 2. Style / Model / Article Concept
- **Canonical Key:** `STYLE_CODE`
- **Synonyms / Aliases:** `Style`, `Style Code`, `Product Style Code`, `StyleCode`, `Article`, `Article Code`, `Article No`, `Style/Article Code`, `Model`, `Model Number`, `Model No`, `Design Code`, `Product Code`, `Item Code`, `SKU Style`
- **Storage Field:** `products.style_code` (PostgreSQL VARCHAR 100)
- **Authority Verdict:** `Style`, `Model`, `Article`, `Style Code`, `Model Code`, and `Article Code` are industry-specific display aliases of the single canonical parent design concept `STYLE_CODE`.

---

## C. & D. Business-Model Adaptive Labeling Matrix

| Canonical Key | Apparel Pack | Footwear Pack | Jewellery Pack | Medical Pack | Electronics Pack | FMCG / Grocery | General Pack |
|---|---|---|---|---|---|---|---|
| `BRAND` | Brand | Brand Name | Designer / Brand | Manufacturer | Brand Name | Brand | Brand Name |
| `STYLE_CODE` | Style Code | Article Code | Design / Style No | Item Code | Model Number | Item Code | Product Style Code |
| `COLOR` | Color | Color / Shade | Plating / Finish | Color | Color Finish | Variant / Color | Color |
| `SIZE` | Size | Shoe Size | Net Weight / Size | Dosage / Pack | Capacity / Size | Pack Size | Size |
| `COST_PRICE` | Buy Cost | Buy Cost | Buy Cost | Purchase Rate | Buy Cost | Landing Cost | Buy Cost |
| `SELLING_PRICE` | Selling Price | Selling Price | Tag Rate | MRP / Rate | Selling Price | Selling Price | Selling Price |

---

## E. Import Header Aliases Resolution Engine

When importing Excel / CSV spreadsheets via `ExcelGridEntrySection.tsx` or `/api/v1/attributes/import-commit`, header aliases are automatically normalized to canonical keys:

```text
Excel Import Header: 'Brand Name'      ──► Canonical KEY: BRAND      ──► Target Column: products.brand
Excel Import Header: 'Manufacturer'    ──► Canonical KEY: BRAND      ──► Target Column: products.brand
Excel Import Header: 'Article Code'    ──► Canonical KEY: STYLE_CODE ──► Target Column: products.style_code
Excel Import Header: 'Model Number'    ──► Canonical KEY: STYLE_CODE ──► Target Column: products.style_code
Excel Import Header: 'Style No'        ──► Canonical KEY: STYLE_CODE ──► Target Column: products.style_code
```

---

## F. Variant Dimensions vs Product Identity Attributes

| Attribute | Classification | Can Generate SKU Variants? | Combinatorial SKU Formula Role |
|---|---|---|---|
| `style_code` | Product Identity Attribute | ❌ NO (Parent Identity) | Base SKU Prefix (`{style_code}`) |
| `brand` | Product Identity Attribute | ❌ NO (Parent Identity) | Optional SKU Prefix (`{brand}`) |
| `category` | Product Identity Attribute | ❌ NO (Parent Identity) | Optional SKU Prefix (`{category}`) |
| `color` | Variant Dimension | ✅ YES (Child Variant) | Combinatorial Variant (`{color}`) |
| `size` | Variant Dimension | ✅ YES (Child Variant) | Combinatorial Variant (`{size}`) |

> **SKU Generation Guarantee:** Combinatorial SKU Formula remains strictly `style_code + configured variant dimensions` (e.g. `STYLE-COLOR-SIZE`). Sequence-based SKU generation is strictly prohibited.

---

## G., H., I., & J. Column Registry & Decision Matrix

| Business Concept | Current UI Display | Canonical Attribute Key | DB Storage Field | API Field (`ProductRead`) | Import Header Aliases | Verification Status |
|---|---|---|---|---|---|---|
| Brand Identity | Brand / Brand Name | `BRAND` | `products.brand` | `brand` | `Brand`, `Brand Name`, `Manufacturer`, `Label` | **VERIFIED** |
| Style / Design Identity | Style Code / Article Code / Model No | `STYLE_CODE` | `products.style_code` | `style_code` | `Style Code`, `Product Style Code`, `Article Code`, `Model Number` | **VERIFIED** |
| Color Dimension | Color | `COLOR` | `products.color` | `color` | `Color`, `Colour`, `Shade`, `Color Finish` | **VERIFIED** |
| Size Dimension | Size | `SIZE` | `products.size` | `size` | `Size`, `Shoe Size`, `Pack Size` | **VERIFIED** |
| Barcode Identity | Barcode | `BARCODE` | `products.barcode` | `barcode` | `Barcode`, `Barcode No`, `UPC`, `EAN` | **VERIFIED** |
| Buy Cost | Buy Cost | `COST_PRICE` | `products.cost_price` | `cost_price` | `Buy Cost`, `Cost Price`, `Buying Price` | **VERIFIED** |
| Selling Price | Selling Price | `SELLING_PRICE` | `products.price` | `price` | `Selling Price`, `Price`, `Rate` | **VERIFIED** |
| MRP | MRP | `MRP` | `products.mrp` | `mrp` | `MRP`, `Max Retail Price` | **VERIFIED** |
| Tax Percentage | GST % | `GST_RATE` | `products.gst_percentage` | `gst_percentage` | `GST %`, `GST Percentage`, `Tax` | **VERIFIED** |
| Stock Quantity | Stock | `STOCK` | `products.stock` | `stock` | `Stock`, `Initial Stock`, `Qty` | **VERIFIED** |