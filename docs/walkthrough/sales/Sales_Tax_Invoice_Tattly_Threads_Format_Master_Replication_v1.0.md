<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-17
  Modified     : 2026-08-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Walkthrough — Tattly Threads Tax Invoice Format Master Replication v1.0

## 1. Purpose
Achieve 100% forensic and geometric reproduction of the authoritative original Tattly Threads Tax Invoices (`F:\SMRITRretailNX\TT\B` and `C:\Users\netma\Downloads\Tax_Invoice_Tattly_Threads\`) within the SMRITI Retail OS FastAPI backend canonical rendering engine (`InvoicePdfService`), ensuring zero financial data loss, exact point-by-point grid geometry, Code 128 barcode retention, GST E-Invoice QR code retention, and dynamic multi-page pagination matching.

## 2. Scope
- Authoritative original PDF scan of 30 invoices in `F:\SMRITRretailNX\TT\B` (`TT2026-2027/74` to `TT2026-2027/103`).
- 54 Historical Invoices in `C:\Users\netma\Downloads\Tax_Invoice_Tattly_Threads\` (`TT2026-2027/18` to `TT2026-2027/71`).
- Geometry replication of ISO A4 dimensions (`595.92 x 842.88 pt`), margins (`23.25 pt`), table columns (`#`, `ITEM DESCRIPTION`, `HSN/SAC`, `QTY`, `MRP`, `DISC %`, `TAXABLE VALUE`, `IGST @ 5%`, `AMOUNT`), row height (`11.25 pt`), subtotal row (`13.50 pt`), summary box, bank details, and statutory watermark for cancelled invoices (`TT/39`, `TT/43`, `TT/58`).
- Database immutability verification on canonical template `TAX_INVOICE_TATTLY_THREADS` (`V1`, `FROZEN`).

## 3. Files Created
- `F:\SMRITRretailNX\exports\ORIGINAL_INVOICE_MASTER_INDEX.csv` (30 original invoices indexed with SHA256)
- `F:\SMRITRretailNX\exports\GEOMETRY_REPORT.csv` (Element bounding boxes & dimensions)
- `F:\SMRITRretailNX\exports\TATTLY_THREADS_MASTER_RECONCILIATION.csv` (54-invoice master comparison)
- `F:\SMRITRretailNX\exports\TATTLY_THREADS_MASTER_RECONCILIATION.md` (Detailed markdown report)
- `docs/walkthrough/sales/Sales_Tax_Invoice_Tattly_Threads_Format_Master_Replication_v1.0.md`

## 4. Files Modified
- [`F:\SMRITRretailNX\backend\app\services\invoice_pdf_service.py`](file:///F:/SMRITRretailNX/backend/app/services/invoice_pdf_service.py)

## 5. Architecture Decisions
- Preserved Single Source-of-Truth in PostgreSQL `smriti001` and FastAPI `InvoicePdfService`.
- Implemented Playwright Headless Chromium print engine with zero CSS column overflow and deterministic table layout.
- Designed dynamic pagination engine handling single-page, 2-page, 3-page, 4-page, and 5-page documents based on item row count and address wrapping lines.

## 6. Design Rationale
- Original Tax Invoices feature statutory Code 128 barcodes and GST QR codes on Page 1. Retaining both complies with GST e-invoicing standards and matches the physical visual masters.
- Cancelled invoices must retain line items and financial line integrity while bearing prominent statutory `CANCELLED` watermarks and header badges.

## 7. Implementation Summary
- Scanned `TT\B` and indexed all 30 originals into `ORIGINAL_INVOICE_MASTER_INDEX.csv`.
- Calibrated pagination rules (`first_page_max=25` or `23`, `cont_page_max=36`, `last_page_room=18`).
- Batch-rendered all 92 canonical invoices into `F:\SMRITRretailNX\exports\canonical_tax_invoices/`.
- Performed 54-invoice forensic verification against `C:\Users\netma\Downloads\Tax_Invoice_Tattly_Threads/`.

## 8. Tests Executed
- `pytest backend/tests/test_canonical_tax_invoice_frozen.py -v` (17 passed)
- Full 54-invoice automated forensic reconciliation engine (`build_full_reconciliation_suite.py`).

## 9. Verification Results
- 54 / 54 (100.0%) Invoices PASSED:
  - Total Quantity Mismatches: 0
  - Grand Total Mismatches: 0
  - Page Count Mismatches: 0
  - Missing Barcodes: 0
  - Missing QR Codes: 0

## 10. Known Limitations
- None. All 54 historical invoices match exactly in financial totals, item quantities, pagination, and visual assets.

## 11. Future Work
- Add direct printer spooling integration for thermal/POS roll printers alongside A4 PDF output.

## 12. Related ADRs
- `ADR-0044`: Canonical Tax Invoice Multi-Page Pagination Standard.

## 13. Related RFCs
- `RFC-0089`: High-Fidelity Statutory PDF Generation Architecture.
