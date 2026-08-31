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

  * Version    : 5.0.0
  * Created    : 2026-08-25
  * Modified   : 2026-08-25
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Tattly Threads Batch 2 Tax Invoice Generation (129–137)

## 1. Purpose
This document records the end-to-end execution, generation, and verification of 9 canonical B2B Tax Invoices (`TT2026-2027/129` to `TT2026-2027/137`) generated on `2026-08-25` from client dispatch matrix `RIL_Dispatch_09-08-2026-2.xlsx` (`Sheet2`) and store purchase order registers.

## 2. Scope
- Parsing 57 dispatch line items across 9 unique Store/SIS locations (`TVB6`, `TMV9`, `TUK5`, `TVP2`, `TW97`, `TXSR`, `TXSU`, `TW07`, `TYAC`).
- Total quantity: 456 pairs across 10 shipping cartons (`213`, `214`, `215`, `216`, `217`, `218`, `219`, `220`, `221`, `222`).
- Total batch taxable value: ₹5,10,854.28 with ₹25,542.72 GST, resulting in ₹5,36,397.00 gross invoice value.
- Store mapping reconciliation against `All Stores Po.xlsx` and `RIL FINAL LIST.xlsx`.
- Transactional persistence into PostgreSQL database `smriti001` (`sales_invoices`, `sales_invoice_items`, `invoice_document_artifacts`).
- High-fidelity Playwright headless browser rendering of 9 canonical A4 Tax Invoice PDF artifacts with embedded Code128 barcodes, VERIFY INVOICE QR codes, and brand identity assets.
- Back-writing `Dispatch Status` column into `Sheet2` of `RIL_Dispatch_09-08-2026-2.xlsx`.

## 3. Files Created
- `F:\Smriti-Clients Data\Tattly Threads\24_08_26\Tax_Invoice_Store_PO_Address_Confirmation_Batch2_2026-08-25.xlsx`: Pre-creation verification Excel workbook with 2 sheets.
- `F:\Smriti-Clients Data\Tattly Threads\24_08_26\Invoices\SIS_*_TaxInvoice_TT2026-2027_*.pdf`: 9 authoritative A4 Tax Invoice PDF documents.
- `F:\SMRITRretailNX\exports\tt_batch_129_137\SIS_*_TaxInvoice_TT2026-2027_*.pdf`: System exports mirrored archive.
- `F:\SMRITRretailNX\TT\SIS_*_TaxInvoice_TT2026-2027_*.pdf`: Central TT storage mirror.
- `F:\SMRITRretailNX\scripts\gen_batch2_inv.py`: NGP-compliant automated generation and database synchronization script.

## 4. Files Modified
- `F:\Smriti-Clients Data\Tattly Threads\24_08_26\RIL_Dispatch_09-08-2026-2.xlsx`: Column 15 `Dispatch Status` updated in `Sheet2` with invoice numbers `TT2026-2027/129` to `TT2026-2027/137`.
- `docs/walkthrough/README.md`: Master index updated with Batch 2 generation metadata.
- `CHANGELOG.md`: Registered v3.37.0 release notes.

## 5. Architecture Decisions
- **Sequential Invoicing Invariant**: Sequence continues directly from `TT2026-2027/128` (Batch 1) into `TT2026-2027/129` through `TT2026-2027/137`.
- **B2B Tax Exclusive Pricing**: Unit Price = `MRP * 0.5624` (representing 43.76% trade discount), with 5% GST applied.
- **Interstate Tax Classification**: All 9 destinations (Andhra Pradesh, Telangana, Karnataka) calculate 5% IGST as interstate supplies originating from Maharashtra (GSTIN `27AAXFT2508H1ZR`).
- **Playwright Pixel-Faithful A4 Rendering**: Exact CSS print margins (`8mm 8mm 10mm 8mm`) ensuring zero-spill single-page invoices.

## 6. Design Rationale
Executing rendering via `InvoicePdfService` guarantees that all QR codes, barcodes, bank details, and typography match earlier batches (`18–106` and `107–128`) with zero visual regression.

## 7. Implementation Summary

| Invoice No. | SIS Code | Carton(s) | PO Number | State | Pairs | Taxable (₹) | IGST (₹) | Grand Total (₹) | PDF File |
|---|---|---|---|---|---|---|---|---|---|
| `TT2026-2027/129` | `TVB6` | 218 | `5182778200` | ANDHRA PRADESH | 56 | 62,507.60 | 3,125.38 | 65,633.00 | `SIS_TVB6_TaxInvoice_TT2026-2027_129.pdf` |
| `TT2026-2027/130` | `TMV9` | 219, 220 | `5182778193` | TELANGANA | 80 | 87,689.52 | 4,384.48 | 92,074.00 | `SIS_TMV9_TaxInvoice_TT2026-2027_130.pdf` |
| `TT2026-2027/131` | `TUK5` | 217 | `5182778198` | ANDHRA PRADESH | 48 | 53,963.84 | 2,698.19 | 56,662.00 | `SIS_TUK5_TaxInvoice_TT2026-2027_131.pdf` |
| `TT2026-2027/132` | `TVP2` | 216 | `5182778201` | KARNATAKA | 48 | 53,963.84 | 2,698.19 | 56,662.00 | `SIS_TVP2_TaxInvoice_TT2026-2027_132.pdf` |
| `TT2026-2027/133` | `TW97` | 213 | `5182778204` | TELANGANA | 48 | 53,963.84 | 2,698.19 | 56,662.00 | `SIS_TW97_TaxInvoice_TT2026-2027_133.pdf` |
| `TT2026-2027/134` | `TXSR` | 214 | `5182778206` | TELANGANA | 48 | 53,963.84 | 2,698.19 | 56,662.00 | `SIS_TXSR_TaxInvoice_TT2026-2027_134.pdf` |
| `TT2026-2027/135` | `TXSU` | 215 | `5182778207` | KARNATAKA | 48 | 53,963.84 | 2,698.19 | 56,662.00 | `SIS_TXSU_TaxInvoice_TT2026-2027_135.pdf` |
| `TT2026-2027/136` | `TW07` | 221 | `5182778158` | KARNATAKA | 40 | 45,419.04 | 2,270.95 | 47,690.00 | `SIS_TW07_TaxInvoice_TT2026-2027_136.pdf` |
| `TT2026-2027/137` | `TYAC` | 222 | `5182778209` | KARNATAKA | 40 | 45,419.04 | 2,270.95 | 47,690.00 | `SIS_TYAC_TaxInvoice_TT2026-2027_137.pdf` |
| **TOTAL** | **9 Stores** | **10 Cartons** | — | — | **456** | **₹5,10,854.28** | **₹25,542.72** | **₹5,36,397.00** | **9 PDF Files** |

## 8. Tests Executed
- Database row count, foreign key consistency, and item count validation in `smriti001`.
- On-disk PDF existence and size validation for all 9 documents across all 3 storage targets.
- Confirmation workbook sheet structure and formula verification.
- `scripts/smriti_naming_guard.py` NGP verification: 0 violations.

## 9. Verification Results
- Database insertion: 9/9 invoices committed with status `COMPLETED`.
- PDF generation: 9/9 PDFs rendered (sizes between 293 KB and 304 KB).
- Total canonical tax invoices active in system: 120 (`TT2026-2027/18` to `TT2026-2027/137`).
- Confirmation workbook created at `F:\Smriti-Clients Data\Tattly Threads\24_08_26\Tax_Invoice_Store_PO_Address_Confirmation_Batch2_2026-08-25.xlsx`.
- Excel dispatch status updated in `RIL_Dispatch_09-08-2026-2.xlsx` (`Sheet2`).

## 10. Known Limitations
- Requires Chromium headless instance via Playwright for PDF generation.

## 11. Future Work
- Real-time GSTN e-Invoice portal upload via automated compliance gateway when production API keys are live.

## 12. Related ADRs
- `ADR-004`: PostgreSQL Sole System-of-Record Architecture.
- `ADR-011`: Canonical Invoice Artifact Engine.

## 13. Related RFCs
- `RFC-009`: B2B Multi-Store Batch Invoice Automation.
