<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.1
  Created      : 2026-10-09
  Modified     : 2026-10-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Canonical Walkthrough Document (WGP)
-->

# Walkthrough: SMRITI Retail OS — Phase 0 P0 Hotfix Remediation & Acceptance

**Version:** `v3.16.1`  
**Area:** Statutory & Commercial Core  
**Classification:** Phase 0 Hotfix & Acceptance Remediation  
**Status:** Completed  

---

## 1. Purpose
This document provides the canonical architectural walkthrough for the Phase 0 P0 commercial and statutory remediations in SMRITI Retail OS, including the resolution of the two post-implementation acceptance blockers:
1. Enforcing PostgreSQL table `states_ref` as the **sole statutory authority** for GST state codes with dynamic synchronization and elimination of duplicate static dictionaries.
2. Complete elimination of silent tax assumptions (`18%` and `0%`) on transactional normalization, replacing them with strict master resolution or explicit statutory rejection (`SMRITI-TAX-001`).

---

## 2. Scope
- **P0-1 Commercial**: Reliance hardcoded discount bypass elimination and delegation to customer group configuration.
- **P0-2 Inventory**: Server-side negative stock parameter governance (`SMRITI.STOCK.ALLOW_NEGATIVE_STOCK`) on the canonical sales posting path.
- **P0-3 Commercial**: Hardcoded 40% maximum discount cap eradication; dynamic system parameter `SMRITI.PRICING.MAX_INVOICE_DISCOUNT_PCT` resolution.
- **P0-4 Statutory**: Elimination of static fallback dictionaries for GST state codes; `states_ref` authority; addition of statutory codes 99, 25, 28, 27.
- **P0-5 Statutory**: Elimination of silent 0% and 18% tax fallbacks; strict transactional tax determination and preview unverified state.
- **Strict Boundary**: Phase 1, Phase 2, and Phase 3 findings were strictly excluded.

---

## 3. Files Created
1. `backend/app/tests/test_customer_discount_policy.py`: Dedicated unit tests for customer group discount policy resolution.
2. `backend/app/tests/test_max_discount_cap.py`: Unit tests for dynamic discount cap resolution and boundary enforcement.
3. `backend/app/tests/test_negative_stock_policy.py`: Unit tests for server-authoritative negative stock policy and real posting-path transaction rollback verification.

---

## 4. Files Modified
1. `backend/app/core/gst_engine.py`: Added `resolve_gst_state_name_from_db` and `load_canonical_gst_state_codes_from_db` strictly querying `states_ref`. Removed static fallback.
2. `backend/app/db/seed_ctrl_ref.py`: Seeded canonical GST state codes 99 (Centre Jurisdiction), 25 (Daman & Diu), 28 (Andhra Pradesh Old).
3. `backend/app/schemas/canonical_posting.py`: Deprecated client-controlled `allow_negative_stock` field; added warning metadata.
4. `backend/app/services/canonical_sales_writer.py`: Replaced client context negative stock check with `SystemParameterService.resolve_parameter`.
5. `backend/app/services/customer_discount_policy.py`: Removed hardcoded Reliance 50% discount override.
6. `backend/app/services/headless_billing.py`: Dynamic resolution and enforcement of `SMRITI.PRICING.MAX_INVOICE_DISCOUNT_PCT`.
7. `backend/app/tests/test_gst_engine.py`: Tests verifying canonical `states_ref` resolution and statutory codes 99, 25, 28, 27.
8. `src/components/SetupWizard/SetupWizardTab.tsx`: Dynamic hydration of Indian states from `fetchCanonicalIndianStates()`.
9. `src/constants/indianStates.ts`: Removed static `INDIAN_STATES` array; implemented `fetchCanonicalIndianStates()` querying `/control/reference/states` with memory caching.
10. `src/types.ts`: Added optional `taxDeterminationStatus?: "RESOLVED" | "UNRESOLVED"` to `SalesItemLine`.
11. `src/utils/normalizeSales.ts`: Implemented `resolveItemGstRate` enforcing strict tax determination, throwing `SMRITI-TAX-001` on unresolvable tax in transactional paths, and preventing silent 0% / 18% assumptions.
12. `src/utils/pricingDiscountEngine.ts`: Replaced hardcoded 40% discount ceiling with dynamic parameter resolution.
13. `src/tests/pricingDiscountEngine.test.ts`: Vitest suite covering dynamic discount caps.
14. `src/tests/salesAuditAndFormatters.test.ts`: Vitest suite covering all 8 mandatory tax rate normalization conditions.

---

## 5. Architecture Decisions
1. **Single Statutory Source of Truth for Indian States (`ADR-048`)**: PostgreSQL table `states_ref` is the sole source of truth. All frontend and backend consumers obtain state lists and codes from this table. Fallbacks to static dictionaries are strictly prohibited.
2. **Zero-Assumption Statutory Tax Determination (`ADR-049`)**: Transactional normalization must never guess tax rates. An item missing tax must either be resolved through master data architecture or rejected with `SMRITI-TAX-001`.
3. **Server-Authoritative Negative Stock Policy (`ADR-050`)**: POS terminals cannot declare their own stock policy. Negative inventory posting is gated exclusively by `SMRITI.STOCK.ALLOW_NEGATIVE_STOCK` in `system_parameters`.

---

## 6. Design Rationale
- Guessing statutory tax rates creates serious tax compliance and invoice liability risks. An item with missing tax must never become an exempt 0% transaction without master data proof.
- Maintaining separate static state dictionaries in frontend and backend code inevitably leads to catalog drift and tax misallocations.

---

## 7. Implementation Summary
- **Backend**: Implemented `resolve_gst_state_name_from_db` requiring an active session. Updated `CanonicalSalesPostingWriter` to query `SystemParameterService`. Enforced `SMRITI.PRICING.MAX_INVOICE_DISCOUNT_PCT` in `HeadlessBillingCore`.
- **Frontend**: Overhauled `normalizeSales.ts` with `TaxResolutionOptions` supporting `transactional`, `posting`, `preview`, and `draft` modes. Populated `SetupWizardTab` state dropdown dynamically from `apiFetchV1`.

---

## 8. Tests Executed
1. **Pytest (24 tests green)**:
   - `backend/app/tests/test_gst_engine.py` (9 tests)
   - `backend/app/tests/test_customer_discount_policy.py` (7 tests)
   - `backend/app/tests/test_max_discount_cap.py` (3 tests)
   - `backend/app/tests/test_negative_stock_policy.py` (5 tests)
2. **Vitest (25 tests green)**:
   - `src/tests/pricingDiscountEngine.test.ts` (4 tests)
   - `src/tests/salesAuditAndFormatters.test.ts` (21 tests)
3. **TypeScript Typecheck**:
   - `npx tsc --noEmit` exited 0 with 0 errors.

---

## 9. Verification Results
- All 5 P0 findings verified with direct code diffs, terminal outputs, and zero regressions.
- No silent 18% or 0% fallback paths remain.
- Posting path rollback verified under negative stock condition.

---

## 10. Known Limitations
- Untouched P1 finding `P1-7` (`src/constants/indianLocationData.ts`) remains in codebase and is scheduled for Phase 1 remediation.

---

## 11. Future Work
- Execute Phase 1: High-Priority Operational & Identity Configuration Hardening.
- Migrate `indianLocationData.ts` and customer mailing dialogues to canonical `states_ref` API.

---

## 12. Related ADRs
- `ADR-042`: SMRITI Canonical Parameter Namespace.
- `ADR-048`: Statutory Reference Single-Source Architecture.
- `ADR-049`: Transactional Tax Non-Assumption Policy.
- `ADR-050`: Central Stock Policy Enforcement.

---

## 13. Related RFCs
- `RFC-2026-P0-HOTFIX`: Phase 0 Commercial & Statutory Hotfix Specification.
