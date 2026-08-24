<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.9.5
  Created      : 2026-08-18
  Modified     : 2026-08-18
  Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Invoicing

**Date:** 2026-08-18 | **Version:** 4.9.5

## 1. Purpose
Implement backend-driven GST and E-Invoice QR compliance architecture, dynamic Reverse Charge rule 46(p) handling, footer branding center alignment, and subtle background Tattly logo watermark (80% width, 7% opacity) while preserving 100% frozen visual geometry and barcode/QR scannability across all 86 invoices.

## 2. Scope
- `backend/app/models/sales.py`: Added compliance columns `e_invoice_status`, `irn`, `ack_no`, `ack_date`, `signed_qr_payload`.
- `backend/app/services/invoice_pdf_service.py`: Added 3-state QR logic, IRN conditional rendering, center-aligned branding footer, and `.watermark-logo` background layer (80% width, 7% opacity).
- `backend/tests/t_tax_inv_harden.py`: Added 7 new test assertions covering compliance states, QR payloads, and watermark layer.
- Bulk export and 1,032-check programmatic reconciliation of all 86 historical sales invoices.

## 3. Files Created
- `docs/walkthrough/invoicing/Invoicing.md`
- `exports/forensic_86_gate/BUSINESS_DATA_RECONCILIATION_86.csv`
- `exports/forensic_86_gate/BUSINESS_DATA_RECONCILIATION_86.md`
- `exports/forensic_86_gate/BUSINESS_DATA_RECONCILIATION_86_SUMMARY.json`

## 4. Files Modified
- `backend/app/models/sales.py`
- `backend/app/services/invoice_pdf_service.py`
- `backend/tests/t_tax_inv_harden.py`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **AD-1: Backend-Driven E-Invoice State**: QR code rendering adapts dynamically to `e_invoice_status` (`GENERATED` -> Signed IRP QR, `PENDING` / `NOT_APPLICABLE` -> Safe Verification QR). IRN printed only when authenticated.
- **AD-2: Rule 46(p) Dynamic Reverse Charge**: Displayed dynamically without disrupting layout or column geometry.
- **AD-3: Background Watermark Layering**: Logo placed in `.watermark-logo` at `z-index: 0`, while text/tables/barcodes are placed at `z-index: 1`, guaranteeing 100% optical scanning reliability.

## 6. Design Rationale
- Opacity set to 7% and width to 80% to ensure visual distinction without interfering with text contrast, barcode lines, or QR matrices.
- Centered branding in bottom footer creates balanced symmetry between page indicator and barcode.

## 7. Implementation Summary
1. Added database columns to `SalesInvoice` for E-Invoice fields.
2. Updated `InvoicePdfService` with QR 3-state engine and sync model wrappers.
3. Configured centered footer layout for `"SMRITI OS Retail Suite -- Powered by SMRITI SYSTEMS"`.
4. Applied subtle background watermark with `.watermark-logo` at 80% page width and 7% opacity.
5. Executed 19/19 pytest unit tests with 100% pass rate.
6. Ran single invoice acceptance gate for `TT2026-2027/64` (4 pages, all barcodes and QR verified).
7. Completed 86-invoice bulk export and automated 1,032-check reconciliation audit with 0 failures and 0 warnings.

## 8. Tests Executed
- `pytest backend/tests/t_tax_inv_harden.py -v`: 19 passed in 2.05s.
- `python scratch/verify_single_invoice_64_watermark.py`: 10/10 checks PASS.
- `python scratch/run_master_tax_invoice_hardening.py`: 86/86 PDFs exported, 1032/1032 checks PASS.

## 9. Verification Results
- 86/86 PDFs exported successfully.
- 86/86 Barcodes decoded (100% Code 128 pass rate).
- 86/86 QR codes decoded (100% QR pass rate).
- Cancelled invoices /39, /43, /58 correctly rendered with cancelled watermark.
- Zero layout drift, zero content shift, zero margin regressions.

## 10. Known Limitations
- None.

## 11. Future Work
- Connect FastAPI compliance gateway endpoints to live IRP sandbox for automated IRN generation during outward sales posting.

## 12. Related ADRs
- ADR-TT-001: Playwright HTML-to-PDF renderer
- ADR-TT-002: SBI is canonical bank
- ADR-TT-003: zxingcpp approved decoder

## 13. Related RFCs
- RFC-TT-001: 86-invoice historical batch re-export
- RFC-TT-002: 3-way business data reconciliation gate
