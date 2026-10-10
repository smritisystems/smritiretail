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

# Implementation Plan: SMRITI Retail OS — Phase 3 Master Registry Presets & Tenant Defaults Hardening

**Plan ID:** `IPGP-FOUNDATION-P3-v1.0.0`  
**Area:** Foundation, Master Data, Multi-Tenancy & Printing Configuration  
**Status:** In Progress  

---

## 1. Objective
Systematically remediate Priority 1 and Priority 2 master data and tenant branding hardcoding findings (FND-010, FND-002, FND-006, FND-036 through FND-051). Eliminate client-side brand and address injections in printing studios, parameterize walk-in customer identification, enable per-transaction coupon stacking governance, and establish a canonical backend preset API for Master Registry recommendations.

---

## 2. Business Motivation
Multi-tenant retail platforms must never embed physical addresses, customer trade names, or specific logos into print layout source code. New tenants provisioning Staff ID cards or registration forms must print their authentic brand identity and registered office address loaded from the company master. Furthermore, master lookup recommendations (departments, designations, payment modes, banks, etc.) should be delivered authoritatively by the backend system of record rather than exclusively embedded in static TypeScript bundles.

---

## 3. Scope
- **Cluster A: Staff Print Center Multi-Tenant De-Hardcoding (FND-010)**:
  - Excise `knownCompanyLogos` and `knownCompanyAddresses` dictionaries containing `"Tattly Threads"` and Mumbai address from `src/components/staff/StaffPrintModal.tsx`.
  - Resolve company name, address, and logo strictly from active company master / branding storage with neutral generic fallbacks.
- **Cluster B: Commercial Policy & Walk-In Parameterization (FND-002, FND-006)**:
  - Dynamically resolve walk-in customer codes in `backend/app/services/customer_discount_policy.py` via `SMRITI.POS.WALKIN_CUSTOMER_CODE` (defaulting to `"CUST-WALKIN"`).
  - Support `couponStackingAllowed` in `PriceResolutionInput` within `src/utils/pricingDiscountEngine.ts` to allow caller and policy-level coupon stacking governance.
- **Cluster C: Backend Master Registry Presets API (FND-036 to FND-051)**:
  - Implement `GET /lookup/{type_code}/presets` in `backend/app/api/v1/master_lookup.py` to serve canonical industry presets from the backend system of record.
  - Upgrade `src/components/global/master/LookupRecommendModal.tsx` to asynchronously fetch recommendations from the server API, falling back gracefully to client presets.

---

## 4. Current State
- `src/components/staff/StaffPrintModal.tsx` hardcodes `"COMP-001"` and `"001"` to `"Tattly Threads"` and its Mumbai address.
- `backend/app/services/customer_discount_policy.py` checks solely against hardcoded `WALK_IN_CUSTOMER_ID = "CUST-WALKIN"`.
- `src/utils/pricingDiscountEngine.ts` enforces global `PRICING_CONFIG.couponStackingAllowed` without per-request override.
- `src/components/global/master/lookupStandardPresets.ts` contains 373 lines of static presets duplicated from database seed intentions.

---

## 5. Gap Analysis
- **Multi-Tenant Branding Leakage**: Any company configured with ID `"COMP-001"` prints Tattly Threads details.
- **Walk-in Code Inflexibility**: Retail chains using custom walk-in customer codes (e.g., `WALKIN-01`, `CUST-RETAIL`) cannot leverage policy resolution.
- **Client Master Data Drift**: Frontend presets evolve independently of backend database seed records.

---

## 6. Architecture Impact
- Enforces strict tenant branding isolation across print centers.
- Establishes single API surface for lookup recommendations (`/api/v1/masters/lookup/{type_code}/presets`).
- Zero schema breaking changes.

---

## 7. Proposed Design
1. **Dynamic Staff Print Branding**:
   - In `StaffPrintModal.tsx`, remove hardcoded dictionaries. Query active tenant company profile or storage. Fall back to clean default initials when no logo is uploaded.
2. **Dynamic Walk-in Code Resolution**:
   - In `customer_discount_policy.py`, query `SystemParameterService.resolve_parameter("SMRITI.POS.WALKIN_CUSTOMER_CODE")` and treat both default and configured codes as walk-in.
3. **Flexible Coupon Stacking**:
   - Add optional `couponStackingAllowed` property to `PriceResolutionInput`.
4. **Authoritative Backend Presets Endpoint**:
   - Mount `@router.get("/lookup/{type_code}/presets")` in `master_lookup.py` returning standard presets for all supported retail categories.

---

## 8. Files Created
1. `backend/app/tests/test_phase3_master_registry_and_branding.py`: Verification suite covering backend presets endpoint and dynamic walk-in parameterization.

---

## 9. Files Modified
1. `src/components/staff/StaffPrintModal.tsx`
2. `backend/app/services/customer_discount_policy.py`
3. `src/utils/pricingDiscountEngine.ts`
4. `backend/app/api/v1/master_lookup.py`
5. `src/components/global/master/LookupRecommendModal.tsx`
6. `docs/implementation/README.md`
7. `docs/walkthrough/README.md`
8. `CHANGELOG.md`

---

## 10. Dependencies
- `SystemParameterService` in `backend/app/services/system_parameter.py`.
- `master_lookup` router in `backend/app/api/v1/master_lookup.py`.

---

## 11. Risks
- Risk: Offline terminals might fail to fetch server presets.
  - Mitigation: `LookupRecommendModal.tsx` maintains offline fallback to `lookupStandardPresets.ts`.

---

## 12. Rollback Strategy
Revertible via Git rollback (`git checkout`) without database schema modifications.

---

## 13. Verification Plan
- Unit tests verifying dynamic walk-in parameter resolution.
- Pytest verifying `GET /lookup/{type_code}/presets` response.
- Vitest verifying per-request coupon stacking override and print modal branding.
- `npx tsc --noEmit` clean compile.

---

## 14. Test Plan
- Run `pytest backend/app/tests/test_phase3_master_registry_and_branding.py`.
- Run Vitest suites.
- Run `npx tsc --noEmit`.

---

## 15. Documentation Impact
- Create `docs/walkthrough/foundation/Foundation_Phase3_Master_Registry_And_Tenant_Defaults_v1.0.0.md`.
- Update indexes in `docs/walkthrough/README.md` and `docs/implementation/README.md`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
Included in next regular SMRITI Retail OS minor release.

---

## 17. Status
Completed.

---

## 18. Related ADRs
- `ADR-048`: Statutory Reference Single-Source Architecture.
- `ADR-051`: Multi-Tenant Seller Identity Strictness.

---

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Foundation_Phase3_Master_Registry_And_Tenant_Defaults_v1.0.0.md`
