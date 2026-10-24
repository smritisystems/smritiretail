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
  Classification: Price Revision Tenant Trust-Boundary Audit & Remediation (Phase 7)
-->

# Price Revision Tenant Trust-Boundary Audit & Remediation Walkthrough (v1.2.0)

## 1. Purpose
This walkthrough documents the independent verification and targeted remediation of the SMRITI Price Revision Module's tenant trust boundary and test database isolation. It closes the auditor findings regarding `effective_cid = company_id or req.company_id` fallback vulnerabilities, enforces authoritative server-side tenant scoping, eliminates shared-database test overrides, and establishes end-to-end API-level spoofing regression tests.

## 2. Scope
- Audit and remediation of tenant identity resolution across `backend/app/api/v1/pricing.py`, `backend/app/services/pricing_engine.py`, and `backend/app/db/session.py`.
- Elimination of client-supplied `req.company_id` fallback in pricing resolution endpoints (`/resolve`, `/resolve/bulk`, `/snapshot`).
- Fail-closed enforcement of `SMRITI-PRICE-TENANT-REQUIRED` (HTTP 403) when trusted tenant context is missing.
- Fail-closed enforcement of `SMRITI-PRICE-TENANT-MISMATCH` (HTTP 403) when client payload passes a company differing from the authenticated token.
- Tenant scoping of Price Book and Customer Price Tier list queries (`/books`, `/tiers`).
- Unconditional test database isolation in `backend/app/db/session.py`, removing `ALLOW_SHARED_TEST_DB` override flags and strictly requiring `smriti_test_*` databases during automated test execution.
- Addition of 4 end-to-end API regression tests via `AsyncClient` verifying spoofing rejection, valid pricing, and multi-tier pricing hierarchies.

## 3. Files Created
- `docs/walkthrough/pricing/Price_Revision_Tenant_Trust_Boundary_Audit_v1.2.0.md`
- `docs/implementation/pricing/Price_Revision_Tenant_Trust_Boundary_Audit_Plan_v1.2.0.md`

## 4. Files Modified
- `backend/app/api/v1/pricing.py`
- `backend/app/services/pricing_engine.py`
- `backend/app/db/session.py`
- `backend/tests/test_price_revisions.py`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **ADR-PR-005: Authoritative Server-Side Tenant Trust Boundary**: The authenticated token identity is solely authoritative. Client payloads may never supply a tenant context to replace missing server context, nor may they switch tenants. Any mismatch triggers immediate HTTP 403 rejection.
- **ADR-PR-006: Unconditional Automated Test Database Isolation**: Automated tests are strictly prohibited from targeting shared company databases (`smriti001`, `smriti002`, etc.) or the control plane database (`smritisys`). No environment variable escape hatches (`ALLOW_SHARED_TEST_DB`) are permitted. Test targets must strictly match `^smriti_test_[a-z0-9_]+$`.

## 6. Design Rationale
- Previously, `effective_cid = company_id or req.company_id` allowed unauthenticated requests or requests with an empty tenant context to inherit tenant identity from the unverified request body. Furthermore, if an authenticated user from Company A passed Company B in `req.company_id`, the mismatch was silently ignored rather than actively blocked.
- Removing default `"COMP-001"` fallbacks from `_extract_user_info` and `_extract_user_and_role` ensures fail-closed behavior across all pricing routes.
- Adding `except HTTPException: raise` in endpoint exception handlers prevents FastAPI `HTTPException` (such as 403 Forbidden) from being trapped by broad `except Exception` clauses and transformed into generic HTTP 500 errors.

## 7. Implementation Summary
1. **User Identity Extraction Hardening (`pricing.py`)**:
   - `_extract_user_info` and `_extract_user_and_role` validate that `company_id` is non-empty. If missing or whitespace, raises HTTP 403 `SMRITI-PRICE-TENANT-REQUIRED`.
   - `_validate_tenant_scope(auth_company_id, req_company_id)` verifies that if `req_company_id` is supplied, it strictly matches `auth_company_id`. Otherwise, raises HTTP 403 `SMRITI-PRICE-TENANT-MISMATCH`.
2. **Pricing Endpoints Update (`pricing.py`)**:
   - `/resolve`, `/resolve/bulk`, and `/snapshot` use `_validate_tenant_scope(company_id, req.company_id)`.
   - `list_price_books` and `list_customer_tiers` filter strictly by `company_id` and `is_deleted == False`.
   - All endpoint routes re-raise `HTTPException` explicitly.
3. **Engine Scoping (`pricing_engine.py`)**:
   - In `calculate_bulk_pricing`, removed fallback to `req.company_id`. Added explicit validation that `req.company_id == resolved_cid`.
4. **Database Test Isolation Guard (`session.py`)**:
   - In `get_company_async_engine`, during `_is_testing()`, any database not matching `^smriti_test_[a-z0-9_]+$` is blocked with `RuntimeError`.
   - Removed `ALLOW_SHARED_TEST_DB` override.
   - Enforced verification on `company_eng.url.database`.
5. **API Regression Tests (`test_price_revisions.py`)**:
   - Added Section 30 with 4 comprehensive API tests using `AsyncClient(transport=ASGITransport(app=app))`.

## 8. Tests Executed
1. `pytest backend/tests/test_price_revisions.py -v` (37/37 tests passed)
2. `vitest run src/tests/dynamicPricing.integration.test.ts src/tests/priceOverride.integration.test.ts src/tests/custPriceGrp.test.ts src/tests/proposCatalogCache.test.ts src/tests/smritiSalesFactorEngine.test.ts` (73/73 tests passed)
3. `npx tsc --noEmit --skipLibCheck` (0 errors)
4. `py_compile backend/app/api/v1/pricing.py backend/app/services/pricing_engine.py backend/app/db/session.py backend/tests/test_price_revisions.py` (0 errors)
5. Shared Database Zero-Mutation Verification on `smriti001` and `smritisys` (0 alterations)

## 9. Verification Results
- **API Spoofing Rejected**: Missing auth token company returns HTTP 403 `SMRITI-PRICE-TENANT-REQUIRED`. Cross-tenant company ID injection returns HTTP 403 `SMRITI-PRICE-TENANT-MISMATCH`.
- **Valid API Pricing Verified**: Same-company pricing via `/resolve`, `/resolve/bulk`, and `/snapshot` succeeds with HTTP 200.
- **Hierarchy Verified via API**: Price Book volume breaks and Customer Price Tier percentage discounts resolve accurately through the REST API layer.
- **Database Isolation Verified**: Automated tests execute against isolated `smriti_test_price_revisions`. Shared databases `smriti001` and `smritisys` preserved with 0 mutations.

## 10. Known Limitations
- Release status remains **ON HOLD** pending independent database-integrity incident review and formal management sign-off.
- Production deployment is strictly deferred.

## 11. Future Work
- Continuous monitoring via CI tenant boundary automated guards (`scripts/ci_tenant_boundary_guard.py`).
- Automated periodic reconciliation audits between catalog baselines and revision history.

## 12. Related ADRs
- `ADR-042`: System Parameter Dual-Key Resolution
- `ADR-PR-001`: Statutory Ceiling Check Constraint
- `ADR-PR-005`: Authoritative Server-Side Tenant Trust Boundary
- `ADR-PR-006`: Unconditional Automated Test Database Isolation

## 13. Related RFCs
- `RFC-PRICE-2026-01`: SMRITI Temporal Price Revision Engine Specification
- `RFC-TENANT-2026-02`: Multi-Tenant Authorization and Boundary Enforcement Standard
