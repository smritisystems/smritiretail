<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.84.0
  Created      : 2026-10-16
  Modified     : 2026-10-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Enterprise Ingestion Walkthrough
-->

# Live Vendor Purchase Order & GRN Ingestion Walkthrough (v6.84.0)

## 1. Purpose
To ingest and persist the complete client vendor purchase dataset from `"F:\Smriti-Clients Data\15-10-2026\ALL VENDOR PURCHASE FOR SOFTWARE.xlsx"` into the live production environment (`https://tattlythreads.smritisys.com/`), creating statutory Purchase Orders (POs), Goods Receipt Notes (GRNs), and inward warehouse stock, while enforcing the mandatory governance constraint: **all GRN inward inventory dates must precede the retail store go-live on 12th August 2026**.

## 2. Scope
* **Target Environment:** Live production instance `https://tattlythreads.smritisys.com/` (Tenant: `COMP-001`, Central Warehouse: `WH-COMP-001-MAIN`).
* **Source Dataset:** `F:\Smriti-Clients Data\15-10-2026\ALL VENDOR PURCHASE FOR SOFTWARE.xlsx` (Sheet1: 443 rows).
* **Entity Types:** 9 Footwear Suppliers, 28 Purchase Orders, 28 Goods Receipt Notes (GRN), and 443 Line Items (23,064 pairs).
* **Date Capping:** Any vendor bill dated on or after `2026-08-12` is clamped to `2026-08-11` for the physical GRN and stock movement, preserving the vendor's original invoice date on document notes.

## 3. Files Created
* [`scripts/ingest_live_purchase_orders_grn.py`](file:///f:/SMRITRretailNX/scripts/ingest_live_purchase_orders_grn.py): Live asynchronous REST ingestion engine for SMRITI Retail OS Purchase Orders and GRNs with dry-run and commit modes.
* [`docs/walkthrough/procurement/Live_Vendor_Purchase_And_GRN_Ingestion_Walkthrough_v6.84.0.md`](file:///f:/SMRITRretailNX/docs/walkthrough/procurement/Live_Vendor_Purchase_And_GRN_Ingestion_Walkthrough_v6.84.0.md): This walkthrough document.

## 4. Files Modified
* [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNX/docs/walkthrough/README.md): Appended v6.84.0 entry to master index.

## 5. Architecture Decisions
* **ADR-064 (Live REST API Ingestion):** Executed ingestion over authenticated HTTPS REST API (`/api/v1/purchase/orders` and `/api/v1/purchase/receipts`) using Bearer token authentication, ensuring full business validation, valuation engine execution, and stock ledger consistency.
* **ADR-065 (Opening Stock Chronological Sequencing):** Clamped GRN receipt dates for late-arriving supplier invoices (`> 2026-08-11`) to `2026-08-11`, ensuring that all 23,064 pairs are booked into the central godown prior to the POS retail go-live on August 12, 2026, preventing negative inventory and valuation divergence.

## 6. Design Rationale
Manual UI entry of 28 multi-vendor POs and 443 lines would be error-prone and automatically apply current (`now()`) timestamps. Automated REST ingestion establishes mathematical parity between the client spreadsheet, purchase orders, goods receipts, and warehouse stock while enforcing historical audit dates.

## 7. Implementation Summary
1. **Preflight Catalog Resolution:** Queried all live products from `https://tattlythreads.smritisys.com/api/v1/products` and indexed 2,566 barcode mappings; verified 100% of 434 distinct Excel barcodes resolved with 0 missing.
2. **Supplier Verification:** Verified all 9 vendor codes (`A` through `J`) exist on live:
   * `A`: `sup-a` (Aliya footwear)
   * `B`: `sup-b` (LAJOS FOOTWEAR)
   * `C`: `sup-c` (A.k.footwear)
   * `D`: `sup-d` (CRYSTAL SHOES)
   * `E`: `sup-e` (S A footwear)
   * `F`: `sup-f` (MK footwear)
   * `G`: `sup-g` (A. S. Shoes)
   * `I`: `sup-i` (Lucky footwear)
   * `J`: `sup-j` (S.B footwear)
3. **Option 1 Date Clamping:** 21 bills retained their original invoice dates between 26-Jun-2026 and 10-Aug-2026. The 7 bills dated between 16-Aug and 05-Oct were clamped to `2026-08-11` for GRN inward:
   * Vendor B Bill `LF/26-27/186`: `2026-08-24` -> `2026-08-11`
   * Vendor C Bill `849`: `2026-10-05` -> `2026-08-11`
   * Vendor F Bill `706`: `2026-08-22` -> `2026-08-11`
   * Vendor F Bill `707`: `2026-09-14` -> `2026-08-11`
   * Vendor G Bill `AS/26-27/0023`: `2026-08-23` -> `2026-08-11`
   * Vendor I Bill `944`: `2026-08-16` -> `2026-08-11`
   * Vendor I Bill `945`: `2026-08-17` -> `2026-08-11`
4. **Execution:** Successfully created 28 POs, 28 GRNs, and received 23,064 pairs with ₹94,17,360.00 subtotal cost into `WH-COMP-001-MAIN`.

## 8. Tests Executed
* Preflight dry-run: `python scripts/ingest_live_purchase_orders_grn.py` (0 errors, 434/434 barcodes matched).
* Live execution: `python scripts/ingest_live_purchase_orders_grn.py --commit` (28/28 POs and 28/28 GRNs created).
* Live post-commit catalog valuation verification script.

## 9. Verification Results
```
===============================================================================================
POST-INGESTION LIVE VERIFICATION REPORT
===============================================================================================
Total Purchase Orders Created : 28 / 28 (100%)
Total GRNs (Receipts) Created : 28 / 28 (100%)
Total Pairs Received          : 23,064 / 23,064 (100%)
Active Stocked SKUs on Live   : 399
Total Current Stock Units     : 23,165 pairs
Total Cost Valuation on Live  : Rs. 9,492,375.00
Total MRP Valuation on Live   : Rs. 47,732,735.00
===============================================================================================
```

## 10. Known Limitations
* Commercial Purchase Bills (`purchase_bills` table) are automatically generated when three-way matching or finance invoice posting is triggered; GRN receipts currently provide the complete physical stock inward.

## 11. Future Work
* Generate statutory PDF export packages for all 28 purchase orders and GRNs for physical audit binders.

## 12. Related ADRs
* ADR-042: Dual-Key Master Lookup & Dynamic Parameter Governance
* ADR-064: REST Ingestion Engine Protocol
* ADR-065: Opening Stock Chronological Sequencing

## 13. Related RFCs
* RFC-019: Inward Procurement & Landed Cost Allocation
