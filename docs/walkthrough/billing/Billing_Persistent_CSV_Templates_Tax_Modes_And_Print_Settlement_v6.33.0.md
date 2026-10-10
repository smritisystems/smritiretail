<!--
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.33.0
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
-->

# Walkthrough: Persistent CSV Templates, Statutory Tax Modes & End-to-End POS Print Settlement

## 1. Purpose
Document the introduction of persistent PostgreSQL database tables (`billing_csv_templates` and `billing_csv_import_logs`), the expansion of the Barcode Billing CSV engine to support flexible **Tax-Inclusive (MRP / Retail Standard)** and **Tax-Exclusive (Base Rate + GST)** pricing combinations, statutory Legal Metrology MRP ceiling enforcement, and automated end-to-end POS settlement with printable receipt views.

## 2. Scope
- **Database Plane**: Alembic migration `v1462_billing_csv_templates_and_import_logs.py` introducing 2 dedicated tables with full column/AST parity in `smriti001` and `smritisys`.
- **Backend API (`billing_csv.py`)**:
  - Auto-detection of `FORMAT_B2B_RATE` and `FORMAT_COMMERCIAL_DISC`.
  - Normalization of row-level tax mode aliases (`is_tax_inclusive`, `tax_mode`, `tax_inclusive`, `price_type`).
  - Positional 5-column headerless fallback parser: `[barcode, quantity, rate, discount, is_tax_inclusive]`.
  - Canonical GST arithmetic integration using `calculate_line_item_tax` from `app.core.gst_engine`.
  - Strict Legal Metrology MRP ceiling enforcement on tax-exclusive rates: $\text{Base Rate} \times (1 + \text{GST}\%) \le \text{Catalog MRP}$.
  - Statutory audit entry insertion into `billing_csv_import_logs` storing file SHA256 digests and row metrics.
  - Template CRUD endpoints (`GET /api/v1/billing/csv/templates`, `POST /api/v1/billing/csv/templates`).
- **Frontend UI (`BarcodeCSVImportModal.tsx`, `types.ts`, `ProPosBillingTerm.tsx`)**:
  - Pricing Policy selector dropdown (`Auto-detect`, `Tax Inclusive`, `Tax Exclusive`).
  - Visual badges (`INC TAX`, `EXC TAX`) and expanded metadata cards.
  - Seamless propagation of `is_tax_inclusive` to the POS cart and `/pos/checkout` payload.
  - Settle bill via Exact Cash and display `SmritiProPosTaxInvoiceReceipt` with A4 & 80mm thermal receipt formats.

## 3. Files Created
1. `backend/app/models/billing_csv.py`: SQLAlchemy models `BillingCsvTemplate` and `BillingCsvImportLog`.
2. `backend/alembic/versions/v1462_billing_csv_templates_and_import_logs.py`: Alembic migration `v1462`.
3. `F:\SMRITRretailNX\CSV\tt_tax_modes.csv`: Multi-line test CSV demonstrating mixed tax mode entries.
4. `scripts/test_headless_csv_tax_billing.py`: Headless Playwright automated verification script.
5. `docs/implementation/billing/Billing_Persistent_CSV_Templates_And_Tax_Inclusive_Exclusive_Ingestion_Plan_v6.33.0.md`: Implementation plan.
6. `docs/walkthrough/billing/Billing_Persistent_CSV_Templates_Tax_Modes_And_Print_Settlement_v6.33.0.md`: This walkthrough.

## 4. Files Modified
1. `backend/app/models/__init__.py`: Exported `BillingCsvTemplate` and `BillingCsvImportLog`.
2. `backend/app/api/v1/billing_csv.py`: Added format tiers, canonical GST math, MRP guards, template endpoints, and audit logging.
3. `backend/tests/test_billing_csv.py`: Extended test suite with 9 unit tests covering all pricing modes and validations.
4. `src/components/billing/types.ts`: Extended format tiers, row interfaces, and result models.
5. `src/components/billing/BarcodeCSVImportModal.tsx`: Added tax policy selector, badges, and confirm mapping.
6. `docs/walkthrough/README.md`: Appended chronological master index table.
7. `docs/implementation/README.md`: Appended master implementation index.

## 5. Architecture Decisions
- **Canonical GST Engine Parity**: Instead of maintaining separate ad-hoc tax formulas in `billing_csv.py`, the engine delegates directly to `app.core.gst_engine.calculate_line_item_tax`. This guarantees 100% mathematical parity across CSV import preview, POS cart calculations, and database ledger posting.
- **5-Level Statutory Tax Resolution Hierarchy**:
  1. Row-level column in CSV (`is_tax_inclusive`)
  2. Modal/API request parameter override (`tax_inclusive_default`)
  3. Item Barcode sellable unit policy (`ItemBarcode.is_tax_inclusive`)
  4. Customer price tier contract (`CustomerPriceTier.is_tax_inclusive`)
  5. Channel default (`POS_RETAIL` = True, B2B = False)
- **Immutable Audit Logging**: Every validation invocation hashes the file content with SHA256 and records validation metrics in `billing_csv_import_logs` for compliance with GST statutory audit trails.

## 6. Design Rationale
Retail point-of-sale environments routinely deal with mixed billing profiles: standard retail walk-in customers receive tax-inclusive MRP bills, while institutional, corporate, or wholesale customers purchase on base rates subject to GST add-ons. Supporting both modes within the same high-speed barcode ingestion modal prevents manual calculation errors and eliminates double-entry invoicing.

## 7. Implementation Summary
- **Migration & Tables**: Created `billing_csv_templates` (21 columns) and `billing_csv_import_logs` (28 columns) in `smriti001` and `smritisys` with 9 pre-seeded system templates.
- **Backend**: Implemented `_parse_tax_mode` supporting truthy (`1`, `true`, `yes`, `inc`, `mrp`) and falsy (`0`, `false`, `no`, `exc`, `base`) tokens. Enforced Legal Metrology post-tax ceiling validation. Added template CRUD endpoints.
- **Frontend**: Added Pricing & Tax Mode selector dropdown and visual badges (`INC TAX`, `EXC TAX`) to `BarcodeCSVImportModal.tsx`. Bound cart state to preserve `is_tax_inclusive` through `/pos/checkout`.
- **Receipt & Print**: Integrated `SmritiProPosTaxInvoiceReceipt` modal rendering both A4 Tax Invoice and 80mm Thermal Receipt layouts with browser print action triggers.

## 8. Tests Executed
1. **Pytest Suite (`backend/tests/test_billing_csv.py`)**:
   - `test_detect_format`: Verified auto-detection across all 9 format tiers.
   - `test_compute_gst_inclusive`: Verified inclusive tax split without 1-paisa divergence.
   - `test_compute_gst_exclusive`: Verified base rate + GST arithmetic.
   - `test_parse_tax_mode`: Verified string alias normalization.
   - `test_validate_row_format_1_valid_barcode`: Verified catalog resolution.
   - `test_validate_row_tax_exclusive_valid`: Verified valid tax-exclusive calculation.
   - `test_validate_row_tax_exclusive_exceeding_mrp_rejected`: Verified post-tax MRP rejection (`SMRITI-BILL-002`).
   - `test_validate_row_commercial_dual_discount`: Verified dual discount handling.
   - `test_positional_5_column_parsing`: Verified 5-column positional parser.
   - **Result:** 9/9 passed in 7.23s.
2. **Frontend Build (`npm run build`)**:
   - Transformed 3,550 modules with 0 errors in 29.18s.
3. **Database Schema Parity (Rule 12)**:
   - Verified 21 columns in `billing_csv_templates` and 28 columns in `billing_csv_import_logs` in PostgreSQL `smriti001` and `smritisys`.

## 9. Verification Results
| Check | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Database Tables Present & Parity Verified | **Done** | `billing_csv_templates` (21 cols, 9 rows), `billing_csv_import_logs` (28 cols) |
| 2 | Backend Unit Tests Green | **Done** | 9/9 passed in `backend/tests/test_billing_csv.py` |
| 3 | Frontend Compilation | **Done** | `npm run build` 3,550 modules transformed, 0 errors |
| 4 | Tax Inclusive / Exclusive Calculations | **Done** | Verified mathematical parity with `calculate_line_item_tax` |
| 5 | Post-Tax Legal MRP Ceiling Guard | **Done** | Rejects tax-exclusive base rates exceeding catalog MRP (`SMRITI-BILL-002`) |
| 6 | End-to-End Headless POS Settlement & Print | **Done** | Automated test settled bill, generated invoice, and rendered printable receipt |

## 10. Known Limitations
- Browser physical printing triggers window.print() dialog; in automated headless testing, this is validated by inspecting the rendered thermal/A4 receipt DOM canvas.

## 11. Future Work
- Direct CSV drag-and-drop onto the POS items grid without opening modal.
- Multi-register concurrency load testing for simultaneous batch CSV uploads.

## 12. Related ADRs
- `ADR-0042`: Canonical GST Calculation Engine.
- `ADR-0089`: Unified Point of Sale Architecture.

## 13. Related RFCs
- `RFC-0019`: Multi-Channel Barcode Ingestion Standards.
