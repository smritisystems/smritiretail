<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.8.0
  Created      : 2026-08-17
  Modified     : 2026-08-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Tax Invoice Canonical Renderer & Layout Freeze (v1.0)

## 1. Purpose
Freeze the definitive canonical Tax Invoice rendering engine (`InvoicePdfService` / `TaxInvoiceRenderer`) and its visual specification (`TAX_INVOICE_TATTLY_THREADS_CANONICAL_V1`) as the single source of truth for Preview, Browser Print, PDF Streaming, Download, and Reprint across SMRITI Retail OS.

## 2. Scope
- Single Canonical Renderer architecture in FastAPI (`backend/app/services/invoice_pdf_service.py`).
- Route consolidation across `/invoices/{id}/html`, `/preview`, `/print`, `/reprint`, `/pdf`, `/download` in `backend/app/api/v1/sales.py`.
- Complete table grid enforcement: horizontal separator after every item row, vertical column borders, zero text wrapping.
- GST Column Engine: dynamic conditional column rendering for Interstate (IGST @ 5% — 9 columns) and Intrastate (CGST @ 2.5% + SGST @ 2.5% — 10 columns).
- Exact statutory financial calculation reconciliation on TT batch invoices (`TT2026-2027/74` through `TT2026-2027/103`) and intra-state fixtures.
- Company Database persistence (`tax_invoice_templates`, `tax_invoice_template_versions`, `invoice_document_artifacts`) in `smriti001`.
- Cryptographic SHA256 integrity verification and immutable historical document reprint protection.
- Automated test suite verification with 371/371 PASS baseline.

## 3. Files Created
- `backend/app/models/tax_invoice_template.py`: SQLAlchemy entity models for `TaxInvoiceTemplate`, `TaxInvoiceTemplateVersion`, and `InvoiceDocumentArtifact`.
- `backend/app/db/seed_tax_invoice_canonical_template.py`: Seeding script for canonical frozen template and artifact SHA256 indexing.
- `backend/tests/test_canonical_tax_invoice_frozen.py`: 13 automated tests validating canonical config, financial reconciliation on Invoice 102, zero-wrap guarantee, route registration, DB persistence, SHA256 integrity, tenant isolation, and Interstate/Intrastate GST column engine.
- `docs/walkthrough/sales/Sales_Tax_Invoice_Canonical_Renderer_Freeze_v1.0.md`: Formal WGP governance walkthrough.

## 4. Files Modified
- `backend/app/models/__init__.py`: Exported new template and artifact models.
- `backend/app/services/invoice_pdf_service.py`: Added `TAX_INVOICE_TATTLY_THREADS_CANONICAL_V1` configuration dictionary, `render_pdf_bytes`, `get_or_render_pdf_artifact` (reprint protection), `get_template_configuration`, dynamic GST rates/columns, and `TaxInvoiceRenderer` / `TaxInvoicePrintService` aliases.
- `backend/app/api/v1/sales.py`: Added canonical route aliases `/preview`, `/print`, `/reprint`, `/download` ensuring single-renderer execution.
- `backend/generate_tt_tax_invoices_batch.py`: Synchronized item row horizontal and vertical borders and CSS styling.
- `docs/architecture/TAX_INVOICE_TATTLY_THREADS_CANONICAL_SPECIFICATION.md`: Added Company Database persistence, artifact governance, and GST column engine specifications.
- `docs/walkthrough/README.md`: Appended entry for this walkthrough.

## 5. Architecture Decisions
- **Single Canonical Renderer Rule**: Print, preview, export, download, and reprint routes must call `InvoicePdfService` exclusively. Duplicate template implementations are prohibited.
- **Presentation-Only Renderer**: PDF rendering engine strictly displays backend-calculated statutory financial values without independent recalculation.
- **GST Supply Type Exclusivity**: Inter-state invoices show IGST only; Intra-state invoices show CGST and SGST only. Mutual exclusivity prevents duplicate or mixed statutory tax lines on standard domestic supplies.
- **Control Plane Isolation**: All operational invoice transactions belong to Company Databases (`smriti001`), while `smritisys` maintains strictly 0 operational invoices and 0 operational templates.
- **Immutable Historical Artifact Reprint**: Reprints check for valid historical artifacts with cryptographic SHA256 integrity on disk before attempting regeneration.

## 6. Design Rationale
- Continuous grid styling (`border: 1px solid #d1d5db; border-collapse: collapse;`) reproduces the authoritative Golden Reference invoices (`SIS_8319_TaxInvoice_TT2026-2027_73.pdf`).
- Fixed percentage `<colgroup>` proportions (9 cols for Interstate, 10 cols for Intrastate) and `white-space: nowrap !important;` guarantee zero wrapping on footwear style/color/size item descriptions.
- Database persistence of `TAX_INVOICE_TATTLY_THREADS` V1 guarantees configuration immutability.

## 7. Implementation Summary
- Configuration identifier `TAX_INVOICE_TATTLY_THREADS` registered as frozen version V1 in `tax_invoice_templates` and `tax_invoice_template_versions`.
- All 30 batch invoices (`TT2026-2027/74` to `TT2026-2027/103`) generated, persisted in `smriti001`, and indexed in `invoice_document_artifacts` with SHA256 checksums.
- Intra-state test invoice (`TT-INTRA-2026/01`) generated and verified with 10-column layout and exact tax split.

## 8. Tests Executed
```bash
pytest tests/test_canonical_tax_invoice_frozen.py -v
pytest tests/ -q
pytest app/tests/ -q
```

## 9. Verification Results
- `tests/test_canonical_tax_invoice_frozen.py`: 13/13 PASS
- `tests/`: 185/185 PASS
- `app/tests/`: 186/186 PASS
- Combined Total: 371/371 PASS (0 Failures)
- `ITEM_GRID_TEXT_WRAP_COUNT = 0`
- `MISSING_ITEM_ROW_BORDER_COUNT = 0`
- `smritisys` operational invoices count = 0

## 10. Known Limitations
None. All 30 invoices generated and validated.

## 11. Future Work
Phase 4 rollout of electronic E-Way Bill AcroForm interactive fields onto canonical print template.

## 12. Related ADRs
- ADR-001: Multi-Company Database Architecture & Tenant Isolation
- ADR-014: Platform Abstraction Layer (PAL) & Backend System-of-Record

## 13. Related RFCs
- RFC-2026-08-14: Statutory GST Tax Invoice Canonical Rendering Specification
