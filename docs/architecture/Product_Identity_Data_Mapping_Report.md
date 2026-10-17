<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.38.0
  Created      : 2026-09-25
  Modified     : 2026-09-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture & Schema Governance (Internal Core)
-->

# SMRITI Retail OS — Product Identity Data Mapping Report
**Document ID:** DMR-PROD-ID-20260925-01  
**Status:** Done (Data Mapping & Preflight Forensic Report)  
**Corpus / Database:** `smritisys` (Control Plane) | `smriti001` (Tenant Plane)  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Executive Summary

This Data Mapping Report documents the verification of all product identity mappings across `smriti001`, evaluating cross-company boundary safety, identifier collision probability, and partner SKU resolution behavior.

---

## 2. Preflight Mapping Verification Metrics

| Mapping Category | Total Records Audited | Matched | Unmatched | Ambiguous / Collision | Cross-Company Leakage | Preflight Gate Status |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **PSV Balances -> Internal Products** | 100 | 0 | 100 (100.0%) | 0 | 0 | **PASS (Decoupled by Design)** |
| **Active Customer Article Mappings** | 451 | 451 (100.0%) | 0 | 0 | 0 | **PASS** |
| **Item Barcodes per Active Tenant** | 733 | 733 (100.0%) | 0 | 0 | 0 | **PASS** |
| **Item Variants per Active Tenant** | 654 | 654 (100.0%) | 0 | 0 | 0 | **PASS** |
| **Parent Items per Active Tenant** | 311 | 311 (100.0%) | 0 | 0 | 0 | **PASS** |
| **Legacy Null-Tenant Orphan Test Items**| 2 | N/A | N/A | 1 duplicate (`IMMUTABLE-86A1E8`) | 0 | **IDENTIFIED (0 Refs)** |

---

## 3. Forensic Analysis of Data Mapping Findings

### 3.1 PSV External Partner SKUs (100% Unmatched)
- **Finding:** All 100 rows in `psv_stock_balances` in `smriti001` carry external partner SKUs (e.g. `SKU-PSV-173F`, `SKU-A-0047E4`).
- **Data Integrity Safety:**
  - Ambiguous matches: **0**
  - Cross-company matches: **0**
  - Duplicate `(company_id, psv_party_id, sku)` combinations: **0**
- **Action:** PSV partner feeds must store the external partner SKU as sovereign in `psv_stock_balances.sku`. Internal `product_id` must remain `nullable=True` and be populated via the `PartnerIdentifierResolver` when a mapping rule or customer article cross-reference is established.

### 3.2 Orphan Test Item Immutability Pair
- In `items`, `item_variants`, and `item_barcodes`, exactly one code pair was duplicated where `company_id IS NULL`:
  - `IMMUTABLE-86A1E8` (Original Item: `itm_8e5e3af6d51a`, Replacement Item: `itm_3986b68e92e3`).
- **Forensic Check:** A reference scan across all 7 transactional line item tables (`sales_invoice_items`, `purchase_order_items`, `purchase_receipt_items`, `customer_article_mappings`, `product_batch_stocks`, `stock_movements`, `products`) confirmed **0 references** to either record.
- **Remediation:** During tenant unification backfill, the older unreferenced original test item is stamped `is_deleted = true`, eliminating the collision while preserving complete audit history.

---

## 4. Tenant Boundary Isolation Verification

| Validation Rule | Target Assertion | Observed Metric | Conformance |
|---|---|---|:---:|
| **Company Isolation** | Identifiers from Company A never resolve to Company B | 0 cross-company matches across all 244 tables | **100% PASS** |
| **PSV Tenant Scoping** | Every balance record has authoritative `company_id` | 100 / 100 records populated with `COMP-001` | **100% PASS** |
| **Barcodes per Tenant** | No duplicate barcode within the same `company_id` | 0 collisions within `COMP-001` | **100% PASS** |
| **Customer Cross-Ref** | Active buyer codes unique per `(company_id, customer_id)` | 0 collisions | **100% PASS** |
