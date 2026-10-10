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

# Walkthrough: SMRITI Retail OS — Phase 3 Master Registry Presets & Tenant Defaults Hardening

**Walkthrough ID:** `WGP-FOUNDATION-P3-v1.0.0`  
**Area:** Foundation, Master Data, Multi-Tenancy & Printing Configuration  
**Status:** Completed & Accepted  

---

## 1. Purpose
This walkthrough documents the full implementation, architectural hardening, and verification of Phase 3 Master Registry Presets & Tenant Defaults in SMRITI Retail OS. Phase 3 systematically remediated findings FND-010, FND-002, FND-006, and FND-036 through FND-051, eliminating client-side tenant branding leakages from print layouts, parameterizing walk-in customer identification, enabling per-transaction coupon stacking governance, and establishing an authoritative backend system-of-record presets API for Master Registry recommendations.

---

## 2. Scope
The scope encompasses three primary architectural clusters across frontend and backend surfaces:
- **Cluster A: Staff Print Center Multi-Tenant De-Hardcoding (FND-010)**:
  - Excised `knownCompanyLogos` and `knownCompanyAddresses` dictionaries containing `"Tattly Threads"` and Mumbai address from `src/components/staff/StaffPrintModal.tsx`.
  - Dynamically resolved company name, address, and logo strictly from active company master / branding configuration with clean neutral fallbacks.
- **Cluster B: Commercial Policy & Walk-In Parameterization (FND-002, FND-006)**:
  - Dynamically resolved walk-in customer codes in `backend/app/services/customer_discount_policy.py` via system parameter `SMRITI.POS.WALKIN_CUSTOMER_CODE` (defaulting to `"CUST-WALKIN"`).
  - Added optional `couponStackingAllowed` property to `PriceResolutionInput` in `src/utils/pricingDiscountEngine.ts` to allow caller and policy-level coupon stacking governance on a per-transaction basis.
- **Cluster C: Backend Master Registry Presets API (FND-036 to FND-051)**:
  - Implemented `master_lookup_presets.py` containing canonical presets for retail categories (department, designation, bank, payment_mode, expense_category, currency, gst_rate, uom, gender, category, subcategory, product_type, color, size, heel_type, upper_material, outsole_material, collection_type, size_group, color_group, po_cancel_reason, po_cross_vendor_reason).
  - Mounted `@router.get("/lookup/{type_code}/presets")` in `backend/app/api/v1/master_lookup.py`.
  - Upgraded `src/components/global/master/LookupRecommendModal.tsx` to asynchronously fetch recommendations from the server API, falling back gracefully to client presets when offline.

---

## 3. Files Created
1. `backend/app/services/master_lookup_presets.py`: Canonical master registry presets service delivering standardized retail presets.
2. `backend/app/tests/test_phase3_master_registry_and_branding.py`: Dedicated verification test suite covering backend presets endpoint and dynamic walk-in parameterization.
3. `docs/implementation/foundation/Foundation_Phase3_Master_Registry_And_Tenant_Defaults_Plan_v1.0.0.md`: Formal 19-section Implementation Plan per IPGP.
4. `docs/walkthrough/foundation/Foundation_Phase3_Master_Registry_And_Tenant_Defaults_v1.0.0.md`: This comprehensive walkthrough document.

---

## 4. Files Modified
1. `src/components/staff/StaffPrintModal.tsx`
2. `backend/app/services/customer_discount_policy.py`
3. `src/utils/pricingDiscountEngine.ts`
4. `src/tests/pricingDiscountEngine.test.ts`
5. `backend/app/tests/test_customer_discount_policy.py`
6. `backend/app/api/v1/master_lookup.py`
7. `src/components/global/master/LookupRecommendModal.tsx`
8. `docs/implementation/README.md`
9. `docs/walkthrough/README.md`
10. `CHANGELOG.md`

---

## 5. Architecture Decisions
1. **Multi-Tenant Physical Print Isolation (`ADR-051`)**: Physical document generation components (A4 registration sheets, CR-80 PVC identity cards, thermal receipts) must never embed tenant identities, logos, or addresses into static source code.
2. **Authoritative Master Data Registry (`ADR-052`)**: Master lookups and taxonomy suggestions must be served authoritatively by the backend system of record (`/api/v1/masters/lookup/{type_code}/presets`) to prevent catalog drift between clients and server database seeds.
3. **Dynamic Walk-in Policy Parameterization (`ADR-053`)**: Tenant retail counters have different customer code formats for walk-in transactions. Walk-in recognition is governed by `SMRITI.POS.WALKIN_CUSTOMER_CODE` while preserving backward compatibility for `"CUST-WALKIN"`.

---

## 6. Design Rationale
- Hardcoded tenant details in print components lead to data leakage across tenants in multi-tenant SaaS deployments.
- Delivering master lookup presets via the backend API enables enterprise administrators to customize or extend recommendation catalogues centrally without deploying frontend code updates.
- Per-transaction coupon stacking overrides enable POS promotions to flexibly govern whether specific promotions can stack with vouchers.

---

## 7. Implementation Summary
- **Frontend Print Center**: Completely removed `"Tattly Threads"` and Mumbai address literals from `StaffPrintModal.tsx`.
- **Backend Discount Policy**: Integrated `SystemParameterService.resolve_parameter` for `SMRITI.POS.WALKIN_CUSTOMER_CODE`.
- **Pricing Engine**: Added `couponStackingAllowed?: boolean` override in `PriceResolutionInput` and updated `resolveLine`.
- **Lookup Modal**: Added asynchronous API fetch with mounted cleanup in `LookupRecommendModal.tsx`.
- **Master Lookup Router**: Added `/lookup/{type_code}/presets` endpoint returning canonical categories.

---

## 8. Tests Executed
1. **Pytest (45 tests green)**:
   - `backend/app/tests/test_phase3_master_registry_and_branding.py` (6 tests)
   - `backend/app/tests/test_customer_discount_policy.py` (7 tests)
   - `backend/app/tests/test_phase1_operational_hardening.py` (7 tests)
   - `backend/app/tests/test_phase2_operational_defaults.py` (8 tests)
   - `backend/app/tests/test_gst_engine.py` (9 tests)
   - `backend/app/tests/test_max_discount_cap.py` (3 tests)
   - `backend/app/tests/test_negative_stock_policy.py` (5 tests)
2. **Vitest (27 tests green)**:
   - `src/tests/pricingDiscountEngine.test.ts` (6 tests)
   - `src/tests/salesAuditAndFormatters.test.ts` (21 tests)
3. **TypeScript Typecheck**:
   - `npx tsc --noEmit` exited with code 0 (zero errors).

---

## 9. Verification Results
- Zero `"Tattly Threads"` or hardcoded addresses remain in `StaffPrintModal.tsx`.
- `SMRITI.POS.WALKIN_CUSTOMER_CODE` parameter verified in automated test suite.
- Per-request coupon stacking verified with both positive and negative assertions.
- Backend presets endpoint verified across standard categories.

---

## 10. Known Limitations
- Client-side presets file `src/components/global/master/lookupStandardPresets.ts` is retained as an offline fallback bundle when the backend is unreachable.

---

## 11. Future Work
- Support tenant-specific custom preset overrides stored in PostgreSQL `master_lookup_presets` database table.
- Implement Phase 4 advanced operational reporting and analytics hardening.

---

## 12. Related ADRs
- `ADR-048`: Statutory Reference Single-Source Architecture.
- `ADR-051`: Multi-Tenant Seller Identity Strictness.
- `ADR-052`: Master Lookup Presets Backend Authority.
- `ADR-053`: POS Walk-In Code Governance.

---

## 13. Related RFCs
- `RFC-2026-FND-P3`: Phase 3 Master Registry Presets & Tenant Defaults Specification.
