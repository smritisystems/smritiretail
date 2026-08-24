<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-13
  Modified     : 2026-08-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Tax Invoice — E-Way Bill PDF AcroForm Field Walkthrough (v3.16.0)

## 1. Purpose
This walkthrough documents the implementation of the layout-aware, native PDF AcroForm text field generator for Tax Invoice PDF exports in SMRITI Retail OS. It handles both pre-filled and blank E-Way Bill numbers seamlessly across Print Preview, PDF export, and physical printing.

---

## 2. Scope
- PDF Export Engine post-processing (`scratch/generate_canonical_reference_pdfs.py`).
- Print Template HTML Anchor (`src/print_engine/templates/StandardInvoiceA4.tsx`).
- Sales Studio Invoice Creation & Details View (`src/components/SalesStudioTab.tsx`).
- Database mapping & FastAPI schema aliases (`backend/app/schemas/sales.py`, `src/db/postgres/PostgresRepositories.ts`).
- Verification & Test Automation Suite (`scratch/test_eway_bill_pdf_acroform.py`, `scratch/inspect_exported_pdf_acroforms.py`).

---

## 3. Files Created
1. `scratch/test_eway_bill_pdf_acroform.py` — Complete 6-case automated test suite for AcroForm properties, layout shift tracking, and value persistence.
2. `scratch/test_eway_bill_validation.py` — Frontend & DB validation logic unit test.
3. `scratch/inspect_exported_pdf_acroforms.py` — Programmatic PDF inspection script for exported statutory PDFs.

---

## 4. Files Modified
1. `src/print_engine/templates/StandardInvoiceA4.tsx` — Added `<span id="eway_bill_acro_box">` anchor span with unified CSS variable dimension tokens (`--eway-bill-field-width`).
2. `scratch/generate_canonical_reference_pdfs.py` — Added `dom_to_pdf_coords()` coordinate mapper, duplicate widget check, and PyMuPDF `fitz.Widget()` text field injection.
3. `src/components/SalesStudioTab.tsx` — Restricted E-Way Bill inputs to 13-digit numeric `/^\d*$/` and added inline editable field in Selected Invoice view.
4. `backend/app/schemas/sales.py` — Added `AliasChoices` validation alias for camelCase / snake_case payloads.
5. `src/db/postgres/PostgresRepositories.ts` — Mapped `eway_bill_no` column across PostgreSQL queries.

---

## 5. Architecture Decisions
1. **Single Authoritative PDF Pipeline**: PyMuPDF (`fitz`) post-processing owns AcroForm creation after Playwright vector PDF export.
2. **DOM-Driven Bounding Rect Mapping**: Playwright queries `#eway_bill_acro_box` DOM bounding box and converts viewport CSS pixels to PDF point coordinates. The widget rectangle moves dynamically with any layout shift.
3. **Official PyMuPDF Widget Attributes**: Uses `widget.text_maxlen = 13` and `widget.field_flags = 0` (unlocked/editable).
4. **Duplicate Protection**: Inspects existing widgets on Page 1 before calling `add_widget()`.

---

## 6. Design Rationale
Using a DOM anchor (`#eway_bill_acro_box`) ensures clean vector PDF printing without HTML input control artifacts. Calculating PDF point coordinates from the live Playwright layout guarantees zero coordinate drift when margins or header typography evolve.

---

## 7. Implementation Summary
- **Scenario 1 (E-Way Bill Present)**: Renders static text. 0 AcroForm widgets created.
- **Scenario 2 (E-Way Bill Blank)**: Renders reserved 13-digit space. PyMuPDF injects 1 AcroForm text field named `eway_bill_no`, `text_maxlen = 13`, `field_flags = 0` (readOnly = false).
- Accepts manual typing in Adobe Acrobat Reader, saves, re-opens, and prints with physical alignment.

---

## 8. Tests Executed
1. `python scratch/test_eway_bill_validation.py` -> 9/9 Validation & DB tests PASSED.
2. `python scratch/test_eway_bill_pdf_acroform.py` -> 6/6 AcroForm & Layout-Shift tests PASSED.
3. `python scratch/generate_canonical_reference_pdfs.py` -> 54 Statutory PDFs re-exported with AcroForm post-processing.
4. `python scratch/inspect_exported_pdf_acroforms.py` -> 65/65 PDFs audited and verified 100% compliant.
5. `python scratch/run_full_regression_suite.py` -> 100% Print Engine Regression PASSED.

---

## 9. Verification Results
- **Blank EWB PDF**: Exactly 1 AcroForm widget named `eway_bill_no`.
- **Field Properties**: `text_maxlen = 13`, `readOnly = false`.
- **Value Persistence**: Saved values persist upon re-opening in PDF readers.
- **Layout-Shift**: AcroForm widget rectangle dynamically tracks anchor displacement.

---

## 10. Known Limitations
None.

---

## 11. Future Work
None required for E-Way Bill printing.

---

## 12. Related ADRs
- ADR-004: Platform Abstraction Layer API Guidelines.

---

## 13. Related RFCs
- RFC-012: Tax Invoice Pagination & Statutory Export Guidelines.
