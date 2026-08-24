<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Version      : 4.9.2
  Created      : 2026-08-18
  Modified     : 2026-08-18
  Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Invoicing_TattlyThreads_RendererCalibration_v4.9.2

**Date:** 2026-08-18 | **Commit:** ceb352f9

## 1. Purpose
Calibrate invoice_pdf_service.py row height and pagination to match 86-invoice OLD archive geometry.

## 2. Scope
invoice_pdf_service.py v4.9.1->v4.9.2. 86 invoices TT2026-2027/18-103.

## 3. Files Created
- exports/forensic_86_gate/BULK_EXPORT_v4.9.2_REPORT.csv
- exports/forensic_86_gate/TT2026-2027_64_BUSINESS_DATA_RECONCILIATION.csv
- exports/forensic_86_gate/TATTLY_BARCODE_QR_DECODER_ENVIRONMENT.txt
- exports/Final_TaxInvoice/*.pdf (86 files)

## 4. Files Modified
- backend/app/services/invoice_pdf_service.py: row height 20.47->21.00pt; pagination 24/36/18->29/40/22; remove is_large_sis; add overflow:hidden

## 5. Architecture Decisions
AD-1: CSS 21.0pt -> ~20.5pt rendered pitch (empirical Playwright calibration)
AD-2: Removed is_large_sis override (was over-paginating large invoices)
AD-3: overflow:hidden enforces hard row ceiling
AD-4: zxingcpp 3.1.1 used for barcode/QR (pyzbar unavailable: MSVCR120.dll missing)

## 6. Design Rationale
Row height calibrated from drawn-line pitch measurement in OLD PDFs (PyMuPDF).
OLD mode pitch = 20.0pt. Pagination thresholds from counting items per page in 86-invoice archive.

## 7. Implementation Summary
1. Measured OLD drawn-line row pitch: mode=20.0pt
2. CSS 19.5pt rendered to 18.5pt pitch (1.0pt Playwright gap)
3. Raised CSS to 21.0pt -> 20.5pt rendered
4. Raised pagination: first 29 / cont 40 / last 22
5. Removed is_large_sis override
6. Added overflow:hidden + max-height
7. Gate: /64 regenerated, 8-step forensic PASS
8. 3-way reconciliation (OLD/DB/NEW) all P0 PASS
9. Barcode Code128 PASS, QR PASS
10. Bulk export: 86/86 OK, 0 failed, 191.9s

## 8. Tests Executed
- regen_64_final.py: PASS (20.5pt pitch, 4 pages)
- reconcile_64_3way.py: All P0 PASS
- test_barcode_qr_v2.py: Code128 + QR PASS
- export_all_86_v492.py: 86/86 OK
- forensic_86_full.py: PASS=78 WARN=5 CANCELLED=3 FAIL=0

## 9. Verification Results
Page count OLD=4 NEW=4 PASS. Taxable=142890.40 PASS. IGST=7144.48 PASS. GT=150035.00 PASS.
Barcode: Code 128: TT2026-2027/64 PASS.
QR: GSTIN:27AAXFT2508H1ZR|INV:TT2026-2027/64|VAL:150035.00|DATE:12-08-2026 PASS.
86-invoice: PASS=78 WARN=5(pre-existing page delta) CANCELLED=3 FAIL=0

## 10. Known Limitations
1. pyzbar unavailable (MSVCR120.dll). zxingcpp used as verified alternative.
2. OLD PDF item column extraction misaligns multi-digit numbers. DB<->NEW is authoritative.
3. 5 WARN invoices: pre-existing page count delta vs OLD renderer. Financials exact.

## 11. Future Work
- Install VC++ 2013 x64 Redistributable for pyzbar
- Investigate 5 WARN invoice page deltas
- Add 3-way reconciliation to CI pipeline

## 12. Related ADRs
- ADR-TT-001: Playwright HTML-to-PDF renderer
- ADR-TT-002: SBI is canonical bank (HDFC historical)
- ADR-TT-003: zxingcpp approved decoder

## 13. Related RFCs
- RFC-TT-001: 86-invoice historical batch re-export
- RFC-TT-002: 3-way business data reconciliation gate
