<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.92.0
  Created      : 2026-10-18
  Modified     : 2026-10-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough Document
-->

# Walkthrough: Company Identity Printing Safety Remediation v6.92.0

## 1. Purpose
This remediation eliminates all hardcoded corporate identity fallbacks ("Tattly Threads", GSTIN "27AAXFT2508H1ZR", hardcoded SBI bank accounts, emails, websites, and logos) across backend PDF engines, API route handlers, report exporters, and frontend print templates. It enforces fail-closed `CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED` banners and validation barriers that prevent document issuance when statutory corporate identity is missing, while establishing document-specific validation and guaranteeing historical invoice reprint immutability.

## 2. Scope
- Backend seller context resolution (`backend/app/services/seller_resolver.py`).
- Global HREP error handler for `InvoiceRenderError` (`backend/app/core/error_handlers.py`).
- Backend Tax Invoice PDF service (`backend/app/services/invoice_pdf_service.py`).
- Backend Sales Order PDF service (`backend/app/services/sales_order_pdf_service.py`).
- Sales API and Order Conversion service (`backend/app/api/v1/sales.py`, `backend/app/services/sales.py`).
- Reporting Excel exporter and schemas (`backend/app/services/reports.py`, `backend/app/schemas/reports.py`).
- E-Way Bill gateway identity resolution (`backend/app/services/eway_bill_service.py`).
- Frontend print templates:
  - `src/print_engine/templates/StandardInvoiceA4.tsx`
  - `src/print_engine/templates/PurchaseOrderPrintA4.tsx`
  - `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`
  - `src/print_engine/templates/ThermalReceipt80mm.tsx`
  - `src/print_engine/templates/SizePivotMatrixA4.tsx`
  - `src/components/TaxInvoicePrintPag.tsx`
- Comprehensive safety regression test suites:
  - `backend/tests/test_printing_safety.py`
  - `backend/tests/test_seller_resolver.py`
  - `src/tests/poPrintBrandingAndTerms.test.tsx`

## 3. Files Created
- `backend/tests/test_printing_safety.py`
- `docs/walkthrough/print/Print_Company_Identity_Safety_Remediation_v6.92.0.md`

## 4. Files Modified
- `backend/app/core/error_handlers.py`
- `backend/app/services/seller_resolver.py`
- `backend/app/services/invoice_pdf_service.py`
- `backend/app/services/sales_order_pdf_service.py`
- `backend/app/services/sales.py`
- `backend/app/api/v1/sales.py`
- `backend/app/services/reports.py`
- `backend/app/schemas/reports.py`
- `backend/app/services/eway_bill_service.py`
- `src/components/TaxInvoicePrintPag.tsx`
- `src/print_engine/templates/StandardInvoiceA4.tsx`
- `src/print_engine/templates/PurchaseOrderPrintA4.tsx`
- `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`
- `src/print_engine/templates/ThermalReceipt80mm.tsx`
- `src/print_engine/templates/SizePivotMatrixA4.tsx`
- `src/tests/poPrintBrandingAndTerms.test.tsx`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Fail-Closed Statutory Validation:** Document engines must never fall back to default corporate details or dummy strings. If seller legal name, GSTIN, or required bank details are missing, generation fails with HTTP 422 `InvoiceRenderError`.
- **Precedence Inversion for Immutability:** Historical invoice snapshots (`invoice.seller_name`, `invoice.bank_name`, `account_no`, `ifsc_code`, `rule_snapshots`) take precedence over live mutable `Company` records. Historical reprints preserve the exact legal identity under which they were originally issued.
- **Document-Specific Policy Enforcement:** Banking coordinates are statutory prerequisites exclusively for `TAX_INVOICE`. Non-tax documents (`SALES_ORDER`, `QUOTATION`, `POS_RECEIPT`) and `PURCHASE_ORDER` (which evaluates Buyer profile) validate identity without requiring bank details.
- **Conversion-Time Sealing:** Converting a Sales Order to an Invoice executes seller resolution at conversion time and seals snapshot fields into dedicated columns and `SalesInvoice.rule_snapshots`.

## 6. Design Rationale
In multi-tenant or re-branded environments, silent fallbacks to a developer tenant (such as Tattly Threads) risk statutory non-compliance, legal liability, and brand confusion. By halting generation early and rendering actionable `CORPORATE IDENTITY NOT CONFIGURED` banners, operators are guided to configure their Company Profile without leaking mock or third-party identities.

## 7. Implementation Summary
1. **Dynamic Seller Resolver:** Enhanced `seller_resolver.py` with `doc_type` parameter, inverted snapshot precedence, and document-specific banking enforcement.
2. **Standard HREP 422 Handler:** Added `invoice_render_error_handler` in `error_handlers.py` returning business-friendly error payloads.
3. **PDF Generator Cleansing:** Stripped default arguments (`company_name="TATTLY THREADS"`, `company_gstin="27AAXFT2508H1ZR"`, SBI bank defaults) from `invoice_pdf_service.py` and `sales_order_pdf_service.py`. Made QR codes dynamic.
4. **Print Engine Template Protection:** Updated all React print templates (`StandardInvoiceA4`, `PurchaseOrderPrintA4`, `FootwearPurchaseOrderA4`, `ThermalReceipt80mm`, `SizePivotMatrixA4`, `TaxInvoicePrintPag`) to check `isIdentityMissing` and render prominent warning banners blocking printing.
5. **Report & Gateway Harmonization:** Removed static supplier strings from `reports.py`, made register line supplier attributes optional in `reports.py` schemas, and cleared GSTIN fallbacks in `eway_bill_service.py`.
6. **Isolated Test Fixtures:** Explicit mock profiles supplied in `src/tests/poPrintBrandingAndTerms.test.tsx` per policy.

## 8. Tests Executed
1. `pytest backend/tests/test_seller_resolver.py backend/tests/test_printing_safety.py -v` (14/14 passed)
2. `npx vitest run src/tests/poPrintBrandingAndTerms.test.tsx` (9/9 passed)
3. `python scripts/architecture_duplication_gate.py` (11/11 passed, 0 violations)
4. `python scripts/ci_tenant_boundary_guard.py` (10/10 passed, 0 violations)
5. `npm run validate-registry` (98/98 components valid)
6. `npx tsc --noEmit` (0 errors)

## 9. Verification Results
- All 14 Python unit and integration tests passed green.
- All 9 Vitest frontend print engine tests passed green.
- Zero architecture duplication violations and zero tenant boundary violations.
- Clean TypeScript build with zero errors.

## 10. Known Limitations
- When corporate identity is unconfigured in the database, document downloads and print windows return HTTP 422 or display warning banners until the tenant profile is completed.

## 11. Future Work
- Add automated frontend banner notification inside Company Profile Studio prompting new tenants to configure banking coordinates before issuing tax invoices.

## 12. Related ADRs
- `ADR-0042`: Canonical Dynamic Corporate Identity Architecture
- `ADR-0078`: Multi-Tenant Invoice Snapshot Immutability

## 13. Related RFCs
- `RFC-2026-PRINT-01`: Elimination of Static Identity Defaults in Document Generation
