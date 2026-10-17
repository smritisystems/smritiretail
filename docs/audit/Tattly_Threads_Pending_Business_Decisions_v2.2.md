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
  Classification: Customer Governance Decision Matrix
-->

# SMRITI Item Master — Tattly Threads Pending Business Decisions (Standard v2.2)

**Customer:** Tattly Threads  
**Document Purpose:** Formal record of all semantic mappings, missing-master registrations, and data conflicts requiring merchant, commercial, or tax sign-off before database commit.  
**Governing Standard:** SMRITI Universal Item Master Standard v2.2 (IM-001 through IM-013)  
**System Version:** SMRITI Retail OS `v6.46.1`  
**Date:** 2026-09-28  

---

## 1. Transparency Pre-Commit Manifest

Per SMRITI Governance Rules, every proposed change to customer data is disclosed below with exact technical rule ID, original value, proposed value, affected row count, and approval mandate.

| # | Rule ID | Classification | Original Customer Value | Proposed Remediation Value | Reason / Architectural Impact | Affected Rows | Customer Approval Required |
|---|:---:|---|---|---|---|:---:|:---:|
| 1 | `IM-001` | `MISSING_MASTER` | `KORA` (in Brand column) | Add `KORA` to Brand Master in `smritisys` | Customer brand is legitimate; must not be overwritten or replaced with generic brand. | 266 | **YES (MERCHANT)** |
| 2 | `IM-001` | `MISSING_REQUIRED_VALUE` | *(BLANK)* in `HEELS` | *Customer to provide (e.g. `FLAT`)* | Mandatory footwear field is completely empty in customer sheet for Brand `KORA`. | 266 | **YES (MERCHANT)** |
| 3 | `IM-001` | `MISSING_REQUIRED_VALUE` | *(BLANK)* in `UPPER MATERIAL` | *Customer to provide (e.g. `SYNTHETIC`)* | Mandatory footwear field is completely empty in customer sheet for Brand `KORA`. | 266 | **YES (MERCHANT)** |
| 4 | `IM-003` | `CONFLICT` | Style `2006` Cream with dual MRPs (₹1,299 vs ₹1,499) | Clarify batch versioning (e.g. `2006-V1` vs `2006-V2`) | Two different production runs share identical variant SKU candidates with conflicting prices. | 14 | **YES (COMMERCIAL)** |
| 5 | `IM-013` | `CONFLICT` | `PRODUCT TAX = 5%` for MRP > ₹2,500 | Correct GST to `18%` or provide statutory exemption | Footwear with MRP > ₹2,500 attracts 18% GST under GST Notification 14/2021-Central Tax. | 80 | **YES (CA / TAX)** |
| 6 | `IM-001` | `PENDING_BUSINESS_REVIEW` | `MATERIAL` (in Upper Material) | *Customer to specify exact material* | "MATERIAL" is an ambiguous placeholder. Cannot infer leather/synthetic without CA risk. | 80 | **YES (MERCHANT)** |
| 7 | `IM-001` | `NON_CANONICAL` | `FABRIC` | `TEXTILE` *(or register `FABRIC`)* | Standard footwear taxonomy classifies non-leather woven uppers as `TEXTILE`. | 176 | **YES (MERCHANT)** |
| 8 | `IM-001` | `NON_CANONICAL` | `LYCRA` | `TEXTILE` *(or register `LYCRA`)* | Stretch synthetic upper material. | 32 | **YES (MERCHANT)** |
| 9 | `IM-001` | `NON_CANONICAL` | `CUBE HEEL` | `BOX HEEL` *(or `BLOCK`)* | Cube heel geometry is synonymous with Box Heel in footwear standards. | 64 | **YES (MERCHANT)** |
| 10| `IM-001` | `NON_CANONICAL` | `BIG PLATFORM` | `PLATFORM` | Remove descriptive size adjective; geometry is Platform. | 64 | **YES (MERCHANT)** |
| 11| `IM-001` | `NON_CANONICAL` | `WEDGES` | `WEDGE` | Plural form. Canonical catalog standard is singular noun (`WEDGE`). | 48 | **YES (MERCHANT)** |
| 12| `IM-001` | `NON_CANONICAL` | `HALF SHOE` | `MULE` *(or `SLIPPER`)* | Silhouette descriptor; Half Shoe corresponds to backless slip-on shoe. | 37 | **YES (MERCHANT)** |
| 13| `IM-001` | `NON_CANONICAL` | `SHEET` (in Outsole column) | `SHEET SOLE` | Industry abbreviation for Neolite/Sheet Sole. | 96 | **YES (MERCHANT)** |
| 14| `IM-001` | `MISSING_MASTER` | `BRONZE` (in Color column) | `GOLD` *(or register `BRONZE`)* | Warm metallic tone. Map to Gold scale or add as a separate finish. | 56 | **YES (MERCHANT)** |
| 15| `IM-001` | `MISSING_MASTER` | `CHIKKU` (in Color column) | `TAN` *(or register `CHIKKU`)* | Regional footwear color name (Sapota brown). | 40 | **YES (MERCHANT)** |
| 16| `IM-001` | `MISSING_MASTER` | `R-GOLD` (in Color column) | `GOLD` *(or register `ROSE GOLD`)* | Rose Gold metallic finish. | 24 | **YES (MERCHANT)** |
| 17| `IM-001` | `MISSING_MASTER` | `GUNMETAL` (in Color column) | `GREY` *(or register `GUNMETAL`)* | Dark metallic finish. | 23 | **YES (MERCHANT)** |
| 18| `IM-001` | `MISSING_MASTER` | `ANTIQUE` (in Color column) | `GOLD` *(or register `ANTIQUE GOLD`)* | Distressed metallic brass/gold finish. | 21 | **YES (MERCHANT)** |
| 19| `IM-001` | `MISSING_MASTER` | `MUSTARD` (in Color column) | `YELLOW` *(or register `MUSTARD`)* | Yellow color scale member. | 16 | **YES (MERCHANT)** |
| 20| `IM-001` | `MISSING_MASTER` | `SULTAN` (in Color column) | *Customer to provide visual shade* | Proprietary shade name. Visual shade cannot be safely guessed. | 15 | **YES (MERCHANT)** |
| 21| `IM-001` | `MISSING_MASTER` | `PEACH` (in Color column) | `PINK` *(or register `PEACH`)* | Pastel shade. | 8 | **YES (MERCHANT)** |
| 22| `IM-001` | `NON_CANONICAL` | `OF - WHITE` (in Color column) | `WHITE` *(or register `OFF WHITE`)* | Hyphenated typo. | 7 | **YES (MERCHANT)** |
| 23| `IM-001` | `MISSING_MASTER` | `PISTA` (in Color column) | `GREEN` *(or register `PISTA GREEN`)* | Pistachio light green shade. | 7 | **YES (MERCHANT)** |
| 24| `IM-007` | `MISSING_REQUIRED_VALUE` | *(BLANK)* in Vendor Code | *Customer to assign Vendor Code A–H* | Vendor code missing in Rows 662–668 and 795–801. | 16 | **YES (OPERATIONS)** |
| 25| `IM-007` | `MISSING_MASTER` | `KORA` in Vendor Code column | *Customer to assign Vendor Code A–H* | Vendor column repeats brand name `KORA` instead of supplier A–H. | 266 | **YES (OPERATIONS)** |

---

## 2. Deep Dive on Critical Architectural Decisions

### Decision A: Resolution of Style `2006` Variant & Pricing Collision
- **Affected Rows:** Rows 662–668 (Batch 1) vs Rows 795–801 (Batch 2).
- **The Problem:**
  - Batch 1 has Barcodes `7007007007661` to `7007007007667`, Style `2006`, Color `CREAM`, Sizes `36` to `42`, Planned MRP **₹1,299**.
  - Batch 2 has Barcodes `7007007007794` to `7007007007800`, Style `2006`, Color `CREAM`, Sizes `36` to `42`, Planned MRP **₹1,499**.
- **Architectural Impact:**
  Under SMRITI's universal item model, an Item Variant SKU (`2006-CREAM-36`) is unique. Two different prices cannot be stored on the same single variant baseline without explicit PriceBook batch matrix rules.
- **Recommended Options for Merchant:**
  1. **Option 1 (Style Versioning - Recommended):** Rename Batch 2 to Style `2006-V2` so that both price points can exist independently as distinct SKUs.
  2. **Option 2 (Single SKU with Multi-Barcode Pricing):** Keep single SKU `2006-CREAM-36`, link both barcodes, and govern the ₹1,299 vs ₹1,499 distinction through PriceBook entries / Batches.
  3. **Option 3 (Superseded Run):** If ₹1,499 represents the new updated price and ₹1,299 is obsolete, discard Batch 1.

---

### Decision B: Resolution of Statutory GST 2.0 Inconsistency (Rule IM-013)
- **Affected Rows:** 80 rows (Styles `SH-01-H`, `CH-25-G`, `CH-02-A`, `CH-03-A`, `SND-07-G`).
- **The Problem:**
  All 80 rows have `PLANNED MRP = ₹2,599` or `₹2,999`, but list `PRODUCT TAX = 5%`.
- **Statutory Law:**
  Under Ministry of Finance Notification No. 14/2021-Central Tax (Rate), footwear having retail sale price exceeding ₹2,500 per pair attracts **18% GST**. A 5% rate for footwear above ₹2,500 is non-compliant unless a specific statutory exemption is claimed.
- **Recommended Options for Chartered Accountant / Tax Sign-Off:**
  1. **Option 1 (Compliance Correction - Recommended):** Update `GST_RATE_PERCENT` to `18%` for all 80 rows.
  2. **Option 2 (Price Restructuring):** If the customer intended to remain in the lower tax bracket, adjust MRP to ₹2,499.
  3. **Option 3 (Formal CA Override):** If customer claims an exemption, record formal CA override reference in `VALIDATION_MESSAGE`.

---

### Decision C: Strategy for Missing Master Values (Add vs Map)
- **The Decision:**
  For regional terms (`CHIKKU`, `BRONZE`, `R-GOLD`, `GUNMETAL`, `PISTA`, `KORA`):
  - **Option 1 (Map to Existing):** Minimizes master catalog size by mapping regional terms to standard primary colors (`CHIKKU → TAN`, `BRONZE → GOLD`).
  - **Option 2 (Add to Master - Recommended for Client Branding):** Preserve Tattly Threads' authentic catalog vocabulary by seeding `KORA` into Brand Master, and `CHIKKU`, `BRONZE`, `ROSE GOLD`, `GUNMETAL` into Color Master.

---

## 3. Customer Action Checklist

To authorize ingestion into SMRITI Retail OS:

- [ ] **Sign-off on Brand Master addition:** Approve adding `KORA` to SMRITI Brand Master.
- [ ] **Provide missing Heel & Upper attributes:** Specify valid heel types and upper materials for Rows 578 to 843.
- [ ] **Clarify Style `2006` pricing collision:** Choose Option 1 (Style Versioning `2006-V2`), Option 2 (Batch Matrix), or Option 3 (Supersede).
- [ ] **Tax Review for MRP > ₹2,500 items:** Confirm GST rate update from 5% to 18% for the 80 affected rows.
- [ ] **Clarify Upper Material `"MATERIAL"`:** Provide real material composition for Style `SND-01-C`.
- [ ] **Provide Supplier Codes:** Assign authentic vendor codes (A through H) for `KORA` items and blank rows.
- [ ] **Approve Dimension Mappings:** Sign off on Proposed Mapping Report (`Tattly_Threads_Proposed_Mapping_Report_v2.2.md`).
