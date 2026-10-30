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

# Implementation Plan: SMRITI Company Profile & Corporate Settings Subsystem (v1.0.0)

## 1. Objective
Establish an authoritative, database-backed Single System-of-Record in PostgreSQL for corporate identity, multi-branch network operations, statutory GST tax compliance, banking coordinates, and document branding across SMRITI Retail OS (`smritiNX` branch). Permanently eradicate hardcoded seller fallbacks across invoices, POS receipts, and Purchase Orders while guaranteeing strict historical document artifact immutability.

## 2. Business Motivation
In enterprise multi-tenant retail ERP systems, the corporate profile is the legal foundation for tax compliance, regulatory reporting, commercial banking settlements, and customer-facing store branding. Prior to this implementation, seller metadata in print templates and PDF rendering engines defaulted to static strings ("Tattly Threads", "27AAXFT2508H1ZR", "State Bank of India"), creating compliance risks, preventing proper tenant isolation, and blocking multi-branch operational setups.

## 3. Scope
- Alembic database migration `v1537_company_profile_foundation.py` adding 24 corporate attributes, 8 branch attributes, and foreign-key bank relationships across `smritisys` and `smriti001`.
- SQLAlchemy ORM models (`Company`, `Branch`, `BankAccount` relationship) and Pydantic v2 schemas (`CompanyProfileResponse`, `CompanyProfileUpdate`, `BranchCreateUpdate`, `BankAccountCreateUpdate`).
- Backend `CompanyProfileService` handling identity mutations, multi-branch updates, bank coordinate updates, and cryptographic SHA-256 hash-chaining into `compliance_immutable_audit_logs`.
- REST API router mounted at `/api/v1/company/profile` and `/api/v1/company/audit-trail` with `SYSADMIN`/`MANAGER` RBAC and SMRITI HREP error envelopes.
- Dynamic seller resolver (`seller_resolver.py`) with fail-closed validation blocking document issuance if corporate identity, GSTIN, address, or banking coordinates are missing.
- Dynamic wiring into print templates (`StandardInvoiceA4.tsx`, `PurchaseOrderPrintA4.tsx`, `FootwearPurchaseOrderA4.tsx`, `ThermalReceipt80mm.tsx`, `TaxInvoicePrintPag.tsx`) and backend PDF services (`invoice_pdf_service.py`, `sales_order_pdf_service.py`).
- Enterprise 7-tab GUI Studio `CompanyProfileStudio.tsx` registered in `TabRenderer.tsx`, `layout_store.tsx`, and `launchpadCatalog.ts`.
- Comprehensive automated verification via Pytest and Vitest test suites.

## 4. Current State
- `control_companies` in `smritisys` and `companies` in `smriti001` contained basic columns (`name`, `company_code`, `gst_number`, `address`, `currency_code`), but lacked statutory fields (`legal_name`, `trade_name`, `cin`, `pan`, `msme_reg_no`, `signatory_name`, `signature_url`, `stamp_url`).
- Print templates (`StandardInvoiceA4.tsx`, `PurchaseOrderPrintA4.tsx`, `FootwearPurchaseOrderA4.tsx`) fell back to static "Tattly Threads" string literals when metadata was absent.
- No dedicated studio existed in the frontend for managing company profiles, banking coordinates, and branch networks.

## 5. Gap Analysis
1. **Statutory Attribute Deficit:** Absence of structured address fields (`address_line1`, `address_line2`, `city`, `state_code`, `pincode`), MSME Udyam, CIN, and digital signatory URLs in the canonical schema.
2. **Hardcoded Document Identity:** 5 print templates and 2 backend PDF services contained static fallback constants.
3. **Missing Management UI:** Store managers and administrators had no GUI studio to configure corporate branding, bank accounts, or branch locations.
4. **Audit Non-Repudiation Gap:** Profile mutations were not cryptographically chained into `compliance_immutable_audit_logs`.

## 6. Architecture Impact
- **Database Schema:** 24 nullable/defaulted columns added to `companies`, 8 to `branches`, and foreign-key link to `company_bank_accounts`. Zero breaking changes to existing relations.
- **Backend Communication:** Single canonical REST endpoint `/api/v1/company/profile` handling GET and PUT.
- **Frontend State:** `persistTenantContext()` extended to cache corporate details in the browser session, enabling 0ms latency for document headers without recurring network fetches.
- **Document Rendering:** `seller_resolver.py` serves as the sole authoritative gateway for resolving supplier identity across both client-side React templates and backend headless Chromium PDF engines.

## 7. Proposed Design
- **7-Tab Studio Organization:**
  1. *Corporate Identity:* Legal name, trade name, CIN, business type, phone, email, website, contact person.
  2. *Address & Branches:* Primary HQ address + multi-branch CRUD manager.
  3. *Tax & Statutory:* 15-char GSTIN with regex validation, PAN auto-extraction, GST scheme, MSME reg, RCM default.
  4. *Banking Coordinates:* Default bank card + secondary accounts list with IFSC validation.
  5. *Branding & Documents:* Full-color logo, print monochrome logo, signature, seal/stamp, statutory invoice/PO terms.
  6. *Regional & Localization:* Base currency INR, timezone, financial year cycle, date/number formatting.
  7. *Change History:* Cryptographic audit trail from `compliance_immutable_audit_logs`.

## 8. Files Created
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
- `docs/implementation/foundation/Company_Profile_And_Corporate_Settings_Subsystem_Plan_v1.0.0.md`

## 9. Files Modified
- `backend/app/models/tenant.py`
- `backend/app/main.py`
- `backend/app/services/invoice_pdf_service.py`
- `backend/app/services/sales_order_pdf_service.py`
- `src/lib/apiFetchV1.ts`
- `src/print_engine/templates/StandardInvoiceA4.tsx`
- `src/print_engine/templates/PurchaseOrderPrintA4.tsx`
- `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`
- `src/print_engine/templates/ThermalReceipt80mm.tsx`
- `src/components/TaxInvoicePrintPag.tsx`
- `src/components/shell/TabRenderer.tsx`
- `src/layout_engine/layout_store.tsx`
- `src/components/launchpad/launchpadCatalog.ts`
- `src/tests/fioriLaunchpad.test.ts`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- PostgreSQL 15+ running on localhost:2781.
- SQLAlchemy 2.0 async engine with `asyncpg`.
- FastAPI backend framework.
- React 18 + Vite frontend runtime.
- Lucide React icon library.

## 11. Risks
- *Risk:* Concurrent updates to bank accounts by multiple administrators could create duplicate defaults.
  *Mitigation:* Single transaction lock ensuring setting one account as default resets `is_default=False` on all other accounts for that company.
- *Risk:* Invalid GSTIN or PAN format corrupting statutory reporting.
  *Mitigation:* Strict regex validation enforced simultaneously in Pydantic v2 schemas and frontend client state.

## 12. Rollback Strategy
- Alembic downgrade script restores table definitions to previous revision without data loss.
- Frontend fallback defaults ensure that if backend returns 500, cached tenant context continues to serve print engines.

## 13. Verification Plan
- Column-by-column schema diff against PostgreSQL `information_schema`.
- Pytest API test suite verifying RBAC, validation, and CRUD operations.
- Pytest unit & integration test suite verifying fail-closed seller resolution.
- Vitest test suite verifying Studio rendering, tab navigation, and context synchronization.
- TypeScript compiler (`tsc --noEmit`) and form registry validator verification.

## 14. Test Plan
- `backend/tests/test_company_profile_api.py` (4 tests).
- `backend/tests/test_seller_resolver.py` (6 tests).
- `src/tests/companyProfileStudio.test.tsx` (4 tests).
- `src/tests/fioriLaunchpad.test.ts` (11 tests).
- `src/tests/poPrintBrandingAndTerms.test.tsx` (8 tests).
- `src/tests/distTaxInvoiceStitchFlow.test.ts` (11 tests).

## 15. Documentation Impact
- Author formal walkthrough: `docs/walkthrough/setup/Setup_Company_Profile_And_Corporate_Settings_Studio_v6.92.0.md`.
- Append master walkthrough index: `docs/walkthrough/README.md`.
- Append master implementation index: `docs/implementation/README.md`.
- Update `CHANGELOG.md` under version [6.99.0].

## 16. Deployment Plan
1. Execute Alembic migration on `smritisys` and all active tenant databases (`smriti001`, `smriti002`, `smriti003`).
2. Deploy FastAPI backend services and verify `/api/v1/company/profile` health.
3. Build and deploy Vite frontend bundle (`npm run build`).
4. Perform end-to-end invoice print verification from live billing terminal.

## 17. Status
**Completed**

## 18. Related ADRs
- `ADR-042`: Enterprise Dynamic Seller Corporate Identity & Profile Governance
- `ADR-028`: FastAPI and PostgreSQL System of Record Architecture

## 19. Related Walkthroughs
- `docs/walkthrough/setup/Setup_Company_Profile_And_Corporate_Settings_Studio_v6.92.0.md`
- `docs/walkthrough/setup/Setup_Smriti_System_Parameters_And_Governance_Engine_v6.19.0.md`
