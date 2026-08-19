<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.0
  Created      : 2026-08-18
  Modified     : 2026-08-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Login → Company Database Selector → Dashboard Flow Walkthrough v3.25.0

## 1. Purpose
Documents the implementation and verification of the post-login Company Database Selector and unified context switching flow in SMRITI Retail OS.

## 2. Scope
- Filtering `GET /api/v1/auth/tenants` to return only authorized companies with `status = READY` in `company_database_registries`.
- New `CompanySelectionScreen.tsx` component supporting 1-company auto-select, multi-company card selection, and unassigned guidance states.
- Company selection gating in `App.tsx`.
- In-session company switcher integration with `POST /api/v1/auth/switch-context`.

## 3. Files Created
- `src/components/CompanySelectionScreen.tsx`
- `backend/app/tests/test_login_company_selector_flow.py`
- `docs/implementation/foundation/Login_Company_Selector_Flow_Plan_v3.25.0.md`
- `docs/walkthrough/foundation/Login_Company_Selector_Flow_v3.25.0.md`

## 4. Files Modified
- `backend/app/models/company_database_registry.py`
- `backend/app/api/v1/auth.py`
- `backend/app/tests/test_auth.py`
- `src/App.tsx`
- `src/components/layout/CompanySelector.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- Reused existing authoritative `companies` table, `company_database_registries` table, and `POST /api/v1/auth/switch-context` endpoint without introducing new duplicate models or database migrations.
- Guarded tenant options by joining `Company` with `CompanyDatabaseRegistry` on `status = 'READY'`.

## 6. Design Rationale
Ensures that operators are only ever routed to operational, provisioned databases and receive a cryptographically signed, company-scoped JWT upon selecting a business workspace.

## 7. Implementation Summary
- Refined `list_tenant_options` in `backend/app/api/v1/auth.py`.
- Developed `CompanySelectionScreen.tsx` with Fiori Horizon aesthetics.
- Added company context resolution gate in `App.tsx`.
- Updated `CompanySelector.tsx` to issue server-side context switch requests.

## 8. Tests Executed
- `pytest app/tests/test_auth.py`
- `pytest app/tests/test_multi_company_tenant_isolation.py`
- `pytest app/tests/test_login_company_selector_flow.py`
- `npm run build`

## 9. Verification Results
- 28 backend unit/integration tests passed (100% pass rate).
- Vite frontend production build compiled cleanly in 39.00s with zero errors.

## 10. Known Limitations
Custom per-company dashboards remain in Phase 2 as planned.

## 11. Future Work
- Phase 2: Per-company custom dashboard layouts and widget presets.
- Transition `CompanyDatabaseResolver` to fully asynchronous SQLAlchemy queries.

## 12. Related ADRs
- ADR-002: Multi-Company Control Plane Database Architecture

## 13. Related RFCs
- RFC-019: Post-Login Tenant Resolution and Scoped JWT Context
