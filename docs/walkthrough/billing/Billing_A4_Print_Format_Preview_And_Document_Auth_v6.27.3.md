<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.27.3
  Created      : 2026-09-16
  Modified     : 2026-09-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Billing A4 Print Format Default Preview & Document Authentication Protection (SMRITI-AUTH-001)

## 1. Purpose
This walkthrough documents:
1. Setting the canonical A4 Tax Invoice (from `invoice_TT2026-2027-138.pdf`) as the default print and preview format for retail and wholesale bills.
2. Enabling cashier and operator live preview in the POS billing terminal via keyboard shortcut `Alt+V` and toolbar action.
3. Completely eliminating `SMRITI-AUTH-001` authentication errors when opening document print, preview, download, and reprint endpoints in new browser tabs.

## 2. Scope
- **Default A4 Print Format & Preview**:
  - Embedded `TaxInvoiceA4.tsx` (TT138 canonical renderer) as the primary/default preview layout inside `ProPosTaxInvoiceRc.tsx`.
  - Added toggle pill allowing cashiers to switch seamlessly between `A4 Standard (TT138) [Default]` and `Thermal Slip (80mm)`.
  - Integrated zoom controls (`Zoom Out`, `Zoom In`, `Reset 100%`) for responsive preview on compact touchscreens and widescreen checkout counters.
  - Added shortcut `Alt+V` in `ProPosBillingTerm.tsx` to preview the active bill before or during checkout.
- **Document Authentication Protection (`SMRITI-AUTH-001` Root-Cause Remediation)**:
  - Backend `backend/app/api/deps.py`:
    - Updated `oauth2_scheme = OAuth2PasswordBearer(..., auto_error=False)` to prevent premature 401 raises.
    - Updated `get_current_user` to inspect `Authorization: Bearer <token>` header, query parameter `?token=...` or `?auth_token=...`, and cookies `access_token` or `smriti_jwt_token`.
    - Added sanitization to strip whitespace, `Bearer ` prefixes, and enclosing quotes.
    - Updated `get_tenant_context` to support query params and cookies for `company_id` and `branch_id`, with automatic fallback to the company's first active branch.
  - Backend `backend/app/services/invoice_pdf_service.py`:
    - Updated invoice query in `generate_invoice_html` and `get_or_render_pdf_artifact` to resolve by either `id` or `invoice_no`.
    - Aligned branch lookup with `BaseRepository` to accept standard branch aliases (`BR-MAIN-001`, `MAIN`, `BR-001`).
  - Frontend `src/lib/apiFetchV1.ts`:
    - Exported `getAuthenticatedDocumentUrl(endpoint)` and `openAuthenticatedDocument(endpoint, target, features)`.
    - Added `syncAuthCookies(token)` to synchronize session tokens into browser cookies with `SameSite=Lax`.
  - Frontend `src/components/SalesStudioTab.tsx`:
    - Routed all document actions (`PRINT TAX INVOICE`, `Preview`, `Export PDF`, `Reprint`) through `openAuthenticatedDocument`.
- **Automated Regression Protection**:
  - Created `src/tests/authenticatedDocumentUrl.test.ts` (4 unit tests).
  - Maintained 10/10 tests green in `src/tests/ttInvoiceBillingCalculation.test.ts`.

## 3. Files Created
- `src/tests/authenticatedDocumentUrl.test.ts` (110 LOC) — Unit test suite verifying authenticated document URL generation and cookie synchronization.
- `docs/walkthrough/billing/Billing_A4_Print_Format_Preview_And_Document_Auth_v6.27.3.md` (This document).

## 4. Files Modified
- `src/components/billing/propos/ProPosTaxInvoiceRc.tsx` — Integrated A4 TaxInvoiceA4 component as default print format, added format toggle, zoom controls, and print hotkey.
- `src/components/billing/propos/ProPosBillingTerm.tsx` — Added `[Alt+V] Preview Bill` button in checkout footer and registered global keyboard shortcut.
- `src/components/billing/propos/types.ts` — Extended `ProPosCustomer` with optional address metadata.
- `src/lib/apiFetchV1.ts` — Added `getAuthenticatedDocumentUrl`, `openAuthenticatedDocument`, and `syncAuthCookies`.
- `src/components/SalesStudioTab.tsx` — Updated document actions to use `openAuthenticatedDocument`.
- `backend/app/api/deps.py` — Added query param and cookie fallback for JWT token and tenant context, with active branch auto-resolution.
- `backend/app/services/invoice_pdf_service.py` — Aligned invoice lookup with branch alias resolution.
- `backend/app/middleware/rate_limiter.py` — Added graceful fallback when `slowapi` is not present.
- `backend/app/main.py` — Made rate limiter middleware registration conditional on availability.
- `docs/walkthrough/README.md` — Appended walkthrough entry and redacted public PII.

## 5. Architecture Decisions
- **Multi-Vector Document Authentication**: Browser navigations via `window.open` inherently do not send JavaScript `Authorization` headers. SMRITI enforces a multi-vector authentication model: primary `Authorization: Bearer <jwt>`, secondary query parameter `?token=<jwt>`, and tertiary `SameSite=Lax` browser cookies.
- **Single Source of Render Truth**: Both frontend client-side preview (`TaxInvoiceA4.tsx`) and backend PDF generation (`InvoicePdfService.generate_invoice_html`) follow the identical column structure and layout specifications defined by `invoice_TT2026-2027-138.pdf`.

## 6. Design Rationale
Previously, cashiers could only see an 80mm thermal receipt preview. For wholesale dispatches and commercial B2B invoicing, operators require an A4 tax invoice preview to verify GSTINs, HSN breakdown, and discount lines before final generation. Making A4 the default format aligns with commercial distribution standards while retaining thermal slips for quick retail checkout.

## 7. Implementation Summary
1. **Frontend Integration**:
   - `ProPosTaxInvoiceRc.tsx` now imports `TaxInvoiceA4.tsx` and defaults `printFormat` state to `"a4"`.
   - Toggle pill enables instant format switching without re-rendering or losing invoice state.
   - `Alt+V` in POS terminal provides instantaneous bill inspection.
2. **Backend Authentication Hardening**:
   - `deps.py` now resolves token from query params or cookies if header is absent.
   - Branch resolution automatically resolves to the company's active branch if unassigned or default.
   - `sales.py` preview, print, reprint, and download endpoints serve canonical HTML and PDF artifacts with 200 OK.

## 8. Tests Executed
- `npx vitest run src/tests/authenticatedDocumentUrl.test.ts src/tests/ttInvoiceBillingCalculation.test.ts` — 14/14 tests passed (0 failures).
- `npx vitest run` — 132/132 test files passed (875/875 tests passed).
- `npx tsc --noEmit` — Exited with code 0 (0 errors).
- `python -m py_compile backend/app/api/deps.py backend/app/services/invoice_pdf_service.py backend/app/middleware/rate_limiter.py backend/app/main.py` — 0 errors.
- End-to-end Python HTTP integration test:
  - `POST /api/v1/auth/login` → Status 200 OK
  - `GET /api/v1/sales/invoices?...&token=...` → Status 200 OK (300 invoices)
  - `GET /api/v1/sales/invoices/inv-dispatch-15092026-2-t25i/preview?token=...` → Status 200 OK (HTML length 84,066 bytes)
  - `GET /api/v1/sales/invoices/inv-dispatch-15092026-2-t25i/print?token=...` → Status 200 OK (HTML length 84,148 bytes)

## 9. Verification Results
- Zero `SMRITI-AUTH-001` errors during document print, preview, or export.
- Complete parity with `invoice_TT2026-2027-138.pdf`.
- 132/132 test files green across the codebase.

## 10. Known Limitations
- If a browser strictly blocks all popups (`window.open` returns null), the user is prompted to allow popups for the SMRITI domain.

## 11. Future Work
- Add user-level preference to remember the cashier's last chosen format (`A4` vs `Thermal`) across browser sessions.

## 12. Related ADRs
- `docs/architecture/decisions/ADR-005_One_Way_Projections_And_Statutory_Snapshot_Rule.md`

## 13. Related RFCs
- RFC-2026-GST-R46 Statutory Tax Invoice Serialization and Line Structure
