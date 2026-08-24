<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.30.0
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI 9 High-Throughput Billing Terminal (Stitch Integration) v3.30.0

## 1. Purpose
Modernize and replace legacy billing, POS, and tax invoicing frontends with the official **Smriti 9 Institutional Billing Terminal** specified in `F:\SMRITI\stitch_invoice_management_system (1).zip\stitch_invoice_management_system`. The new terminal consolidates desktop point-of-sale and B2B/B2C tax invoice generation into a high-speed, dual-layer interface designed for rapid barcode scanning, tactical line items spreadsheet editing, multi-attribute catalog browsing, and instant PDT batch file ingestion.

## 2. Scope
- Replacement of legacy POS and billing views (`PosTerminalTab.tsx`, `AdvancedBillingEng.tsx`) with `BillingTerm.tsx`.
- Implementation of the **Secondary Bottom Scanning Bar** (`smriti_billing_main_terminal_with_secondary_scanning_bar`) providing real-time product line mirroring.
- Implementation of the **Product Search & Catalog Browser Modal** (`smriti_billing_product_search_browser_overlay`).
- Implementation of the **Item Attribute & Column Browser Modal** (`smriti_billing_item_browse_overlay`).
- Implementation of the **PDT Batch Ingest & Barcode Collector Modal** (`invoice_generation_with_pdt_import_modal`).
- PostgreSQL and FastAPI transactional persistence via `POST /api/v1/sales/invoices/`.

## 3. Files Created
- `src/components/billing/types.ts`: Comprehensive types for line items, header state, summary totals, PDT rows, and filter columns.
- `src/components/billing/ProductSearchBrows.tsx`: Tabular product and customer catalog search overlay with pagination and hotkey navigation.
- `src/components/billing/ItemBrowseOverlayD.tsx`: Columnar attribute filter modal across Stock No, Item Desc, Product, Brand, Style, Shade, and Size.
- `src/components/billing/PdtImportModal.tsx`: Batch barcode / portable data terminal file parser and validator.
- `src/components/billing/BillingTerm.tsx`: Master billing workspace integrating header actions, tactical grid, right summary pane, secondary scanner bar, and institutional status footer.
- `src/tests/billingTerm.test.ts`: Automated regression test suite covering financial calculations, PDT parsing, and return mode logic.

## 4. Files Modified
- `src/components/PosTerminalTab.tsx`: Refactored to mount `SmritiBillingTerminal`.
- `src/components/AdvancedBillingEng.tsx`: Refactored to mount `SmritiBillingTerminal`.
- `src/App.tsx`: Updated `"pos"` and `"create-tax-invoice"` routing targets to mount the unified terminal.
- `docs/walkthrough/README.md`: Appended new walkthrough entry to the master index.

## 5. Architecture Decisions
1. **Single Unified Billing Terminal**: Rather than maintaining fragmented interfaces for quick retail POS vs detailed B2B tax invoicing, `SmritiBillingTerminal` provides full capabilities for both via its `Bill Type` (Product/Service) and `Payment Mode` (Cash/Credit/UPI/Card/Split) controls.
2. **Dual-Layer Real-Time Barcode Scanning**: High-volume checkout cashiers scan directly into the bottom secondary scanner input which automatically detects existing items to increment quantities, or appends new lines and updates totals synchronously.
3. **Statutory Financial Integrity**: All calculations (Gross Value, Item Discounts, Taxable Value, GST, Round-Off, Net Payable) adhere to Indian GST standards and are stored in PostgreSQL with 2-decimal precision.

## 6. Design Rationale
The design incorporates institutional retail terminal patterns from `smriti_9/DESIGN.md` and Stitch blueprints:
- **Palette**: Surface container `#faf9ff`, Primary `#00296d`, Secondary container `#cdddff`, Outline `#737685`.
- **Typography**: Inter with Mono data numerals (`font-data-mono`) for numerical rate, quantity, and total alignment.
- **Ergonomics**: Full keyboard hotkey support (`Alt+N` New, `Alt+V` Void, `Alt+R` Return, `Alt+P` Reprint, `Alt+S` Search, `Alt+D` Attribute Browse, `Alt+I` PDT Import, `F4` Checkout).

## 7. Implementation Summary
- **Main Terminal**: Built in `src/components/billing/BillingTerm.tsx` with responsive spreadsheet grid, 14-row simulated layout, right-hand net values breakdown, and prominent net amount footer.
- **Secondary Scanner Bar**: Built with active line mirror fields showing Stock No, Item Description, Rate, Qty, Value, Discount, and Total.
- **Modals**: Created standalone accessible modals for catalog lookup, multi-column filtering, and PDT batch import.
- **Backend Persistence**: Connected to `/api/v1/sales/invoices/` and `/api/v1/customers`.

## 8. Tests Executed
```bash
npm test
```
**Terminal Output:**
```
Test Files  26 passed (26)
     Tests  171 passed (171)
```

```bash
npm run lint
```
**Terminal Output:**
```
> tsc --noEmit
Exit code: 0
```

## 9. Verification Results
- Line item financial calculations verified (Rate * Qty - Discount + Tax).
- PDT collector batch parsing verified against product catalog.
- Sales return quantity negation verified.
- 0 TypeScript compiler warnings or errors.

## 10. Known Limitations
- Offline local bill recall currently supports in-memory/browser session storage; multi-terminal sync relies on FastAPI core connection.

## 11. Future Work
- Direct USB POS cash drawer kick pulse dispatch via ESC/POS protocol integration.
- Hardware barcode weighing scale RS-232 serial stream reader.

## 12. Related ADRs
- `ADR-0012`: Platform Abstraction Layer (PAL) and FastAPI System-of-Record Architecture.
- `ADR-0016`: Single Source of Truth for Item Master and Dynamic Attribute Catalog.

## 13. Related RFCs
- `RFC-2026-08-POS-01`: High-Throughput Terminal Ergonomics and Secondary Scanning Bar Specification.
