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

# SMRITI Implementation Plan: Sales Distributor Speed Invoice UX Refactor (Stitch Design Parity) — v4.12.0

## 1. Objective
Refactor the **Smriti Distributor Tax Invoice** (`DistTaxInvoice.tsx` and sub-components) to achieve exact architectural, functional, and visual parity with the Google Stitch enterprise reference design: **Enterprise B2B Retail POS Billing Workspace** (`https://stitch.withgoogle.com/projects/3912159676941883228`).

## 2. Business Motivation
High-volume distributor billing desks and wholesale dispatch operations require a keyboard-first, dense information architecture that eliminates vertical scrolling, surfaces live tax and margin metrics, and provides instantaneous customer credit checks.

## 3. Scope
- Enterprise App Shell Header (`#0b2444`) with store node, live clock, shift status, and cashier avatar.
- Billing Workspace Controls Band (`billing-control-bar`): Speed Invoice branding, Bill Type, Txn Type, Doc Series `#D1DS13/1`, and fast actions.
- Context Entity Ribbon: 8 horizontal cards (Customer, GST, Bill-To, Ship-To, POS, Payment, Sales Staff, Net Amount).
- 5 Context Popovers: Customer Credit & Ledger, GST Registration, Billing Location, Delivery Location, Credit Terms.
- Dynamic Data Grid: High-speed Barcode Scan Dock, Active Item Focus preview strip, dense spreadsheet table with sticky header, inline entry row, and guide rows.
- Horizontal Summary Totals Bar: High-contrast deep navy `#0c243f` 9-column grid with oversized `#0066cc` Net Amount block.
- Keyboard-First Footer: Hotkey pills (`F2`, `F11`, `F6`, `F7/F8`, `F12`, `Ctrl+4`, `Ctrl+P`, `Ctrl+S`) and next-action prompt.
- Modals: SKU Search (`F11`), Settlement Confirmation (`F8`), and Customer Directory (`F2`).
- F2 Universal Lookup Architecture v2 and PostgreSQL backend API integration (`apiFetchV1`).

## 4. Current State
`DistTaxInvoice.tsx` was implemented as a multi-card layout with standard vertical scrolling, separating header information from the item grid and footers into disparate containers.

## 5. Gap Analysis
- Missing high-density rapid barcode scan dock with auto-focus and auto-add.
- Absence of real-time active item financial preview strip (Rate, MRP discount comparison, tax breakdown).
- Disconnected context presentation instead of an integrated 8-card entity ribbon and on-demand popovers.
- Footer metrics lacked the enterprise high-contrast 9-column split grid format.

## 6. Architecture Impact
- Replaced outdated button and panel styles with Tailwind tokens aligned to SMRITI Design System.
- Embedded autofocus and barcode scanning logic into the top dock and inline spreadsheet row.
- Synchronized summary calculation state across all 9 metrics columns.
- Preserved `useF2Screen` F2 Universal Lookup Architecture v2 registration for `customer` and `variant` entities.

## 7. Proposed Design
Full-bleed corporate utility layout operating on a fixed 4px baseline system designed for 1366×768 and 1920×1080 fixed displays without triggering vertical scrolling on core POS transactions.

## 8. Files Created
- `src/tests/distTaxInvoiceStitchFlow.test.ts`: Comprehensive contract and UI workflow test suite for Stitch Speed Invoice.

## 9. Files Modified
- `src/components/sales/DistTaxInvoice.tsx`: Workspace orchestration, B2B multi-location state hooks, interstate cash disambiguation, canonical numbering delegation, canonical PDF stream call, and HREP notification wiring.
- `src/components/sales/components/TaxHeaderBar.tsx`: Modernized to Stitch dark navy app shell header with live clock, shift pulse badge, cashier avatar, and quick actions.
- `src/components/sales/components/TaxInvoiceDoc.tsx`: Upgraded to 2-layer control strip with active interactive selectors for GST registrations, billing sites, delivery locations, and PO reference.
- `src/components/sales/components/TaxInvoiceItemGrid.tsx`: Modernized to dense spreadsheet grid with Barcode Scan Dock, Active Focus Item preview strip, guide rows, and stock protection.
- `src/components/sales/components/TaxStatusBar.tsx`: Transformed to 9-column horizontal totals summary bar in deep navy `#0c243f` with oversized `#0066cc` Net Amount.
- `src/components/sales/types.ts`: Added `stockQty` to `TaxInvoiceItemRow` and distributor B2B statutory location fields.
- `backend/app/services/sales.py`: Scoped credit checks strictly to credit transactions and positive unpaid balance.
- `backend/tests/test_b2b_credit_sales_contract.py`: Added Scenarios 12 and 13 for cash independence from credit gate and interstate cash preservation.

## 10. Dependencies
- React 18
- Tailwind CSS v4
- Lucide React
- SMRITI API Fetch V1 (`src/lib/apiFetchV1.ts`)
- F2 Dispatcher Context (`src/context/F2DispatcherContext.tsx`)
- FastAPI Core + PostgreSQL Backend Services

## 11. Risks
- Keyboard shortcut collisions with browser default keys. Mitigated by `e.preventDefault()` on handled function keys (`F11`, `F8`, `Ctrl+S`, `Ctrl+P`).
- Input focus traps. Mitigated by `Escape` listeners to dismiss modals and refocus the active grid entry.
- Misclassification of Interstate cash sales as credit. Mitigated by explicit `isCreditTx` isolation and `is_interstate` flag separation.

## 12. Rollback Strategy
Git commit revert to restore previous layout if required.

## 13. Verification Plan
- Backend Pytest (`python scratch/run_test_with_env.py tests/test_b2b_credit_sales_contract.py`) — 13/13 passing.
- Frontend Vitest (`npx vitest run src/tests/distTaxInv.test.ts src/tests/distTaxInvoiceStitchFlow.test.ts`) — 11/11 passing.
- TypeScript strict typecheck (`npm run lint` / `tsc --noEmit`) — 0 errors.
- Vite production bundle build (`npm run build`) — 3526 modules transformed, built clean.
- Git diff verification per SMRITI Governance Rule 1.

## 14. Test Plan
- Scenario 1 to 13 in `backend/tests/test_b2b_credit_sales_contract.py`.
- Contract 1 to 5 in `src/tests/distTaxInvoiceStitchFlow.test.ts`.
- Calculations unit tests in `src/tests/distTaxInv.test.ts`.

## 15. Documentation Impact
- Update `docs/walkthrough/sales/Sales_Distributor_Speed_Invoice_UX_Refactor_v4.12.0.md`
- Update `docs/walkthrough/README.md`
- Update `docs/implementation/README.md`

## 16. Deployment Plan
Sync to test environment via `git pull` per SMRITI Environment Rule.

## 17. Status
Completed

## 18. Related ADRs
- ADR-0012: Universal F2 Lookup Architecture v2
- ADR-0018: PostgreSQL Sole Backend System of Record

## 19. Related Walkthroughs
- `docs/walkthrough/sales/Sales_Distributor_Speed_Invoice_UX_Refactor_v4.12.0.md`
