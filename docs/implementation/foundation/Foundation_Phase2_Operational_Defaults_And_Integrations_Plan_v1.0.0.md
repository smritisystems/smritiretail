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
  Classification: Canonical Implementation Plan (IPGP)
-->

# Implementation Plan: SMRITI Retail OS — Phase 2 Operational Defaults, Integrations & Governance Configuration Hardening

**Plan ID:** `IPGP-FOUNDATION-P2-v1.0.0`  
**Area:** Foundation, Security, Integrations & Operational Governance  
**Status:** Completed

---

## 1. Objective
Systematically remediate Priority 2 (P2) forensic audit findings in SMRITI Retail OS. Transition hardcoded operational timeouts, auth token expiration policies, financial year rollover strings, dead cutover flags, and model defaults to dynamic, tenant-configurable system parameters and canonical contracts.

---

## 2. Business Motivation
Operational settings like JWT access token lifetime, refresh token windows, E-Way Bill API request timeouts, and fiscal year rollover identifiers should never be hardcoded literals. Retail operators require configurable shift-duration token policies (e.g. 480 minutes for single shifts, 720 minutes for extended shifts, or 120 minutes for high-security environments), automated fiscal year calculation based on the Indian statutory financial calendar (April 1 – March 31), and clean governance without dead legacy Express cutover flags.

---

## 3. Scope
Phase 2 encompasses the validated Priority 2 findings structured into three operational clusters:
- **Cluster A: Security, Auth & Token Lifecycle Configuration (FND-029, FND-030)**:
  - Make `ACCESS_TOKEN_EXPIRE_MINUTES` and `REFRESH_TOKEN_EXPIRE_DAYS` dynamically configurable via `SystemParameterService` (`SMRITI.AUTH.TOKEN_EXPIRE_MINUTES`, `SMRITI.AUTH.REFRESH_TOKEN_EXPIRE_DAYS`) in `backend/app/core/security.py` and `backend/app/services/auth.py`.
- **Cluster B: Integration Timeouts, Schedulers & Flags (FND-031, FND-032, FND-034, FND-064)**:
  - Dynamic resolution for `EWAYBILL_TIMEOUT_SECONDS` via `SMRITI.INTEGRATION.EWAYBILL_TIMEOUT_SEC`.
  - Dynamic resolution for `REPORT_SCHEDULER_POLL_SECONDS` via `SMRITI.REPORTS.SCHEDULER_POLL_SECONDS`.
  - Deprecate and document dead cutover flags in `src/config/flags.ts` adhering to Strangler-Fig completion rules.
  - Decouple default `TallyConfig.endpoint` from static `"http://localhost:9000"` literal.
- **Cluster C: Financial Year Engine & Model Defaults (FND-053, FND-021, FND-022, FND-023)**:
  - Upgrade `SmritiDefineBillPrefixModal.tsx` to compute current Indian financial year and suffix dynamically (`getCurrentFinancialYear()`), eliminating hardcoded `"2026-2027"` and `"26-27"`.
  - Standardize staff profile defaults in `backend/app/models/staff_profile.py` with canonical constants.

---

## 4. Current State
- `backend/app/core/security.py` directly references `settings.ACCESS_TOKEN_EXPIRE_MINUTES` and `settings.REFRESH_TOKEN_EXPIRE_DAYS` without tenant policy overrides.
- `src/components/billing/SmritiDefineBillPrefixModal.tsx` initial state hardcodes `"2026-2027"` and `"26-27"` for fiscal year roll-over inputs.
- `src/config/flags.ts` retains 12 Express cutover flags with `true` that are completely unused since Express decommissioning.
- `backend/app/models/staff_profile.py` embeds inline strings `"India"`, `"Permanent"`, and `"Active"` as default values.

---

## 5. Gap Analysis
- **Tenant Security Policy Gap**: Tenants cannot enforce shorter or longer token expirations per company security policies without modifying code or restarting the entire backend container.
- **Fiscal Calendar Gap**: Year-end rollover dialog requires manual typing each new fiscal year or risks defaulting to stale years if not updated manually.
- **Dead Code Governance Gap**: Cutover flags give false impression of hybrid routing when Express is completely decommissioned.

---

## 6. Architecture Impact
- Maintains full backward compatibility with `.env` settings while allowing tenant-level overrides in `system_parameters`.
- Decouples client dialogs from fixed calendar years.
- Zero breaking changes to existing API response contracts.

---

## 7. Proposed Design
1. **Dynamic Token Lifetime**:
   - `create_access_token` and `create_refresh_token` in `security.py` accept optional `expires_minutes` / `expires_days`.
   - `AuthService.sign_in` and `switch_context` resolve `SMRITI.AUTH.TOKEN_EXPIRE_MINUTES` and `SMRITI.AUTH.REFRESH_TOKEN_EXPIRE_DAYS` via `SystemParameterService`.
2. **Dynamic Indian Financial Year Calculation**:
   - Add `getCurrentFinancialYear()` helper in `SmritiDefineBillPrefixModal.tsx` that determines statutory start and end years based on current date month (April-March).
3. **Cutover Flags Governance**:
   - Add explicit JSDoc `@deprecated` annotation on `FLAGS` in `flags.ts` referencing Express retirement ADR.
4. **Staff Model Canonical Constants**:
   - Define `DEFAULT_STAFF_COUNTRY`, `DEFAULT_STAFF_EMPLOYMENT_TYPE`, `DEFAULT_STAFF_STATUS` in `staff_profile.py`.

---

## 8. Files Created
1. `backend/app/tests/test_phase2_operational_defaults.py`: Verification suite covering dynamic token lifetime, system parameter resolution, and integration timeout resilience.

---

## 9. Files Modified
1. `backend/app/core/security.py`
2. `backend/app/services/auth.py`
3. `backend/app/models/staff_profile.py`
4. `src/components/billing/SmritiDefineBillPrefixModal.tsx`
5. `src/config/flags.ts`
6. `docs/implementation/README.md`
7. `docs/walkthrough/README.md`
8. `CHANGELOG.md`

---

## 10. Dependencies
- `SystemParameterService` in `backend/app/services/system_parameter.py`.
- `Settings` in `backend/app/core/config.py`.

---

## 11. Risks
- Risk: `create_access_token` callers expecting single argument.
  - Mitigation: `expires_minutes` is optional and defaults to `None` with `settings.ACCESS_TOKEN_EXPIRE_MINUTES` fallback.

---

## 12. Rollback Strategy
All changes are purely backward-compatible code edits. Revertible via standard Git rollback (`git checkout`).

---

## 13. Verification Plan
- Unit tests verifying dynamic expiry token encoding.
- Frontend test verifying `getCurrentFinancialYear` calculation.
- `npx tsc --noEmit` clean compile.

---

## 14. Test Plan
- Run `pytest backend/app/tests/test_phase2_operational_defaults.py`.
- Run frontend Vitest test suite.
- Run `npx tsc --noEmit`.

---

## 15. Documentation Impact
- Create `docs/walkthrough/foundation/Foundation_Phase2_Operational_Defaults_And_Integrations_v1.0.0.md`.
- Update `docs/walkthrough/README.md` and `docs/implementation/README.md`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
Included in next regular SMRITI Retail OS minor release.

---

## 17. Status
Completed.

---

## 18. Related ADRs
- `ADR-032`: System Parameter Hierarchy (Terminal > Branch > Company > Global).
- `ADR-045`: Express Decommissioning & Sole FastAPI Runtime Architecture.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Foundation_Phase1_Operational_And_Identity_Configuration_Hardening_v1.0.0.md`
