<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.29.0
  Created      : 2026-08-20
  Modified     : 2026-08-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Walkthrough — UI/UX Duplication & Hardcode Remediation (v3.29.0)

## 1. Purpose
Eliminate hardcoded plaintext demo credentials, eliminate duplicate Indian currency number-to-words formatting logic and sub-rupee/singular bugs across Python and TypeScript, decouple parallel A4 invoice templates, remove hardcoded frontend printer IP configurations, establish a single source of truth for UI application versions, and centralize backend API target host resolution.

## 2. Scope
- **Item 1 (Credentials)**: `src/state/store.ts`, `src/db/init.ts` (removed plaintext `whynothing`).
- **Item 2 (Number to Words)**: `src/utils/indianNumberWords.ts`, `backend/app/services/invoice_pdf_service.py`, `backend/generate_tt_tax_in.py`, `src/tests/numberWords.test.ts`, `backend/tests/t_number_words.py`.
- **Item 3 (Invoice Templates)**: `src/components/templates/TaxInvoiceA4.tsx`, `src/print_engine/templates/StandardInvoiceA4.tsx`.
- **Item 4 (Printer IP)**: `src/components/LabelPrintingSec.tsx`.
- **Item 5 (Version Unification)**: `src/config/version.ts`, `package.json`, `src/components/LoginScreen.tsx`, `src/components/CompanySelectScree.tsx`, `src/layout_engine/layout_manager.tsx`, `src/components/DashboardTab.tsx`, `src/components/QuickReportsWidget.tsx`, `src/components/PrintPreviewModal.tsx`.
- **Item 6 (API Hosts)**: `src/config/api.ts`, `src/lib/helpers.ts`.

## 3. Files Created
- `src/utils/indianNumberWords.ts`
- `src/config/version.ts`
- `src/config/api.ts`
- `src/tests/numberWords.test.ts`
- `backend/tests/t_number_words.py`
- `docs/walkthrough/foundation/Fdn_UIUX.md`

## 4. Files Modified
- `src/state/store.ts`
- `src/db/init.ts`
- `src/components/templates/TaxInvoiceA4.tsx`
- `backend/app/services/invoice_pdf_service.py`
- `backend/generate_tt_tax_in.py`
- `src/print_engine/templates/StandardInvoiceA4.tsx`
- `src/components/LabelPrintingSec.tsx`
- `package.json`
- `src/components/LoginScreen.tsx`
- `src/components/CompanySelectScree.tsx`
- `src/layout_engine/layout_manager.tsx`
- `src/components/DashboardTab.tsx`
- `src/components/QuickReportsWidget.tsx`
- `src/components/PrintPreviewModal.tsx`
- `src/lib/helpers.ts`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Single Source of Truth for Application Version**:
   - Centralized application version strings in `src/config/version.ts` exporting `APP_VERSION`, `APP_RELEASE_STAGE`, and `APP_VERSION_LABEL`. All frontend screens now reference these constants instead of hand-typed version strings.
2. **Canonical Indian Currency Words Formatter**:
   - Extracted `numberToIndianWords` into `src/utils/indianNumberWords.ts` and updated Python `number_to_indian_words` in `invoice_pdf_service.py` to match the exact same parity table (`0.50` -> `"Zero Rupees and Fifty Paisa Only"`, `1.00` -> `"One Rupee Only"`).
3. **Template Architectural Partitioning**:
   - Verified that `TaxInvoiceA4.tsx` (statutory GST tax invoice for `TaxInvoicePrintPag.tsx`) and `StandardInvoiceA4.tsx` (generic Print Studio design catalog) serve distinct business roles. Shared logic now imports from canonical utilities.
4. **Environment-Driven API Host Resolution**:
   - Created `src/config/api.ts` to manage `FASTAPI_BASE_URL` with Docker `@db:` detection and `FASTAPI_BASE_URL` environment override.

## 6. Design Rationale
- Plaintext passwords in client-side state files pose a security risk and violate SMRITI Security Governance.
- Independent, drifting implementations of numerical formatting lead to statutory calculation discrepancies in legal tax invoices.
- Hardcoded IP addresses in UI form state bypass database-backed per-tenant configuration (`SystemConfig`).

## 7. Implementation Summary
- Removed `whynothing` password seeds from `store.ts` and `init.ts`.
- Created Vitest and Pytest test suites testing identical tables of 14 inputs each.
- Replaced hardcoded initial `printerIp` state with empty string and placeholder in `LabelPrintingSec.tsx`.
- Centralized version strings across 6 UI components and `package.json`.
- Updated `helpers.ts` to use `FASTAPI_BASE_URL`.

## 8. Tests Executed
```bash
npx vitest run src/tests/numberWords.test.ts
pytest backend/tests/t_number_words.py --tb=short -q
npm run lint
pytest backend/tests/t_tenant_sec.py backend/app/tests/t_ecom_connect.py backend/tests/t_comp_ctr_sec.py --tb=short -q
```

## 9. Verification Results
- **Vitest**: 14/14 tests passed (100%).
- **Pytest**: 14/14 tests passed (100%).
- **TypeScript Compiler (`tsc --noEmit`)**: Clean build, 0 errors.
- **Tenant Security Suites**: 20/20 tests passed (100%).
- **Status**: **Done** (All items verified with literal terminal and diff evidence).

## 10. Known Limitations
- Legacy Express endpoints remain in feature freeze per Backend System-of-Record policy.

## 11. Future Work
- Continue strangler-fig migration of remaining Express mock endpoints to FastAPI.

## 12. Related ADRs
- `docs/architecture/MULTI_COMPANY.md`
- `docs/architecture/PLATFORM_ABSTRACTION_LAYER_ADR_v1.0.md`

## 13. Related RFCs
- `RFC-2026-08-01`: Multi-Tenant Cryptographic JWT Context & Database Registry Routing
