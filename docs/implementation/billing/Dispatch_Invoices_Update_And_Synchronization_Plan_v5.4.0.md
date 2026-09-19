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

# Implementation Plan — Dispatch Invoices Update & Synchronization (v5.4.0)

## 1. Objective
Synchronize the active sales invoices in PostgreSQL database `smriti001`, regenerate statutory pixel-faithful A4 PDF invoices, and update the audit validation master report according to the revised line items in `F:\Smriti-Clients Data\08-09-2026\RIL_Dispatch-2.xlsx` (sheet `"08-09-2026"`), while strictly excluding bills/stores having `*` in Column N or green highlight in Column O.

## 2. Business Motivation
The client provided a revised dispatch spreadsheet (`RIL_Dispatch-2.xlsx`) reflecting physical warehouse packing adjustments. Specifically, certain lines/quantities were adjusted downwards across stores, 10 stores were marked with `*` in Column N (carton hold/cancelled), 19 stores were highlighted in green in Column O (already finalized/dispatched), and 3 stores had both. To maintain statutory billing integrity, prevent overbilling, and ensure exact alignment between physical dispatches and tax invoices, the database, PDF documents, and audit master reports must be updated with 100% mathematical parity.

## 3. Scope
- **Source File:** `F:\Smriti-Clients Data\08-09-2026\RIL_Dispatch-2.xlsx` (Sheet: `"08-09-2026"`, 779 data rows across 57 stores).
- **Target Invoices:** Exactly 25 stores/invoices in database `smriti001` (invoices with neither `*` in Column N nor green fill in Column O).
- **Excluded Invoices:** 32 stores/invoices (10 with `*` in Column N, 19 with green fill in Column O, 3 with both). These remain strictly untouched.
- **Affected Artifacts:**
  - Database tables: `smriti001.sales_invoices`, `smriti001.sales_invoice_items`.
  - PDF Invoices: `F:\Smriti-Clients Data\08-09-2026\Tax_Invoice_Tattly_Threads_138_194\` and `Invoices_Store_PO_Invoice\`.
  - Audit Master Report: `F:\Smriti-Clients Data\08-09-2026\Invoice_Validation_Audit_Report_TT138_to_TT194_CORRECTED.xlsx`.
  - Archive: `F:\Smriti-Clients Data\08-09-2026\Tax_Invoice_Tattly_Threads_138_194.7z`.

## 4. Current State
- Previously, 57 invoices (`TT2026-2027/138` to `TT2026-2027/194`) were generated and imported into `smriti001` under batch `DISPATCH_20260902_STORE_GROUPED_V2` using `RIL_Dispatch.xlsx` (800 rows, 6,471 pairs).
- The client modified dispatch quantities in `RIL_Dispatch-2.xlsx` (779 rows, 6,250 pairs), leaving the database with outdated higher quantities for 18 stores.

## 5. Gap Analysis
- 18 of the 25 target stores had overbilled quantities in the database compared to `RIL_Dispatch-2.xlsx`, amounting to a discrepancy of 214 pairs and ₹234,308.00.
- Outdated PDF documents existed in client folders reflecting old quantities.
- The audit report did not reflect the revised line items from `RIL_Dispatch-2.xlsx`.

## 6. Architecture Impact
- Enforces SMRITI Universal Author Details & File Header Policy (UADHP).
- Strictly complies with SMRITI Governance Rule 12 (column-by-column schema parity) and Rule 4 (measurement evidence).
- Uses atomic PostgreSQL transaction (`BEGIN ... COMMIT`) to guarantee all-or-nothing database updates.

## 7. Proposed Design
- Script `update_20260902_dispatch_25_invoices.py` loads `RIL_Dispatch-2.xlsx`, filters the 25 stores, wipes their previous line items in `sales_invoice_items`, rebuilds all 2,188 line items with exact discount pricing (`round(mrp * 0.5624, 2)`), updates `sales_invoices` headers, and commits atomically.
- Script `regenerate_updated_dispatch_pdfs.py` executes Playwright headless browser rendering via `InvoicePdfService` to re-export the 25 PDF files with pixel fidelity.
- Script `update_audit_report_excel.py` updates the master audit workbook.
- Script `verify_dispatch_update_parity.py` validates 100% parity across Excel, DB, and PDFs.

## 8. Files Created
- `backend/scripts/update_20260902_dispatch_25_invoices.py`
- `backend/scripts/regenerate_updated_dispatch_pdfs.py`
- `backend/scripts/update_audit_report_excel.py`
- `backend/scripts/verify_dispatch_update_parity.py`
- `docs/implementation/billing/Dispatch_Invoices_Update_And_Synchronization_Plan_v5.4.0.md`
- `docs/walkthrough/billing/Dispatch_Invoices_Update_And_Synchronization_v5.4.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `F:\Smriti-Clients Data\08-09-2026\Invoice_Validation_Audit_Report_TT138_to_TT194_CORRECTED.xlsx`
- `F:\Smriti-Clients Data\08-09-2026\Tax_Invoice_Tattly_Threads_138_194.7z`

## 10. Dependencies
- PostgreSQL 15+ (`smriti001`)
- Python 3.13 (`psycopg2`, `openpyxl`, `playwright`)
- 7-Zip CLI (`7z.exe`)

## 11. Risks
- Risk of inadvertently modifying any of the 32 excluded stores.
  *Mitigation:* Explicit SQL `delivery_store_code = ANY(%s)` filtering with pre-validated 25-store whitelist.
- Risk of rounding discrepancies in invoice grand totals.
  *Mitigation:* Exact rounding formula `round(taxable + tax)` matching historical reference invoices (`TT18` to `TT71`).

## 12. Rollback Strategy
Database changes are transactional; any failure during execution triggers an immediate `ROLLBACK`. Original files are preserved in historical batch metadata.

## 13. Verification Plan
- Column-by-column, line-by-line verification comparing `RIL_Dispatch-2.xlsx` to `sales_invoice_items`.
- Quantitative before-and-after audit check on total pairs, taxable value, tax total, and grand total.
- Verification that all 32 excluded stores remain completely untouched.
- Visual and structural verification of generated PDF invoices.

## 14. Test Plan
- Run `verify_dispatch_update_parity.py` to confirm zero discrepancies.

## 15. Documentation Impact
- Implementation plan recorded in `docs/implementation/billing/`.
- Walkthrough recorded in `docs/walkthrough/billing/`.
- Master indexes updated in `docs/implementation/README.md` and `docs/walkthrough/README.md`.

## 16. Deployment Plan
- Run synchronization script in local PostgreSQL environment.
- Re-generate PDFs directly into client output directories.
- Package output PDFs into 7z archive for client distribution.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0021`: Canonical Statutory Tax Invoice Calculation and 43.76% Trade Discount Formula.
- `ADR-0034`: Server-Side Headless Playwright PDF Rendering Engine.

## 19. Related Walkthroughs
- [`docs/walkthrough/billing/Dispatch_Invoices_Update_And_Synchronization_v5.4.0.md`](../walkthrough/billing/Dispatch_Invoices_Update_And_Synchronization_v5.4.0.md)
