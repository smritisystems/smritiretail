<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.27.0
  Created      : 2026-10-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Implementation Plan & Governance
-->

# Implementation Plan: Generation of 9 Statutory GST Tax Invoices for Reliance Retail (TATTLY_THREADS_INDENT_FORMATTED (1).xlsx) (v6.27.0)

## 1. Objective
Execute statutory commercial dispatch invoicing for 9 Reliance Retail stores from `F:\Smriti-Clients Data\Tattly Threads\12-10-2026\TATTLY_THREADS_INDENT_FORMATTED (1).xlsx` starting at invoice number `TT2026-2027/287` through `TT2026-2027/295`, continuing sequentially from `TT2026-2027/286`.

## 2. Business Motivation
Provide full statutory compliance, E-Way Bill readiness, and physical delivery documentation for 441 pairs of footwear dispatched on 12-10-2026 to 9 stores of Reliance Retail Limited across Assam, Tripura, Karnataka, and West Bengal.

## 3. Scope
Ingest store indent spreadsheet, resolve item barcodes from purchase and item master records, calculate taxable values and 5% interstate IGST, omit PO Reference and PO Date on invoices per client directive, generate 9 A4 vector PDF invoices via Playwright, create NIC v1.0.1118 compliant E-Way Bill payloads, persist records to PostgreSQL `smriti001`, and generate client audit summaries.

## 4. Current State
Previous dispatches covered invoices up to `TT2026-2027/286`. Store dispatch for 12-10-2026 contains 9 stores needing sequential tax invoices starting from `TT2026-2027/287`. Client mandated generation strictly without PO / Reference numbers.

## 5. Gap Analysis
The new indent contains article styles and sizes without direct barcode mapping in the indent sheet. Barcode mapping requires cross-referencing `ALL VENDOR PURCHASE FOR SOFTWARE.xlsx` and `TATTLY THREADS ITEM MASTER 2026 - Copyfinal2.xlsx`.

## 6. Architecture Impact
Uses SMRITI's standard headless dispatch architecture: unpivoted lines, transactional staging in PostgreSQL `smriti001`, vector A4 PDF rendering via Playwright and `InvoicePdfService`, and statutory NIC E-Way Bill generation.

## 7. Proposed Design
1. Load and parse `TATTLY_THREADS_INDENT_FORMATTED (1).xlsx` (116 article rows, 441 pairs).
2. Resolve barcodes across all 254 unpivoted line items.
3. Apply standard wholesale pricing: `unit_rate = round(mrp * 0.5624, 2)`.
4. Omit PO Reference and PO Date on headers, database records (`po_reference = None`), and PDF filenames.
5. Insert headers into `sales_invoices`, lines into `sales_invoice_items`, and transport records into `eway_bills`.
6. Render 9 PDFs using Playwright with `InvoicePdfService`.
7. Generate 9 single E-Way JSONs + 1 consolidated bulk upload JSON.
8. Generate client audit workbook `Tax_Invoice_Summary_12-10-2026.xlsx`.

## 8. Files Created
- `backend/scripts/generate_ril_dispatch_12102026_invoices.py`
- `docs/walkthrough/sales/Sales_Dispatch_9_Stores_Invoices_12102026_v6.27.0.md`
- `docs/implementation/sales/Sales_Dispatch_9_Stores_Invoices_12102026_Plan_v6.27.0.md`

## 9. Files Modified
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- Playwright Chromium
- openpyxl
- psycopg2
- `smriti001` database on port 2781

## 11. Risks
- Excel file locking if open in external viewers: mitigated with automated `_Updated.xlsx` / `_Clean.pdf` failover.

## 12. Rollback Strategy
Delete generated records by target IDs (`inv-dispatch-12102026-*`) from `sales_invoice_items`, `eway_bills`, and `sales_invoices`.

## 13. Verification Plan
Run end-to-end reconciliation script verifying DB row counts, mathematical parity (pairs, MRP, taxable, tax, grand total), file existence, and sheet layout.

## 14. Test Plan
Execute `backend/scripts/generate_ril_dispatch_12102026_invoices.py` and `scratch/verify_output_12102026.py`.

## 15. Documentation Impact
Walkthrough created and registered in master index; implementation plan registered in master index; CHANGELOG updated.

## 16. Deployment Plan
Local generation on client machine directly accessing network drives and local tenant database.

## 17. Status
Completed.

## 18. Related ADRs
- `ADR-038`: Store-Specific Direct Invoicing
- `ADR-041`: NIC E-Way Bill Schema Compliance

## 19. Related Walkthroughs
- `docs/walkthrough/sales/Sales_Dispatch_9_Stores_Invoices_12102026_v6.27.0.md`
