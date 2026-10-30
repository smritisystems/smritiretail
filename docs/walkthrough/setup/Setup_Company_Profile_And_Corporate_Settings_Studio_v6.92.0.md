<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.92.0
  Created      : 2026-10-18
  Modified     : 2026-10-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Company Profile & Corporate Settings Subsystem (v6.92.0)

## 1. Purpose
This release implements the enterprise **SMRITI Company Profile & Corporate Settings Subsystem**, establishing an authoritative, database-backed Single System-of-Record for corporate identity, multi-branch network operations, statutory GST tax compliance, banking coordinates, and document branding. It eliminates all hardcoded seller references across billing, print templates, and PDF rendering pipelines while ensuring strict historical invoice immutability.

## 2. Scope
- Multi-tenant PostgreSQL database migration `v1537_company_profile_foundation.py` adding 24 corporate profile attributes, 8 branch attributes, and foreign-key bank relationships across `smritisys` and tenant databases (`smriti001`).
- SQLAlchemy ORM models (`Company`, `Branch`, `BankAccount` relationship) and Pydantic v2 schemas (`CompanyProfileResponse`, `CompanyProfileUpdate`, `BranchCreateUpdate`, `BankAccountCreateUpdate`).
- Backend `CompanyProfileService` handling identity mutations, multi-branch updates, bank coordinate updates, and cryptographic SHA-256 hash-chaining into `compliance_immutable_audit_logs`.
- REST API router mounted at `/api/v1/company/profile` and `/api/v1/company/audit-trail` with `SYSADMIN`/`MANAGER` RBAC and SMRITI HREP error envelopes.
- Dynamic seller resolver (`seller_resolver.py`) with fail-closed validation blocking issuance if corporate identity, GSTIN, address, or banking coordinates are missing.
- Dynamic wiring into print templates (`StandardInvoiceA4.tsx`, `PurchaseOrderPrintA4.tsx`, `FootwearPurchaseOrderA4.tsx`, `ThermalReceipt80mm.tsx`, `TaxInvoicePrintPag.tsx`) and backend PDF services (`invoice_pdf_service.py`, `sales_order_pdf_service.py`).
- Enterprise 7-tab GUI Studio `CompanyProfileStudio.tsx` registered in `TabRenderer.tsx`, `layout_store.tsx`, and `launchpadCatalog.ts`.
- Comprehensive automated verification via Pytest and Vitest test suites.

## 3. Files Created
- `backend/alembic/versions/v1537_company_profile_foundation.py`
- `backend/app/schemas/company_profile.py`
- `backend/app/services/company_profile_service.py`
- `backend/app/api/v1/company_profile.py`
- `backend/app/services/seller_resolver.py`
- `backend/tests/test_company_profile_api.py`
- `backend/tests/test_seller_resolver.py`
- `src/components/setup/CompanyProfileStudio.tsx`
- `src/tests/companyProfileStudio.test.tsx`
- `docs/walkthrough/setup/Setup_Company_Profile_And_Corporate_Settings_Studio_v6.92.0.md`

## 4. Files Modified
- `backend/app/models/tenant.py` (Added 24 company profile fields, 8 branch fields, bank_accounts ORM relationship)
- `backend/app/main.py` (Registered company_profile router under `/api/v1/company`)
- `backend/app/services/invoice_pdf_service.py` (Wired dynamic `resolve_seller_context_async`)
- `backend/app/services/sales_order_pdf_service.py` (Wired dynamic `resolve_seller_context_async`)
- `src/lib/apiFetchV1.ts` (Extended `persistTenantContext` and exported `getTenantCompanyContext`)
- `src/print_engine/templates/StandardInvoiceA4.tsx` (Replaced hardcoded seller text with dynamic context)
- `src/print_engine/templates/PurchaseOrderPrintA4.tsx` (Replaced hardcoded seller text with dynamic context)
- `src/print_engine/templates/FootwearPurchaseOrderA4.tsx` (Replaced hardcoded seller text with dynamic context)
- `src/print_engine/templates/ThermalReceipt80mm.tsx` (Replaced hardcoded seller text with dynamic context)
- `src/components/TaxInvoicePrintPag.tsx` (Replaced hardcoded seller text with dynamic context)
- `src/components/shell/TabRenderer.tsx` (Added company-profile aliases and lazy component rendering)
- `src/layout_engine/layout_store.tsx` (Registered company-profile workspace)
- `src/components/launchpad/launchpadCatalog.ts` (Registered company-profile Fiori launchpad tile)
- `src/tests/fioriLaunchpad.test.ts` (Added company-profile to registered app tabs verification)
- `docs/walkthrough/README.md` (Appended walkthrough master index entry)

## 5. Architecture Decisions
1. **PostgreSQL as Sole System of Record:** Rather than fragmenting company identity across multiple config files or local storage, all legal, trade, branch, and banking attributes reside exclusively in the canonical database (`companies`, `branches`, `company_bank_accounts`).
2. **Fail-Closed Compliance Gate:** Dynamic document issuance (`resolve_seller_context`) strictly enforces GST and corporate identity integrity. If corporate legal name, GSTIN, address, or banking coordinates are missing, issuance immediately halts with `InvoiceRenderError`.
3. **Immutable Historical Document Artifacts:** Issued tax invoices and sales orders capture immutable snapshots (`rule_snapshots` and `InvoiceDocumentArtifact` SHA-256 hashed files). Reprints verify the original hash and retrieve the immutable record without altering historical tax filings.
4. **Cryptographic Audit Trail:** Every profile mutation writes an event into `compliance_immutable_audit_logs` containing the actor, timestamp, updated fields, and a SHA-256 hash stamp for regulatory non-repudiation.
5. **Instant Frontend State Synchronization:** Upon saving in `CompanyProfileStudio`, `persistTenantContext()` immediately updates the active browser session cache so that all active print templates, receipt previews, and document headers reflect the updated corporate details without requiring application restart.

## 6. Design Rationale
In an enterprise retail ERP, the corporate identity defines the legal entity issuing fiscal invoices, filing GST returns, and collecting customer remittances. Prior to this release, branding elements and seller coordinates contained hardcoded fallbacks to "Tattly Threads". This implementation delivers full multi-company and multi-tenant flexibility while meeting strict Indian GST statutory rules (15-character GSTIN regex, 10-character PAN checksums, and 11-character RBI IFSC formats).

## 7. Implementation Summary
- Applied Alembic migration `v1537` across `smritisys` and `smriti001`.
- Built Pydantic v2 schemas with comprehensive regex validation.
- Created `CompanyProfileService` with hash-chained audit logging.
- Created `seller_resolver.py` providing synchronous and async resolution with structured address construction and default bank selection.
- Created `CompanyProfileStudio.tsx` featuring 7 dedicated tabs: Corporate Identity, Address & Branches, Tax & Statutory, Banking Coordinates, Branding & Documents, Regional & Localization, and Change History.
- Wired all 5 core print and PDF rendering pipelines to dynamically resolve active corporate identity.

## 8. Tests Executed
1. **Pytest Backend Test Suite (`backend/tests/test_company_profile_api.py` & `backend/tests/test_seller_resolver.py`):**
   - `test_01_get_company_profile_success`: PASSED
   - `test_02_put_company_profile_manager_and_sysadmin`: PASSED
   - `test_03_put_company_profile_validation_gstin_pan_ifsc`: PASSED
   - `test_04_put_company_profile_rbac_cashier_forbidden`: PASSED
   - `test_01_resolve_seller_context_unit_success`: PASSED
   - `test_02_resolve_seller_context_fail_closed_missing_company`: PASSED
   - `test_03_resolve_seller_context_fail_closed_missing_gstin`: PASSED
   - `test_04_resolve_seller_context_fail_closed_missing_address`: PASSED
   - `test_05_resolve_seller_context_fail_closed_missing_bank`: PASSED
   - `test_06_resolve_seller_context_async_db_integration`: PASSED
   **Result:** 10 passed in 19.52s.

2. **Vitest Frontend Test Suite (`src/tests/companyProfileStudio.test.tsx`, `fioriLaunchpad.test.ts`, `poPrintBrandingAndTerms.test.tsx`, `distTaxInvoiceStitchFlow.test.ts`):**
   - 34 passed in 1.13s (0 failed).

3. **TypeScript Compilation:**
   - `npx tsc --noEmit` passed with 0 errors across entire workspace.

## 9. Verification Results
- Database Column Parity: Column-by-column, datatype, and foreign-key parity verified across `smritisys` and `smriti001`.
- RBAC Enforcement: Verified `SYSADMIN` and `MANAGER` roles can modify profile; `CASHIER` role is blocked with HTTP 403 `SMRITI-PERM-003`.
- Zero Regressions: All existing print engine templates, Fiori launchpad tests, and invoice stitch flows passed.

## 10. Known Limitations
- High-resolution logo image uploads currently link via URL; binary file upload to S3/MinIO bucket will be integrated in subsequent cloud asset pipeline release.
- Digital DSC (Digital Signature Certificate) hardware token signing will be hooked into the backend PDF signer service in the upcoming compliance update.

## 11. Future Work
- Direct NIC/E-Way Bill and E-Invoice credential testing modal inside Tax & Statutory tab.
- Multi-currency rate table synchronization for international export invoices.

## 12. Related ADRs
- `ADR-042`: Enterprise Dynamic Seller Corporate Identity & Profile Governance
- `ADR-028`: FastAPI and PostgreSQL System of Record Architecture

## 13. Related RFCs
- `RFC-054`: Unified Multi-Branch Corporate Profile & Document Identity Architecture
