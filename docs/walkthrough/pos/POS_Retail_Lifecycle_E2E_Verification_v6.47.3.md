<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.47.3
  Created      : 2026-09-30
  Modified     : 2026-09-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Retail Transaction Lifecycle E2E Verification Suite (v6.47.3)

## 1. Purpose
The purpose of this implementation is to establish a canonical, automated, end-to-end integration test harness (`scripts/test_retail_lifecycle_e2e.py`) that exercises the entire retail transactional lifecycle in SMRITI Retail OS. This suite verifies cross-workspace parity spanning Article Master creation (`POST /api/v1/inventory/`), Purchase Order issuance, Goods Receipt Note (GRN) warehouse inwarding, live Point-of-Sale (POS) barcode checkout (`POST /api/v1/pos/checkout`), PostgreSQL Stock Ledger double-entry reconciliation, and headless browser UI barcode scanning in Counter POS.

## 2. Scope
- **Canonical Article & Variant Lifecycle**: Verification of the two-tier Article (`items`) + Variant (`item_variants`) + Sellable SKU (`products`) data pipeline through canonical FastAPI endpoint `/api/v1/inventory/`.
- **Procurement & Inward Flow**: Approved Purchase Order creation and Goods Receipt Note posting, testing physical stock increments (+20 units) and `PURCHASE_RECEIPT` movements.
- **Counter POS Checkout**: Authenticated cash checkout processing with real-time cashier shift linkage, line-item tax calculations (12% GST), invoice emission, and immediate outward stock movement (`OUTWARD_SALE`).
- **Stock Ledger Reconciliation**: Real-time arithmetic verification: `20 Inward - 2 Outward Sale = 18 Net Balance` in both cached `products.stock` and transactional `stock_movements`.
- **Playwright Headless UI Verification**: Automated browser authentication injection, POS counter navigation, barcode input execution, and visual audit screenshot capture.
- **UTMIH Immutable Ledger Compliance**: Teardown logic strictly honors PostgreSQL trigger `prevent_stock_movement_mutation()` (`SMRITI-LEDGER-001`).

## 3. Files Created
- [`scripts/test_retail_lifecycle_e2e.py`](file:///f:/SMRITRretailNX/scripts/test_retail_lifecycle_e2e.py): Canonical 341-line Python test suite orchestrating all 6 phases across FastAPI, PostgreSQL, and Playwright Chromium.

## 4. Files Modified
- [`docs/walkthrough/README.md`](file:///f:/SMRITRretailNX/docs/walkthrough/README.md): Appended chronological entry to the master walkthrough index.

## 5. Architecture Decisions
- **ADR-E2E-001: Autonomous Cross-Tier Execution**:
  The suite does not rely on mocked API calls or SQLite in-memory fixtures. It interacts directly with the production-identical FastAPI backend (`http://127.0.0.1:1981`) and PostgreSQL tenant database (`postgresql://postgres:postgres@localhost:2781/smriti001`) to validate real network serialization, authentication, and database constraints.
- **ADR-E2E-002: Dynamic Identifiers & Teardown Boundary**:
  To guarantee isolation and idempotency during automated runs, each execution generates unique identifiers based on timestamp hexadecimal strings (`RUN_ID = hex(int(time.time()))[2:].upper()`). Teardown cleanly removes operational test documents (`sales_invoices`, `purchase_receipts`, `purchase_orders`) while deliberately retaining ledger entries to satisfy the immutable ledger governance policy.
- **ADR-E2E-003: Headless Visual Telemetry**:
  Playwright runs headlessly and saves screenshots to `scratch/visual-audit-temp/e2e_parity/`, giving continuous visual audit proof of UI state and barcode search popups.

## 6. Design Rationale
Prior to this implementation, tests were fragmented between backend unit tests (`pytest`), frontend component tests (`vitest`), and ad-hoc scratch scripts. Changes to catalog APIs, numbering engines, or POS schemas risked breaking the retail transactional chain without immediate detection. Consolidating this into a single runnable Python script ensures zero regression across the complete retail lifecycle.

## 7. Implementation Summary
The test script executes the following 6 transactional phases sequentially:
1. **Admin Authentication & Token Acquisition**: Authenticates against `POST /api/v1/auth/login` to obtain an enterprise JWT token.
2. **Phase 1 — Canonical Article Creation**:
   - Sends payload to `POST /api/v1/inventory/` specifying standard product attributes (`style_no`, `article_no`, color, size, brand, category, HSN 61091000, 12% GST).
   - Validates HTTP 201 response and confirms corresponding records in `items`, `item_variants`, and `products`.
3. **Phase 2 — Purchase Order Issuance**:
   - Creates an approved PO for 20 units at ₹500.00 each in `purchase_orders` and `purchase_order_items`.
4. **Phase 3 — Goods Receipt Note (GRN) Inwarding**:
   - Posts a GRN in `purchase_receipts` and `purchase_receipt_items`.
   - Records a `PURCHASE_RECEIPT` row in `stock_movements`.
   - Increments `products.stock` to 20 units.
5. **Phase 4 — POS Barcode Checkout**:
   - Resolves active cashier shift from `shifts`.
   - Dispatches `POST /api/v1/pos/checkout` with 2 units of the created article.
   - Asserts HTTP 200 response, invoice creation (`INV-E2E-*`), and grand total calculation.
6. **Phase 5 — Stock Ledger & Balance Reconciliation**:
   - Inspects `products.stock` ensuring cached balance equals exactly 18 units.
   - Inspects `stock_movements` confirming both inward (`PURCHASE_RECEIPT`) and outward (`OUTWARD_SALE`) entries.
7. **Phase 6 — Playwright UI Verification**:
   - Launches headless Chromium browser, injects tenant local storage, navigates to Counter POS (`?tab=pos`), enters the generated barcode into the scanning input, and captures a visual snapshot (`e2e_interactive_pos_scan.png`).

## 8. Tests Executed
- **Full Suite Run**:
  ```powershell
  .venv\Scripts\python.exe scripts/test_retail_lifecycle_e2e.py
  ```
- **Syntax & Compilation Validation**:
  ```powershell
  .venv\Scripts\python.exe -m py_compile scripts/test_retail_lifecycle_e2e.py
  ```

## 9. Verification Results
- **Exit Code**: `0` (Clean pass)
- **Phase 1 Article Creation**: HTTP 201 Created (Product ID: `prod_f722887a8290`, Style: `STYLE-ART-CYC-6ABC4667`)
- **Phase 2 Purchase Order**: Status `APPROVED`, 20 units @ ₹500.00
- **Phase 3 GRN Inwarding**: Stock incremented to 20 units
- **Phase 4 POS Checkout**: HTTP 200 OK, Invoice `INV-E2E-6ABC4667`, Total ₹2,400.00
- **Phase 5 Ledger Reconciliation**: Net stock = 18 units (20 Inward − 2 Sale = 18 Balance verified)
- **Phase 6 Visual Telemetry**: `e2e_interactive_pos_scan.png` successfully generated in `scratch/visual-audit-temp/e2e_parity/`
- **Teardown**: Database restored cleanly with zero constraint violations.

## 10. Known Limitations
- The current implementation assumes an open cashier shift exists in `shifts` table for tenant `COMP-001`. If no open shift exists, the checkout phase will assert failure.
- Headless browser UI scan interacts with the item search input field; full automated checkout completion via the DOM UI buttons will be added in a future enhancement.

## 11. Future Work
- **Sales Return / Credit Note Phase**: Extend the suite to test customer returns (`POST /api/v1/pos/returns`) and verify stock increment back to 19 units.
- **Cashier Shift Closure Phase**: Assert shift settlement arithmetic (tendered cash vs sales invoice totals).
- **CI Workflow Integration**: Embed `scripts/test_retail_lifecycle_e2e.py` into `.github/workflows/ci.yml` as a mandatory PR check.

## 12. Related ADRs
- `ADR-DB-004`: Stock Source-of-Truth Consolidation & Double-Entry Ledger
- `ADR-E2E-001`: Autonomous Cross-Tier Execution Policy
- `ADR-UTMIH-001`: Immutable Stock Movement Trigger Governance

## 13. Related RFCs
- `RFC-CAT-001`: Universal Item Master & Variant Synchronization
- `RFC-POS-003`: Counter POS High-Speed Barcode Checkout Contract
