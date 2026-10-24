<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.57.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: SMRITI Walkthrough Governance Policy (WGP)
-->

# Walkthrough: Global Grid Import Standard Rollout — POS Counter Billing & Commercial Sales Orders (v1.0)

## 1. Purpose
This walkthrough documents the Phase 32 rollout of the **SMRITI Global Grid Input, Paste, Import & Product Resolution Standard** across the front-line transactional surfaces: **Counter POS Billing Terminal** (`ProPosBillingTerm.tsx`) and **Commercial Sales Order Studio** (`SalesOrderFormPremium.tsx`). It also records hardening improvements made to `GlobalGridImportModal.tsx` for clipboard initial text ingestion and strict adherence to the SMRITI Human-Readable Error Policy (HREP).

## 2. Scope
- **Counter POS Billing Terminal (`ProPosBillingTerm.tsx`)**:
  - Wiring `GlobalGridImportModal` with `GRID_PROFILES.BILLING`.
  - Adding "Fast Import" action button in the POS quick utilities ribbon.
  - Intercepting `onPaste` events directly on the 10-row cart table container to auto-detect multi-line or delimited clipboard data (Excel, TSV, CSV, PDT) and route directly into `GlobalGridImportModal` with pre-loaded content.
  - Adding `handleGlobalGridImportCommit` with full GST recalculation (`calculateGST`), Reliance trade discount handling (`43.76% off MRP`), and duplicate resolution (`APPEND`, `MERGE`, `REPLACE`).
- **Commercial Sales Order Studio (`SalesOrderFormPremium.tsx`)**:
  - Deprecating and eliminating the legacy stub `ImportPDTModal` (which previously produced an empty item list and triggered unformatted browser alert dialogs).
  - Integrating `GlobalGridImportModal` with `GRID_PROFILES.BILLING`.
  - Wiring `handleGlobalImportCommit` recalculating full transaction and line totals via `calculateLineTotal` across APPEND, MERGE, and REPLACE modes.
  - Updating action panel with a dedicated "Global Import" modal trigger button.
- **Global Grid Import Modal (`GlobalGridImportModal.tsx`)**:
  - Added support for `initialRawText` prop to immediately analyze raw text from parent component paste events.
  - Replaced browser `alert()` popups with HREP-compliant inline error banners in Step 1 (Input) and Step 3 (Preview/Commit).

## 3. Files Created
- `docs/walkthrough/sales/Global_Grid_Import_POS_And_Sales_Order_v1.0.md`

## 4. Files Modified
- `src/components/gridInput/GlobalGridImportModal.tsx`: Added `initialRawText` prop, `inputError` state, and inline error banners; eradicated `alert()` calls.
- `src/components/billing/propos/ProPosBillingTerm.tsx`: Added Global Grid Import modal integration, `onPaste` on the cart grid, "Fast Import" ribbon button, and `handleGlobalGridImportCommit`.
- `src/components/sales/SalesOrderFormPremium.tsx`: Removed stub `ImportPDTModal`, wired `GlobalGridImportModal`, added `handleGlobalImportCommit` with `calculateLineTotal`, and updated action button.
- `package.json`: Version bumped to `6.57.0`.
- `src/config/version.ts`: Version bumped to `6.57.0`.
- `backend/app/core/config.py`: Version bumped to `6.57.0`.
- `CHANGELOG.md`: Added `[6.57.0]` entry.
- `docs/walkthrough/README.md`: Appended chronological entry to the master index.

## 5. Architecture Decisions
- **AD-32.1: Unified Billing Profile (`GRID_PROFILES.BILLING`)**: Both POS Cashier terminal and Commercial Sales Orders utilize the unified `BILLING` profile with context `SALES_INVOICE`. This maps standard columns (Barcode, SKU, Item Name, Quantity, Selling Price, MRP, Discount, GST Rate, HSN Code) and ensures consistent priority cascade resolution via `POST /api/v1/products/batch-resolve`.
- **AD-32.2: Seamless Cart Container Paste Interception**: Cashiers frequently copy item codes or lists from customer emails, WhatsApp quotes, or purchase orders. Instead of forcing manual navigation to an import modal, pressing `Ctrl+V` anywhere on the billing cart table detects delimited or multi-line strings, opens `GlobalGridImportModal`, and pre-populates the input.
- **AD-32.3: Zero Technical Alerts (HREP Compliance)**: Replaced raw browser `alert()` invocations with state-driven, accessible inline banner messages in `GlobalGridImportModal.tsx`, providing clear guidance on how to resolve invalid or empty input lines.

## 6. Design Rationale
Prior to this phase, `SalesOrderFormPremium.tsx` contained an incomplete mock import modal that accepted CSV files but failed to parse items, leaving `items: []`. Meanwhile, `ProPosBillingTerm.tsx` only had a single-file CSV upload modal without multi-mode clipboard paste or PDT support. Standardizing on `GlobalGridImportModal` delivers a consistent, high-productivity experience across both retail counter and B2B wholesale workflows with zero duplicate code.

## 7. Implementation Summary
- Extended `GlobalGridImportModalProps` to include `initialRawText?: string`. When provided on mount, the modal automatically populates `rawText` and runs `processRawInput()`.
- Implemented `handleCartTablePaste` in `ProPosBillingTerm.tsx` with delimiter sniffing (`\n`, `\t`, `,`) to prevent interfering with standard text inputs.
- Structured `handleGlobalGridImportCommit` in `ProPosBillingTerm.tsx` to iterate over database-verified items, resolve pricing, apply GST rates via `calculateGST`, and handle merge vs append vs replace strategies.
- Structured `handleGlobalImportCommit` in `SalesOrderFormPremium.tsx` to compute line totals via `calculateLineTotal` and update order summary totals.

## 8. Tests Executed
1. `F:\SMRITRretailNX\.venv\Scripts\python.exe scripts/validate_version_ssot.py`
2. `npx tsc --noEmit`
3. `npx vitest run src/tests/billingTerm.test.ts src/tests/salesOrderValidation.test.ts src/tests/globalGridInputEngine.test.ts`
4. `F:\SMRITRretailNX\.venv\Scripts\pytest backend/tests/test_batch_product_resolution.py`

## 9. Verification Results
- **Version SSOT**: PASSED (6.57.0 across `package.json`, `backend/app/core/config.py`, `src/config/version.ts`, `CHANGELOG.md`).
- **TypeScript Typecheck**: PASSED (0 errors, code 0).
- **Frontend Vitest Suite**: PASSED (29/29 tests green across 3 test files).
- **Backend Pytest Suite**: PASSED (5/5 tests green in `test_batch_product_resolution.py`).

## 10. Known Limitations
- The POS cart grid `onPaste` handler only intercepts paste when the cart table container has focus, not when a focused sub-input (e.g. customer name or document prefix) is active, which is intentional to avoid hijacking standard text input pasting.

## 11. Future Work
- Roll out `GlobalGridImportModal` to Stock Transfer Studio (`StockTransferStudioModal.tsx`) and Vendor Return / RMA creation modules.
- Add offline catalog caching support for `ProductResolutionService` during network disconnection at POS terminals.

## 12. Related ADRs
- `ADR-0056`: Unified Transaction Document Lifecycle Architecture
- `ADR-0072`: Single-Source-of-Truth Product Resolution and Catalog Identity
- `ADR-0074`: SMRITI Global Grid Input & Delimited Text Ingestion Standard

## 13. Related RFCs
- `RFC-2026-GRID-INPUT-01`: Universal Grid Input, Paste, Import & Product Resolution Standard
- `RFC-2026-POS-IMPORT-02`: High-Speed Wholesale & POS Batch Item Ingestion
