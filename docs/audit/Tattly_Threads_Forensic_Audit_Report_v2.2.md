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
  Classification: Forensic Data Quality Audit
-->

# SMRITI Item Master — Tattly Threads Forensic Audit Report (Standard v2.2)

**Dataset Inspected:** `F:\Smriti-Clients Data\Tattly Threads\TATTLY_THREADS_ITEM_MASTER_UPDATED.xlsx`  
**Target Worksheet:** `NEW` (842 Data Rows, Rows 2 to 843)  
**Governing Contract:** `SMRITI_Item_Master_Creation_Standard_v2.2.xlsx` (36 Columns)  
**Target Architectural Hierarchy:** `Item (Style) → Item Variant (SKU) → Item Barcode (EAN)`  
**Audit Engine Version:** SMRITI Retail OS `v6.46.1`  
**Audit Execution Date:** 2026-09-28  

---

## 1. Executive Summary & Audit Posture

This forensic audit evaluates the customer-provided Item Master against the official 36-column ingestion contract `SMRITI_Item_Master_Creation_Standard_v2.2.xlsx`.

### Core Architectural Principle
The Excel template serves as an **IMPORT CONTRACT**, not the database schema. Under SMRITI's transactional governance:
1. No customer data is silently modified or converted using inferred semantic mappings.
2. The `SKU_PREVIEW` column is strictly a formula preview; the backend PostgreSQL engine is authoritative for final canonical SKU generation and uniqueness.
3. Every issue is strictly classified under the mandatory 7-state taxonomy:
   - `VALID`
   - `NON_CANONICAL`
   - `INVALID`
   - `MISSING_MASTER`
   - `MISSING_REQUIRED_VALUE`
   - `CONFLICT`
   - `PENDING_BUSINESS_REVIEW`

---

## 2. Complete 36-Column Matrix Audit

The customer sheet `NEW` supplies 21 unstructured columns. Below is the column-by-column forensic mapping to the governing 36-column Standard v2.2 contract:

| Col # | Col Letter | Standard v2.2 Field Name | Customer Source Column | Source Type | Completeness | Ingestion Classification |
|---|:---:|---|---|---|:---:|:---:|
| 1 | **A** | `BARCODE_NO` | Col 0 (`BARCODE NO`) | Text (13-digit) | 100% (842/842) | **VALID** |
| 2 | **B** | `SKU_PREVIEW` | *(Generated Formula)* | Excel Formula | 100% | **VALID (PREVIEW ONLY)** |
| 3 | **C** | `ARTICLE_STYLE_CODE` | Col 1 (`PRODUCT STYLE CODE`) | Text | 100% (842/842) | **VALID** |
| 4 | **D** | `COLLECTION_TYPE` | Col 2 (`ITEM DESCRIPTION`) | Text | 50.6% (426/842) | **NON_CANONICAL / MISSING_MASTER** |
| 5 | **E** | `BRAND_NAME` | Col 3 (`BRAND NAME`) | Text | 100% (842/842) | **MISSING_MASTER (266 rows KORA)** |
| 6 | **F** | `COLOR` | Col 4 (`COLOR`) | Text | 100% (842/842) | **NON_CANONICAL / MISSING_MASTER (217 rows)** |
| 7 | **G** | `SIZE` | Col 5 (`SIZE`) | Numeric/Text | 100% (842/842) | **VALID** |
| 8 | **H** | `ITEM_DESCRIPTION` | Col 2 (`ITEM DESCRIPTION`) | Text | 100% (842/842) | **VALID** |
| 9 | **I** | `MRP` | Col 6 (`PLANNED MRP`) | Currency (INR) | 100% (842/842) | **VALID** |
| 10 | **J** | `SELLING_PRICE` | Col 6 (`PLANNED MRP`) | Currency (INR) | 100% (842/842) | **VALID** |
| 11 | **K** | `BUYING_PRICE` | Col 7 (`COST PRICE`) | Currency (INR) | 100% (842/842) | **VALID** |
| 12 | **L** | `LANDED_COST_PRICE` | *(Separated per IM-005)* | Currency (INR) | 100% (842/842) | **VALID** |
| 13 | **M** | `GST_RATE_PERCENT` | Col 8 (`PRODUCT TAX`) | Numeric (%) | 100% (842/842) | **CONFLICT (80 rows IM-013)** |
| 14 | **N** | `HSN_CODE` | Col 9 (`HSN CODE`) | Text (8-digit) | 100% (842/842) | **VALID** |
| 15 | **O** | `GENDER` | Col 10 (`GENDER`) | Text | 100% (842/842) | **VALID** |
| 16 | **P** | `PURCHASE_CLASS` | Col 12 (`PURCHASE CLASS`) | Text | 100% (842/842) | **VALID** |
| 17 | **Q** | `VENDOR_CODE` | Col 11 (`VENDOR CODE`) | Text | 98.1% (826/842) | **MISSING_REQUIRED (16) / MISSING_MASTER (266)** |
| 18 | **R** | `MERCHANDISE_DEPARTMENT`| Col 13 (`DEPARTMENT`) | Text | 100% (842/842) | **VALID** |
| 19 | **S** | `MERCHANDISE_CATEGORY` | Col 14 (`MERCHANDISE CATEGORY`)| Text | 100% (842/842) | **NON_CANONICAL (37 rows HALF SHOE)** |
| 20 | **T** | `PRODUCT_TYPE` | Col 14 (`MERCHANDISE CATEGORY`)| Text | 100% (842/842) | **NON_CANONICAL (37 rows HALF SHOE)** |
| 21 | **U** | `DESIGN_ATTRIBUTE` | Col 15 (`Sub category`) | Text | 100% (842/842) | **MISSING_MASTER (842 rows unseeded)** |
| 22 | **V** | `HEEL_TYPE` | Col 16 (`HEELS`) | Text | 68.4% (576/842) | **MISSING_REQUIRED (266) / NON_CANONICAL (176)**|
| 23 | **W** | `UPPER_MATERIAL` | Col 17 (`UPPER MATERIAL`) | Text | 68.4% (576/842) | **MISSING_REQUIRED (266) / NON_CANONICAL (288)**|
| 24 | **X** | `OUTSOLE_MATERIAL` | Col 18 (`OUTSOLE`) | Text | 100% (842/842) | **NON_CANONICAL (96 rows SHEET)** |
| 25 | **Y** | `IMAGE_LINK` | Col 19 (`IMAGE LINK`) | URL/Text | 0% (Blank) | **VALID (OPTIONAL)** |
| 26 | **Z** | `LEAST_SALABLE_QTY` | *(Standard default: 1)* | Integer | 100% (842/842) | **VALID** |
| 27 | **AA**| `UOM` | *(Footwear Standard: PRS)* | Text | 100% (842/842) | **VALID** |
| 28 | **AB**| `WAREHOUSE_CODE` | *(Standard: WH-MAIN)* | Text | 100% (842/842) | **VALID** |
| 29 | **AC**| `REORDER_LEVEL` | *(Standard: 0)* | Integer | 100% (842/842) | **VALID** |
| 30 | **AD**| `TAX_INCLUSIVE_YN` | *(Standard default: Y)* | Boolean (Y/N) | 100% (842/842) | **VALID** |
| 31 | **AE**| `IS_INVENTORY_YN` | *(Standard default: Y)* | Boolean (Y/N) | 100% (842/842) | **VALID** |
| 32 | **AF**| `IS_BILLABLE_YN` | *(Standard default: Y)* | Boolean (Y/N) | 100% (842/842) | **VALID** |
| 33 | **AG**| `IS_SERVICE_YN` | *(Standard default: N)* | Boolean (Y/N) | 100% (842/842) | **VALID** |
| 34 | **AH**| `CREATION_STATUS` | *(Standard default: DRAFT)* | Text | 100% (842/842) | **VALID** |
| 35 | **AI**| `VALIDATION_STATUS` | *(Pre-flight Evaluated)* | Text | 100% (842/842) | **BLOCK (266) / REVIEW (576)** |
| 36 | **AJ**| `VALIDATION_MESSAGE` | *(Diagnostic Reason)* | Text | 100% (842/842) | **TRACEABLE AUDIT TRAIL** |

---

## 3. Mandatory 18 Integrity Checks

### Check 1: Blank Required Values
- **Rule ID:** `IM-001` / Mandatory Invariant
- **Finding:** **266 Rows Fail.**
  - `HEEL_TYPE` (Col V): **266 blank rows** (Rows 578 to 843).
  - `UPPER_MATERIAL` (Col W): **266 blank rows** (Rows 578 to 843).
- **Affected Items:** Styles `1383`, `2130`, `1057`, `2097`, `2006` (All under Brand `KORA`).
- **Classification:** `MISSING_REQUIRED_VALUE` (Immediate Ingestion Block).

### Check 2: Duplicate BARCODE_NO
- **Rule ID:** `IM-002` (Uniqueness Block)
- **Finding:** **0 duplicates.** All 842 barcodes are unique across the dataset.
- **Classification:** `VALID`.

### Check 3: Invalid Barcode Format
- **Rule ID:** Standard EAN/Barcode Specification
- **Finding:** **0 invalid formats.** All 842 barcodes consist of exactly 13 numeric digits (e.g., `7007007007001` to `7007007007842`).
- **Classification:** `VALID`.

### Check 4: Duplicate Canonical SKU Candidates
- **Rule ID:** `IM-003` (Variant Uniqueness Block)
- **Finding:** **7 Duplicate Canonical SKU Candidates found across 14 rows.**
  - SKU Candidate: `2006-CREAM-36` → Row 662 vs Row 795
  - SKU Candidate: `2006-CREAM-37` → Row 663 vs Row 796
  - SKU Candidate: `2006-CREAM-38` → Row 664 vs Row 797
  - SKU Candidate: `2006-CREAM-39` → Row 665 vs Row 798
  - SKU Candidate: `2006-CREAM-40` → Row 666 vs Row 799
  - SKU Candidate: `2006-CREAM-41` → Row 667 vs Row 800
  - SKU Candidate: `2006-CREAM-42` → Row 668 vs Row 801
- **Root Cause Analysis:** Style `2006` in Color `CREAM` appears twice in the customer file with **different barcodes** and **different MRPS** (`MRP ₹1,299` in Rows 662–668 vs `MRP ₹1,499` in Rows 795–801).
- **Classification:** `CONFLICT` / `PENDING_BUSINESS_REVIEW`.

### Check 5: ARTICLE_STYLE_CODE Consistency
- **Rule ID:** `IM-004` (Style Invariance across Variants)
- **Finding:** **0 style inconsistencies.** For all styles across the dataset, Brand, Department, Product Type, Gender, and HSN code remain 100% consistent across all child size/color variants.
- **Classification:** `VALID`.

### Check 6: Variant / Style Collisions
- **Rule ID:** Architecture Isolation
- **Finding:** **0 cross-style variant collisions.** No variant SKU is claimed by multiple disparate style codes.
- **Classification:** `VALID`.

### Check 7: Invalid System Master Values
- **Rule ID:** Master Schema Integrity
- **Finding:** **0 syntactically corrupt entries.** All customer strings are valid UTF-8 text without illegal control characters.
- **Classification:** `VALID`.

### Check 8: Missing System Master Values
- **Rule ID:** `IM-001` (Controlled Field Master Lookup)
- **Finding:** Multiple controlled dimensions contain values legitimate in business semantics but absent from SMRITI Control Plane `smritisys.master_values`:
  - `BRAND_NAME`: `KORA` (266 rows) → `MISSING_MASTER`.
  - `COLOR`: `BRONZE` (56), `CHIKKU` (40), `R-GOLD` (24), `GUNMETAL` (23), `ANTIQUE` (21), `MUSTARD` (16), `SULTAN` (15), `PEACH` (8), `OF - WHITE` (7), `PISTA` (7) → Total 217 rows → `MISSING_MASTER` / `NON_CANONICAL`.
  - `HEEL_TYPE`: `CUBE HEEL` (64), `BIG PLATFORM` (64), `WEDGES` (48) → Total 176 rows → `NON_CANONICAL`.
  - `UPPER_MATERIAL`: `FABRIC` (176), `MATERIAL` (80), `LYCRA` (32) → Total 288 rows → `NON_CANONICAL` / `PENDING_BUSINESS_REVIEW`.
  - `PRODUCT_TYPE`: `HALF SHOE` (37 rows) → `NON_CANONICAL`.
  - `OUTSOLE_MATERIAL`: `SHEET` (96 rows) → `NON_CANONICAL`.
  - `DESIGN_ATTRIBUTE`: 10 values across 842 rows (`MUEL`: 313, `BURMY`: 134, etc.) → `MISSING_MASTER`.
- **Classification:** Explicitly preserved as `MISSING_MASTER` and `NON_CANONICAL` (NOT converted to `INVALID`).

### Check 9: MRP / Selling Price Violations
- **Rule ID:** `IM-006` (Price Monotonicity)
- **Finding:** **0 violations.** Across all 842 rows:
  - `Cost Price <= MRP` holds for 100% of rows.
  - Selling Price defaults to Planned MRP (0 rows have `Selling Price > MRP`).
  - No negative or zero MRP values.
- **Classification:** `VALID`.

### Check 10: BUYING_PRICE / LANDED_COST_PRICE Separation
- **Rule ID:** `IM-005` (Cost Separation)
- **Finding:** Customer column Col 7 provides `COST PRICE`. In the remediated contract, Col K (`BUYING_PRICE`) and Col L (`LANDED_COST_PRICE`) are strictly segregated into independent schema columns.
- **Classification:** `VALID`.

### Check 11: Invalid Y/N Control Values
- **Rule ID:** `IM-008` (Strict Boolean Y/N)
- **Finding:** **0 invalid values.** Control columns (`TAX_INCLUSIVE_YN`, `IS_INVENTORY_YN`, `IS_BILLABLE_YN`, `IS_SERVICE_YN`) are explicitly populated with standard `Y` and `N`.
- **Classification:** `VALID`.

### Check 12: Inventory / Billable / Service Logical Conflicts
- **Rule ID:** `IM-009` (Service/Inventory Invariance)
- **Finding:** **0 conflicts.** All items have `IS_INVENTORY_YN = 'Y'`, `IS_BILLABLE_YN = 'Y'`, and `IS_SERVICE_YN = 'N'`.
- **Classification:** `VALID`.

### Check 13: Warehouse / Reorder Level Relationship
- **Rule ID:** `IM-011` (Warehouse Scoping)
- **Finding:** **0 violations.** All items are qualified by canonical central warehouse `WH-MAIN` with initial reorder level `0`.
- **Classification:** `VALID`.

### Check 14: Vendor Code Validity
- **Rule ID:** `IM-007` (Vendor Master Control)
- **Finding:**
  - 560 rows map cleanly to vendor codes `A` through `H` defined in customer `Sheet1`.
  - **16 rows have completely blank Vendor Code** (Rows 662–668 and 795–801, Style `2006`, plus 2 rows under Style `2130`).
  - **266 rows contain Vendor Code `'KORA'`** (matching the brand name `KORA`, not registered in `Sheet1` vendors A–H).
- **Classification:** `MISSING_REQUIRED_VALUE` (16 blank rows) / `MISSING_MASTER` (266 rows `KORA`).

### Check 15: UOM Validity
- **Rule ID:** Unit of Measure Master
- **Finding:** **0 violations.** All 842 footwear items are standardized to canonical unit `PRS` (Pairs).
- **Classification:** `VALID`.

### Check 16: HSN / GST Consistency
- **Rule ID:** `IM-013` (GST 2.0 Footwear Threshold Governance)
- **Finding:** **80 Rows Fail Statutory Threshold Check.**
  - **Rule Definition:** Under GST Notification 14/2021-Central Tax (Rate), footwear with sale price / MRP > ₹2,500 requires GST rate >= 18%.
  - **Violations Detected:** 80 rows have `MRP = ₹2,599` or `₹2,999`, but specify `PRODUCT TAX = 5%` (e.g. Styles `SH-01-H`, `CH-25-G`, `CH-02-A`, `CH-03-A`, `SND-07-G`).
- **Classification:** `CONFLICT` / `PENDING_BUSINESS_REVIEW` (Requires Chartered Accountant / Tax sign-off).

### Check 17: Creation Status Validity
- **Rule ID:** `IM-010` (Audit Information)
- **Finding:** All rows initialized to `DRAFT` in `CREATION_STATUS`.
- **Classification:** `VALID`.

### Check 18: Validation Status / Message Consistency
- **Rule ID:** Diagnostic Traceability
- **Finding:** 100% of rows carry evaluable validation flags in Col AI (`VALIDATION_STATUS`) and diagnostic explanations in Col AJ (`VALIDATION_MESSAGE`).
- **Classification:** `VALID`.

---

## 4. Summary Quantification of Audit Findings

```text
================================================================================
Total Customer Data Rows Audited : 842 rows (Sheet 'NEW')
Governing Import Contract        : SMRITI Standard v2.2 (36 Columns)
================================================================================

1. Ingestion Feasibility Posture:
   - Clean First-Pass Import Ready :   0 rows (0.0%)
   - Critical Ingestion Blocks     : 266 rows (31.6% - Missing mandatory Heel & Upper)
   - Business Review Required      : 576 rows (68.4% - Non-canonical & Missing Master)

2. Critical Blocks Breakdown:
   - Rows Missing HEEL_TYPE        : 266 rows (Rows 578 to 843)
   - Rows Missing UPPER_MATERIAL   : 266 rows (Rows 578 to 843)
   - Rows Missing VENDOR_CODE      :  16 rows (Rows 662–668, 795–801, 606–607)

3. Key Architectural Conflicts:
   - Duplicate Variant SKUs (Style 2006 with dual barcodes/MRPs) : 7 SKUs (14 rows)
   - Statutory GST 2.0 Violations (Rule IM-013: MRP > 2500 @ 5%) : 80 rows
   - Missing Brand Master Registration ('KORA')                  : 266 rows
```
