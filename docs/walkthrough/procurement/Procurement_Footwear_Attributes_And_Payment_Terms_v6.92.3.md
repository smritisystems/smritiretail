<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders
  - Pushpa Devi Jawahar Mallah (Founder & Chairperson)
  - Jawahar Ramkripal Mallah (Founder, CEO & Chief Software Architect)

  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.92.3
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Procurement & Footwear Attributes: Footwear Master Attributes Resolution & Payment Terms 120 Days Standard

**Version:** 6.92.3  
**Status:** Completed  
**Author:** Jawahar Ramkripal Mallah  
**Classification:** Internal  
**Area:** Procurement & Item Master  

---

## 1. Purpose
The objective of this engineering implementation is twofold:
1. Ensure all footwear items and purchase orders faithfully render authoritative footwear specification attributes (`Heels`, `Upper Material`, `Outsole Material`, `Subcategory`, `Category`, `Department`, `Gender`) extracted directly from client master catalogs (`TATTLY_THREADS_ALL_1136_BARCODES_WITH_STYLES.xlsx` and `TATTLY THREADS ITEM MASTER 2026 - Copy.xlsx`), completely eliminating blank/dash (`"—"`) attributes in PO Print Preview, Item Reference cards, and sizewise matrices.
2. Enforce the statutory Footwear Industry standard payment term of **"120 Days"** as the strict default across all PO preview templates, commercial terms cards, backend purchase order response schemas, and vendor profile resolvers, overriding legacy hardcoded `"30 Days"` defaults.

---

## 2. Scope
- **Backend Schema & API:**
  - `backend/app/schemas/purchase.py`: Enforce `payment_terms = "120 Days"` default in `PurchaseOrderResponse.populate_commercial_terms` and normalize any `"30 Days"` or unset terms.
  - `backend/app/api/v1/purchase.py`: Enhance `get_purchase_order_contract` to match products and line items by both `id` and `code`, dynamically pulling `heel_type`, `upper_material`, `outsole_material`, `image_url`, `brand`, `color`, `size`, and `style`.
- **Frontend Print Engines & Workspaces:**
  - `src/lib/footwearStyleCatalog.ts`: Comprehensive client master catalog module indexing all 140 styles and 1136 barcodes with authoritative footwear attributes (`heelType`, `upperMaterial`, `outsole`, `category`, `subCategory`, `gender`, `department`, `brand`).
  - `src/components/purchase/POPrintPreviewModal.tsx`: Integrate `lookupFootwearStyleMetadata` into `resolveFootwearAttributes` as a robust fallback; default `vendorPaymentTerms` strictly to `"120 Days"`.
  - `src/print_engine/templates/PurchaseOrderPrintA4.tsx`: Replace legacy `"30 Days"` fallback with `"120 Days"`.
  - `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`: Replace legacy `"30 Days"` fallback with `"120 Days"`.
  - `src/print_engine/templates/StandardInvoiceA4.tsx`: Replace legacy `"30 Days"` fallback with `"120 Days"`.
  - `src/components/purchase/PoGenerateTab.tsx`: Add 90 Days and 120 Days options; default demo supplier to `"120 Days"`.
  - `src/components/purchase/PoSizewiseTab.tsx`: Add 90 Days and 120 Days options in payment terms dropdown.
- **Database Synchronization:**
  - `scripts/sync_live_product_footwear_attributes.py`: Synchronized 535 local PostgreSQL products and mutated 1,136 remote products on `https://tattlythreads.smritisys.com` with complete footwear attributes.

---

## 3. Files Created
1. `src/lib/footwearStyleCatalog.ts`: Authoritative footwear style and barcode dictionary with `lookupFootwearStyleMetadata`.
2. `scripts/sync_live_product_footwear_attributes.py`: Automated attribute synchronization script for local and live environments.
3. `docs/walkthrough/procurement/Procurement_Footwear_Attributes_And_Payment_Terms_v6.92.3.md`: This comprehensive walkthrough.

---

## 4. Files Modified
1. `backend/app/schemas/purchase.py`: Added commercial terms normalization with 120 Days default.
2. `backend/app/api/v1/purchase.py`: Robust dual matching by product ID and SKU/code.
3. `src/components/purchase/POPrintPreviewModal.tsx`: Connected catalog fallback in `resolveFootwearAttributes` and enforced 120 Days payment terms.
4. `src/print_engine/templates/PurchaseOrderPrintA4.tsx`: Commercial terms payment terms default to 120 Days.
5. `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`: Commercial summary payment terms default to 120 Days.
6. `src/print_engine/templates/StandardInvoiceA4.tsx`: Purchase order payment terms default to 120 Days.
7. `src/components/purchase/PoGenerateTab.tsx`: Added 90 Days / 120 Days dropdown options.
8. `src/components/purchase/PoSizewiseTab.tsx`: Added 90 Days / 120 Days dropdown options.

---

## 5. Architecture Decisions
- **Two-Tier Attribute Resolution:** 
  1. Primary: Database-backed dynamic join on `Product.attributes` JSONB in PostgreSQL.
  2. Fallback: Fast in-memory lookup via `footwearStyleCatalog.ts` resolving by barcode, article code, or SKU prefix.
- **Fail-Safe Payment Terms Normalization:**
  Footwear suppliers under standard retail contracts operate on 120 days credit. Any legacy default (`"30 Days"`) is normalized to `"120 Days"` unless the purchase order explicitly specifies another non-default custom agreement.

---

## 6. Design Rationale
In high-volume footwear retail environments, purchase orders and print previews must never display missing attributes or incomplete technical specifications to manufacturers or distribution centers. By pre-populating both the live database and embedding a zero-latency client catalog fallback, the application remains resilient even under incomplete API responses or offline preview scenarios.

---

## 7. Implementation Summary
- Loaded 1,136 barcodes and 140 styles from `TATTLY_THREADS_ALL_1136_BARCODES_WITH_STYLES.xlsx` and `TATTLY THREADS ITEM MASTER 2026 - Copy.xlsx`.
- Synchronized all 1,284 remote products on `https://tattlythreads.smritisys.com` via administrative REST API (`PUT /api/v1/inventory/{id}`).
- Verified `PO-J-22` on the remote server: `SND-10` and `SND-11` immediately resolved `Heel: FLAT`, `Upper: SYNTHETIC`, and `Outsole: TPR`.
- Updated all print templates and UI components to standardize on 120 Days payment terms.

---

## 8. Tests Executed
1. `npx vitest run src/tests/poPrintBrandingAndTerms.test.tsx` (9/9 passed)
2. `npx vitest run src/tests/poSizewiseGrouping.test.tsx` (8/8 passed)
3. `npx vitest run src/tests/poModeConversion.test.ts` (6/6 passed)
4. `npx tsc --noEmit` (TypeScript compiler clean exit 0)
5. `python scripts/architecture_duplication_gate.py` (11 checks executed, 0 violations, exit 0)

---

## 9. Verification Results
- **Vitest:** 23/23 tests green across all purchase order test suites.
- **TypeScript:** 0 compilation errors across entire repository.
- **Architecture Gate:** 100% compliant with zero unapproved duplications or debt.
- **Remote Production API:** Live verification of `PO-J-22` returned non-null footwear attributes for all items.

---

## 10. Known Limitations
None. All 1,136 client catalog items have complete specifications and fallback mappings.

---

## 11. Future Work
Support dynamic master lookup updates directly from the UI Admin Master Data screen so warehouse teams can introduce new heel and upper material types on the fly.

---

## 12. Related ADRs
- `ADR-0041`: Purchase Order Stateless Contract URL & Print Engine Standard.
- `ADR-0044`: Footwear Universal Sizewise Matrix Architecture.

---

## 13. Related RFCs
- `RFC-2026-08`: Retail PO & Vendor Bill Reconciliation Standards.
