<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.30.0
  Created      : 2026-09-02
  Modified     : 2026-09-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI B2B Sales Invoice Server-Side Playwright PDF Pipeline Walkthrough

## 1. Purpose
This document provides an end-to-end technical walkthrough of the server-side PDF pipeline fix for B2B Sales Invoices in SMRITI Retail OS v3.x. The implementation resolves the missing Playwright Chromium headless engine and system runtime libraries within the `smriti-api` Docker container, unblocks `/api/v1/sales/invoices/{id}/pdf`, `/download`, and `/reprint` binary streaming endpoints, harmonizes model attribute construction on `InvoiceDocumentArtifact`, and preserves the single-source-of-truth Golden CSS HTML rendering architecture across preview, browser printing, and statutory A4 PDF compilation.

## 2. Scope
* **Backend Runtime Container:** `backend/Dockerfile` and `backend/production.txt` package manifests.
* **PDF Rendering Pipeline:** `backend/app/services/invoice_pdf_service.py` (`InvoicePdfService.render_pdf_bytes()` and `InvoicePdfService.get_or_render_pdf_artifact()`).
* **API Route Streaming Contract:** `backend/app/api/v1/sales.py` (`get_sales_invoice_pdf_stream`, `get_sales_invoice_download_attachment`, `get_sales_invoice_reprint_contract`, `get_sales_invoice_preview_contract`, `get_sales_invoice_print_contract`).
* **Target Forensic Validation:** Authoritative validation against real PostgreSQL transactional invoice `INV-INV-1788357308-491856` (ID: `inv-1788357308-491856`).

## 3. Files Created
* `scratch/inspect_invoice_pdf_print.py` (Transient validation script for HTTP and MIME assertions)
* `scratch/parse_pdf_artifact.py` (Transient forensic parser verifying binary PDF structure and extracted textual assertions via PyMuPDF)
* `scratch/verify_ui_print_flow.py` (Transient Playwright UI browser test verifying user session flow)

## 4. Files Modified
* `backend/production.txt` — Added pinned `playwright==1.44.0`, `qrcode==7.4.2`, `python-barcode==0.15.1`, and `pymupdf==1.24.5`.
* `backend/Dockerfile` — Added system dependencies (`libnss3`, `libnspr4`, `libatk1.0-0`, `libcups2`, `libdrm2`, `libdbus-1-3`, `libxkbcommon0`, `libxcomposite1`, `libxdamage1`, `libxfixes3`, `libxrandr2`, `libgbm1`, `libpango-1.0-0`, `libcairo2`, `libasound2`, `fonts-liberation`) and post-install `playwright install chromium`.
* `backend/app/services/invoice_pdf_service.py` — Refined `render_pdf_bytes()` with robust `try...finally` browser and page closing semantics, switched to `wait_until="domcontentloaded"`, and harmonized `InvoiceDocumentArtifact` model constructor parameters.
* `backend/app/api/v1/sales.py` — Streamlined `GET /invoices/{invoice_id}/pdf` to default to `media_type="application/pdf"` binary streams with `inline` Content-Disposition header.
* `docs/walkthrough/README.md` — Appended chronological master index table entry.

## 5. Architecture Decisions
1. **Single Source of Truth Document Engine:** Retained the existing Golden CSS Tax Invoice HTML renderer (`tax_invoice_spec.py` / `invoice_pdf_service.py`) as the sole canonical document blueprint for HTML preview, client-side browser printing, and server-side PDF generation.
2. **Playwright + Chromium Engine:** Standardized on Playwright async API with headless Chromium (`--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`) inside Docker for pixel-faithful A4 rendering matching browser print CSS specifications (`@page`, `@media print`).
3. **Multi-Tenant Database Storage:** Artifact records are persisted in PostgreSQL tenant database `invoice_document_artifacts` linked directly to `sales_invoices.id` with SHA256 integrity hash and file size metadata.

## 6. Design Rationale
* B2B accounting compliance in India requires statutory A4 Tax Invoices with exact GST rate breakouts, interstate IGST calculations, HSN codes, Indian currency formatting, and amount in words.
* Generating PDFs on the server side using the same Chromium engine as modern browsers eliminates visual discrepancies between what the operator sees in UI preview and what is exported or transmitted as a PDF document.

## 7. Implementation Summary
* Added headless Chromium and requisite Linux shared libraries to Docker runtime image.
* Cleaned up `InvoiceDocumentArtifact` instantiation kwargs to match SQL model schema.
* Configured `/pdf` endpoint to stream binary `application/pdf` by default, preserving `/html` and `/preview` for iframe or web preview, and `/print` for automated `window.print()` triggers.
* Verified SHA256 integrity, page count, and physical PDF generation.

## 8. Tests Executed
1. **Endpoint Diagnostic Test (`scratch/inspect_invoice_pdf_print.py`):**
   * Verified `GET /api/v1/sales/invoices/{id}/pdf` returns `HTTP 200`, `application/pdf`, `%PDF-1.4` header, 76,057 bytes.
   * Verified `GET /api/v1/sales/invoices/{id}/download` returns `HTTP 200`, `attachment` disposition header.
   * Verified `GET /api/v1/sales/invoices/{id}/reprint` returns `HTTP 200`, `inline; filename="..._REPRINT.pdf"`.
   * Verified `GET /api/v1/sales/invoices/{id}/print` returns `HTTP 200`, `text/html` with `window.print()`.
   * Verified `GET /api/v1/sales/invoices/{id}/preview` and `/html` return `HTTP 200`, `text/html`.
2. **Deep Binary Forensic Parsing (`scratch/parse_pdf_artifact.py`):**
   * Loaded generated 76,057 byte stream into PyMuPDF.
   * Extracted text content and verified presence of:
     * Invoice Number: `INV-INV-1788357308-491856`
     * Customer Name: `Validation Test B2B Enterprise 192507`
     * Customer GSTIN: `29AABCR1718E1ZL`
     * Seller GSTIN: `27AAXFT2508H1ZR`
     * Line Items: `BASIC CHAPPAL` (Qty: 5), `REGULAR SANDAL` (Qty: 2)
     * Taxable: `₹13,103.10`
     * GST Total: `₹2,358.56`
     * Grand Total: `₹15,461.66`
     * Amount in Words: `Fifteen Thousand Four Hundred`
3. **Frontend Vitest Suite:**
   * Ran `npm test`: 99 test files passed (612 tests green).
4. **Frontend Production Build:**
   * Ran `npm run build`: 3526 modules transformed, built in 28.58s.

## 9. Verification Results
```text
==========================================================================================
SMRITI RETAIL OS — DEEP PDF BINARY ARTIFACT FORENSIC PARSER
==========================================================================================

[1] Fetching PDF Binary from http://localhost:3000/api/v1/sales/invoices/inv-1788357308-491856/pdf...
  HTTP Status: 200
  Content-Type: application/pdf
  Content-Disposition: inline; filename="TaxInvoice_INV-INV-1788357308-491856.pdf"
  Binary File Size: 76,057 bytes
  Magic Byte Header: b'%PDF-1.4'

[2] Parsing PDF Content with PyMuPDF...
  Total Pages: 1
  Extracted Text Length: 1,802 characters

[3] Text Content Assertions inside Rendered Binary PDF:
  ✓ PASS   | Invoice Number           -> Target: 'INV-INV-1788357308-491856'
  ✓ PASS   | Customer Name            -> Target: 'Validation Test B2B Enterprise 192507'
  ✓ PASS   | Customer GSTIN           -> Target: '29AABCR1718E1ZL'
  ✓ PASS   | Seller GSTIN             -> Target: '27AAXFT2508H1ZR'
  ✓ PASS   | Line Item 1 Description  -> Target: 'BASIC CHAPPAL'
  ✓ PASS   | Line Item 2 Description  -> Target: 'REGULAR SANDAL'
  ✓ PASS   | Quantity 1               -> Target: '5'
  ✓ PASS   | Quantity 2               -> Target: '2'
  ✓ PASS   | Price                    -> Target: '1,899'
  ✓ PASS   | Taxable Value            -> Target: '13,103.10'
  ✓ PASS   | GST Amount               -> Target: '2,358.56'
  ✓ PASS   | Grand Total              -> Target: '15,461.66'
  ✓ PASS   | Amount in Words          -> Target: 'Fifteen Thousand Four Hundred'

==========================================================================================
ALL CRITICAL PDF FORENSIC CHECKS PASSED GREEN (100% VERIFIED)
==========================================================================================
```

## 10. Known Limitations
* Multi-page overflow invoices with over 30 line items rely on CSS page-break rules; long invoice table pagination should be tested on high-volume test fixtures.

## 11. Future Work
* Integration with NIC e-Invoice QR code payload signing and IRN embedding directly in the top header box.
* Direct email dispatch of generated PDF attachments to customer registered email contacts.

## 12. Related ADRs
* ADR-014: Single Canonical Document Rendering Engine for SMRITI Invoices and Orders.

## 13. Related RFCs
* RFC-089: Statutory Tax Invoice Format and Multi-Tenant Storage Specification.
