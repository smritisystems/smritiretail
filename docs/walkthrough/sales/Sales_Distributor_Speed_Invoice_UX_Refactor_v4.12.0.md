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

  * Version    : 4.12.0
  * Created    : 2026-09-07
  * Modified   : 2026-09-07
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Sales Distributor Speed Invoice UX Refactor (Stitch Project 3912159676941883228 Parity) — v4.12.0

## 1. Purpose
This walkthrough documents the full UX refactoring of the **SMRITI Distributor Tax Invoice** (`DistTaxInvoice.tsx` and sub-components) to achieve 100% design and functional parity with the Google Stitch reference design: **Enterprise B2B Retail POS Billing Workspace** (`https://stitch.withgoogle.com/projects/3912159676941883228`). The refactor delivers high-speed, high-density, keyboard-driven ergonomics tailored for wholesale warehouse dispatchers, distributor billing specialists, and multi-shift cashier terminals operating fixed 1366×768 to 1920×1080 displays.

## 2. Scope
- Full-bleed enterprise desktop workspace layout with 48px System Utility Header (`#0b2444`), store node identifier, real-time sync clock, and shift active telemetry (`Shift Active REG-01` with emerald pulsing indicator).
- Transaction Action Band (`billing-control-bar`): Speed Invoice title, Bill Type selector, Txn Type selector, Doc Series badge (`D1DS13 / 1`), action toolbar (`New`, `Import`, `Recall`, `Print`), and primary CTA `Settle & Save (F8)`.
- Context Entity Ribbon: 8 horizontal cards displaying Customer (with credit health indicator), GST Registration, Bill-To Location, Ship-To Location, Place of Supply (POS), Payment Terms, Sales Staff, and Real-time Net Amount preview.
- 5 Interactive Popovers with Active UI Selectors: Collapsible inspection panels for Customer Credit & Ledger, GST Registration details (`data-testid="dist-gst-registration-select"`), Billing Office Address (`data-testid="dist-billing-location-select"`), Delivery Store Address (`data-testid="dist-delivery-location-select"`), PO Reference input (`data-testid="dist-po-reference-input"`), and Credit Due Terms.
- Dynamic Data Grid: High-speed Barcode Scan Dock with pulsing indicator and auto-focus, Active Item Rapid Preview Strip (Rate/MRP/Discount/Tax/Total), dense spreadsheet table with sticky header, inline entry row, alternating rows, guide rows, and stock-guarded auto-increment.
- Interstate / Credit Disambiguation: Interstate Sales (IGST tax jurisdiction) strictly separated from payment terms (Cash vs Credit).
- Backend Credit Gate: Scoped to credit mode and positive balance amounts; Cash transactions succeed even if credit hold is active.
- Horizontal Summary Totals Bar: High-contrast deep navy `#0c243f` 9-column grid with prominent vibrant blue `#0066cc` Net Amount block.
- Keyboard-First Footer: Function key badges (`F2`, `F11`, `F6`, `F7/F8`, `F12`, `Ctrl+4`, `Ctrl+P`, `Ctrl+S`) and dynamic next-action prompt.
- Modal Dialogs: Product Catalog SKU Search (`F11`), Settlement Confirmation (`F8`), and Customer Master Directory (`F2`).
- F2 Universal Lookup Architecture v2 and PostgreSQL backend API integration (`apiFetchV1`).

## 3. Files Created
1. `src/tests/distTaxInvoiceStitchFlow.test.ts`: Comprehensive contract and UI workflow test suite for Stitch Speed Invoice.

## 4. Files Modified
1. `src/components/sales/DistTaxInvoice.tsx`: Workspace orchestration, B2B multi-location state hooks, interstate cash disambiguation, canonical numbering delegation, canonical PDF stream call, and HREP notification wiring.
2. `src/components/sales/components/TaxHeaderBar.tsx`: Modernized to Stitch dark navy app shell header with live clock, shift pulse badge, cashier avatar, and quick actions.
3. `src/components/sales/components/TaxInvoiceDoc.tsx`: Upgraded to 2-layer control strip with active interactive selectors for GST registrations, billing sites, delivery locations, and PO reference.
4. `src/components/sales/components/TaxInvoiceItemGrid.tsx`: Modernized to dense spreadsheet grid with Barcode Scan Dock, Active Focus Item preview strip, guide rows, and stock protection.
5. `src/components/sales/components/TaxStatusBar.tsx`: Transformed to 9-column horizontal totals summary bar in deep navy `#0c243f` with oversized `#0066cc` Net Amount.
6. `src/components/sales/types.ts`: Added `stockQty` to `TaxInvoiceItemRow` and distributor B2B statutory location fields.
7. `backend/app/services/sales.py`: Scoped credit checks strictly to credit transactions and positive unpaid balance.
8. `backend/tests/test_b2b_credit_sales_contract.py`: Added Scenarios 12 and 13 for cash independence from credit gate and interstate cash preservation.

## 5. Architecture Decisions
1. **Zero-Latency Keyboard Navigation**: Preserved all global ERP keyboard shortcuts while introducing `F11` (SKU Catalog Search), `F8` (Settlement Confirmation), `Ctrl+P` (Print), and `Ctrl+S` (Save). `F2` remains exclusively dispatched through `useF2Screen` under F2 Universal Lookup Architecture v2.
2. **Industrial Information Architecture**: Replaced generic form controls with high-density enterprise cards and popovers, reducing cognitive overhead and eliminating vertical scrolling on standard resolutions.
3. **Continuous Data Integrity**: Maintained full backward compatibility with PostgreSQL endpoints (`/api/v1/sales/invoices`, `/api/v1/crm/customers`, `/api/v1/products`).

## 6. Design Rationale
Distributor billing desks process high-volume lines where speed, visual clarity under bright warehouse lighting, and zero mis-scans are critical. The high-contrast dark navy `#0b2444` header and `#0c243f` summary footer anchor the screen, while the dense tabular grid and live item preview strip provide immediate scannability of margins, discounts, and GST breakdowns before commitment.

## 7. Implementation Summary
- Extracted exact specifications, tokens, and markup from Stitch project `3912159676941883228`.
- Replaced outdated button and panel styles with Tailwind tokens aligned to SMRITI Design System.
- Embedded autofocus and barcode scanning logic into the top dock and inline spreadsheet row with stock boundary guards.
- Synchronized summary calculation state across all 9 metrics columns.
- Connected customer B2B endpoints for GST registrations, delivery locations, and billing sites with interactive UI selectors.

## 8. Tests Executed
1. **Backend Integration Contract Test Suite (14 Scenarios)**:
   ```powershell
   python scratch/run_test_with_env.py tests/test_b2b_credit_sales_contract.py
   ```
   *Result:* 14/14 passed in 14.16s (including Scenario 12: Cash on credit hold, Scenario 13: Interstate Cash, Scenario 14: Partial tender unpaid balance credit gate).
2. **Frontend Dedicated Distributor Test Suites (15 Tests)**:
   ```powershell
   npx vitest run src/tests/distTaxInv.test.ts src/tests/distTaxInvoiceStitchFlow.test.ts
   ```
   *Result:* 15/15 passed in 858ms (Workflow contracts, openCanonicalInvoicePrint execution, and React server-rendered markup and control-presence validation).
3. **Full Application Vitest Regression Suite (107 Files, 664 Tests)**:
   ```powershell
   npx vitest run
   ```
   *Result:* 107/107 files passed, 664/664 tests passed in 21.51s.
4. **Patch Whitespace & Worktree Hygiene Check**:
   ```powershell
   git status --short; git diff --check
   ```
   *Result:* Patch hygiene clean (zero trailing whitespace, `git diff --check` exited 0); zero untracked scratch files; intended feature modifications remain unstaged in the worktree.
5. **TypeScript Strict Typecheck**:
   ```powershell
   npm run lint  # tsc --noEmit
   ```
   *Result:* 0 errors, clean exit code 0.
6. **Production Bundle Build**:
   ```powershell
   npm run build # vite build
   ```
   *Result:* 3526 modules transformed, built in 29.03s.

## 9. Verification Results
- Status: **Done (Contract Hardened & Staging Ready)**.
- **Workflow & Calculation Invariants:** Validated across gross totals, multi-tier discounts, line-item GST, interstate non-conversion to credit, and duplicate scan stock limits.
- **React Server-Rendered Markup & Control-Presence:** Verified interactive B2B location selectors (`data-testid="dist-billing-location-select"`, `dist-delivery-location-select`, `dist-gst-registration-select`, `dist-po-reference-input`), option strings, line item rows, and summary totals bar.
- **Production PDF Helper:** Direct test executes `openCanonicalInvoicePrint`, validating `/sales/invoices/{id}/pdf` endpoint call, blob generation, `window.open` navigation, and popup-blocked notification handling.
- **Staging Verification Gate:** Physical browser window interaction, live network round-trips to active Postgres, and physical thermal/laser printer spooling.

## 10. Known Limitations
- Physical browser printer spooling and live DOM interaction events are reserved for staging environment verification.

## 11. Future Work
- Integration with direct QZ Tray hardware thermal printing for speed receipts.
- Direct barcode scale weighment integration via Web Serial API.

## 12. Related ADRs
- ADR-0012: Universal F2 Lookup Architecture v2
- ADR-0018: PostgreSQL Sole Backend System of Record

## 13. Related RFCs
- RFC-0041: High-Density POS and Distributor Speed Invoice Workspace
