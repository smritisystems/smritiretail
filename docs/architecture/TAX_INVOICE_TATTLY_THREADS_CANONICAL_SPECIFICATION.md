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

# SMRITI Tax Invoice Canonical Print & Export Specification

**Template ID:** `TAX_INVOICE_TATTLY_THREADS_CANONICAL_V1`  
**Status:** FROZEN  
**Version:** 1.0.0  
**Effective Date:** 2026-08-17  
**Canonical Service:** `backend/app/services/invoice_pdf_service.py` (`InvoicePdfService` / `TaxInvoiceRenderer`)

---

## 1. Architectural Principles & Invariants

1. **Single Source of Truth (Canonical Renderer)**:
   - All presentation pathways (HTML Print Preview, Browser Print, PDF Streaming, File Download, Document Reprint, Print History) MUST execute through `InvoicePdfService.generate_invoice_html` and `InvoicePdfService.render_pdf_bytes`.
   - Separate, alternate, or divergent rendering engines are strictly prohibited.
2. **Presentation-Only Mandate**:
   - The PDF renderer is strictly a visual formatting engine. It receives finalized financial quantities from the PostgreSQL Company Database (`smriti001`) and MUST NOT perform uncoordinated recalculations.
3. **Control Plane Isolation**:
   - `smritisys` maintains strictly 0 operational invoice records.
   - All transactional invoice records reside within Company Operational Databases (`smriti<Code>`).

---

## 2. Frozen Geometry & Layout Specifications

| Dimension / Property | Specification |
| :--- | :--- |
| **Page Size** | A4 (`210mm x 297mm`), Portrait |
| **Page Margins** | Top: `8mm`, Bottom: `12mm`, Left: `8mm`, Right: `8mm` |
| **Table Layout** | `fixed`, `border-collapse: collapse`, `width: 100%` |
| **Outer Table Border** | `1px solid #d1d5db` |
| **Horizontal Row Separators** | `1px solid #d1d5db` after EVERY single item row |
| **Vertical Column Borders** | `1px solid #d1d5db` between EVERY column cell |
| **Header Row** | `background-color: #f3f4f6`, `font-weight: 700`, `font-size: 8.5px` |
| **Item Row Cell** | `font-size: 8.5px`, `font-family: monospace`, `padding: 3.5px 3px` |
| **Text Wrapping** | `ITEM_GRID_TEXT_WRAP_COUNT = 0` (`white-space: nowrap !important`) |
| **Subtotal Row** | `border-top: 2px solid #9ca3af`, `border-bottom: 2px solid #9ca3af` |

---

## 3. GST Column Engine & Proportions

### A. Interstate Supply (`is_interstate = True` — 9 Columns)
```
┌──────┬────────────────────────────────┬──────────┬─────┬───────────┬────────┬───────────────┬─────────────┬──────────────┐
│  #   │       ITEM DESCRIPTION         │ HSN/SAC  │ QTY │    MRP    │ DISC % │ TAXABLE VALUE │  IGST @ 5%  │    AMOUNT    │
├──────┼────────────────────────────────┼──────────┼─────┼───────────┼────────┼───────────────┼─────────────┼──────────────┤
│  4%  │              30%               │    9%    │ 6%  │    9%     │   7%   │      11%      │     10%     │     14%      │
└──────┴────────────────────────────────┴──────────┴─────┴───────────┴────────┴───────────────┴─────────────┴──────────────┘
```

### B. Intrastate Supply (`is_interstate = False` — 10 Columns)
```
┌──────┬──────────────────────────┬──────────┬─────┬───────────┬────────┬───────────────┬───────────┬───────────┬──────────────┐
│  #   │     ITEM DESCRIPTION     │ HSN/SAC  │ QTY │    MRP    │ DISC % │ TAXABLE VALUE │ CGST 2.5% │ SGST 2.5% │    AMOUNT    │
├──────┼──────────────────────────┼──────────┼─────┼───────────┼────────┼───────────────┼───────────┼───────────┼──────────────┤
│ 3.5% │          27.5%           │    8%    │ 5%  │    8%     │   6%   │      11%      │    9%     │    9%     │     13%      │
└──────┴──────────────────────────┴──────────┴─────┴───────────┴────────┴───────────────┴───────────┴───────────┴──────────────┘
```

### C. Conditional Tax Display Rules
1. **Interstate**: Displays `IGST @ <rate>%` column, tax summary row, and HSN breakdown. Hides CGST and SGST.
2. **Intrastate**: Displays `CGST @ <half_rate>%` and `SGST @ <half_rate>%` columns, dual tax summary rows, and HSN breakdown. Hides IGST.
3. **Mutual Exclusivity**: Never shows both IGST and CGST/SGST simultaneously for standard domestic supplies.


---

## 4. Statutory Financial Calculation Standards

- **Line-Item Taxable**: $\text{MRP} \times \text{Qty} \times (1 - 0.4376)$
- **Line-Item IGST**: $\text{round}(\text{Taxable} \times 0.05, 2)$
- **Invoice Subtotal**: $\sum \text{Taxable}$
- **Invoice Statutory IGST**: $\text{round}(\text{Subtotal} \times 0.05, 2)$
- **Pre-Round Total**: $\text{Subtotal} + \text{Invoice Statutory IGST}$
- **Grand Total**: $\text{round}(\text{Pre-Round Total})$
- **Rounding Adjustment**: $\text{Grand Total} - \text{Pre-Round Total}$

### Verified Target Invoice Verification (`TT2026-2027/102`):
- Total Line Items: 34
- Total Quantity: 46 Pairs
- Taxable Value: `₹50,815.20`
- Invoice IGST @ 5%: `₹2,540.76`
- Pre-round Total: `₹53,355.96`
- Rounding Adjustment: `+₹0.04`
- Grand Total: `₹53,356.00`
- Amount in Words: *Fifty Three Thousand Three Hundred Fifty Six Rupees Only*

---

## 5. API Endpoints Contract & Execution Flow

```
UI Action          Frontend Trigger                    Backend Endpoint                     Response
─────────────────────────────────────────────────────────────────────────────────────────────────────────────
Preview            Click "Preview"                    GET /api/v1/sales/invoices/{id}/preview   text/html
Print              Click "PRINT TAX INVOICE" / "Print" GET /api/v1/sales/invoices/{id}/print     text/html (auto-print)
Export / Download  Click "Export PDF" / "Download"    GET /api/v1/sales/invoices/{id}/download  application/pdf (attachment)
PDF Stream         Direct Document View                GET /api/v1/sales/invoices/{id}/pdf       application/pdf (inline)
Reprint            Click "Reprint"                    GET /api/v1/sales/invoices/{id}/reprint   application/pdf (original hash)
```

- `GET /api/v1/sales/invoices/{id}/html`: Canonical HTML preview
- `GET /api/v1/sales/invoices/{id}/preview`: Canonical HTML preview alias
- `GET /api/v1/sales/invoices/{id}/print`: Canonical browser print (includes client auto-print trigger)
- `GET /api/v1/sales/invoices/{id}/reprint`: Canonical document reprint resolving original immutable historical PDF artifact
- `GET /api/v1/sales/invoices/{id}/pdf`: Canonical streaming document (`format=binary` returns binary PDF; default returns HTML preview)
- `GET /api/v1/sales/invoices/{id}/download`: Downloadable PDF attachment with `Content-Disposition: attachment`


---

## 6. Company Database Persistence & Artifact Governance

### 1. Database Entity Models (`smriti<Code>`)
- `tax_invoice_templates`:
  - `template_code`: `TAX_INVOICE_TATTLY_THREADS` (Unique PK/Code)
  - `template_name`: `TATTLY THREADS Tax Invoice`
  - `template_type`: `TAX_INVOICE`
  - `status`: `FROZEN`
  - `current_version`: `V1`
  - `layout_configuration`: Complete JSONB structure containing geometry, `<colgroup>`, fonts, borders, and footer.
  - `configuration_hash`: Cryptographic SHA256 checksum (`16fbb84f1420911d...`).
- `tax_invoice_template_versions`:
  - Immutable version history record (`template_id`, `version = 'V1'`, `status = 'FROZEN'`, `layout_configuration`, `configuration_hash`, `effective_from = '2026-08-17'`).
- `invoice_document_artifacts`:
  - Tracks every issued invoice PDF (`invoice_id`, `invoice_no`, `template_code`, `template_version`, `storage_path`, `sha256_hash`, `file_size`, `page_count`, `generated_at`, `is_valid`, `reprint_count`).

### 2. Historical Document Reprint Protection
- When an invoice reprint is requested, the system verifies `invoice_document_artifacts` and checks the disk file against its stored `sha256_hash`.
- If the artifact is valid, the original immutable PDF binary is returned directly without re-rendering or applying newer template changes, guaranteeing legal and statutory auditability.
- In-place modification of `FROZEN` template versions is strictly prohibited. Future design alterations require version incrementation (`V2`, `V3`).

