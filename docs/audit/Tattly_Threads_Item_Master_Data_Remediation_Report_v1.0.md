<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.46.1
  Created      : 2026-09-28
  Modified     : 2026-09-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Customer Data Quality Audit
-->

# SMRITI Retail OS — Customer Data Remediation Report

**Customer Name:** Tattly Threads  
**Source Dataset:** `F:\Smriti-Clients Data\Tattly Threads\TATTLY_THREADS_ITEM_MASTER_UPDATED.xlsx`  
**Target Worksheet:** `NEW`  
**Total Data Rows:** 842 (Rows 2 to 843)  
**Audit Standard:** SMRITI Universal Item Master Standard v2.2 (IM-001 Two-Tier Master Lookup Gate)  
**System Version:** SMRITI Retail OS `v6.46.1`  
**Audit Date:** 2026-09-28  

---

## 1. Executive Summary

Under SMRITI Retail OS `v6.46.1`, the Item Master ingestion pipeline strictly enforces the **IM-001 Controlled-Field Standard** (`system_parameters.ValidateDataDuringPMImport = '2'`). Under this standard:
- Four core catalog dimensions (**GENDER**, **PRODUCT_TYPE**, **HEEL_TYPE**, **UPPER_MATERIAL**) are **mandatory** (`BLOCK`).
- Every entry in a controlled dimension must resolve against the centralized database master catalog (`master_values`).
- Style/Article codes (`ARTICLE_STYLE_CODE`) are strictly mandatory and can never be inferred from SKU or barcode numbers.

### Audit Findings Summary
- **Total Ingestion Rows:** 842 rows.
- **Valid Rows (Ready for Immediate Ingestion):** 0 rows (0.0%).
- **Blocked Rows (Requiring Customer Remediation):** 842 rows (100.0%).
- **Primary Root Causes:**
  1. **266 Rows Completely Missing Mandatory Attributes:** Rows 578 to 843 (Brand: `KORA`) have completely blank values for `HEELS` and `UPPER MATERIAL`.
  2. **288 Rows with Unapproved Upper Materials:** Usage of non-standard terms `FABRIC`, `LYCRA`, and generic placeholder `MATERIAL`.
  3. **217 Rows with Unapproved Shade/Color Names:** Usage of non-standard color descriptors (`CHIKKU`, `BRONZE`, `R-GOLD`, `GUNMETAL`, `ANTIQUE`, `MUSTARD`, `SULTAN`, `PEACH`, `PISTA`, `OF - WHITE`).
  4. **176 Rows with Non-Canonical Heel Types:** Plural/compound names (`CUBE HEEL`, `BIG PLATFORM`, `WEDGES`).
  5. **37 Rows with Non-Canonical Product Type:** `HALF SHOE`.
  6. **266 Rows with Unregistered Brand:** `KORA` is not yet registered in SMRITI Brand Master.

---

## 2. Mandatory Blanks & Missing Values (CRITICAL BLOCKS)

These rows will be immediately rejected upon import because mandatory footwear attributes are completely blank.

| Field Name | Column in Excel | Blank Count | Affected Excel Rows | Sample Items / Styles | Required Customer Action |
|---|---|:---:|---|---|---|
| **HEELS (HEEL_TYPE)** | Col Q (Index 16) | **266** | Rows 578 to 843 | Style `1383`, `2130`, `1057`, `2097` | Specify canonical heel type for all 266 items (e.g. `FLAT`, `BLOCK`, `PLATFORM`, `WEDGE`). Cannot be blank. |
| **UPPER MATERIAL** | Col R (Index 17) | **266** | Rows 578 to 843 | Style `1383`, `2130`, `1057`, `2097` | Specify canonical upper material (e.g. `SYNTHETIC`, `PU`, `LEATHER`, `TEXTILE`). Cannot be blank. |

---

## 3. Dimension-by-Dimension Discrepancy & Remediation Catalog

### 3.1. Dimension: COLOR (Shade)
- **Validation Rule:** Must match an approved color in SMRITI Master Values.
- **SMRITI Canonical Allowed Values:** `BEIGE`, `BLACK`, `BLUE`, `BROWN`, `CREAM`, `GOLD`, `GREEN`, `GREY`, `MAROON`, `MULTI`, `NAVY`, `OLIVE`, `PINK`, `PURPLE`, `RED`, `SILVER`, `TAN`, `WHITE`, `YELLOW`.

| Customer Term in Excel | Occurrence Count | Affected Excel Rows (Sample) | Sample Style & Barcode | Recommended Remediation / Standard Mapping |
|---|:---:|---|---|---|
| `BRONZE` | 56 | Rows 26–30, 74–78, 122–126 | Style `CH-02-A` \| Barcode `7007007007025` | Map to **`GOLD`** or **`BROWN`**, or request SMRITI admin to add `BRONZE` to master catalog. |
| `CHIKKU` | 40 | Rows 2–6, 50–54, 98–102 | Style `CH-01-A` \| Barcode `7007007007001` | Map to **`TAN`** or **`BROWN`**, or request SMRITI admin to register regional shade `CHIKKU`. |
| `R-GOLD` | 24 | Rows 42–46, 90–94, 138–142 | Style `CH-03-A` \| Barcode `7007007007041` | Rename to standard **`GOLD`** or register **`ROSE GOLD`**. |
| `GUNMETAL` | 23 | Rows 274–278, 322–326 | Style `CH-17-D` \| Barcode `7007007007273` | Map to **`GREY`** or **`SILVER`**, or register `GUNMETAL`. |
| `ANTIQUE` | 21 | Rows 606–610, 654–658 | Style `2130` \| Barcode `7007007007605` | Map to **`GOLD`** or **`BRONZE`**, or register `ANTIQUE GOLD`. |
| `MUSTARD` | 16 | Rows 10–14, 58–62 | Style `CH-01-A` \| Barcode `7007007007009` | Map to **`YELLOW`**, or register `MUSTARD`. |
| `SULTAN` | 15 | Rows 378–382, 426–430 | Style `CH-21-F` \| Barcode `7007007007377` | Ambiguous proprietary shade name. Specify actual visual color (e.g. `BROWN`, `TAN`, `GOLD`). |
| `PEACH` | 8 | Rows 194–198, 242–246 | Style `CH-12-C` \| Barcode `7007007007193` | Map to **`PINK`** or **`ORANGE`**, or register `PEACH`. |
| `OF - WHITE` | 7 | Rows 690–694 | Style `1057` \| Barcode `7007007007689` | Syntax error. Correct hyphenated spelling to **`WHITE`** or register canonical `OFF WHITE`. |
| `PISTA` | 7 | Rows 837–841 | Style `2097` \| Barcode `7007007007836` | Map to **`GREEN`** or register `PISTA GREEN`. |

---

### 3.2. Dimension: HEELS (Heel Type)
- **Validation Rule:** Mandatory footwear field. Must match canonical heel morphology.
- **SMRITI Canonical Allowed Values:** `BLOCK`, `BOX HEEL`, `CONE`, `FLAT`, `KITTEN`, `PLATFORM`, `PENCIL`, `SQUARE`, `WEDGE`.

| Customer Term in Excel | Occurrence Count | Affected Excel Rows (Sample) | Sample Style & Barcode | Recommended Remediation / Standard Mapping |
|---|:---:|---|---|---|
| `CUBE HEEL` | 64 | Rows 178–182, 226–230 | Style `SND-01-C` \| Barcode `7007007007177` | Map to canonical **`BOX HEEL`** or **`BLOCK`**. |
| `BIG PLATFORM` | 64 | Rows 290–294, 338–342 | Style `CH-18-E` \| Barcode `7007007007289` | Standardize descriptor to canonical **`PLATFORM`**. |
| `WEDGES` | 48 | Rows 434–438, 482–486 | Style `SND-05-G` \| Barcode `7007007007433` | Plural form. Change to canonical singular **`WEDGE`**. |
| *(BLANK)* | 266 | Rows 578–843 | Style `1383`, `2130`, etc. | **BLOCK:** Fill in valid heel type for all rows (e.g. `FLAT`). |

---

### 3.3. Dimension: UPPER MATERIAL
- **Validation Rule:** Mandatory footwear field. Must specify approved upper composition.
- **SMRITI Canonical Allowed Values:** `CANVAS`, `JACQUARD`, `LEATHER`, `MESH`, `PATENT`, `PU`, `SATIN`, `SUEDE`, `SYNTHETIC`, `TEXTILE`, `VELVET`.

| Customer Term in Excel | Occurrence Count | Affected Excel Rows (Sample) | Sample Style & Barcode | Recommended Remediation / Standard Mapping |
|---|:---:|---|---|---|
| `FABRIC` | 176 | Rows 162–166, 210–214 | Style `CH-11-C` \| Barcode `7007007007161` | Map to canonical **`TEXTILE`** or **`CANVAS`**. |
| `MATERIAL` | 80 | Rows 178–182, 226–230 | Style `SND-01-C` \| Barcode `7007007007177` | **Ambiguous generic placeholder.** Customer must specify the real material (e.g. `SYNTHETIC`, `PU`, `TEXTILE`). |
| `LYCRA` | 32 | Rows 354–358, 402–406 | Style `CH-20-F` \| Barcode `7007007007353` | Map to canonical **`TEXTILE`** or **`SYNTHETIC`**, or register `LYCRA`. |
| *(BLANK)* | 266 | Rows 578–843 | Style `1383`, `2130`, etc. | **BLOCK:** Fill in valid material for all rows (e.g. `SYNTHETIC`). |

---

### 3.4. Dimension: MERCHANDISE CATEGORY (Maps to PRODUCT_TYPE)
- **Validation Rule:** Mandatory footwear field. Specifies the product silhouette.
- **SMRITI Canonical Allowed Values:** `BELLIES`, `BOOT`, `CHAPPAL`, `CLOG`, `LOAFER`, `MOJARI`, `MULE`, `OXFORD`, `SANDAL`, `SLIPPER`, `SNEAKER`, `SPORTS SHOES`.

| Customer Term in Excel | Occurrence Count | Affected Excel Rows (Sample) | Sample Style & Barcode | Recommended Remediation / Standard Mapping |
|---|:---:|---|---|---|
| `HALF SHOE` | 37 | Rows 546–550, 562–566 | Style `SH-01-H` \| Barcode `7007007007545` | Map to canonical **`MULE`**, **`SLIPPER`**, or **`LOAFER`**. |

---

### 3.5. Dimension: BRAND NAME
- **Validation Rule:** Must match an active registered Brand in `master_values`.
- **SMRITI Canonical Allowed Brands:** `BEANSTALK`, `GENERIC`, `HERITAGE`, `SMRITI`, `SND`, `TATTLY THREADS`.

| Customer Term in Excel | Occurrence Count | Affected Excel Rows (Sample) | Sample Style & Barcode | Recommended Remediation / Standard Mapping |
|---|:---:|---|---|---|
| `KORA` | 266 | Rows 578–843 | Style `1383`, `2130` \| Barcode `7007007007577` | Customer brand `KORA` is not in SMRITI Master. Admin must register `KORA` in Brand Master, or map to client's primary brand. |

---

### 3.6. Advisory Secondary Dimensions (Non-Blocking)

These columns do not block import, but should be standardized for complete catalog search and faceted POS browsing.

1. **OUTSOLE:**
   - Term `SHEET` (96 rows, e.g. Style `CH-11-C`): Change to canonical **`SHEET SOLE`**.
2. **Sub category (DESIGN_ATTRIBUTE):**
   - Contains colloquial terminology: `MUEL` (313 rows), `BURMY` (134 rows), `BACK STRAP` (103 rows), `THONGS` (96 rows), `SLIP ON` (54 rows), `CROSS` (32 rows), `FLIP FLOP` (32 rows), `GANDHI` (32 rows), `HALF CLOSE` (30 rows), `AAR PAAR` (16 rows).
3. **ITEM DESCRIPTION (COLLECTION_TYPE):**
   - `COMFORT` (80 rows), `REGULAR` (80 rows), `KORA` (266 rows).

---

## 4. Verification Check: Financial & Statutory Consistency

A comprehensive statutory and commercial check was run across all 842 rows:
- **Selling Price vs MRP Check (`SELLING_PRICE > MRP`):**
  - **Result:** **0 errors.** No rows have Cost or Selling Price exceeding Planned MRP.
- **HSN Code / Upper Material Alignment:**
  - **Result:** **0 mismatches.** No items carry HSN 6403 (leather footwear) with synthetic uppers. HSN codes in file (`64041990` etc.) conform to standard slabs.

---

## 5. Step-by-Step Customer Remediation Instructions

To ensure seamless, 100% first-pass ingestion of this dataset into SMRITI Retail OS:

1. **Open Worksheet:**
   Open `TATTLY_THREADS_ITEM_MASTER_UPDATED.xlsx` and navigate to sheet `NEW`.
2. **Resolve Mandatory Blanks in Rows 578 to 843:**
   - In Column Q (`HEELS`), populate each empty cell with a valid heel type (e.g. `FLAT`).
   - In Column R (`UPPER MATERIAL`), populate each empty cell with a valid material (e.g. `SYNTHETIC`).
3. **Execute Find & Replace for Dimension Aliases:**
   - **Colors (Column E):**
     - Replace `BRONZE` → `GOLD` (or request `BRONZE` seed)
     - Replace `CHIKKU` → `TAN` (or request `CHIKKU` seed)
     - Replace `R-GOLD` → `GOLD`
     - Replace `GUNMETAL` → `GREY`
     - Replace `ANTIQUE` → `GOLD`
     - Replace `MUSTARD` → `YELLOW`
     - Replace `OF - WHITE` → `WHITE`
     - Replace `PISTA` → `GREEN`
   - **Heels (Column Q):**
     - Replace `CUBE HEEL` → `BOX HEEL`
     - Replace `BIG PLATFORM` → `PLATFORM`
     - Replace `WEDGES` → `WEDGE`
   - **Upper Material (Column R):**
     - Replace `FABRIC` → `TEXTILE`
     - Replace `LYCRA` → `TEXTILE`
     - Replace `MATERIAL` → *Specify real material (`SYNTHETIC` or `PU`)*
   - **Product Type (Column O):**
     - Replace `HALF SHOE` → `MULE` or `SLIPPER`
   - **Outsole (Column S):**
     - Replace `SHEET` → `SHEET SOLE`
4. **Register Missing Brand:**
   - Have the system administrator register brand `KORA` in SMRITI Brand Master prior to upload.
5. **Re-upload via Item Master Studio:**
   - Upload the corrected Excel file or copy-paste rows into `ItemMasterStudio.tsx`.
   - Click **Validate Preview** to verify `IM-001 Validated (842 New Rows Ready)`.
   - Click **Import Validated Rows** to commit to PostgreSQL.
