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

# Implementation Plan: Persistent CSV Templates, Tax-Inclusive/Exclusive Ingestion & End-to-End Bill Finalization

## 1. Objective
Establish persistent, database-backed barcode billing CSV templates (`billing_csv_templates`) and statutory import audit logging (`billing_csv_import_logs`), while expanding the ingestion engine to seamlessly support both **Tax Inclusive (MRP/Retail)** and **Tax Exclusive (Base Rate + GST)** pricing combinations with statutory validations and receipt print finalization.

## 2. Business Motivation
Prior to this enhancement, barcode CSV imports in SMRITI POS assumed 100% tax-inclusive retail pricing. When wholesale customers or franchise counters uploaded CSV sheets containing base rates without tax, the system incorrectly treated those rates as tax-inclusive, leading to revenue leakage and tax computation disparities. Furthermore, cashier imports lacked statutory database audit trails and reusable mapping profiles.

## 3. Scope
- Database tables: `billing_csv_templates` (21 columns) and `billing_csv_import_logs` (28 columns) via Alembic migration `v1462`.
- Ingestion engine extensions in `backend/app/api/v1/billing_csv.py`:
  - New format tiers: `FORMAT_B2B_RATE` and `FORMAT_COMMERCIAL_DISC`.
  - Header normalization for tax mode aliases (`is_tax_inclusive`, `tax_mode`, `inclusive`, `price_type`).
  - Positional 5-column parsing fallback: `[barcode, quantity, rate, discount_percent, is_tax_inclusive]`.
  - Integration with canonical `calculate_line_item_tax` from `app.core.gst_engine`.
  - Statutory Legal Metrology MRP ceiling enforcement in tax-exclusive mode.
  - Template management endpoints (`GET /api/v1/billing/csv/templates`, `POST /api/v1/billing/csv/templates`).
  - Automatic audit staging log insertion.
- Frontend enhancements in `BarcodeCSVImportModal.tsx` and `types.ts`:
  - Pricing & Tax Policy dropdown (`Auto-detect`, `Tax Inclusive`, `Tax Exclusive`).
  - Visual row badges (`INC TAX`, `EXC TAX`) and tax mode metadata in expanded cards.
  - Propagation of `is_tax_inclusive` to POS cart and checkout payload.
- End-to-end POS settlement and printable receipt rendering (`SmritiProPosTaxInvoiceReceipt`).

## 4. Current State
- `billing_csv.py` had 7 format tiers, hardcoded to compute tax inclusively via a naive formula.
- No database tables existed for storing CSV templates or recording billing CSV import audit events.
- `canonical_sales_writer.py` and `gst_engine.py` possessed full support for `is_tax_inclusive`, but the CSV import bridge did not pass or respect this flag.

## 5. Gap Analysis
- Lack of tax-exclusive rate support caused incorrect bill totals for wholesale/B2B CSVs.
- Inability to enforce post-tax MRP ceilings on base rates exposed retailers to legal metrology penalties.
- No audit trail connected uploaded CSV file hashes with generated sales invoices.

## 6. Architecture Impact
- Introduces `billing_csv_templates` and `billing_csv_import_logs` to PostgreSQL schema.
- Unifies GST arithmetic between CSV import preview and canonical transaction posting by sharing `calculate_line_item_tax`.
- Preserves the 5-level statutory tax resolution hierarchy across the platform.

## 7. Proposed Design
- **Tier Detection**: Detects `FORMAT_B2B_RATE` if `is_tax_inclusive` is present, or `FORMAT_COMMERCIAL_DISC` if discounts are also present.
- **Tax Mode Normalization**: Normalizes `{"1", "true", "yes", "inc", "mrp"}` to `True`, and `{"0", "false", "no", "exc", "base"}` to `False`.
- **Statutory Guard**: Computes $\text{Post-Tax Rate} = \text{Base Rate} \times (1 + \text{GST}\%)$. If $\text{Post-Tax Rate} > \text{Catalog MRP}$, rejects with `SMRITI-BILL-002`.
- **Audit Hash**: Generates SHA256 digest of raw uploaded CSV content and writes immutable record to `billing_csv_import_logs`.

## 8. Files Created
- `backend/app/models/billing_csv.py`: SQLAlchemy models for `BillingCsvTemplate` and `BillingCsvImportLog`.
- `backend/alembic/versions/v1462_billing_csv_templates_and_import_logs.py`: Alembic migration script.
- `F:\SMRITRretailNX\CSV\tt_tax_modes.csv`: Test CSV with mixed tax modes.
- `scripts/test_headless_csv_tax_billing.py`: Headless Playwright automated verification runner.
- `docs/implementation/billing/Billing_Persistent_CSV_Templates_And_Tax_Inclusive_Exclusive_Ingestion_Plan_v6.33.0.md`: This plan.

## 9. Files Modified
- `backend/app/models/__init__.py`: Registered `BillingCsvTemplate` and `BillingCsvImportLog`.
- `backend/app/api/v1/billing_csv.py`: Added format tiers, canonical GST calculations, MRP guards, audit logging, and template APIs.
- `backend/tests/test_billing_csv.py`: Added comprehensive unit tests for inclusive/exclusive math, MRP enforcement, and 5-column parsing.
- `src/components/billing/types.ts`: Extended format tiers and row schemas with tax mode and batch fields.
- `src/components/billing/BarcodeCSVImportModal.tsx`: Added Pricing Policy selector, tax mode badges, and confirm mapping.
- `docs/implementation/README.md`: Appended master implementation index.

## 10. Dependencies
- FastAPI, SQLAlchemy (asyncio), Pydantic v2.
- PostgreSQL 15 (`smriti001`, `smritisys`).
- Playwright, Pytest.
- React 18, Vite 5, Lucide React.

## 11. Risks
- **Over-MRP Base Rates**: Cashiers might enter tax-exclusive rates that, after statutory GST addition, exceed legal MRP. Mitigated via strict server-side pre-validation rejection.
- **Rounding Divergence**: Split GST amounts (CGST/SGST) could suffer 1-paisa divergence. Mitigated via canonical `round_currency` remainder balancing in `gst_engine.py`.

## 12. Rollback Strategy
- Revert Alembic revision: `alembic downgrade -1` drops `billing_csv_import_logs` and `billing_csv_templates`.
- Git revert of `billing_csv.py` and `BarcodeCSVImportModal.tsx`.

## 13. Verification Plan
- Unit tests: `pytest backend/tests/test_billing_csv.py -v` (9/9 green).
- Database schema verification: column-by-column inspection on `billing_csv_templates` and `billing_csv_import_logs`.
- End-to-end headless Playwright test with screenshots of import preview, cart, settlement, and printable receipt.

## 14. Test Plan
- Test Tax-Inclusive arithmetic: `100.00` @ 18% -> Taxable `84.75`, Tax `15.25`, Line Total `100.00`.
- Test Tax-Exclusive arithmetic: `100.00` @ 18% -> Taxable `100.00`, Tax `18.00`, Line Total `118.00`.
- Test MRP ceiling violation rejection: Base rate ₹1,000 + 18% GST = ₹1,180 > MRP ₹1,100 -> Rejection `SMRITI-BILL-002`.
- Test Headerless 5-column positional ingestion.

## 15. Documentation Impact
- Update `docs/walkthrough/billing/`.
- Update `docs/implementation/README.md` and `docs/walkthrough/README.md`.

## 16. Deployment Plan
- Applied migration `v1462` to both `smriti001` and `smritisys`.
- Rebuilt frontend assets (`npm run build`).
- Restarted `smriti-api` and `smriti-web` Docker containers.

## 17. Status
Approved & In Execution.

## 18. Related ADRs
- `ADR-0042`: Canonical GST Calculation Engine.
- `ADR-0089`: Unified Point of Sale Architecture.

## 19. Related Walkthroughs
- `Billing_Barcode_CSV_Import_Engine_And_Statutory_GST_Resolution_v6.25.0.md`
- `Billing_Headless_Playwright_CSV_Import_And_Settlement_v6.32.1.md`
- `Billing_Persistent_CSV_Templates_Tax_Modes_And_Print_Settlement_v6.33.0.md`
