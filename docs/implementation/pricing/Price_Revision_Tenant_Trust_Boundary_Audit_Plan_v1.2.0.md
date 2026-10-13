<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.73.2
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Price Revision Tenant Trust-Boundary Audit & Remediation Plan (Phase 7)
-->

# Price Revision Tenant Trust-Boundary Audit & Remediation Plan (v1.2.0)

## 1. Objective
Perform an independent security audit and targeted code remediation on the Price Revision Module within branch `smritiNX`. Specifically, eradicate client-side tenant spoofing vectors (`effective_cid = company_id or req.company_id`), enforce fail-closed server-side tenant authentication, lock down test database isolation without shared-database overrides, and implement comprehensive API-level regression test coverage.

## 2. Business Motivation
SMRITI Retail OS operates in high-volume, multi-tenant retail environments. Tenant data leaks or cross-tenant pricing spoofing compromise data confidentiality, violate enterprise data sovereignty, and create regulatory non-compliance. In addition, automated test suites must never run against or mutate shared company databases (`smriti001`) or control-plane systems (`smritisys`).

## 3. Scope
- Inspect and remediate `backend/app/api/v1/pricing.py`, `backend/app/services/pricing_engine.py`, and `backend/app/db/session.py`.
- Reject requests with missing or unauthenticated tenant context (`SMRITI-PRICE-TENANT-REQUIRED`).
- Reject requests where client-supplied company ID differs from authenticated token (`SMRITI-PRICE-TENANT-MISMATCH`).
- Unconditionally block non-isolated database targets during testing in `get_company_async_engine`.
- Add 4 API-level spoofing and hierarchy tests in `backend/tests/test_price_revisions.py`.
- Preserve existing developer workspaces and user fixtures. Production release remains on HOLD.

## 4. Current State
- The Price Revision engine previously supported temporal revisions and volume breaks, but API endpoints utilized `effective_cid = company_id or req.company_id`.
- If server-side `company_id` was absent, client-supplied `req.company_id` was accepted.
- If client-supplied `req.company_id` differed from token `company_id`, the mismatch was silently ignored without error rejection.
- Automated tests had service-level tests, but lacked end-to-end API spoofing tests.

## 5. Gap Analysis
- **Gap 1 (Security - High)**: `_extract_user_info` defaulted `company_id` to `"COMP-001"`, failing open instead of failing closed when token lacked company claims.
- **Gap 2 (Security - High)**: `req.company_id` could be submitted with another tenant's ID without generating a 403 Forbidden error.
- **Gap 3 (Governance - Medium)**: `backend/app/db/session.py` contained an `os.getenv("ALLOW_SHARED_TEST_DB") != "1"` escape hatch and only enumerated `smriti001` and `smritisys`.
- **Gap 4 (Testing - Medium)**: Section 29 regression tests only executed direct Python service methods, leaving the HTTP API surface untested for spoofing.

## 6. Architecture Impact
- Re-establishes strict server-side tenant boundaries. Request body cannot override, switch, or supply tenant identity.
- Locks test harness to require dedicated isolated test databases (`smriti_test_*`), protecting live environments from test data contamination.

## 7. Proposed Design
- Implement `_validate_tenant_scope(auth_company_id: str, req_company_id: Optional[str]) -> str` in `pricing.py`.
- Require `company_id` to be present and non-empty in `_extract_user_info` and `_extract_user_and_role`.
- In `PricingEngine.calculate_bulk_pricing`, validate `req.company_id == resolved_cid`.
- In `backend/app/db/session.py`, require `re.match(r"^smriti_test_[a-z0-9_]+$", db_clean)` during testing with zero overrides.
- Add Section 30 API regression tests via `AsyncClient`.

## 8. Files Created
- `docs/walkthrough/pricing/Price_Revision_Tenant_Trust_Boundary_Audit_v1.2.0.md`
- `docs/implementation/pricing/Price_Revision_Tenant_Trust_Boundary_Audit_Plan_v1.2.0.md`

## 9. Files Modified
- `backend/app/api/v1/pricing.py`
- `backend/app/services/pricing_engine.py`
- `backend/app/db/session.py`
- `backend/tests/test_price_revisions.py`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI 0.115+
- SQLAlchemy 2.0+ (asyncpg)
- PostgreSQL 15+ (isolated test DB `smriti_test_price_revisions`)
- Pytest, HTTPX AsyncClient

## 11. Risks
- Risk: Valid client calls might send `company_id` in request body.
  - Mitigation: If `req.company_id` matches the authenticated tenant, it is accepted and validated without error.
- Risk: Test database contention.
  - Mitigation: `smriti_test_price_revisions` runs with isolated engine pools and per-test unique ID suffixes.

## 12. Rollback Strategy
- Changes are localized to Python API validation and session safety checks. Standard git branch revert can restore prior files without schema changes.

## 13. Verification Plan
- Run full pytest suite against `smriti_test_price_revisions`.
- Inspect pre/post row counts on shared database `smriti001` and control database `smritisys`.
- Run frontend vitest pricing tests and TypeScript compiler.

## 14. Test Plan
- Test 1: API `/resolve` with missing authenticated company -> 403 `SMRITI-PRICE-TENANT-REQUIRED`.
- Test 2: API `/resolve`, `/resolve/bulk`, `/snapshot` with cross-tenant `company_id` -> 403 `SMRITI-PRICE-TENANT-MISMATCH`.
- Test 3: API `/resolve` with valid company -> 200 OK.
- Test 4: API `/books`, `/tiers`, `/resolve` volume break & tier discount hierarchy -> 200 OK.

## 15. Documentation Impact
- Updated Walkthroughs index (`docs/walkthrough/README.md`).
- Updated Implementation Plans index (`docs/implementation/README.md`).
- Updated CHANGELOG (`CHANGELOG.md`).

## 16. Deployment Plan
- **Status: ON HOLD**.
- No deployment to production environments until independent database-integrity incident review and formal release sign-off are completed.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-042`: System Parameter Dual-Key Resolution
- `ADR-PR-001`: Statutory Ceiling Check Constraint
- `ADR-PR-005`: Authoritative Server-Side Tenant Trust Boundary
- `ADR-PR-006`: Unconditional Automated Test Database Isolation

## 19. Related Walkthroughs
- `docs/walkthrough/pricing/Price_Revision_Tenant_Trust_Boundary_Audit_v1.2.0.md`
- `docs/walkthrough/pricing/Price_Revision_Security_Hardening_And_Verification_v1.1.0.md`
