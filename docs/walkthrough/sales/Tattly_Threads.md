<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 4.9.0
  * Created    : 2026-08-24
  * Modified   : 2026-08-24
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Tattly Threads Batch Tax Invoice Generation (107–128)

## 1. Purpose
This document records the end-to-end execution and verification of 22 canonical B2B Tax Invoices (`TT2026-2027/107` to `TT2026-2027/128`) generated on `2026-08-24` from client dispatch matrix `RIL_Dispatch_09-08-2026.xlsx` (`Sheet1`) and store purchase order registers.

## 2. Scope
- Parsing 132 dispatch matrix line items across 22 unique Store/SIS locations.
- Matching Store Codes to Purchase Orders, Site Names, Delivery Site Addresses, Recipient Billing Addresses, and State GSTINs.
- Transactional persistence into PostgreSQL database `smriti001` (`sales_invoices`, `sales_invoice_items`, `invoice_document_artifacts`).
- High-fidelity Playwright headless browser rendering of 22 canonical A4 Tax Invoice PDF artifacts with embedded Code128 barcodes, GST QR codes, and brand identity assets.

## 3. Files Created
- `F:\Smriti-Clients Data\Tattly Threads\24_08_26\Tax_Invoice_Store_PO_Address_Confirmation_2026-08-24.xlsx`: Pre-creation verification Excel workbook with 2 sheets.
- `F:\Smriti-Clients Data\Tattly Threads\24_08_26\Invoices\SIS_*_TaxInvoice_TT2026-2027_*.pdf`: 22 authoritative A4 Tax Invoice PDF documents.
- `F:\SMRITRretailNX\exports\tt_batch_107_128\SIS_*_TaxInvoice_TT2026-2027_*.pdf`: System exports mirrored archive.

## 4. Files Modified
- `docs/walkthrough/README.md`: Master index updated with batch generation metadata.

## 5. Architecture Decisions
- **Unified Identity Invariant**: Store Code and SIS Code are treated as equivalent identifiers across dispatch sheets and purchase order registers.
- **B2B Tax Exclusive Pricing**: For B2B Reliance Retail Limited transactions, line item prices represent tax-exclusive base cost (`MRP * 0.5624` reflecting 43.76% trade discount), with 5% GST applied explicitly.
- **Multi-Jurisdiction Tax Classification**: Invoices for stores outside Maharashtra (e.g. Karnataka, Telangana, Andhra Pradesh, Assam, Bihar, Tamil Nadu, Tripura) calculate 5% IGST; Maharashtra destinations split into 2.5% CGST and 2.5% SGST.

## 6. Design Rationale
Playwright PDF rendering directly executes CSS print layout rules (`@page { size: A4 portrait; margin: 8mm 8mm 12mm 8mm; }`), ensuring identical visual typography, column alignment, and zero page-overflow across single-page A4 invoices.

## 7. Implementation Summary
- **Batch Range**: `TT2026-2027/107` to `TT2026-2027/128` (22 Tax Invoices).
- **Invoice Date**: `2026-08-24`.
- **Total Pairs (Quantity)**: 1,053 pairs across 22 cartons.
- **Total Invoices in DB**: 111 canonical invoices (`TT2026-2027/18` to `TT2026-2027/128`).

## 8. Tests Executed
- Database row count and foreign key consistency assertion between `sales_invoices`, `sales_invoice_items`, and `invoice_document_artifacts`.
- On-disk PDF existence and file size validation for all 22 documents.

## 9. Verification Results
- Database insertion: 22/22 invoices committed with status `COMPLETED`.
- PDF generation: 22/22 PDFs rendered with file sizes between 175 KB and 182 KB.
- Total canonical tax invoices active in system: 111.

## 10. Known Limitations
- Requires Chromium headless instance for PDF rendering.

## 11. Future Work
- Direct NIC/GSTN e-Invoice IRN QR integration when live API credentials are supplied.

## 12. Related ADRs
- `ADR-004`: PostgreSQL Sole System-of-Record Architecture.
- `ADR-011`: Canonical Invoice Artifact Engine.

## 13. Related RFCs
- `RFC-009`: B2B Multi-Store Batch Invoice Automation.
