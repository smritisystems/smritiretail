<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.7.0
  Created      : 2026-08-14
  Modified     : 2026-08-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Statutory A4 Tax Invoice Print & PDF Engine Integration Walkthrough — v4.7.0

## 1. Purpose
This walkthrough documents the review, integration, and verification of the **SMRITI OS Statutory A4 Tax Invoice Print & PDF Engine** (`TaxInvoiceA4.tsx` & `TaxInvoicePrintPag.tsx`) imported from client template repository `F:\Smriti-Clients Data\Tattly Threads\exports\exported_pdf_invoices\SMRITI_STATUTORY_A4_PRINT_ENGINE_TEMPLATES` into core SMRITI Retail OS product codebase.

## 2. Scope
- Importing React A4 Tax Invoice template [`src/components/templates/TaxInvoiceA4.tsx`](file:///F:/SMRITRretailNX/src/components/templates/TaxInvoiceA4.tsx).
- Importing Tax Invoice Workspace host [`src/components/TaxInvoicePrintPag.tsx`](file:///F:/SMRITRretailNX/src/components/TaxInvoicePrintPag.tsx).
- Importing backend dispatch import service [`backend/app/services/dispatch_import.py`](file:///F:/SMRITRretailNX/backend/app/services/dispatch_import.py).
- Importing GST exclusive 5% calculation pytest suite [`backend/tests/t_tax_invoice.py`](file:///F:/SMRITRretailNX/backend/tests/t_tax_invoice.py).
- Adding `SPK` kernel facade [`src/kernel/SPK.ts`](file:///F:/SMRITRretailNX/src/kernel/SPK.ts).
- Routing `tax-invoice-print` and `statutory-a4` tabs in [`src/App.tsx`](file:///F:/SMRITRretailNX/src/App.tsx).

## 3. Files Created
- [`src/components/templates/TaxInvoiceA4.tsx`](file:///F:/SMRITRretailNX/src/components/templates/TaxInvoiceA4.tsx): Statutory A4 multi-page tax invoice print component.
- [`src/components/TaxInvoicePrintPag.tsx`](file:///F:/SMRITRretailNX/src/components/TaxInvoicePrintPag.tsx): SEEF & UCR-001 compliant Tax Invoice workspace host with live branding customization panel.
- [`src/kernel/SPK.ts`](file:///F:/SMRITRretailNX/src/kernel/SPK.ts): SPK kernel configuration facade for branding persistence.
- [`backend/app/services/dispatch_import.py`](file:///F:/SMRITRretailNX/backend/app/services/dispatch_import.py): Backend dispatch import & statutory invoice lifecycle calculation service.
- [`backend/tests/t_tax_invoice.py`](file:///F:/SMRITRretailNX/backend/tests/t_tax_invoice.py): Pytest suite asserting 5% exclusive IGST calculation mandates.
- [`docs/walkthrough/sales/Statutory_A4_Tax.md`](file:///F:/SMRITRretailNX/docs/walkthrough/sales/Statutory_A4_Tax.md): This walkthrough document.

## 4. Files Modified
- [`src/App.tsx`](file:///F:/SMRITRretailNX/src/App.tsx): Registered `TaxInvoicePrintPage` router tab.
- [`src/lib/apiFetchV1.ts`](file:///F:/SMRITRretailNX/src/lib/apiFetchV1.ts): Exported `isLocalMockToken` helper.
- [`docs/walkthrough/README.md`](file:///F:/SMRITRretailNX/docs/walkthrough/README.md): Appended walkthrough entry.

## 5. Architecture Decisions
- **Statutory GST Exclusive Mandate**: Column `TAXABLE VALUE` is strictly GST-exclusive. 5% IGST is computed as `Taxable Value * 0.05`.
- **Indian Number to Words Conversion**: `numberToIndianWords` converts invoice totals to Indian Rupee word representations (Lakhs, Crores).
- **Playwright & Browser Print Compatibility**: Uses CSS `@media print` A4 dimensions with Playwright PDF bottom margin template support (`Page X of Y`).

## 6. Design Rationale
Providing a statutory A4 tax invoice print page directly in SMRITI Retail OS guarantees compliance with Indian GSTN requirements and permits instant, pixel-perfect A4 invoice printing and PDF exports.

## 7. Implementation Summary
- Reviewed all files from `SMRITI_STATUTORY_A4_PRINT_ENGINE_TEMPLATES`.
- Integrated frontend React components, backend services, and unit test suites.
- Executed Pytest calculation suite (`2/2 PASSED`).
- Executed Vite production bundle build (`20.37s`).

## 8. Tests Executed
```bash
python -m pytest tests/t_tax_invoice.py -v
npx vite build
```

## 9. Verification Results
```text
tests/t_tax_invoice.py: 2/2 PASSED in 1.56s
✓ Vite build completed cleanly in 20.37s
```

## 10. Known Limitations
- Playwright headless PDF generation requires Playwright Chromium installed on server environment.

## 11. Future Work
- Integration with direct WhatsApp invoice PDF sending gateway.

## 12. Related ADRs
- `ADR-001`: Platform Architecture & Modular Isolation Policy.

## 13. Related RFCs
- `RFC-2026-04`: Statutory A4 Print Engine & Invoice PDF Layout Standard.
