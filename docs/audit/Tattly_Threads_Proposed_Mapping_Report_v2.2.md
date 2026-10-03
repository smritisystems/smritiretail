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
  Classification: Proposed Semantic Mapping Registry
-->

# SMRITI Item Master — Tattly Threads Proposed Mapping Report (Standard v2.2)

**Dataset:** `TATTLY_THREADS_ITEM_MASTER_UPDATED.xlsx` (Sheet: `NEW`, 842 Data Rows)  
**Governing Standard:** SMRITI Universal Item Master Standard v2.2  
**System Master Baseline:** SMRITI Control Plane `smritisys.master_values`  
**Governance Directive:** No customer data is altered without explicit approval. All proposed business-semantic mappings are cataloged here with confidence score, technical rationale, and approval flags.  
**Report Date:** 2026-09-28  

---

## 1. Controlled Field Mapping Governance

Under SMRITI Item Master Standard v2.2, controlled fields cannot receive unapproved or inferred strings. When an incoming customer value deviates from the authoritative System Master, it must either:
1. **Be Mapped to an Existing Canonical Value:** If an exact or close semantic equivalent exists in `master_values`.
2. **Be Added to the Master Catalog:** If the customer value represents a legitimate brand, shade, or silhouette that should be supported permanently.

All rows below require **explicit merchant sign-off** before any transformation is applied.

---

## 2. Dimension Mappings Requiring Review

### 2.1. Dimension: COLOR (Customer Column: `COLOR`)
*Authoritative Canonical Values in SMRITI Master:* `BEIGE`, `BLACK`, `BLUE`, `BROWN`, `CREAM`, `GOLD`, `GREEN`, `GREY`, `MAROON`, `MULTI`, `NAVY`, `OLIVE`, `PINK`, `PURPLE`, `RED`, `SILVER`, `TAN`, `WHITE`, `YELLOW`.

| Source Value | Proposed Canonical Value | Confidence | Reason | Affected Rows | Requires Approval |
|---|---|:---:|---|:---:|:---:|
| `BRONZE` | `GOLD` *(Alternative: Register `BRONZE` in Master)* | Medium (70%) | Metallic warm bronze is closest to Gold scale; however, customer may treat Bronze as a distinct metallic SKU. | 56 | **YES (MANDATORY)** |
| `CHIKKU` | `TAN` *(Alternative: Register `CHIKKU` in Master)* | High (85%) | Chikku (sapota brown) is a standard regional footwear term for earthy Tan/Brown. | 40 | **YES (MANDATORY)** |
| `R-GOLD` | `GOLD` *(Alternative: Register `ROSE GOLD` in Master)* | Medium (75%) | R-GOLD stands for Rose Gold. Currently mapped to Gold scale unless Rose Gold master type is seeded. | 24 | **YES (MANDATORY)** |
| `GUNMETAL` | `GREY` *(Alternative: Register `GUNMETAL` in Master)* | High (85%) | Gunmetal is dark metallic grey. Can resolve to Grey in master palette or be registered as a distinct finish. | 23 | **YES (MANDATORY)** |
| `ANTIQUE` | `GOLD` *(Alternative: Register `ANTIQUE GOLD` in Master)* | Medium (70%) | Antique refers to distressed brass/gold finish. Semantic mapping requires customer confirmation. | 21 | **YES (MANDATORY)** |
| `MUSTARD` | `YELLOW` *(Alternative: Register `MUSTARD` in Master)* | High (90%) | Mustard is a standard shade within the Yellow color scale group. | 16 | **YES (MANDATORY)** |
| `SULTAN` | *(No Mapping — Needs Definition)* | Low (20%) | Proprietary trade shade name. Visual color cannot be safely inferred from text alone. | 15 | **YES (MANDATORY)** |
| `PEACH` | `PINK` *(Alternative: Register `PEACH` in Master)* | Medium (75%) | Peach pastel falls between Pink and Orange in footwear color groups. | 8 | **YES (MANDATORY)** |
| `OF - WHITE` | `WHITE` *(Alternative: Register `OFF WHITE` in Master)* | Very High (95%) | Punctuation error. Resolves to standard Off-White / White. | 7 | **YES (MANDATORY)** |
| `PISTA` | `GREEN` *(Alternative: Register `PISTA GREEN` in Master)* | High (85%) | Pista (pistachio) is a light green shade within the Green scale group. | 7 | **YES (MANDATORY)** |

---

### 2.2. Dimension: HEEL_TYPE (Customer Column: `HEELS`)
*Authoritative Canonical Values in SMRITI Master:* `BLOCK`, `BOX HEEL`, `CONE`, `FLAT`, `KITTEN`, `PLATFORM`, `PENCIL`, `SQUARE`, `WEDGE`.

| Source Value | Proposed Canonical Value | Confidence | Reason | Affected Rows | Requires Approval |
|---|---|:---:|---|:---:|:---:|
| `CUBE HEEL` | `BOX HEEL` *(Alternative: `BLOCK`)* | High (85%) | Cube heel is synonymous with Box Heel or Block Heel morphology in footwear manufacturing. | 64 | **YES (MANDATORY)** |
| `BIG PLATFORM` | `PLATFORM` | Very High (95%) | Descriptive size qualifier ("BIG") should be removed; primary heel geometry is Platform. | 64 | **YES (MANDATORY)** |
| `WEDGES` | `WEDGE` | Very High (98%) | Grammatical pluralization. Canonical catalog standard is singular noun (`WEDGE`). | 48 | **YES (MANDATORY)** |

---

### 2.3. Dimension: UPPER_MATERIAL (Customer Column: `UPPER MATERIAL`)
*Authoritative Canonical Values in SMRITI Master:* `CANVAS`, `JACQUARD`, `LEATHER`, `MESH`, `PATENT`, `PU`, `SATIN`, `SUEDE`, `SYNTHETIC`, `TEXTILE`, `VELVET`.

| Source Value | Proposed Canonical Value | Confidence | Reason | Affected Rows | Requires Approval |
|---|---|:---:|---|:---:|:---:|
| `FABRIC` | `TEXTILE` *(Alternative: `CANVAS`)* | High (90%) | Fabric is an umbrella term; standard industrial footwear taxonomy classifies woven upper fabrics as `TEXTILE`. | 176 | **YES (MANDATORY)** |
| `MATERIAL` | *(Cannot Infer — Merchant Must Provide)* | 0% (Unacceptable) | **Ambiguous generic placeholder.** Does not convey leather, synthetic, or textile composition. Silently mapping this would corrupt statutory HSN compliance. | 80 | **YES (MANDATORY)** |
| `LYCRA` | `TEXTILE` *(Alternative: Register `LYCRA` in Master)* | High (85%) | Lycra (spandex elastane) is a synthetic stretch textile. | 32 | **YES (MANDATORY)** |

---

### 2.4. Dimension: PRODUCT_TYPE (Customer Column: `MERCHANDISE CATEGORY`)
*Authoritative Canonical Values in SMRITI Master:* `BELLIES`, `BOOT`, `CHAPPAL`, `CLOG`, `LOAFER`, `MOJARI`, `MULE`, `OXFORD`, `SANDAL`, `SLIPPER`, `SNEAKER`, `SPORTS SHOES`.

| Source Value | Proposed Canonical Value | Confidence | Reason | Affected Rows | Requires Approval |
|---|---|:---:|---|:---:|:---:|
| `HALF SHOE` | `MULE` *(Alternative: `SLIPPER` or `LOAFER`)* | Medium (65%) | "Half Shoe" in Indian retail footwear typically denotes a backless slip-on shoe (Mule) or casual slip-on. | 37 | **YES (MANDATORY)** |

---

### 2.5. Dimension: OUTSOLE_MATERIAL (Customer Column: `OUTSOLE`)
*Authoritative Canonical Values in SMRITI Master:* `AIRMAX`, `EVA`, `LEATHER`, `PU`, `PVC`, `RUBBER`, `SHEET SOLE`, `TPR`, `TPU`.

| Source Value | Proposed Canonical Value | Confidence | Reason | Affected Rows | Requires Approval |
|---|---|:---:|---|:---:|:---:|
| `SHEET` | `SHEET SOLE` | Very High (98%) | Industry abbreviation for Sheet Sole (neolite/crepe/resin rubber sheet). | 96 | **YES (MANDATORY)** |

---

### 2.6. Dimension: BRAND_NAME (Customer Column: `BRAND NAME`)
*Authoritative Canonical Values in SMRITI Master:* `BEANSTALK`, `GENERIC`, `HERITAGE`, `SMRITI`, `SND`, `TATTLY THREADS`.

| Source Value | Proposed Canonical Value | Confidence | Reason | Affected Rows | Requires Approval |
|---|---|:---:|---|:---:|:---:|
| `KORA` | *(Add `KORA` to Brand Master)* | 100% | `KORA` is an authentic client-owned brand line. It must NOT be replaced with another brand name. | 266 | **YES (MANDATORY)** |

---

### 2.7. Dimension: VENDOR_CODE (Customer Column: `VENDOR CODE`)
*Authoritative Vendor Codes in Sheet1:* `A` (AAMIR), `B` (ABDUL), `C` (AKRAM), `D` (ASIF), `E` (SHAFI), `F` (MOHIB), `G` (YAKIN), `H` (ZAFRU).

| Source Value | Proposed Canonical Value | Confidence | Reason | Affected Rows | Requires Approval |
|---|---|:---:|---|:---:|:---:|
| `KORA` | *(Assign Authentic Vendor Code A–H)* | Low (30%) | In rows 578–843, the vendor column repeats the brand name `KORA`. Customer must provide the actual supplier code. | 266 | **YES (MANDATORY)** |
| *(BLANK)* | *(Assign Authentic Vendor Code A–H)* | 0% | Rows 662–668 and 795–801 have empty vendor fields. | 16 | **YES (MANDATORY)** |

---

## 3. Approval Sign-Off Matrix

Before any proposed mapping is executed against the production database:

1. **Merchant Merchandising Sign-Off:** Review Sections 2.1, 2.2, 2.3, 2.4, 2.6.
2. **Chartered Accountant / Statutory Sign-Off:** Review Section 2.3 (`MATERIAL` clarification for HSN eligibility).
3. **Inventory Operations Sign-Off:** Review Section 2.7 (Supplier / Vendor attribution).
