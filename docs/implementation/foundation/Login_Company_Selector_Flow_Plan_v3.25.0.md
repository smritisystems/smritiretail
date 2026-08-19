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

# SMRITI Login → Company Database Selector → Dashboard Implementation Plan v3.25.0

## 1. Objective
Implement the post-login **Company Database Selector → Dashboard** flow across SMRITI Retail OS based strictly on the single authoritative reconciled live architecture, providing seamless multi-tenant database routing and company selection without architectural duplication.

## 2. Business Motivation
Provide an enterprise post-authentication user experience where operators choose or auto-connect to their authorized company database workspace, guaranteeing tenant data isolation, server-side assignment enforcement, and company-scoped JWT tokens.

## 3. Scope
- Refine backend `GET /api/v1/auth/tenants` to return only active companies with `status = READY` in `company_database_registries`.
- Create `CompanySelectionScreen.tsx` supporting 1-company auto-select (Case B), multi-company card selection (Case C), and unassigned guidance (Case D).
- Integrate company selection gate into `App.tsx`.
- Update header `CompanySelector.tsx` to use `POST /api/v1/auth/switch-context` for live JWT re-issuance.

## 4. Current State
Previously, `LoginScreen` directly set `currentUser` and transitioned immediately to the Dashboard without a dedicated post-login company database selection gate. `CompanySelector.tsx` performed client-side localStorage overrides without re-issuing company-scoped JWT tokens.

## 5. Gap Analysis
- Absence of post-login company selection UX gate.
- `/auth/tenants` previously returned unregistered/test companies without filtering by active `READY` database status.
- In-session company switcher relied on page reloads rather than authoritative `/auth/switch-context` JWT re-issuance.

## 6. Architecture Impact
None. Reuses existing `companies`, `company_database_registries`, `AuthService.login()`, `AuthService.switch_context()`, and `get_tenant_context()` without schema migrations or duplicate models.

## 7. Proposed Design
```text
LOGIN → AUTHENTICATION SUCCESS → GET /auth/tenants (READY ONLY) → [AUTO-SELECT / CARD PICKER] → POST /auth/switch-context → SCOPED JWT → FIORI LAUNCHPAD
```

## 8. Files Created
- `src/components/CompanySelectionScreen.tsx`
- `backend/app/tests/test_login_company_selector_flow.py`
- `docs/implementation/foundation/Login_Company_Selector_Flow_Plan_v3.25.0.md`
- `docs/walkthrough/foundation/Login_Company_Selector_Flow_v3.25.0.md`

## 9. Files Modified
- `backend/app/models/company_database_registry.py`
- `backend/app/api/v1/auth.py`
- `backend/app/tests/test_auth.py`
- `src/App.tsx`
- `src/components/layout/CompanySelector.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
`fastapi`, `sqlalchemy`, `pydantic`, `react`, `motion/react`, `lucide-react`.

## 11. Risks
Low. All existing auth and tenant isolation tests continue to pass. Orphan records are filtered safely.

## 12. Rollback Strategy
Revert code changes via Git commit history if regressions occur.

## 13. Verification Plan
- Automated backend pytest test suites (`test_auth.py`, `test_multi_company_tenant_isolation.py`, `test_login_company_selector_flow.py`).
- Frontend production bundle build (`npm run build`).
- Live API endpoint validation.

## 14. Test Plan
Execute `pytest` across all authentication and tenant isolation tests, and execute Vite build.

## 15. Documentation Impact
Update implementation and walkthrough master indices.

## 16. Deployment Plan
Deploy updated FastAPI backend and React frontend production assets.

## 17. Status
Completed.

## 18. Related ADRs
- ADR-002: Multi-Company Control Plane Database Architecture

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Login_Company_Selector_Flow_v3.25.0.md`
