<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Retail OS — Reports & BI: Purchase Inward Register (GRN) Logistics, Delivery Terms & Transporter Alignment

## 1. Purpose
This document details the end-to-end alignment and enhancement of the **Purchase Inward Register (GRN)** report (`RPT-PUR-001`) in the Standard Daily Retail Reports presentation center (`ReportDesignerTab.tsx`). It closes critical operational and auditing visibility gaps by surfacing commercial logistics attributes—including `Delivery Terms` (`Door Delivery` vs `Ex-Factory`), `Freight Terms`, `Transporter Name`, `LR / Bilty Number`, and `Collection Type`—directly in the inward register grid, in both Detailed Line Items and GRN Summary views, with instant search filtering and comprehensive export support.

---

## 2. Scope
- **Backend Schemas & Reporting Service (`backend/app/schemas/reports.py`, `backend/app/services/reports.py`):**
  - Extended `PurchaseInwardItemLine` Pydantic model with optional fields: `delivery_terms`, `freight_terms`, `transporter_name`, `lr_number`, and `collection_type`.
  - Upgraded `ReportsService.purchase_inward_register` to dynamically parse embedded logistics and landed cost parameters from `PurchaseReceipt.notes` (formatted under `[LOGISTICS & LANDED COST: Transporter: ..., LR: ..., Delivery: ..., Freight Terms: ...]`) and associate them with every line item.
- **Frontend Presentation Layer (`src/components/ReportDesignerTab.tsx`):**
  - **Live Search Filtering (`filteredGrnLines`):** Expanded live keyword search to match `delivery_terms`, `transporter_name`, `lr_number`, and `collection_type` alongside supplier name, receipt number, article number, and SKU.
  - **GRN Summary Aggregation (`grnSummaryList`):** Grouped receipts with distinct `delivery_terms`, `freight_terms`, `transporter_name`, and `lr_number` attributes.
  - **Detailed Line Items View:** Added column headers and cells for `Delivery Terms` (with color-coded amber/emerald badges) and `Transporter / LR`. Adjusted empty-state colSpan to 14 and total summary footer colSpan to 8.
  - **GRN Summary View:** Added column headers and cells for `Delivery Terms` and `Transporter`. Adjusted empty-state colSpan to 11 and total summary footer colSpan to 6.
  - **Export Integration:** Added dedicated `purchaseInwardData` branching to `handleTriggerExport` (CSV, Excel/XLSX, JSON, HTML) and `handleOpenInGoogleSheets` mapping with complete logistics columns.
- **Automated Verification Suite (`src/tests/reportsPurchaseInwardLogistics.test.ts`):**
  - Created automated Vitest tests verifying delivery terms parsing, search filtering by transporter/LR/collection, and summary aggregation.

---

## 3. Files Created
1. `docs/implementation/reports/Reports_Purchase_Inward_Register_Logistics_Alignment_Plan_v1.0.0.md` — Formal 19-section IPGP implementation plan.
2. `src/tests/reportsPurchaseInwardLogistics.test.ts` — Comprehensive Vitest automated test suite covering report filtering, aggregation, and logistics column mapping.
3. `docs/walkthrough/reports/Reports_Purchase_Inward_Register_Logistics_Alignment_Walkthrough_v1.0.0.md` — This WGP walkthrough document.

---

## 4. Files Modified
1. `backend/app/schemas/reports.py` — Added `delivery_terms`, `freight_terms`, `transporter_name`, `lr_number`, and `collection_type` to `PurchaseInwardItemLine`.
2. `backend/app/services/reports.py` — In `purchase_inward_register`, added regex parsing of `[LOGISTICS & LANDED COST: ...]` from `pr.notes` to populate line item attributes.
3. `src/components/ReportDesignerTab.tsx` — Added columns, search keywords, export triggers, and Google Sheets mappings for logistics data.
4. `docs/implementation/README.md` — Updated implementation plan index table.
5. `docs/walkthrough/README.md` — Updated walkthrough index table with version `v3.140.0`.
6. `CHANGELOG.md` — Logged release notes under version `[6.99.8]`.

---

## 5. Architecture Decisions
1. **Zero Database Migrations Required (Payload Parsing from Notes):**
   - The logistics and landed cost metadata is systematically stored in `PurchaseReceipt.notes` upon receipt creation. By extracting these fields at query time via deterministic regular expressions in `ReportsService`, the reporting center immediately gains access to historic and active GRN logistics without requiring schema alterations or table migrations on PostgreSQL.
2. **Unified Search Experience:**
   - Operators often need to find all shipments delivered via a specific carrier (e.g. "V-Trans") or trace a specific LR/bilty number directly from the report without having to open the GRN Studio. Including these attributes in `filteredGrnLines` makes search immediate and responsive.
3. **Consistent Commercial Status Badging:**
   - Mirrors the design language established across PO Studio, GRN Studio, and statutory print templates: `Ex-Factory` displays in amber (`bg-amber-500/10 text-amber-600 border-amber-500/20`), while `Door Delivery` displays in emerald (`bg-emerald-500/10 text-emerald-600 border-emerald-500/20`).

---

## 6. Design Rationale
- **Auditing Landed Costs by Freight Terms:**
  When reconciling vendor bills versus transporter invoices, auditors need to see at a glance whether inwarded stock was `Door Delivery` (prepaid by vendor) or `Ex-Factory` (billed by transporter). Displaying both `Delivery Terms` and `Transporter / LR` directly in the register eliminates ambiguity.
- **Dual-View Support (Detailed vs Summary):**
  Detailed view assists SKU-level inventory controllers checking sizes and quantities received against a specific LR, while GRN Summary view gives purchase and logistics managers an aggregated view of total receipt landed costs per carrier.

---

## 7. Implementation Summary
- **Backend Schema:**
  ```python
  class PurchaseInwardItemLine(BaseModel):
      receipt_no:       str
      receipt_date:     str
      supplier_name:    str
      order_no:         Optional[str] = None
      article_no:       Optional[str] = None
      barcode:          Optional[str] = None
      item_name:        str
      qty_received:     float
      cost_rate:        float
      gst_rate:         float
      tax_amount:       float
      landed_cost:      float
      status:           str
      delivery_terms:   Optional[str] = None
      freight_terms:    Optional[str] = None
      transporter_name: Optional[str] = None
      lr_number:        Optional[str] = None
      collection_type:  Optional[str] = None
  ```
- **Service Parsing:**
  ```python
  transporter = None
  lr_no = None
  delivery_terms = None
  freight_terms = None
  if pr.notes and "[LOGISTICS & LANDED COST:" in pr.notes:
      t_match = re.search(r"Transporter:\s*([^,\n\]]+)", pr.notes)
      if t_match: transporter = t_match.group(1).strip()
      lr_match = re.search(r"LR:\s*([^,\n\]]+)", pr.notes)
      if lr_match: lr_no = lr_match.group(1).strip()
      del_match = re.search(r"Delivery:\s*([^,\n\]]+)", pr.notes)
      if del_match: delivery_terms = del_match.group(1).strip()
      fr_match = re.search(r"Freight Terms:\s*([^,\n\]]+)", pr.notes)
      if fr_match: freight_terms = fr_match.group(1).strip()
  ```

---

## 8. Tests Executed
1. `npx vitest run src/tests/reportsPurchaseInwardLogistics.test.ts`
   - Test 1: Extracts and filters by delivery terms (`Ex-Factory` vs `Door Delivery`).
   - Test 2: Live keyword search matches `transporter_name` and `lr_number`.
   - Test 3: Filters by `collection_type` (`Festive & Wedding`).
   - Test 4: Aggregates GRN summary with correct delivery terms and transporter.
2. `npx vitest run src/tests/poPrintBrandingAndTerms.test.tsx` (15/15 passed)
3. `npx vitest run src/tests/grnLogisticsAndTerms.test.tsx` (4/4 passed)
4. `npx vitest run src/tests/poSizewiseGrouping.test.tsx` (10/10 passed)
5. `npx tsc --noEmit` — Static type-checking across frontend and backend schemas.

---

## 9. Verification Results
- **Automated Test Suite:** 33/33 tests passed across reports and purchase logistics test suites.
- **TypeScript Static Verification:** 0 errors reported by `tsc --noEmit`.
- **Export Verification:** Verified that `handleTriggerExport` and `handleOpenInGoogleSheets` serialize all new logistics columns without schema mismatch.

---

## 10. Known Limitations
- When receipts were created prior to the introduction of the structured `[LOGISTICS & LANDED COST: ...]` notes format, the logistics columns will gracefully display `"N/A"` or `"—"`.

---

## 11. Future Work
- Add advanced facet dropdowns directly above the Purchase Inward Register table allowing one-click filtering by specific Transporter or Delivery Terms without typing into the search bar.
- Introduce an automated carrier freight cost reconciliation report cross-referencing transporter invoice submissions against GRN landed costs.

---

## 12. Related ADRs
- `ADR-0042`: Canonical JSONB Metadata Storage & Header Note Audit Trails.
- `ADR-0045`: Single-Store Daily Operational Reporting Architecture.

---

## 13. Related RFCs
- `RFC-2026-PUR-004`: Purchase Order to GRN Commercial Logistics Inheritance.
- `RFC-2026-RPT-008`: Operational Retail Register Standardization & Multi-Format Export.

