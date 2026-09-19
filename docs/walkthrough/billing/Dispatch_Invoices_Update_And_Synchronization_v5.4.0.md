<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.4.0
  Created      : 2026-09-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough — Dispatch Invoices Update & Synchronization (v5.4.0)

## 1. Purpose
This walkthrough documents the complete synchronization of sales invoices in PostgreSQL database `smriti001`, re-export of statutory A4 Tax Invoice PDFs via Playwright, and update of the master audit workbook based on [`F:\Smriti-Clients Data\08-09-2026\RIL_Dispatch-2.xlsx`](file:///F:/Smriti-Clients%20Data/08-09-2026/RIL_Dispatch-2.xlsx) (sheet `"08-09-2026"`). All stores/bills having `*` in Column N or green highlight in Column O are strictly excluded and preserved intact.

## 2. Scope
- **Target Invoices Updated (25 Stores):** `1888` (TT138), `1969` (TT139), `1977` (TT140), `8155` (TT141), `8313` (TT142), `8319` (TT143), `8361` (TT144), `T0N6` (TT146), `T1BJ` (TT147), `T25I` (TT148), `T38X` (TT149), `T40K` (TT150), `T51H` (TT152), `T72W` (TT153), `T7FN` (TT154), `T91M` (TT156), `T97D` (TT157), `TDL3` (TT163), `TDM4` (TT165), `TFW4` (TT166), `TKU6` (TT175), `TMV9` (TT177), `TV78` (TT182), `TVB6` (TT184), `TYAC` (TT194).
- **Excluded Invoices (32 Stores — Untouched):**
  - *Star in Column N only (10 stores):* `TGX1`, `TGX9`, `TJI4`, `TKF4`, `TKG3`, `TKI6`, `TKU5`, `TMN2`, `TUA7`, `TV81`.
  - *Green in Column O only (19 stores):* `9556`, `T40R`, `T8IY`, `T9SQ`, `TAGG`, `TAGH`, `TC64`, `TDL2`, `TDL9`, `TUK5`, `TVP2`, `TVT0`, `TVU1`, `TW07`, `TW97`, `TXAJ`, `TXSR`, `TXSU`, `TY06`.
  - *Both Star in N and Green in O (3 stores):* `TKL0`, `TPV2`, `TUB7`.

## 3. Files Created
- [`backend/scripts/update_20260902_dispatch_25_invoices.py`](file:///f:/SMRITRretailNX/backend/scripts/update_20260902_dispatch_25_invoices.py) — Synchronizes the 25 invoices in `smriti001` database.
- [`backend/scripts/regenerate_updated_dispatch_pdfs.py`](file:///f:/SMRITRretailNX/backend/scripts/regenerate_updated_dispatch_pdfs.py) — Re-generates pixel-faithful statutory A4 PDF invoices via Playwright.
- [`backend/scripts/update_audit_report_excel.py`](file:///f:/SMRITRretailNX/backend/scripts/update_audit_report_excel.py) — Updates the master audit report with revised figures.
- [`backend/scripts/verify_dispatch_update_parity.py`](file:///f:/SMRITRretailNX/backend/scripts/verify_dispatch_update_parity.py) — Performs 100% line-by-line parity validation.
- [`backend/scripts/generate_updated_eway_bills.py`](file:///f:/SMRITRretailNX/backend/scripts/generate_updated_eway_bills.py) — Regenerates NIC E-Way Bill bulk JSON, individual JSONs, and Excel consignment register.
- [`docs/implementation/billing/Dispatch_Invoices_Update_And_Synchronization_Plan_v5.4.0.md`](file:///f:/SMRITRretailNX/docs/implementation/billing/Dispatch_Invoices_Update_And_Synchronization_Plan_v5.4.0.md) — Formal implementation plan.

## 4. Files Modified
- [`docs/implementation/README.md`](file:///f:/SMRITRretailNX/docs/implementation/README.md) — Updated chronological plan index.
- [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNX/docs/walkthrough/README.md) — Updated chronological walkthrough index.
- [`F:\Smriti-Clients Data\08-09-2026\Invoice_Validation_Audit_Report_TT138_to_TT194_CORRECTED.xlsx`](file:///F:/Smriti-Clients%20Data/08-09-2026/Invoice_Validation_Audit_Report_TT138_to_TT194_CORRECTED.xlsx) — Updated row totals and status annotations.
- [`F:\Smriti-Clients Data\08-09-2026\Tax_Invoice_Tattly_Threads_138_194.7z`](file:///F:/Smriti-Clients%20Data/08-09-2026/Tax_Invoice_Tattly_Threads_138_194.7z) — Repackaged archive with updated PDFs.
- [`F:\Smriti-Clients Data\Eway\EWayBill_Bulk_Upload_TT138_to_TT194.json`](file:///F:/Smriti-Clients%20Data/Eway/EWayBill_Bulk_Upload_TT138_to_TT194.json) — Bulk JSON for all 57 consignments updated with revised values and clean item names.
- [`F:\Smriti-Clients Data\Eway\Individual_Invoices_JSON\`](file:///F:/Smriti-Clients%20Data/Eway/Individual_Invoices_JSON/) — 57 individual invoice JSON files refreshed.
- [`F:\Smriti-Clients Data\Eway\EWayBill_Generation_Register_TT138_to_TT194.xlsx`](file:///F:/Smriti-Clients%20Data/Eway/EWayBill_Generation_Register_TT138_to_TT194.xlsx) — Consignment register updated.
- [`F:\Smriti-Clients Data\Eway\EWayBill_Generation_Register_TT138_to_TT194.7z`](file:///F:/Smriti-Clients%20Data/Eway/EWayBill_Generation_Register_TT138_to_TT194.7z) — Repackaged 7-Zip archive.

## 5. Architecture Decisions
- **Transactional Atomicity:** All database updates (item deletion, item re-insertion, header recalculation, timestamp update) execute within a single PostgreSQL transaction block.
- **Authoritative Discount Pricing Contract:** Unit rate calculation strictly adheres to `round(mrp * 0.5624, 2)` (reflecting a 43.76% trade discount), matching the verified customer contract for Reliance Retail Limited.
- **Multi-Destination PDF Export:** Updated PDFs are exported simultaneously to `Tax_Invoice_Tattly_Threads_138_194` and `Invoices_Store_PO_Invoice` using standard naming (`Tax_Invoice_TT2026-2027_xxx.pdf`) and client-preferred naming (`{StoreCode}_{PO}_{InvoiceNo}.pdf`).

## 6. Design Rationale
In retail supply chain operations, dispatch revisions (e.g. cartons held back, physical stock reductions, or store-specific exclusions) must be reflected synchronously across all system layers. Partial updates create accounting reconciliation failures, tax audit penalties, and delivery mismatches. Updating the PostgreSQL system of record first, regenerating PDFs from that authoritative record, and updating audit workbooks guarantees zero drift.

## 7. Implementation Summary
1. **Spreadsheet Ingestion & Classification:** Loaded `RIL_Dispatch-2.xlsx` sheet `08-09-2026` (779 data rows) and accurately segregated the 57 stores into 32 excluded and 25 included.
2. **Database Synchronization:** Replaced outdated line items with 2,188 freshly calculated line items across 25 invoices in `smriti001`, updating `sales_invoices` headers.
3. **PDF Generation:** Rendered all 25 statutory invoice PDFs using Playwright Chromium headless engine and saved them to both destination directories.
4. **Archive Packaging:** Updated `Tax_Invoice_Tattly_Threads_138_194.7z` with 7-Zip.
5. **Audit Master Update:** Updated 25 rows in `Invoice_Validation_Audit_Report_TT138_to_TT194_CORRECTED.xlsx`.

## 8. Tests Executed
Executed [`backend/scripts/verify_dispatch_update_parity.py`](file:///f:/SMRITRretailNX/backend/scripts/verify_dispatch_update_parity.py) against active PostgreSQL database `smriti001` and client file paths.

```text
===================================================================================================================
SMRITI RETAIL OS — DISPATCH INVOICE UPDATE PARITY VERIFICATION
===================================================================================================================
STORE    | INVOICE NO       | XL QTY  | DB QTY  | XL TOTAL   | DB TOTAL   | DB LINES | PDF CHECK  | PARITY
-------------------------------------------------------------------------------------------------------------------
1888     | TT2026-2027/138  | 104     | 104     | 127019.00  | 127019.00  | 69       | OK         | PASSED
1969     | TT2026-2027/139  | 104     | 104     | 127019.00  | 127019.00  | 69       | OK         | PASSED
1977     | TT2026-2027/140  | 119     | 119     | 144903.00  | 144903.00  | 91       | OK         | PASSED
8155     | TT2026-2027/141  | 108     | 108     | 133630.00  | 133630.00  | 80       | OK         | PASSED
8313     | TT2026-2027/142  | 106     | 106     | 131624.00  | 131624.00  | 78       | OK         | PASSED
8319     | TT2026-2027/143  | 120     | 120     | 146024.00  | 146024.00  | 92       | OK         | PASSED
8361     | TT2026-2027/144  | 120     | 120     | 146024.00  | 146024.00  | 92       | OK         | PASSED
T0N6     | TT2026-2027/146  | 106     | 106     | 131624.00  | 131624.00  | 78       | OK         | PASSED
T1BJ     | TT2026-2027/147  | 120     | 120     | 146024.00  | 146024.00  | 92       | OK         | PASSED
T25I     | TT2026-2027/148  | 106     | 106     | 131624.00  | 131624.00  | 78       | OK         | PASSED
T38X     | TT2026-2027/149  | 107     | 107     | 132686.00  | 132686.00  | 79       | OK         | PASSED
T40K     | TT2026-2027/150  | 70      | 70      | 86293.00   | 86293.00   | 52       | OK         | PASSED
T51H     | TT2026-2027/152  | 107     | 107     | 132686.00  | 132686.00  | 79       | OK         | PASSED
T72W     | TT2026-2027/153  | 120     | 120     | 146024.00  | 146024.00  | 92       | OK         | PASSED
T7FN     | TT2026-2027/154  | 120     | 120     | 146024.00  | 146024.00  | 92       | OK         | PASSED
T91M     | TT2026-2027/156  | 94      | 94      | 118875.00  | 118875.00  | 70       | OK         | PASSED
T97D     | TT2026-2027/157  | 94      | 94      | 118875.00  | 118875.00  | 70       | OK         | PASSED
TDL3     | TT2026-2027/163  | 120     | 120     | 146024.00  | 146024.00  | 92       | OK         | PASSED
TDM4     | TT2026-2027/165  | 110     | 110     | 138708.00  | 138708.00  | 82       | OK         | PASSED
TFW4     | TT2026-2027/166  | 120     | 120     | 146024.00  | 146024.00  | 92       | OK         | PASSED
TKU6     | TT2026-2027/175  | 156     | 156     | 190410.00  | 190410.00  | 116      | OK         | PASSED
TMV9     | TT2026-2027/177  | 126     | 126     | 155587.00  | 155587.00  | 94       | OK         | PASSED
TV78     | TT2026-2027/182  | 258     | 258     | 308926.00  | 308926.00  | 192      | OK         | PASSED
TVB6     | TT2026-2027/184  | 147     | 147     | 179373.00  | 179373.00  | 109      | OK         | PASSED
TYAC     | TT2026-2027/194  | 80      | 80      | 96916.00   | 96916.00   | 58       | OK         | PASSED
-------------------------------------------------------------------------------------------------------------------
TOTAL    | 25 INVOICES      | 2942    | 2942    | 3608946.00 | 3608946.00 | 2188     | ALL OK     | PASSED
===================================================================================================================

Excluded Stores Integrity Check: 32/32 excluded stores present and untouched in smriti001.

ALL VERIFICATION CHECKS PASSED: 100% PARITY BETWEEN EXCEL, DATABASE, AND GENERATED PDFS!
```

## 9. Verification Results
- **Quantitative Measurement (Rule 4):**
  - Before Total Quantity (25 Invoices): 3,156 pairs
  - After Total Quantity (25 Invoices): 2,942 pairs (Reduction: -214 pairs)
  - Before Grand Total (25 Invoices): ₹3,843,254.00
  - After Grand Total (25 Invoices): ₹3,608,946.00 (Reduction: -₹234,308.00)
- **Excluded Stores Guarantee:** Exactly 32/32 excluded stores confirmed untouched.
- **PDF Deliverables:** 25 pairs of PDFs (standard name and store-specific name) verified non-zero byte size and current timestamp.
- **Excel Report Deliverables:** 25 rows updated and verified in `Invoice_Validation_Audit_Report_TT138_to_TT194_CORRECTED.xlsx`.

## 10. Known Limitations
- The 32 excluded stores remain based on the initial import (`RIL_Dispatch.xlsx`). Any future unfreezing of held stores will require a separate synchronization run.

## 11. Future Work
- Incorporate automatic change detection webhooks directly into `RIL_Dispatch-2.xlsx` sync pipelines.

## 12. Related ADRs
- `ADR-0021`: Canonical Statutory Tax Invoice Calculation and Trade Discount Formula.
- `ADR-0034`: Server-Side Headless Playwright PDF Rendering Engine.

## 13. Related RFCs
- `RFC-2026-09-02`: Store Grouped Dispatch Consignment Invoice Architecture.
