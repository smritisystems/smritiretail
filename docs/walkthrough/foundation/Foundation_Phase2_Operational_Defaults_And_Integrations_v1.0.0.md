<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-09
  Modified     : 2026-10-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Walkthrough (WGP)
-->

# Walkthrough: SMRITI Retail OS — Phase 2 Operational Defaults, Integrations & Governance Configuration Hardening

**Walkthrough ID:** `WGP-FOUNDATION-P2-v1.0.0`  
**Area:** Foundation, Security, Integrations & Operational Governance  
**Status:** Completed & Accepted  

---

## 1. Purpose
This walkthrough documents the full implementation and verification of Phase 2 Operational Defaults, Integrations & Governance Configuration Hardening in SMRITI Retail OS. Phase 2 systematically addresses Priority 2 (P2) forensic audit findings, making JWT authentication token lifetimes dynamically configurable via system parameters, automating statutory Indian financial year computation, formalizing dead Express cutover feature flag retirement, and establishing canonical constants across staff profile models.

---

## 2. Scope
The scope encompasses three operational clusters:
- **Cluster A: Security, Auth & Token Lifecycle Configuration (FND-029, FND-030)**:
  - Enabled dynamic expiration overrides in `backend/app/core/security.py` for `create_access_token` and `create_refresh_token`.
  - Added `_resolve_token_expirations` in `AuthService` (`backend/app/services/auth.py`) querying tenant system parameters `SMRITI.AUTH.TOKEN_EXPIRE_MINUTES` and `SMRITI.AUTH.REFRESH_TOKEN_EXPIRE_DAYS` with fallback to `settings`.
  - Passed tenant-specific expirations through `sign_in`, `switch_context`, and `refresh` token generation pathways.
- **Cluster B: Integrations, Schedulers & Flags Governance (FND-034, FND-064)**:
  - Formally annotated and documented dead cutover flags in `src/config/flags.ts` with `@deprecated` referencing ADR-045 and Express full decommissioning.
- **Cluster C: Financial Year Engine & Model Defaults (FND-053, FND-021, FND-022, FND-023)**:
  - Upgraded `src/components/billing/SmritiDefineBillPrefixModal.tsx` to compute current Indian financial year (`getCurrentFinancialYear()`, April 1 to March 31), replacing hardcoded `"2026-2027"` and `"26-27"` with dynamic values.
  - Defined canonical model constants `DEFAULT_STAFF_COUNTRY`, `DEFAULT_STAFF_EMPLOYMENT_TYPE`, and `DEFAULT_STAFF_STATUS` in `backend/app/models/staff_profile.py`.

---

## 3. Files Created
1. `backend/app/tests/test_phase2_operational_defaults.py`: Verification test suite validating custom token lifetimes, fallback behaviors, `AuthService` parameter resolution, and `StaffProfile` model defaults.
2. `docs/implementation/foundation/Foundation_Phase2_Operational_Defaults_And_Integrations_Plan_v1.0.0.md`: Formal 19-section Implementation Plan per IPGP.
3. `docs/walkthrough/foundation/Foundation_Phase2_Operational_Defaults_And_Integrations_v1.0.0.md`: This canonical walkthrough document.

---

## 4. Files Modified
1. `backend/app/core/security.py`
2. `backend/app/services/auth.py`
3. `backend/app/models/staff_profile.py`
4. `src/components/billing/SmritiDefineBillPrefixModal.tsx`
5. `src/config/flags.ts`
6. `src/tests/pricingDiscountEngine.test.ts`
7. `docs/implementation/README.md`
8. `docs/walkthrough/README.md`
9. `CHANGELOG.md`

---

## 5. Architecture Decisions
- **Backward-Compatible Parameter Resolution**: When no tenant parameter is explicitly set in `system_parameters`, the system falls back transparently to container-level environment settings (`settings.ACCESS_TOKEN_EXPIRE_MINUTES` = 480, `settings.REFRESH_TOKEN_EXPIRE_DAYS` = 7), preventing breaking changes for default installations.
- **Statutory Financial Calendar Derivation**: All fiscal year strings derive deterministically from client date month: months 4–12 (April–December) belong to `YYYY-(YYYY+1)`, while months 1–3 (January–March) belong to `(YYYY-1)-YYYY`.
- **Express Cutover Flag Freezing (ADR-045)**: Cutover flags are frozen with explicit deprecation documentation rather than breaking TypeScript consumers.

---

## 6. Design Rationale
Hardcoded 8-hour token limits and static calendar years restrict multi-tenant operations. Enterprise tenants operating 12-hour shifts or requiring 2-hour high-security timeouts now configure them per company without recompilation or server restarts.

---

## 7. Implementation Summary
- **Dynamic JWT Encoding**: Extended `create_access_token` and `create_refresh_token` to accept optional `expires_minutes` and `expires_days`.
- **Auth Service Integration**: Added `_resolve_token_expirations` resolving `SMRITI.AUTH.TOKEN_EXPIRE_MINUTES` and `SMRITI.AUTH.REFRESH_TOKEN_EXPIRE_DAYS` from `SystemParameterService`.
- **Bill Prefix Modal**: Exported `getCurrentFinancialYear()` returning `{ fy, suffix }` dynamically computed from current date.
- **Staff Profile Constants**: Defined `DEFAULT_STAFF_COUNTRY = "India"`, `DEFAULT_STAFF_EMPLOYMENT_TYPE = "Permanent"`, `DEFAULT_STAFF_STATUS = "Active"`.

---

## 8. Tests Executed
1. **Backend Pytest Suite**:
   - `pytest backend/app/tests/test_phase2_operational_defaults.py`
   - `pytest backend/app/tests/test_phase1_operational_hardening.py`
   - `pytest backend/app/tests/test_gst_engine.py`
   - `pytest backend/app/tests/test_customer_discount_policy.py`
   - `pytest backend/app/tests/test_max_discount_cap.py`
   - `pytest backend/app/tests/test_negative_stock_policy.py`
   - **Result**: 32 passed in 4.25s.
2. **Frontend Vitest Suite**:
   - `vitest run src/tests/pricingDiscountEngine.test.ts src/tests/salesAuditAndFormatters.test.ts`
   - **Result**: 26 passed in 763ms.
3. **TypeScript Static Analysis**:
   - `npx tsc --noEmit`
   - **Result**: Exit code 0 (zero errors).

---

## 9. Verification Results
- Dynamic token lifetime verified with 60-minute custom access token encoding and 14-day refresh token encoding.
- `AuthService` parameter resolution confirmed querying `SystemParameterService`.
- `getCurrentFinancialYear` verified generating valid statutory Indian financial year pairs.
- Zero TypeScript compiler regressions.

---

## 10. Known Limitations
- Background outbox worker daemon retry limits (`MAX_RETRIES = 5`) remain class-level defaults until Phase 3 outbox parameterization.

---

## 11. Future Work
- Phase 3 Master Registry Presets & Database Seed Migration: Transition 373 lines of hardcoded lookup presets in `lookupStandardPresets.ts` to backend `master_values` migrations.

---

## 12. Related ADRs
- `ADR-032`: System Parameter Hierarchy (Terminal > Branch > Company > Global).
- `ADR-045`: Express Decommissioning & Sole FastAPI Runtime Architecture.

---

## 13. Related RFCs
- `RFC-2026-08`: Elimination of Static Master Data and Hardcoded Commercial Policies in SMRITI Retail OS.
