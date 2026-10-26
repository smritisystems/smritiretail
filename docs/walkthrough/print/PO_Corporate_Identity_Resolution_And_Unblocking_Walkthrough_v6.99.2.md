<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.2
  Created      : 2026-10-26
  Modified     : 2026-10-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough Document
-->

# Walkthrough: Purchase Order Corporate Identity Resolution and Unblocking v6.99.2

## 1. Purpose
This remediation resolves the `CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED` condition encountered during purchase order printing while preserving 100% of the statutory fail-closed safety guarantees established in `v6.92.0`. The root causes—inadvertent localStorage identity purging in `src/App.tsx`, absence of dynamic profile fetching in `POPrintPreviewModal.tsx`, residual hardcoded fallback identities in `FootwearPurchaseOrderA4.tsx` and `SizePivotMatrixA4.tsx`, and missing company metadata in auth tokens—have been holistically eliminated.

## 2. Scope
- Frontend tenant session persistence (`src/App.tsx`).
- Purchase Order print preview modal (`src/components/purchase/POPrintPreviewModal.tsx`).
- Print engine templates:
  - `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`
  - `src/print_engine/templates/SizePivotMatrixA4.tsx`
- Backend authentication schemas & service:
  - `backend/app/schemas/auth.py`
  - `backend/app/services/auth.py`
  - `backend/app/api/v1/auth.py`
- Verification test suites:
  - `src/tests/poPrintCorporateIdentityUnblocking.test.tsx`
  - `src/tests/printingFailClosedSafety.test.tsx`
  - `src/tests/poPrintBrandingAndTerms.test.tsx`
  - `backend/app/tests/test_auth.py`

## 3. Files Created
- `src/tests/poPrintCorporateIdentityUnblocking.test.tsx`
- `docs/walkthrough/print/PO_Corporate_Identity_Resolution_And_Unblocking_Walkthrough_v6.99.2.md`

## 4. Files Modified
- `src/App.tsx`
- `src/components/purchase/POPrintPreviewModal.tsx`
- `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`
- `src/print_engine/templates/SizePivotMatrixA4.tsx`
- `backend/app/schemas/auth.py`
- `backend/app/services/auth.py`
- `backend/app/api/v1/auth.py`
- `backend/app/tests/test_auth.py`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Preserve Statutory Fail-Closed Protection:** The `CORPORATE IDENTITY NOT CONFIGURED — PRINTING BLOCKED` barrier remains strictly enforced. If neither the Company Profile, tenant session context, nor document payload provides authoritative buyer identity, printing remains prohibited.
2. **Eliminate Accidental Cache Eviction:** `src/App.tsx` lines passing `null` to `persistTenantContext` were updated to pass `undefined` when auth fields are omitted, guaranteeing that `syncOptionalValue` preserves valid cached corporate identity rather than actively deleting `localStorage.removeItem("smriti_company_name")`.
3. **Multi-Source Identity Resolution with Graceful Asynchronous Fetch:** `POPrintPreviewModal.tsx` now evaluates corporate identity through an authoritative cascade:
   `customCompanyProfile` → `asyncCompanyProfile` (dynamically fetched from `/api/v1/company/profile`) → `tenantCtx` / `localStorage` → `document payload` (`header.companyName` or `header.billTo`).
4. **Backend Token & Profile Parity:** Enhanced `TokenResponse` and `UserResponse` with `company_name`, `company_code`, `branch_name`, and `branch_code`, returning authoritative corporate identity directly from `AuthService.login`, `AuthService.switch_context`, and `GET /api/v1/auth/me`.

## 6. Design Rationale
In retail operations, printing purchase orders with dummy or missing corporate buyer identities creates statutory liability under GST Section 31 and commercial contract law. Rather than removing the fail-closed protection, the proper architectural fix is to ensure the authoritative corporate profile is reliably wired from PostgreSQL into the frontend state and print preview pipeline.

## 7. Implementation Summary
- **App.tsx:** Corrected `persistTenantContext` parameters from `data.company_name ?? null` to `data.company_name ?? undefined`.
- **POPrintPreviewModal.tsx:** Added `asyncCompanyProfile` state and a proactive `useEffect` hook that queries `/api/v1/company/profile` if the tenant context cache is empty. Added document payload fallback (`header.companyName` and meaningful `header.billTo`). Updated `createPortal` to safely guard against SSR/non-DOM environments.
- **FootwearPurchaseOrderA4.tsx & SizePivotMatrixA4.tsx:** Removed residual hardcoded `"TATTLY THREADS"` fallbacks so empty strings cleanly trigger statutory blocking containers per specification. Exported `SizePivotMatrixData`.
- **backend/app/schemas/auth.py & services/auth.py & api/v1/auth.py:** Added `company_name`, `company_code`, `branch_name`, and `branch_code` to auth models and resolved them against the database in `login`, `switch_context`, and `get_me`.

## 8. Tests Executed
1. `npm run test -- src/tests/poPrintCorporateIdentityUnblocking.test.tsx` (7/7 passed).
2. `npm run test -- src/tests/printingFailClosedSafety.test.tsx` (6/6 passed, fixing previously failing tests 3 & 4).
3. `npm run test -- src/tests/poPrintBrandingAndTerms.test.tsx` (9/9 passed).
4. `npx tsc --noEmit` (0 TypeScript compilation errors across codebase).
5. `pytest backend/app/tests/test_auth.py -k "test_login_valid_credentials or test_get_me_authenticated"` (2/2 passed).

## 9. Verification Results
- All 22 frontend print engine and corporate identity tests passed with 100% green status.
- Backend auth endpoints validated returning authoritative company and branch names.
- Zero compile errors, zero runtime crashes, zero regressions.

## 10. Known Limitations
- If a tenant database has zero configured companies in the `companies` table, printing will remain blocked until the administrator configures the Company Profile in Company Profile Studio. This is expected by statutory policy.

## 11. Future Work
- Add an in-modal quick configuration shortcut for Managers to navigate directly to Company Profile Studio when printing is blocked.

## 12. Related ADRs
- `ADR-0042`: Fail-Closed Statutory Corporate Identity Protection.
- `ADR-0089`: Tenant Context Synchronization and Multi-Source Resolution.

## 13. Related RFCs
- `RFC-2026-0711`: Universal Author Details and File Header Policy (UADHP).
- `RFC-2026-1018`: Statutory Print Branding and Immutability Framework.
