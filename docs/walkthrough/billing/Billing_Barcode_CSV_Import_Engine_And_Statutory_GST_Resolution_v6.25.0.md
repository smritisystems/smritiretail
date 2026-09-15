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

  * Version    : 6.25.0
  * Created    : 2026-09-15
  * Modified   : 2026-09-15
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Barcode Billing CSV Import Engine & Statutory GST Resolution (v6.25.0)

## 1. Purpose
To deliver an enterprise-grade, multi-tier CSV/PDT barcode billing import subsystem that automates scanning-based and bulk POS cart assembly while enforcing statutory Legal Metrology Act MRP ceilings, CGST Act Section 31 tax determinism, and Shoper 9 / SAP retail operational integrity.

## 2. Scope
- 6 standard barcode CSV format tiers (Barcode only, Barcode+Qty, Barcode+Qty+Price, Barcode+Qty+Rate, Barcode+Qty+Discount%, Full Billing) plus PDT (tilde/pipe delimited).
- Auto-detection of delimiters (comma, tilde, pipe, tab) and header normalization.
- Catalog barcode resolution against PostgreSQL `products` (`barcode` and `secondary_barcodes`).
- Statutory MRP guard rejecting any item priced above catalog MRP (`SMRITI-BILL-002`).
- Statutory GST determinism where catalog GST rate is the legal source of truth, treating user-entered GST as advisory only (`SMRITI-BILL-010`).
- Non-cascading MRP markdown computation for customer receipt display.
- End-to-end 360° wiring from React frontend modal (`BarcodeCSVImportModal.tsx`) and Pro POS billing canvas (`ProPosBillingTerm.tsx`) to backend API (`billing_csv.py`), database catalog lookup, and `/api/v1/pos/checkout` settlement.

## 3. Files Created
- `backend/app/api/v1/billing_csv.py`: FastAPI endpoint `/api/v1/billing/csv/validate`, header normalizer, delimiter detector, format tier detector, MRP validator, catalog lookup, and GST computation engine.
- `backend/tests/test_billing_csv.py`: Pytest suite covering format detection, inclusive GST arithmetic, valid barcode resolution, MRP ceiling rejection, and GST advisory warning.
- `src/components/billing/BarcodeCSVImportModal.tsx`: React modal dialog with drag-and-drop CSV upload, live preview, row status badges (VALID, WARN, ERROR), format tier badges, error guidance, and 1-click cart insertion.
- `docs/walkthrough/billing/Billing_Barcode_CSV_Import_Engine_And_Statutory_GST_Resolution_v6.25.0.md`: This official WGP walkthrough document.

## 4. Files Modified
- `src/components/billing/types.ts`: Added `CsvFormatTier`, `CsvRowStatus`, `CsvImportRow`, and `CsvImportResult` interfaces.
- `src/components/billing/propos/ProPosBillingTerm.tsx`: Added CSV Import button in overflow menu, integrated `BarcodeCSVImportModal`, wired `handleCsvImportConfirmed` propagating `productId`, `sku`, `barcode`, `name`, `qty`, `mrp`, `unitPrice`, `taxPct`, `taxAmt`, `taxableValue`, `cgstAmount`, `sgstAmount`, `hsnCode`, and `lineTotal` into cart and checkout.
- `backend/app/api/v1/__init__.py`: Registered `billing_csv` router.
- `backend/app/main.py`: Mounted `/api/v1/billing` router.
- `docs/walkthrough/README.md`: Appended version v6.25.0 to walkthrough index.

## 5. Architecture Decisions
1. **Strict Database-Only Ingestion**: Arbitrary text, characters, non-existent barcodes, or unmapped SKUs are unconditionally rejected (`SMRITI-BILL-001`). No phantom or ad-hoc items can ever be added to the billing canvas.
2. **Dual-Identifier Catalog Resolution (Barcode + SKU)**: The lookup engine matches across `p.barcode`, `p.secondary_barcodes`, `p.code`, and `p.sku`, guaranteeing that valid inventory records can be resolved either by optical barcode or internal stock SKU.
3. **Statutory Catalog GST Supremacy**: Per Section 31 & 9 of the CGST Act 2017, tax liability is determined by product tariff classification (HSN) and master tax rates filed by the taxable entity. User-provided CSV GST rates cannot override catalog rates; they serve purely as advisory mismatch warnings (`SMRITI-BILL-010`).
4. **Reverse Inclusive GST Extraction**: GST is calculated on effective selling price (`effective_selling_price * qty / (1 + gst_rate / 100)`), never on legal MRP.
5. **Strict MRP Ceilings**: Under the Legal Metrology (Packaged Commodities) Rules 2011, selling above MRP is an unpardonable offence; any row with price > catalog MRP is immediately given `REJECTED` status (`SMRITI-BILL-002`).
6. **Non-Cascading Markdown Display**: MRP discount percentage is computed as `round((mrp - selling_price) / mrp * 100)` and presented as display metadata (`e.g., 25% off MRP`), ensuring it does not recursively trigger secondary promo engines.

## 6. Design Rationale
- **Zero-Tolerance for Uncataloged Data**: POS billing must remain a strict system of record. Blocking uncataloged entries prevents phantom stock deductions, negative margins, and unverified tax postings.
- **Flexible Ingestion**: Retailers use varied PDT devices, batch scanners, and warehouse exports. Auto-detecting headers (`barcode`, `sku`, `ean`, `code`, `qty`, `pcs`, `rate`, `sp`) and delimiters (`~`, `|`, `,`, `\t`) eliminates pre-processing friction.
- **Human-Readable Error Codes (HREP)**: In compliance with SMRITI Human-Readable Error Policy, all validation errors use business terminology (`SMRITI-BILL-001` through `SMRITI-BILL-010`) with actionable recovery advice.

## 7. Implementation Summary
- **Format 1 (Barcode or SKU only)**: Assumes quantity 1; price, MRP, and GST sourced from database catalog.
- **Format 2 (Barcode/SKU + Quantity)**: Standard warehouse/POS physical count format.
- **Format 3 (Barcode/SKU + Quantity + Selling Price)**: Price override with legal MRP verification.
- **Format 4 (Barcode/SKU + Quantity + Rate)**: Rate treated directly as net unit selling price.
- **Format 5 (Barcode/SKU + Quantity + Discount %)**: Promotional percentage applied to catalog price.
- **Format 6 (Full Billing Import)**: All attributes supplied; catalog validates MRP and issues GST advisory if mismatch found.
- **PDT Format**: Tilde/pipe delimited barcode scanner output.
- **Defensive Cart Gate**: Frontend `handleCsvImportConfirmed` filters out any rows lacking a valid catalog `productId`, ensuring only items verified in PostgreSQL reach the checkout queue.

## 8. Tests Executed
- `pytest backend/tests/test_billing_csv.py -v` (8/8 passed in 16.78s):
  - `test_detect_format`: PASSED
  - `test_compute_gst`: PASSED
  - `test_validate_row_format_1_valid_barcode`: PASSED
  - `test_validate_row_valid_sku`: PASSED
  - `test_validate_row_not_in_database_strictly_rejected`: PASSED
  - `test_validate_row_blank_identifier_rejected`: PASSED
  - `test_validate_row_exceeding_mrp_rejected`: PASSED
  - `test_validate_row_gst_mismatch_warning`: PASSED
- `npm run build` (Vite 5.4.21): 3,547 modules transformed, production build clean, exit code 0 in 1m 13s.

## 9. Verification Results
- 100% test coverage of CSV import logic.
- 0 TypeScript compiler errors.
- Clean POS checkout integration with `productId` verification passing line 1152 guard.

## 10. Known Limitations
- Background async validation queue for ultra-large CSV files (> 10,000 lines) can be added if single POS registers ever import multi-pallet bulk batches.

## 11. Future Work
- Direct USB HID PDT scanner direct-stream ingestion hook into modal.

## 12. Related ADRs
- `ADR-0042`: Statutory Single-System-of-Record Architecture.
- `ADR-0089`: Legal Metrology Compliance & MRP Guardrails.

## 13. Related RFCs
- `RFC-2026-09-01`: Enterprise Barcode Billing & Multi-Tier Batch Ingestion.
