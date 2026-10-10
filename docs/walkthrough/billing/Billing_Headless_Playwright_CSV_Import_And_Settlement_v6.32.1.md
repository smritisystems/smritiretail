<!--
  Project      : SMRITI Retail OS
  Author       : Pushpa Devi Jawahar Mallah / Jawahar Ramkripal Mallah
  Designation  : Founder & Chairperson / Founder, CEO & Chief Systems Architect
  Email        : founder@aitdl.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.32.1
  Created      : 2026-09-17
  Modified     : 2026-09-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Headless Playwright CSV Import Billing & POS Settlement Flow (v6.32.1)

## 1. Purpose
To validate and execute complete end-to-end headless automated billing via the Retail POS interface by importing a positional 2-column CSV barcode batch (`F:\SMRITRretailNX\CSV\tt.csv`), verifying all 8 items against the active PostgreSQL catalogue, adding them to the cart, executing Exact Cash tender settlement, and generating verifiable audit receipts and database records.

## 2. Scope
- Headerless 2-column CSV auto-detection (`barcode,quantity`) in `backend/app/api/v1/billing_csv.py`.
- Multi-alias branch resolution (`BR-MAIN-001`, `MAIN`, `BR-001`) in `backend/app/services/pos.py` for open shift discovery and checkout validation.
- Dynamic shift ID binding (`effectiveShiftId = shiftId || activeShiftId`) and live state synchronization in `src/components/billing/propos/ProPosBillingTerm.tsx` and `src/components/billing/BillingWorkspace.tsx`.
- Playwright headless Chromium test harness (`scripts/test_headless_csv_billing.py`) capturing 6 sequential high-resolution screenshots.
- Direct PostgreSQL `sales_invoices` and `sales_invoice_items` verification in `smriti001`.

## 3. Files Created
- `scripts/test_headless_csv_billing.py`: Headless Playwright end-to-end automation runner with PostgreSQL assertion.
- `docs/walkthrough/billing/Billing_Headless_Playwright_CSV_Import_And_Settlement_v6.32.1.md`: This governance walkthrough document.

## 4. Files Modified
- `backend/app/api/v1/billing_csv.py`: Added headerless positional CSV fallback parser and cast parameter types to resolve asyncpg ambiguous parameter issues.
- `backend/app/services/pos.py`: Added `_branch_clause` supporting branch multi-aliases (`BR-MAIN-001`, `MAIN`, `BR-001`) in `list_shifts`, `get_shift`, and `open_shift`; removed duplicate overriding query methods.
- `src/components/billing/BillingWorkspace.tsx`: Made active shift determination case-insensitive (`s.status?.toUpperCase() === "OPEN"`).
- `src/components/billing/propos/ProPosBillingTerm.tsx`: Initialized empty `cartItems`, added `shiftId` prop synchronization effect, and bound `effectiveShiftId = shiftId || activeShiftId`.

## 5. Architecture Decisions
- **AD-POS-032**: Retain POS strict stock check during checkout while reconciling warehouse stock for live test catalogue items.
- **AD-TENANT-019**: Normalize main branch aliases in repository and service layers so that tenant context `BR-MAIN-001` transparently queries data created under `BR-001` or `MAIN`.

## 6. Design Rationale
In real-world retail store operations, cashier barcode scans or scanner batch exports frequently produce headerless 2-column CSV files (`<barcode>,<quantity>`). Auto-detecting header presence eliminates customer friction. Furthermore, branch identifiers in multi-store deployments often transition between corporate IDs (`BR-MAIN-001`) and store branch codes (`BR-001`); multi-alias resolution guarantees shift availability without data drift.

## 7. Implementation Summary
1. **Headerless CSV Detection**: `_parse_input` in `billing_csv.py` evaluates the first line. If no known header alias matches, it assigns positional columns: index 0 -> `barcode`, index 1 -> `quantity`.
2. **Shift Branch Clause**: `POSService._branch_clause` applies `or_(Shift.branch_id.in_(["BR-MAIN-001", "MAIN", "BR-001"]), Shift.branch_id.is_(None))` for main branch contexts.
3. **Frontend Shift & Cart Synchronization**: `ProPosBillingTerm.tsx` starts with an empty cart and synchronizes with the active shift received from `App.tsx` / `BillingWorkspace.tsx`.
4. **End-to-End Headless Run**: Headless Playwright completed the workflow, created Invoice `TT/-0001` (`inv-c028643b5e9a`), and verified 8 line items in PostgreSQL.

## 8. Tests Executed
```bash
python -u scripts/test_headless_csv_billing.py
```

## 9. Verification Results
- **Screenshot 01**: Desktop Launchpad authorized (`01_desktop_launchpad.png`)
- **Screenshot 02**: Billing Workspace empty state (`02_billing_terminal_empty.png`)
- **Screenshot 03**: CSV Import modal open (`03_csv_import_modal_open.png`)
- **Screenshot 04**: CSV Import validated preview: 8/8 valid rows, 0 rejected, ₹55,065.96 (`04_csv_import_validated_preview.png`)
- **Screenshot 05**: Billing Terminal cart populated with 8 items (`05_billing_terminal_with_items.png`)
- **Screenshot 06**: Tax Invoice Receipt dialog showing settled Invoice `TT/-0001` (`06_bill_settled_receipt.png`)
- **Database Invoice**: `sales_invoices` record `inv-c028643b5e9a`, `invoice_no` = `TT/-0001`, Grand Total = ₹55,065.96, Tax Total = ₹2,622.18, 8 lines in `sales_invoice_items`.

## 10. Known Limitations
- The floating barcode search overlay at the bottom right can occlude the action footer buttons during synthetic DOM hit testing; click dispatch via `page.evaluate()` or closing the overlay is recommended in automated environments.

## 11. Future Work
- Add direct CSV drag-and-drop support directly into the POS cart table without opening the modal dialog.

## 12. Related ADRs
- `ADR-POS-001`: POS Shift Treasury Float and Concurrency Governance
- `ADR-POS-011`: Canonical Dual-Key Write Authority and Idempotent Sales Posting

## 13. Related RFCs
- `RFC-POS-009`: Universal Barcode Batch Ingestion Protocol
